import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import {
  MembershipTermSheet,
  type TermSheetTarget,
} from '../../../src/components/members/MembershipTermSheet';
import { useProfileNavigation } from '../../../src/hooks/useProfileNavigation';
import { fetchGymPricingPlans } from '../../../src/lib/gymPricing';
import {
  endsLabel,
  fetchOwnerMembers,
  PLAN_OPTIONS,
  planLabel,
  rejectMemberRequest,
} from '../../../src/lib/memberships';
import { formatShortDate } from '../../../src/lib/time';
import { colors } from '../../../src/theme/colors';
import type {
  GymPricingPlan,
  MemberRequest,
  OwnerMember,
  OwnerMembersData,
} from '../../../src/types/database';

type TabKey = 'active' | 'expiring' | 'expired' | 'requests';

function displayName(person: { fullName: string | null; username: string | null }): string {
  return person.fullName || person.username || 'GymTrust member';
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return url ? (
    <Image source={{ uri: url }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function GymMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gymId = Number(id);
  const goToProfile = useProfileNavigation();

  const [data, setData] = useState<OwnerMembersData | null>(null);
  const [prices, setPrices] = useState<GymPricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('active');
  const [sheetTarget, setSheetTarget] = useState<TermSheetTarget | null>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [membersData, pricingData] = await Promise.all([
        fetchOwnerMembers(gymId),
        fetchGymPricingPlans(gymId),
      ]);
      setData(membersData);
      setPrices(pricingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members.');
    }
    setIsLoading(false);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  // The server sorts members by soonest end date. "Active" is everyone whose
  // membership currently counts (including those expiring soon and legacy
  // members with no plan); "Expiring soon" is the subset inside their plan's
  // reminder window, soonest end first; "Expired" lists the most recently
  // lapsed first. Expired members keep their row so they can be renewed.
  const lists = useMemo(() => {
    const members = data?.members ?? [];
    return {
      active: members.filter((m) => m.state !== 'expired'),
      expiring: members.filter((m) => m.state === 'expiring_soon'),
      expired: members
        .filter((m) => m.state === 'expired')
        .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? '')),
    };
  }, [data]);

  function openSheet(target: TermSheetTarget) {
    setSheetTarget(target);
    setIsSheetVisible(true);
  }

  function openRenew(member: OwnerMember) {
    openSheet({
      mode: member.state === 'no_plan' ? 'set_plan' : 'renew',
      memberId: member.memberId,
      memberName: displayName(member),
      currentPlan: member.planType,
    });
  }

  function openApprove(request: MemberRequest) {
    openSheet({
      mode: 'approve',
      memberId: request.memberId,
      memberName: displayName(request),
      currentPlan: null,
    });
  }

  function confirmDecline(request: MemberRequest) {
    const name = displayName(request);
    Alert.alert('Decline request?', `${name}'s request to join will be declined.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setBusyRequestId(request.memberId);
          const result = await rejectMemberRequest(request.memberId);
          setBusyRequestId(null);
          if (result.kind === 'error') Alert.alert("Couldn't decline", result.message);
          await load();
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Could not load members.'}</Text>
      </View>
    );
  }

  const { summary } = data;
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: lists.active.length },
    { key: 'expiring', label: 'Expiring soon', count: lists.expiring.length },
    { key: 'expired', label: 'Expired', count: lists.expired.length },
    { key: 'requests', label: 'Requests', count: data.requests.length },
  ];

  const memberList =
    tab === 'active' ? lists.active : tab === 'expiring' ? lists.expiring : lists.expired;

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
        <Stack.Screen options={{ title: 'Members' }} />

        {/* ---- summary ---- */}
        <View style={styles.statRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{summary.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={[styles.statValue, summary.expiringSoon > 0 && styles.statValueWarn]}>
              {summary.expiringSoon}
            </Text>
            <Text style={styles.statLabel}>Expiring soon</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={[styles.statValue, summary.expired > 0 && styles.statValueBad]}>
              {summary.expired}
            </Text>
            <Text style={styles.statLabel}>Expired</Text>
          </View>
        </View>

        <View style={styles.planChipRow}>
          {PLAN_OPTIONS.map((option) => (
            <View key={option.value} style={styles.planChip}>
              <Text style={styles.planChipText}>
                {option.label} {summary.byPlan[option.value] ?? 0}
              </Text>
            </View>
          ))}
          {summary.noPlan > 0 ? (
            <View style={styles.planChip}>
              <Text style={styles.planChipText}>No plan {summary.noPlan}</Text>
            </View>
          ) : null}
        </View>
        {summary.expiringWithin7Days > 0 ? (
          <Text style={styles.sevenDayNote}>
            {summary.expiringWithin7Days} {summary.expiringWithin7Days === 1 ? 'membership ends' : 'memberships end'}{' '}
            within 7 days
          </Text>
        ) : null}

        {/* ---- tabs ---- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
              {/* Counts that need attention are real badges: Expiring soon in amber,
                  Requests in red - an owner sees at a glance that someone is waiting. */}
              <View
                style={[
                  styles.tabCount,
                  tab === t.key && styles.tabCountActive,
                  t.count > 0 && t.key === 'expiring' && styles.tabCountWarn,
                  t.count > 0 && t.key === 'requests' && styles.tabCountAlert,
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    tab === t.key && styles.tabCountTextActive,
                    t.count > 0 &&
                      (t.key === 'expiring' || t.key === 'requests') &&
                      styles.tabCountTextBadge,
                  ]}
                >
                  {t.count}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* ---- list ---- */}
        {tab === 'requests' ? (
          data.requests.length === 0 ? (
            <Text style={styles.empty}>No pending requests.</Text>
          ) : (
            <View style={styles.list}>
              {data.requests.map((request) => {
                const name = displayName(request);
                const busy = busyRequestId === request.memberId;
                return (
                  <View key={request.memberId} style={styles.row}>
                    <Pressable style={styles.rowTop} onPress={() => goToProfile(request.userId)}>
                      <Avatar url={request.avatarUrl} name={name} />
                      <View style={styles.rowInfo}>
                        <Text style={styles.name}>{name}</Text>
                        <Text style={styles.meta}>
                          Requested {formatShortDate(request.requestedAt)}
                        </Text>
                      </View>
                    </Pressable>
                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.declineButton}
                        onPress={() => confirmDecline(request)}
                        disabled={busy}
                      >
                        <Text style={styles.declineButtonText}>Decline</Text>
                      </Pressable>
                      <Pressable
                        style={styles.approveButton}
                        onPress={() => openApprove(request)}
                        disabled={busy}
                      >
                        {busy ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.approveButtonText}>Approve…</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ) : memberList.length === 0 ? (
          <Text style={styles.empty}>
            {tab === 'active'
              ? 'No active members yet.'
              : tab === 'expiring'
                ? 'Nobody is close to expiring.'
                : 'No expired memberships.'}
          </Text>
        ) : (
          <View style={styles.list}>
            {memberList.map((member) => {
              const name = displayName(member);
              const noPlan = member.state === 'no_plan';
              return (
                <View key={member.memberId} style={styles.row}>
                  <Pressable style={styles.rowTop} onPress={() => goToProfile(member.userId)}>
                    <Avatar url={member.avatarUrl} name={name} />
                    <View style={styles.rowInfo}>
                      <View style={styles.nameLine}>
                        <Text style={styles.name} numberOfLines={1}>
                          {name}
                        </Text>
                        <View style={[styles.badge, noPlan && styles.badgeMuted]}>
                          <Text style={[styles.badgeText, noPlan && styles.badgeTextMuted]}>
                            {planLabel(member.planType)}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.meta,
                          member.state === 'expiring_soon' && styles.metaWarn,
                          member.state === 'expired' && styles.metaBad,
                        ]}
                      >
                        {endsLabel(member.endDate, member.daysLeft)}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable style={styles.renewButton} onPress={() => openRenew(member)}>
                    <Feather name={noPlan ? 'edit-3' : 'refresh-cw'} size={14} color={colors.emerald} />
                    <Text style={styles.renewButtonText}>{noPlan ? 'Set plan' : 'Renew'}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <MembershipTermSheet
        visible={isSheetVisible}
        target={sheetTarget}
        prices={prices}
        onClose={() => setIsSheetVisible(false)}
        onDone={load}
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
    padding: 16,
    paddingBottom: 48,
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 16,
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statValueWarn: {
    color: '#fbbf24',
  },
  statValueBad: {
    color: '#f87171',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  planChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  planChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  sevenDayNote: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  tabRow: {
    gap: 8,
    paddingVertical: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabCount: {
    minWidth: 20,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabCountActive: {
    backgroundColor: '#ffffff33',
  },
  tabCountWarn: {
    backgroundColor: '#f59e0b',
  },
  tabCountAlert: {
    backgroundColor: '#ef4444',
  },
  tabCountText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tabCountTextBadge: {
    color: '#fff',
  },
  tabCountTextActive: {
    color: '#fff',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  list: {
    gap: 8,
  },
  row: {
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowInfo: {
    flex: 1,
    gap: 3,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  badge: {
    backgroundColor: '#052e1f',
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  badgeMuted: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  badgeText: {
    color: colors.emeraldLight,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextMuted: {
    color: colors.textMuted,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  metaWarn: {
    color: '#fbbf24',
    fontWeight: '600',
  },
  metaBad: {
    color: '#f87171',
    fontWeight: '600',
  },
  renewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 10,
    paddingVertical: 9,
  },
  renewButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#f8717166',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 13,
  },
});
