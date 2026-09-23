import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActionGrid } from '../../src/components/gym-detail/ActionGrid';
import { BusyHoursChart } from '../../src/components/gym-detail/BusyHoursChart';
import { CheckInModal } from '../../src/components/checkin/CheckInModal';
import { CheckInSummaryCard } from '../../src/components/gym-detail/CheckInSummaryCard';
import { ChipRow } from '../../src/components/gym-detail/ChipRow';
import { FaceOfGymCard } from '../../src/components/gym-detail/FaceOfGymCard';
import { GymHeroSection } from '../../src/components/gym-detail/GymHeroSection';
import { ManagePricingModal } from '../../src/components/gym-detail/ManagePricingModal';
import { PricingSection } from '../../src/components/gym-detail/PricingSection';
import { ReviewsList } from '../../src/components/gym-detail/ReviewsList';
import { ScoreCard } from '../../src/components/gym-detail/ScoreCard';
import { ManageMembersCard } from '../../src/components/gym-detail/ManageMembersCard';
import { MembershipReminderBanner } from '../../src/components/gym-detail/MembershipReminderBanner';
import { MyMembershipCard } from '../../src/components/gym-detail/MyMembershipCard';
import { StaffRequestsSection } from '../../src/components/gym-detail/StaffRequestsSection';
import { TeamSection } from '../../src/components/gym-detail/TeamSection';
import { WriteReviewModal } from '../../src/components/gym-detail/WriteReviewModal';
import { GymPickerModal } from '../../src/components/compare/GymPickerModal';
import { useAuth } from '../../src/context/auth-context';
import {
  confirmLeaveGym,
  confirmRemoveTeamMember,
  confirmUnfollow,
} from '../../src/lib/confirmations';
import { fetchLatestValidCheckIn, type LatestValidCheckIn } from '../../src/lib/checkin';
import {
  fetchAmenities,
  fetchBusyHours,
  fetchCheckInSummary,
  fetchEquipment,
  fetchGymDetail,
  fetchIsEligibleVisitor,
  fetchIsFollowing,
  fetchIsGymAdmin,
  fetchReviews,
  fetchTeam,
  requestJoinAsMember,
  toggleFollow,
} from '../../src/lib/gymDetail';
import { useTodayCheckInState } from '../../src/hooks/useTodayCheckInState';
import { fetchGymPricingPlans } from '../../src/lib/gymPricing';
import { fetchMyMemberships } from '../../src/lib/memberships';
import {
  fetchCooldownRemainingSeconds,
  fetchMyStaffStatus,
  canLeaveGym,
  fetchTrainerProfile,
  leaveGym,
  removeStaffMember,
  type MyStaffStatus,
} from '../../src/lib/trainer';
import {
  alertTrainerCooldown,
  confirmTrainerRequest,
  promptCreateTrainerProfile,
  sendTrainerRequest,
} from '../../src/lib/trainerRequestFlow';
import { colors, radius, spacing } from '../../src/theme';
import type {
  BusyHour,
  CheckInSummary,
  GymDetail,
  GymPricingPlan,
  GymReview,
  LocationOption,
  MyMembership,
  TeamMember,
} from '../../src/types/database';

