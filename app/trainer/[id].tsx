import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GuestAuthButtons } from '../../src/components/auth/GuestAuthButtons';
import { AddCertificationModal } from '../../src/components/trainer/AddCertificationModal';
import { AvailabilitySection } from '../../src/components/trainer/AvailabilitySection';
import { BookSessionModal } from '../../src/components/trainer/BookSessionModal';
import { CertificationsSection } from '../../src/components/trainer/CertificationsSection';
import { EditTrainerProfileModal } from '../../src/components/trainer/EditTrainerProfileModal';
import { useAuth } from '../../src/context/auth-context';
import { confirmLeaveGym } from '../../src/lib/confirmations';
import { getOrCreateMessageThread } from '../../src/lib/messages';
import { checkCanBookSessions } from '../../src/lib/sessions';
import { formatShortDate } from '../../src/lib/time';
import {
  deleteTrainerCertification,
  fetchCertificatePhotoUrls,
  fetchGymName,
  fetchMyGymHistory,
  fetchTrainerAffiliations,
  fetchTrainerCertifications,
  fetchTrainerProfile,
  leaveGym,
} from '../../src/lib/trainer';
import { confirmTrainerRequest, sendTrainerRequest } from '../../src/lib/trainerRequestFlow';
import { fetchPublicProfile } from '../../src/lib/userFollows';
import { colors, fontSize, radius, spacing } from '../../src/theme';
import type {
  MyGymHistoryItem,
  PublicProfile,
  TrainerAffiliation,
  TrainerCertification,
  TrainerProfile,
} from '../../src/types/database';

