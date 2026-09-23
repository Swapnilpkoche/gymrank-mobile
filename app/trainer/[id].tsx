import { Feather } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AddCertificationModal } from '../../src/components/trainer/AddCertificationModal';
import { CertificationsSection } from '../../src/components/trainer/CertificationsSection';
import { EditTrainerProfileModal } from '../../src/components/trainer/EditTrainerProfileModal';
import { useAuth } from '../../src/context/auth-context';
import { confirmLeaveGym } from '../../src/lib/confirmations';
import { getOrCreateMessageThread } from '../../src/lib/messages';
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
  const [isMessagePending, setIsMessagePending] = useState(false);
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
  async function handleMessagePress() {
    if (!session) {
      router.push('/login');
      return;
    }
    setIsMessagePending(true);
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
      setIsMessagePending(false);
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
          <View style={styles.applyCard}>
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
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoFallback]}>
            <Text style={styles.photoFallbackText}>{initials(displayName)}</Text>
          </View>
        )}

        <Text style={styles.name}>{displayName}</Text>
        {publicProfile?.username ? (
          <Text style={styles.username}>@{publicProfile.username}</Text>
        ) : null}

        {trainer ? (
          <>
            <View style={styles.badgeRow}>
              <View style={styles.trainerBadge}>
                <Feather name="award" size={12} color={colors.emeraldLight} />
                <Text style={styles.trainerBadgeText}>Trainer</Text>
              </View>
              {trainer.yearsExperience != null ? (
                <View style={styles.experienceBadge}>
                  <Text style={styles.experienceBadgeText}>
                    {trainer.yearsExperience} {trainer.yearsExperience === 1 ? 'yr' : 'yrs'} experience
                  </Text>
                </View>
              ) : null}
            </View>

            {trainer.specialties.length > 0 ? (
              <View style={styles.chipRow}>
                {trainer.specialties.map((specialty) => (
                  <View key={specialty} style={styles.chip}>
                    <Text style={styles.chipText}>{specialty}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {trainer.bio ? <Text style={styles.bio}>{trainer.bio}</Text> : null}
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
            <Pressable style={styles.primaryButton} onPress={() => setIsEditModalVisible(true)}>
              <Feather name="edit-2" size={16} color={colors.white} />
              <Text style={styles.primaryButtonText}>
                {trainer ? 'Edit trainer profile' : 'Create trainer profile'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.outlineButton}
              onPress={handleMessagePress}
              disabled={isMessagePending}
            >
              {isMessagePending ? (
                <ActivityIndicator color={colors.emerald} size="small" />
              ) : (
                <>
                  <Feather name="message-circle" size={16} color={colors.emerald} />
                  <Text style={styles.outlineButtonText}>Message</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {affiliations.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trains at</Text>
            <View style={styles.list}>
              {affiliations.map((affiliation) => (
                <Pressable
                  key={affiliation.gymId}
                  style={styles.gymRow}
                  onPress={() =>
                    router.push({ pathname: '/gym/[id]', params: { id: String(affiliation.gymId) } })
                  }
                >
                  <Feather name="map-pin" size={16} color={colors.emerald} />
                  <View style={styles.gymInfo}>
                    <Text style={styles.gymName}>{affiliation.gymName}</Text>
                    {affiliation.city ? <Text style={styles.gymCity}>{affiliation.city}</Text> : null}
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
              ))}
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

        {trainer ? (
          <CertificationsSection
            certifications={certifications}
            photoUrls={certificatePhotoUrls}
            isOwner={isOwnProfile}
            onAddPress={() => setIsAddCertificationVisible(true)}
            onDelete={handleDeleteCertification}
          />
        ) : null}
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
    </>
  );
}

const PHOTO_SIZE = 112;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    padding: spacing.xxl,
    paddingBottom: 48,
    gap: spacing.md,
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
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    marginBottom: spacing.xs,
  },
  photoFallback: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 36,
  },
  name: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  username: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
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
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  bio: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
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
    marginTop: spacing.md,
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
  gymInfo: {
    flex: 1,
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
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
});