export default function GymDetailScreen() {
  const { id, highlight } = useLocalSearchParams<{ id: string; highlight?: string }>();
  const gymId = Number(id);
  const { session } = useAuth();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  // ScrollView's own inner content View ref - measureLayout on the New
  // Architecture requires a real host-component ref here, not the numeric
  // handle findNodeHandle(scrollViewRef.current) used to produce (that's
  // the deprecated old-architecture form and just logs a warning now).
  const scrollContentRef = useRef<View>(null);
  const reviewsWrapperRef = useRef<View>(null);
  const hasScrolledToReviewsRef = useRef(false);
  const [isReviewsHighlighted, setIsReviewsHighlighted] = useState(false);

  const [gym, setGym] = useState<GymDetail | null>(null);
  const [equipment, setEquipment] = useState<LocationOption[]>([]);
  const [amenities, setAmenities] = useState<LocationOption[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [reviews, setReviews] = useState<GymReview[]>([]);
  const [pricingPlans, setPricingPlans] = useState<GymPricingPlan[]>([]);
  const [isEligible, setIsEligible] = useState(false);
  const [isGymAdmin, setIsGymAdmin] = useState(false);
  // The caller's own gym_staff row for this gym (any role/status), driving the
  // trainer button: Join / pending / active / declined.
  const [myStaffStatus, setMyStaffStatus] = useState<MyStaffStatus | null>(null);
  // Anyone with an ACTIVE staff row here, whatever the role (owner, admin,
  // manager, staff, trainer). Pending/rejected/removed don't count.
  // The caller's OWN membership at this gym (private plan + end date, resolved
  // server-side): drives the join button and the "Your membership" card.
  const [myMembership, setMyMembership] = useState<MyMembership | null>(null);
  const isGymStaff = myStaffStatus?.status === 'active';
  // Only an active owner/admin gets team-management controls (the server
  // enforces who may remove whom regardless).
  const viewerRole: 'owner' | 'admin' | null =
    isGymStaff && (myStaffStatus?.role === 'owner' || myStaffStatus?.role === 'admin')
      ? myStaffStatus.role
      : null;
  // Derived from the team list this page already loads (get_gym_team returns
  // every ACTIVE member with their role): is there an owner other than me? A
  // sole owner isn't offered "Leave this gym" - it could only ever fail.
  const hasOtherActiveOwner = team.some(
    (member) => member.role === 'owner' && member.userId !== session?.user.id
  );
  const canLeave =
    isGymStaff && myStaffStatus !== null && canLeaveGym(myStaffStatus.role, hasOtherActiveOwner);
  const [busyHours, setBusyHours] = useState<BusyHour[] | null>(null);
  const [checkInSummary, setCheckInSummary] = useState<CheckInSummary | null>(null);
  // checkin_to_gym enforces once-per-day GLOBALLY (any valid check-in today,
  // at any gym, blocks a new one) - useTodayCheckInState compares its gymId
  // against THIS gym so the button never claims a check-in happened here
  // when it actually happened at a different gym.
  const [latestValidCheckIn, setLatestValidCheckIn] = useState<LatestValidCheckIn | null>(null);
  const todayCheckInState = useTodayCheckInState(latestValidCheckIn, gymId);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckInModalVisible, setIsCheckInModalVisible] = useState(false);
  const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
  const [isPricingModalVisible, setIsPricingModalVisible] = useState(false);
  const [isComparePickerVisible, setIsComparePickerVisible] = useState(false);
  // Bumped after every load so the self-fetching pending-requests list
  // (admins only) refreshes with pull-to-refresh, like the profile album.
  const [requestsRefreshToken, setRequestsRefreshToken] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [gymData, equipmentData, amenitiesData, teamData, reviewsData, pricingData] =
        await Promise.all([
          fetchGymDetail(gymId),
          fetchEquipment(gymId),
          fetchAmenities(gymId),
          fetchTeam(gymId),
          fetchReviews(gymId),
          fetchGymPricingPlans(gymId),
        ]);

      setGym(gymData);
      setEquipment(equipmentData);
      setAmenities(amenitiesData);
      setTeam(teamData);
      setReviews(reviewsData);
      setPricingPlans(pricingData);

      if (session) {
        const [eligible, following, gymAdmin, staffStatus, membership, lastValidCheckIn] =
          await Promise.all([
            fetchIsEligibleVisitor(gymId, session.user.id),
            fetchIsFollowing(gymId, session.user.id),
            fetchIsGymAdmin(gymId, session.user.id),
            // Fetched here (not only on focus) so it's known before the action
            // grid first renders - team members must never see the review/member
            // buttons flash up. A failed lookup falls back to "no relationship";
            // the reviews policy enforces the rule server-side regardless.
            fetchMyStaffStatus(gymId, session.user.id).catch(() => null),
            // Best-effort: on failure the page just shows no membership card.
            fetchMyMemberships(gymId)
              .then((rows) => rows[0] ?? null)
              .catch(() => null),
            fetchLatestValidCheckIn(session.user.id),
          ]);
        setMyStaffStatus(staffStatus);
        setMyMembership(membership);
        setLatestValidCheckIn(lastValidCheckIn);
        console.log('[gym-detail] eligibility check', {
          gymId,
          userId: session.user.id,
          eligible,
        });
        setIsEligible(eligible);
        setIsFollowing(following);
        setIsGymAdmin(gymAdmin);

        if (eligible) {
          const [hours, summary] = await Promise.all([
            fetchBusyHours(gymId),
            fetchCheckInSummary(gymId, session.user.id),
          ]);
          console.log('[gym-detail] busy hours + check-in summary', {
            hours,
            summary,
          });
          setBusyHours(hours);
          setCheckInSummary(summary);
        }
      } else {
        setIsEligible(false);
        setIsFollowing(false);
        setIsGymAdmin(false);
        setMyStaffStatus(null);
        setMyMembership(null);
        setBusyHours(null);
        setCheckInSummary(null);
        setLatestValidCheckIn(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this gym.');
    }
    setIsLoading(false);
    setRequestsRefreshToken((token) => token + 1);
  }, [gymId, session]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isLoading) return;
    if (highlight !== 'reviews') return;
    if (hasScrolledToReviewsRef.current) return;

    // Defer a tick so the ScrollView content (reviews included) has actually
    // laid out before we measure - isLoading flipping false and the layout
    // pass completing aren't guaranteed to land in the same frame.
    const scrollTimeout = setTimeout(() => {
      if (!scrollContentRef.current || !reviewsWrapperRef.current) return;
      hasScrolledToReviewsRef.current = true;
      reviewsWrapperRef.current.measureLayout(
        scrollContentRef.current,
        (_x, y) => {
          scrollViewRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
        },
        () => {}
      );
      setIsReviewsHighlighted(true);
    }, 50);

    return () => clearTimeout(scrollTimeout);
  }, [isLoading, highlight]);

  useEffect(() => {
    if (!isReviewsHighlighted) return;
    const timeout = setTimeout(() => setIsReviewsHighlighted(false), 2500);
    return () => clearTimeout(timeout);
  }, [isReviewsHighlighted]);

  const refreshMyStaffStatus = useCallback(async () => {
    if (!session) {
      setMyStaffStatus(null);
      return;
    }
    try {
      setMyStaffStatus(await fetchMyStaffStatus(gymId, session.user.id));
    } catch {
      // Best-effort: on failure keep whatever we last knew rather than
      // flashing the button back to "Join as Trainer".
    }
  }, [gymId, session]);

  const refreshMyMembership = useCallback(async () => {
    if (!session) {
      setMyMembership(null);
      return;
    }
    try {
      const rows = await fetchMyMemberships(gymId);
      setMyMembership(rows[0] ?? null);
    } catch {
      // Best-effort: keep whatever we last knew.
    }
  }, [gymId, session]);

  // Re-reads the status every time this screen is focused AGAIN - that's what
  // updates the buttons after sending a request from the trainer profile
  // screen and coming back, which a load-on-mount effect would miss. The very
  // first focus is skipped: load() already fetched it.
  const hasHadFirstFocusRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasHadFirstFocusRef.current) {
        hasHadFirstFocusRef.current = true;
        return;
      }
      refreshMyStaffStatus();
      // A membership renewal or approval is recorded by the gym while this
      // screen is elsewhere - re-read so the card/button never go stale.
      refreshMyMembership();
    }, [refreshMyStaffStatus, refreshMyMembership])
  );

  // While a cooldown is running, re-render every so often so the "Retry in
  // 47h" label counts down and flips to "Request again" on its own.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const retryAt = myStaffStatus?.retryAt;
    if (!retryAt || retryAt <= Date.now()) return;

    const interval = setInterval(() => {
      setClockTick((tick) => tick + 1);
      if (Date.now() >= retryAt) clearInterval(interval);
    }, 30_000);
    return () => clearInterval(interval);
  }, [myStaffStatus]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([load(), refreshMyStaffStatus(), refreshMyMembership()]);
    setIsRefreshing(false);
  }, [load, refreshMyStaffStatus, refreshMyMembership]);

  async function handleFollow() {
    if (!session) return;

    if (isFollowing) {
      confirmUnfollow(gym?.name ?? 'this gym', async () => {
        setIsFollowing(false);
        try {
          await toggleFollow(gymId, session.user.id, true);
        } catch (err) {
          setIsFollowing(true);
          Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
        }
      });
      return;
    }

    setIsFollowing(true);
    try {
      await toggleFollow(gymId, session.user.id, false);
    } catch (err) {
      setIsFollowing(false);
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  async function handleJoinAsMember() {
    // Hidden for team members (UI only - unlike reviews there's no integrity
    // rule behind it, so the members table doesn't enforce this).
    if (!session || isGymStaff) return;
    try {
      const result = await requestJoinAsMember(gymId, session.user.id);
      if (result.kind === 'success') {
        Alert.alert(
          'Request sent',
          "Your request to join as a member has been submitted. The gym will confirm your plan when it approves you."
        );
      } else if (result.kind === 'duplicate') {
        Alert.alert('Already requested', result.message);
      } else {
        Alert.alert('Something went wrong', result.message);
      }
      // Re-read the real row so the button flips to "Request pending" (or
      // whatever the server says) instead of offering "Join" again.
      refreshMyMembership();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  // Open to anyone (not just members). The server only accepts adult users
  // with an existing trainer profile requesting the 'trainer' role. Either
  // way, every prompt names this gym, and nothing is submitted without an
  // explicit confirmation. Without a profile yet, the user is routed to create
  // one WITH this gym carried along (applyGymId), so that screen keeps saying
  // which gym the request is for.
  async function handleJoinAsTrainer() {
    if (!session || !gym) return;
    // The button is disabled for pending/active/suspended/removed-by-the-gym;
    // only "no row yet", "declined" and "left on my own" (all may request)
    // should ever reach the flow below.
    const canRequest =
      !myStaffStatus ||
      myStaffStatus.status === 'rejected' ||
      (myStaffStatus.status === 'removed' && myStaffStatus.removedBySelf);
    if (!canRequest) return;
    const userId = session.user.id;

    const goCreateProfile = () =>
      router.push({
        pathname: '/trainer/[id]',
        params: { id: userId, edit: '1', applyGymId: String(gymId) },
      });

    try {
      // Declined before: ask the server (not the possibly-stale label) whether
      // the waiting period is over, and say how long is left if not. The DB
      // enforces this regardless - this is just the clear message.
      if (myStaffStatus?.status === 'rejected') {
        const remaining = await fetchCooldownRemainingSeconds(gymId).catch(() => null);
        if (remaining !== null && remaining > 0) {
          alertTrainerCooldown(gym.name, remaining);
          refreshMyStaffStatus();
          return;
        }
      }

      const profile = await fetchTrainerProfile(userId);
      if (!profile) {
        promptCreateTrainerProfile(gym.name, goCreateProfile);
        return;
      }

      confirmTrainerRequest(
        gym.name,
        () => {
          sendTrainerRequest({
            gymId,
            gymName: gym.name,
            userId,
            onNeedsProfile: () => promptCreateTrainerProfile(gym.name, goCreateProfile),
          }).then((settled) => {
            // Re-read the real row instead of assuming: also covers "already
            // pending" (the duplicate path), where nothing new was inserted.
            if (settled) refreshMyStaffStatus();
          });
        },
        { previouslyDeclined: myStaffStatus?.status === 'rejected' }
      );
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  // Owner/admin removing someone from the team. The RPC enforces who may
  // remove whom and marks the row 'removed' (kept as history); reload so the
  // Team list reflects it straight away.
  function handleRemoveMember(member: TeamMember) {
    if (!gym) return;
    confirmRemoveTeamMember(member.displayName, member.role, gym.name, async () => {
      const result = await removeStaffMember(member.id);
      if (result.kind === 'error') {
        Alert.alert("Couldn't remove them", result.message);
      }
      // Reload either way - on "already removed" the row should disappear too.
      await load();
    });
  }

  // A team member leaving. Reloading re-reads their own status, which flips
  // the page to the "you left" state (and drops any owner/admin controls).
  function handleLeaveGym() {
    // The link is only rendered when canLeave; this keeps a stale press (or a
    // future caller) from opening a confirmation for something that can't work.
    if (!gym || !myStaffStatus || !canLeave) return;
    const gymName = gym.name;
    confirmLeaveGym(gymName, myStaffStatus.role, async () => {
      const result = await leaveGym(gymId);
      if (result.kind === 'error') {
        Alert.alert("Couldn't leave", result.message);
        return;
      }
      await load();
      Alert.alert(`You left ${gymName}`, 'You can see this in your gym history on your trainer profile.');
    });
  }

  function handleWriteReview() {
    // The button is hidden for team members, and the reviews policy rejects
    // their inserts server-side; this just keeps the modal from ever opening.
    if (isGymStaff) return;
    setIsReviewModalVisible(true);
  }

  function handleReviewSubmitted() {
    load();
  }

  function handleCheckIn() {
    setIsCheckInModalVisible(true);
  }

  function handleCheckInSuccess() {
    load();
  }

  function handlePricingSaved() {
    load();
  }

  function handleCompareGymSelected(otherGymId: number) {
    setIsComparePickerVisible(false);
    router.push({
      pathname: '/compare/[gymAId]/[gymBId]',
      params: { gymAId: String(gymId), gymBId: String(otherGymId) },
    });
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Gym details' }} />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (error || !gym) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Gym details' }} />
        <Text style={styles.error}>{error ?? 'Gym not found.'}</Text>
      </View>
    );
  }

  const locationText = [gym.city, gym.state].filter(Boolean).join(', ') || null;

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        // Bundled RN type declares this as RefObject<View> (non-nullable),
        // but the actual prop (and useRef's own return type) allow a null
        // current until mount - the cast just bridges that stale .d.ts gap.
        innerViewRef={scrollContentRef as RefObject<View>}
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.emerald}
          />
        }
      >
        <Stack.Screen options={{ title: gym.name }} />
        <GymHeroSection
          photoUrl={gym.photoUrl}
          name={gym.name}
          category={gym.category}
          locationText={locationText}
        />

        <View style={styles.body}>
          {/* Dismissible renewal reminder, only while inside the plan's window. */}
          {myMembership ? <MembershipReminderBanner membership={myMembership} /> : null}

          <ScoreCard avgRating={gym.avgRating} reviewCount={gym.reviewCount} />

          <ActionGrid
            isFollowing={isFollowing}
            myStaffStatus={myStaffStatus}
            memberState={myMembership?.state ?? null}
            isGymStaff={isGymStaff}
            onWriteReview={handleWriteReview}
            onFollow={handleFollow}
            onJoinAsMember={handleJoinAsMember}
            onJoinAsTrainer={handleJoinAsTrainer}
            canLeave={canLeave}
            onLeave={handleLeaveGym}
            todayCheckInState={todayCheckInState}
            onCheckIn={handleCheckIn}
            onCompare={() => setIsComparePickerVisible(true)}
          />

          {/* Private to this member: plan + end date, or "Membership ended -
              renew at the gym" once it has lapsed. */}
          {myMembership ? <MyMembershipCard membership={myMembership} /> : null}

          {/* Owners/admins: the Members screen (plans, renewals, requests). */}
          {isGymAdmin ? <ManageMembersCard gymId={gymId} /> : null}

          {isEligible && busyHours ? <BusyHoursChart hours={busyHours} /> : null}
          {isEligible && checkInSummary ? <CheckInSummaryCard summary={checkInSummary} scope="gym" /> : null}

          <PricingSection
            plans={pricingPlans}
            isGymAdmin={isGymAdmin}
            onEditPress={() => setIsPricingModalVisible(true)}
          />

          <ChipRow title="Equipment" items={equipment} variant="equipment" />
          <ChipRow title="Amenities" items={amenities} variant="amenity" />

          {isGymAdmin && session ? (
            <StaffRequestsSection
              gymId={gymId}
              adminUserId={session.user.id}
              refreshToken={requestsRefreshToken}
              onChanged={load}
            />
          ) : null}

          <TeamSection
            team={team}
            viewerUserId={session?.user.id ?? null}
            viewerRole={viewerRole}
            onRemoveMember={handleRemoveMember}
          />

          <FaceOfGymCard gymId={gymId} />

          <View
            ref={reviewsWrapperRef}
            style={[styles.reviewsWrapper, isReviewsHighlighted && styles.reviewsWrapperHighlighted]}
          >
            <ReviewsList reviews={reviews} />
          </View>
        </View>
      </ScrollView>

      <CheckInModal
        visible={isCheckInModalVisible}
        gymId={gymId}
        gymName={gym.name}
        onClose={() => setIsCheckInModalVisible(false)}
        onSuccess={handleCheckInSuccess}
      />

      {session ? (
        <WriteReviewModal
          visible={isReviewModalVisible}
          gymId={gymId}
          locationId={gym.locationId}
          userId={session.user.id}
          onClose={() => setIsReviewModalVisible(false)}
          onSubmitted={handleReviewSubmitted}
        />
      ) : null}

      {isGymAdmin ? (
        <ManagePricingModal
          visible={isPricingModalVisible}
          gymId={gymId}
          plans={pricingPlans}
          onClose={() => setIsPricingModalVisible(false)}
          onSaved={handlePricingSaved}
        />
      ) : null}

      <GymPickerModal
        visible={isComparePickerVisible}
        excludeGymId={gymId}
        defaultCityName={gym.city}
        onClose={() => setIsComparePickerVisible(false)}
        onSelect={(otherGym) => handleCompareGymSelected(otherGym.id)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  reviewsWrapper: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: spacing.sm,
    margin: -8,
  },
  reviewsWrapperHighlighted: {
    borderColor: colors.emerald,
    backgroundColor: colors.emeraldTint,
  },
});
