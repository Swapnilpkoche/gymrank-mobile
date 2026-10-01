import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { UnreadBadge } from '../UnreadBadge';
import { setGymControls } from '../../lib/gymControls';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { GymControlSettings, OwnedGymControls } from '../../types/database';

type ControlKey = keyof GymControlSettings;

const CONTROLS: { key: ControlKey; title: string; on: string; off: string }[] = [
  {
    key: 'isDiscoverable',
    title: 'Show in Discover & search',
    on: 'Anyone can find this gym.',
    off: "Hidden from Discover and search. Members and existing links still work.",
  },
  {
    key: 'acceptingJoinRequests',
    title: 'Accept member requests',
    on: 'People can ask to join as members.',
    off: 'New member requests are turned off.',
  },
  {
    key: 'acceptingTrainerRequests',
    title: 'Accept trainer requests',
    on: 'Trainers can ask to join your team.',
    off: 'New trainer requests are turned off.',
  },
];

// The owner/admin's per-gym switches. With several gyms, every gym's tab
// carries its own pending-request count, so a request at a gym that isn't
// selected is never out of sight. The switches are presentation only:
// set_gym_controls (owner/admin only) and the request INSERT policies are
// what actually enforce them.
export function GymControlsCard({
  gyms,
  onGymUpdated,
}: {
  gyms: OwnedGymControls[];
  onGymUpdated: (gym: OwnedGymControls) => void;
}) {
  const router = useRouter();
  const [selectedGymId, setSelectedGymId] = useState<number | null>(gyms[0]?.gymId ?? null);
  const [savingKey, setSavingKey] = useState<ControlKey | null>(null);

  // Keep a valid selection if the list changes underneath (refresh, a gym
  // handed over to someone else).
  useEffect(() => {
    if (!gyms.some((gym) => gym.gymId === selectedGymId)) {
      setSelectedGymId(gyms[0]?.gymId ?? null);
    }
  }, [gyms, selectedGymId]);

  const gym = gyms.find((g) => g.gymId === selectedGymId) ?? gyms[0];
  if (!gym) return null;

  async function handleToggle(key: ControlKey, value: boolean) {
    if (!gym || savingKey) return;
    const previous = gym;
    setSavingKey(key);
    onGymUpdated({ ...gym, [key]: value });
    try {
      const saved = await setGymControls(gym.gymId, { [key]: value });
      onGymUpdated({ ...previous, ...saved });
    } catch (err) {
      onGymUpdated(previous);
      Alert.alert(
        "Couldn't update this gym",
        err instanceof Error ? err.message : 'Please try again.'
      );
    }
    setSavingKey(null);
  }

  const goToGym = (highlight: 'team' | 'pricing') =>
    router.push({ pathname: '/gym/[id]', params: { id: String(gym.gymId), highlight } });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="sliders" size={18} color={colors.emerald} />
        <Text style={styles.title}>Gym controls</Text>
      </View>

      {gyms.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {gyms.map((item) => {
            const isSelected = item.gymId === gym.gymId;
            return (
              <Pressable
                key={item.gymId}
                style={[styles.tab, isSelected && styles.tabSelected]}
                onPress={() => setSelectedGymId(item.gymId)}
              >
                <Text
                  style={[styles.tabText, isSelected && styles.tabTextSelected]}
                  numberOfLines={1}
                >
                  {item.gymName}
                </Text>
                <UnreadBadge count={item.pendingMemberRequests + item.pendingTrainerRequests} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.gymName}>{gym.gymName}</Text>
      )}

      <View style={styles.controls}>
        {CONTROLS.map((control) => {
          const value = gym[control.key];
          return (
            <View key={control.key} style={styles.controlRow}>
              <View style={styles.controlText}>
                <Text style={styles.controlTitle}>{control.title}</Text>
                <Text style={[styles.controlHint, !value && styles.controlHintOff]}>
                  {value ? control.on : control.off}
                </Text>
              </View>
              <Switch
                value={value}
                onValueChange={(next) => handleToggle(control.key, next)}
                disabled={savingKey !== null}
                trackColor={{ false: colors.surfaceRaised, true: colors.emeraldDark }}
                thumbColor={value ? colors.emeraldLight : colors.textMuted}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.links}>
        <Pressable
          style={styles.link}
          onPress={() =>
            router.push({ pathname: '/gym/[id]/members', params: { id: String(gym.gymId) } })
          }
        >
          <Feather name="users" size={16} color={colors.emerald} />
          <Text style={styles.linkText}>Members</Text>
          <UnreadBadge count={gym.pendingMemberRequests} />
        </Pressable>
        <Pressable style={styles.link} onPress={() => goToGym('team')}>
          <Feather name="award" size={16} color={colors.emerald} />
          <Text style={styles.linkText}>Team</Text>
          <UnreadBadge count={gym.pendingTrainerRequests} />
        </Pressable>
        <Pressable style={styles.link} onPress={() => goToGym('pricing')}>
          <Feather name="tag" size={16} color={colors.emerald} />
          <Text style={styles.linkText}>Pricing</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  gymName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tabs: {
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tabSelected: {
    backgroundColor: colors.emeraldTint,
    borderColor: colors.emerald,
  },
  tabText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  tabTextSelected: {
    color: colors.emeraldLight,
  },
  controls: {
    gap: spacing.md,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  controlText: {
    flex: 1,
    gap: 2,
  },
  controlTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  controlHint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  controlHintOff: {
    color: colors.warning,
  },
  links: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  link: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
  },
  linkText: {
    color: colors.emerald,
    fontWeight: '600',
    fontSize: fontSize.base,
  },
});