function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export default function TrainerProfileScreen() {
  // Coming from a gym's "Join as Trainer" with no trainer profile yet, the
  // user lands here with `edit=1` (open the editor once, right after load) and
  // `applyGymId` (which gym the request is for - shown throughout so this never
  // reads as a generic, gym-less prompt). Opened from the Profile tab instead,
  // neither is set and it's the plain trainer profile.
  const { id, edit, applyGymId } = useLocalSearchParams<{
    id: string;
    edit?: string;
    applyGymId?: string;
  }>();
  const trainerUserId = id;
  const parsedApplyGymId = applyGymId ? Number(applyGymId) : NaN;
  const applyGymIdNumber =
    Number.isInteger(parsedApplyGymId) && parsedApplyGymId > 0 ? parsedApplyGymId : null;
  const { session } = useAuth();
  const router = useRouter();
  const hasAutoOpenedEditorRef = useRef(false);

  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [certifications, setCertifications] = useState<TrainerCertification[]>([]);
  const [certificatePhotoUrls, setCertificatePhotoUrls] = useState<Record<string, string>>({});
  const [affiliations, setAffiliations] = useState<TrainerAffiliation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Which contact button is waiting on the thread lookup - both are disabled
  // meanwhile, the spinner shows on the one that was tapped.
  const [pendingContact, setPendingContact] = useState<'message' | 'book' | null>(null);
  const [isBookingVisible, setIsBookingVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAddCertificationVisible, setIsAddCertificationVisible] = useState(false);
  // Your own non-active gym rows (pending / declined / left / removed) - own
  // profile only. This is how someone finds out they were removed.
  const [history, setHistory] = useState<MyGymHistoryItem[]>([]);
  const [applyGym, setApplyGym] = useState<{ id: number; name: string } | null>(null);
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  const isOwnProfile = session?.user.id === trainerUserId;

  const loadCertifications = useCallback(async () => {
    const certs = await fetchTrainerCertifications(trainerUserId);
    const paths = certs.flatMap((cert) => (cert.photoPath ? [cert.photoPath] : []));
    setCertifications(certs);
    setCertificatePhotoUrls(await fetchCertificatePhotoUrls(paths));
  }, [trainerUserId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [profileData, trainerData, affiliationData, applyGymName, historyData] = await Promise.all([
        // get_public_profile is only granted to signed-in users; a guest still
        // sees the trainer's public trainer data, just without a name/avatar.
        session ? fetchPublicProfile(trainerUserId) : Promise.resolve(null),
        fetchTrainerProfile(trainerUserId),
        fetchTrainerAffiliations(trainerUserId),
        // Only ever meaningful on your own profile; a gym you can't see just
        // drops the "applying to" context rather than failing the screen.
        isOwnProfile && applyGymIdNumber !== null
          ? fetchGymName(applyGymIdNumber).catch(() => null)
          : Promise.resolve(null),
        // Best-effort: a failed history lookup shouldn't blank the profile.
        isOwnProfile
          ? fetchMyGymHistory(trainerUserId).catch(() => [] as MyGymHistoryItem[])
          : Promise.resolve([] as MyGymHistoryItem[]),
      ]);
      setPublicProfile(profileData);
      setTrainer(trainerData);
      setAffiliations(affiliationData);
      setHistory(historyData);
      setApplyGym(
        applyGymName !== null && applyGymIdNumber !== null
          ? { id: applyGymIdNumber, name: applyGymName }
          : null
      );
      if (trainerData) {
        await loadCertifications();
      } else {
        setCertifications([]);
        setCertificatePhotoUrls({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this trainer profile.');
    }
    setIsLoading(false);
  }, [trainerUserId, session, loadCertifications, isOwnProfile, applyGymIdNumber]);

  useEffect(() => {
    load();
  }, [load]);

  // Your own gym affiliations can change while you're elsewhere in the app
  // (an owner removes you, you leave from a gym page) and there are no push
  // notifications - so re-read them whenever this screen comes back into view,
  // rather than leaving it silently stale. The first focus is skipped: the
  // effect above already loaded.
  const hasHadFirstFocusRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasHadFirstFocusRef.current) {
        hasHadFirstFocusRef.current = true;
        return;
      }
      if (isOwnProfile) load();
    }, [isOwnProfile, load])
  );

  useEffect(() => {
    if (isLoading || hasAutoOpenedEditorRef.current) return;
    if (edit === '1' && isOwnProfile) {
      hasAutoOpenedEditorRef.current = true;
      setIsEditModalVisible(true);
    }
  }, [isLoading, edit, isOwnProfile]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const displayName = publicProfile?.fullName || publicProfile?.username || 'GymTrust trainer';
  const photoUrl = trainer?.photoUrl ?? publicProfile?.avatarUrl ?? null;

  // Same contact path as the public profile screen - server-side
  // (trg_enforce_message_thread_rules) is what actually gates who can message.
  // Book a Session is gated the same way: guests go to Log in, and a signed-in
  // minor gets the same kind of "adults only" alert messaging shows
  // (request_trainer_session re-checks is_adult server-side).
  async function handleContactPress(kind: 'message' | 'book') {
    if (!session) {
      router.push('/login');
      return;
    }
    setPendingContact(kind);
    if (kind === 'book') {
      try {
        const eligibility = await checkCanBookSessions(session.user.id);
        if (eligibility.kind === 'success') {
          setIsBookingVisible(true);
        } else if (eligibility.kind === 'ineligible') {
          Alert.alert("Can't book", eligibility.message);
        } else {
          Alert.alert('Something went wrong', eligibility.message);
        }
      } finally {
        setPendingContact(null);
      }
      return;
    }
    try {
      const result = await getOrCreateMessageThread(session.user.id, trainerUserId);
      if (result.kind === 'success') {
        router.push({
          pathname: '/messages/[threadId]',
          params: { threadId: String(result.threadId) },
        });
      } else if (result.kind === 'ineligible') {
        Alert.alert("Can't message", result.message);
      } else {
        Alert.alert('Something went wrong', result.message);
      }
    } finally {
      setPendingContact(null);
    }
  }

  // No web profile page exists yet, so this shares the app's deep link
  // (gymrank://trainer/<id>), which opens this screen for anyone with the app.
  async function handleShare() {
    const url = Linking.createURL(`/trainer/${trainerUserId}`);
    try {
      await Share.share({ message: `${displayName} on GymTrust: ${url}`, url });
    } catch (err) {
      Alert.alert("Couldn't share", err instanceof Error ? err.message : 'Please try again.');
    }
  }

  // Confirmation always names the gym; the request only goes out on "Send".
  function handleSendRequest() {
    if (!session || !applyGym) return;
    const gym = applyGym;
    const userId = session.user.id;

    confirmTrainerRequest(gym.name, async () => {
      setIsSendingRequest(true);
      const settled = await sendTrainerRequest({
        gymId: gym.id,
        gymName: gym.name,
        userId,
        onNeedsProfile: () => setIsEditModalVisible(true),
      });
      setIsSendingRequest(false);
      if (settled) setApplyGym(null);
    });
  }

  // Leaving a gym you train at. The RPC only ever touches your own row; the
  // row is marked 'removed' (kept as history), and reloading moves the gym from
  // "Trains at" into "Gym history" with the date.
  function handleLeave(affiliation: TrainerAffiliation) {
    confirmLeaveGym(affiliation.gymName, 'trainer', async () => {
      const result = await leaveGym(affiliation.gymId);
      if (result.kind === 'error') {
        Alert.alert("Couldn't leave", result.message);
        return;
      }
      await load();
    });
  }

  async function handleDeleteCertification(certification: TrainerCertification) {
    try {
      await deleteTrainerCertification(certification);
      await loadCertifications();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
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
        <Stack.Screen options={{ title: displayName }} />

        {isOwnProfile && applyGym ? (
          <View style={[styles.applyCard, styles.applyCardTop]}>
            <View style={styles.applyHeader}>
              <Feather name="map-pin" size={14} color={colors.emeraldLight} />
              <Text style={styles.applyLabel}>Trainer request</Text>
            </View>
            <Text style={styles.applyTitle}>Request to join {applyGym.name} as a trainer</Text>
            <Text style={styles.applyText}>
              {trainer
                ? `Your trainer profile is ready. Nothing is sent to ${applyGym.name} until you confirm.`
                : `Step 1: create your trainer profile. Step 2: confirm your request to ${applyGym.name}. Nothing is sent until you confirm.`}
            </Text>
            <Pressable
              style={styles.applyButton}
              onPress={trainer ? handleSendRequest : () => setIsEditModalVisible(true)}
              disabled={isSendingRequest}
            >
              {isSendingRequest ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.applyButtonText}>
                  {trainer ? `Request to join ${applyGym.name}` : 'Create trainer profile'}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, styles.heroFallback]}>
            <Text style={styles.heroFallbackText}>{initials(displayName)}</Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.identity}>
            <Text style={styles.name}>{displayName}</Text>
            {publicProfile?.username ? (
              <Text style={styles.username}>@{publicProfile.username}</Text>
            ) : null}
          </View>

          {trainer ? (
            <>
              <View style={styles.badgeRow}>
                <View style={styles.trainerBadge}>
                  <Feather name="award" size={12} color={colors.emeraldLight} />
                  <Text style={styles.trainerBadgeText}>Trainer</Text>
                </View>
                {trainer.yearsExperience != null ? (
                  <View style={styles.experienceBadge}>
                    <Feather name="clock" size={12} color={colors.textMuted} />
                    <Text style={styles.experienceBadgeText}>
                      {trainer.yearsExperience} {trainer.yearsExperience === 1 ? 'yr' : 'yrs'} experience
                    </Text>
                  </View>
                ) : null}
              </View>

              {trainer.specialties.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Specializations</Text>
                  <View style={styles.chipRow}>
                    {trainer.specialties.map((specialty) => (
                      <View key={specialty} style={styles.chip}>
                        <Feather name="activity" size={13} color={colors.emeraldLight} />
                        <Text style={styles.chipText}>{specialty}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {trainer.bio ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About</Text>
                  <Text style={styles.bio}>{trainer.bio}</Text>
                </View>
              ) : null}
            </>
          ) : isOwnProfile ? (
            // The generic pitch only makes sense with no gym in play - when
            // applying to one, the request card above already says exactly what
            // this is for.
            applyGym ? null : (
              <View style={styles.ctaCard}>
                <Text style={styles.ctaTitle}>Become a trainer on GymTrust</Text>
                <Text style={styles.ctaText}>
                  Create a trainer profile to show your specialties and certifications, and to request
                  to join a gym as a trainer. You must be 18 or over.
                </Text>
              </View>
            )
          ) : (
            <Text style={styles.emptyText}>This user hasn&apos;t set up a trainer profile yet.</Text>
          )}

          <View style={styles.actionRow}>
            {isOwnProfile ? (
              <Pressable
                style={[styles.primaryButton, styles.actionButton]}
                onPress={() => setIsEditModalVisible(true)}
              >
                <Feather name="edit-2" size={16} color={colors.white} />
                <Text style={styles.primaryButtonText}>
                  {trainer ? 'Edit trainer profile' : 'Create trainer profile'}
                </Text>
              </Pressable>
            ) : (
              <>
                {/* Only someone with a trainer profile can be booked; a plain
                    user's page keeps just Message. */}
                {trainer ? (
                  <Pressable
                    style={[styles.primaryButton, styles.actionButton]}
                    onPress={() => handleContactPress('book')}
                    disabled={pendingContact !== null}
                  >
                    {pendingContact === 'book' ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <>
                        <Feather name="calendar" size={16} color={colors.white} />
                        <Text style={styles.primaryButtonText}>Book a Session</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.outlineButton, styles.actionButton]}
                  onPress={() => handleContactPress('message')}
                  disabled={pendingContact !== null}
                >
                  {pendingContact === 'message' ? (
                    <ActivityIndicator color={colors.emerald} size="small" />
                  ) : (
                    <>
                      <Feather name="message-circle" size={16} color={colors.emerald} />
                      <Text style={styles.outlineButtonText}>Message</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>

          {/* Message / Book still jump to Log in when tapped, but guests also get
              Sign up up front instead of only finding it on the Log in screen. */}
          {!session ? (
            <View style={styles.guestPrompt}>
              <Text style={styles.guestPromptText}>
                {trainer
                  ? 'Sign in to message or book a session with this trainer.'
                  : 'Sign in to message this trainer.'}
              </Text>
              <GuestAuthButtons />
            </View>
          ) : null}

          {affiliations.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trains at</Text>
              <View style={styles.list}>
                {affiliations.map((affiliation) => {
                  const place = affiliation.location ?? affiliation.city;
                  return (
                    <Pressable
                      key={affiliation.gymId}
                      style={styles.gymCard}
                      onPress={() =>
                        router.push({ pathname: '/gym/[id]', params: { id: String(affiliation.gymId) } })
                      }
                    >
                      {affiliation.photoUrl ? (
                        <Image source={{ uri: affiliation.photoUrl }} style={styles.gymThumb} />
                      ) : (
                        <View style={[styles.gymThumb, styles.gymThumbFallback]}>
                          <Feather name="image" size={20} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.gymInfo}>
                        <Text style={styles.gymName} numberOfLines={1}>
                          {affiliation.gymName}
                        </Text>
                        {place ? (
                          <View style={styles.gymPlaceRow}>
                            <Feather name="map-pin" size={12} color={colors.textMuted} />
                            <Text style={styles.gymCity} numberOfLines={2}>
                              {place}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {/* Every row here is a TRAINER row (fetchTrainerAffiliations filters
                          role = 'trainer', and gym_staff is unique per gym+user, so you
                          can't also be that gym's owner). The sole-owner case that hides
                          "Leave this gym" on the gym page therefore can't occur in this
                          list - Leave is always valid here. */}
                      {isOwnProfile ? (
                        <Pressable
                          style={styles.leaveButton}
                          onPress={() => handleLeave(affiliation)}
                          hitSlop={6}
                          accessibilityLabel={`Leave ${affiliation.gymName}`}
                        >
                          <Feather name="log-out" size={13} color={colors.danger} />
                          <Text style={styles.leaveButtonText}>Leave</Text>
                        </Pressable>
                      ) : (
                        <Feather name="chevron-right" size={16} color={colors.textMuted} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {isOwnProfile && history.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gym history</Text>
              <View style={styles.list}>
                {history.map((item) => {
                  const when = item.at ? ` · ${formatShortDate(item.at)}` : '';
                  const roleLabel = item.role === 'trainer' ? '' : ` (${item.role})`;
                  let text: string;
                  let warn = false;
                  if (item.status === 'removed') {
                    warn = !item.leftByChoice;
                    text = item.leftByChoice
                      ? `You left ${item.gymName}${roleLabel}${when}`
                      : `You were removed from ${item.gymName}${roleLabel}${when}`;
                  } else if (item.status === 'rejected') {
                    warn = true;
                    text = `${item.gymName} declined your request${when}`;
                  } else if (item.status === 'suspended') {
                    warn = true;
                    text = `Your access at ${item.gymName} is suspended`;
                  } else {
                    text = `Request pending at ${item.gymName}`;
                  }

                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.gymRow, warn && styles.historyRowWarn]}
                      onPress={() =>
                        router.push({ pathname: '/gym/[id]', params: { id: String(item.gymId) } })
                      }
                    >
                      <Feather
                        name={warn ? 'alert-circle' : 'clock'}
                        size={16}
                        color={warn ? colors.warning : colors.textMuted}
                      />
                      <Text style={[styles.historyText, warn && styles.historyTextWarn]}>{text}</Text>
                      <Feather name="chevron-right" size={16} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {isOwnProfile && trainer ? (
            <>
              <AvailabilitySection trainerId={trainerUserId} gyms={affiliations} />
              <Pressable style={styles.sessionsLink} onPress={() => router.push('/sessions')}>
                <Feather name="calendar" size={16} color={colors.emerald} />
                <Text style={styles.sessionsLinkText}>Session requests & upcoming sessions</Text>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
            </>
          ) : null}

          {trainer ? (
            <CertificationsSection
              certifications={certifications}
              photoUrls={certificatePhotoUrls}
              isOwner={isOwnProfile}
              onAddPress={() => setIsAddCertificationVisible(true)}
              onDelete={handleDeleteCertification}
            />
          ) : null}

          {trainer ? (
            <Pressable style={styles.shareButton} onPress={handleShare}>
              <Feather name="share-2" size={16} color={colors.textPrimary} />
              <Text style={styles.shareButtonText}>Share Profile</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {isOwnProfile && session ? (
        <>
          <EditTrainerProfileModal
            visible={isEditModalVisible}
            userId={session.user.id}
            displayName={displayName}
            fallbackAvatarUrl={publicProfile?.avatarUrl ?? null}
            profile={trainer}
            applyGymName={applyGym?.name ?? null}
            onClose={() => setIsEditModalVisible(false)}
            onSaved={(saved) => setTrainer(saved)}
          />
          <AddCertificationModal
            visible={isAddCertificationVisible}
            userId={session.user.id}
            onClose={() => setIsAddCertificationVisible(false)}
            onSaved={() => {
              loadCertifications().catch(() => {});
            }}
          />
        </>
      ) : null}

      {!isOwnProfile && session && trainer ? (
        <BookSessionModal
          visible={isBookingVisible}
          trainerId={trainerUserId}
          trainerName={displayName}
          gyms={affiliations}
          onClose={() => setIsBookingVisible(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  body: {
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  applyCardTop: {
    width: 'auto',
    margin: spacing.lg,
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
  applyCard: {
    width: '100%',
    gap: spacing.sm,
    backgroundColor: colors.emeraldTint,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  applyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  applyLabel: {
    color: colors.emeraldLight,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  applyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  applyText: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    lineHeight: 19,
  },
  applyButton: {
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  applyButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  hero: {
    width: '100%',
    aspectRatio: 1,
  },
  heroFallback: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFallbackText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 72,
  },
  identity: {
    gap: spacing.xs,
  },
  name: {
    fontSize: fontSize.display,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  username: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: -spacing.xs,
  },
  trainerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.emeraldTint,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  trainerBadgeText: {
    color: colors.emeraldLight,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  experienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  experienceBadgeText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  bio: {
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    lineHeight: 23,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  ctaCard: {
    width: '100%',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  ctaTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  ctaText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    lineHeight: 19,
  },
  guestPrompt: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  guestPromptText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 17,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: spacing.md,
    minWidth: 0,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: 28,
    minWidth: 140,
  },
  outlineButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  section: {
    width: '100%',
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  list: {
    gap: spacing.sm,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  gymCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  gymThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  gymThumbFallback: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  gymPlaceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  sessionsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sessionsLinkText: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  shareButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  leaveButtonText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  historyRowWarn: {
    borderColor: '#fbbf2455',
  },
  historyText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.base,
    lineHeight: 18,
  },
  historyTextWarn: {
    color: colors.warning,
  },
  gymName: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  gymCity: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
});
