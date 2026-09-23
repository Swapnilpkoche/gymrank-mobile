import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchGymStaffRequests, respondToStaffRequest } from '../../lib/trainer';
import { colors } from '../../theme/colors';
import type { StaffRequest } from '../../types/database';

function initials(name: string): string {
  return name.charAt(0).toUpperCase();
}

// Only ever mounted for gym owners/admins. The list itself comes from an RPC
// that returns nothing to anyone else, and approve/reject go through the
// existing gym_staff UPDATE policy (is_gym_admin) - this is presentation, not
// the access check.
export function StaffRequestsSection({
  gymId,
  adminUserId,
  refreshToken,
  onChanged,
}: {
  gymId: number;
  adminUserId: string;
  refreshToken: number;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await fetchGymStaffRequests(gymId));
    } catch {
      // Best-effort: a failed lookup just hides the section rather than
      // breaking the whole gym page.
      setRequests([]);
    }
  }, [gymId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests, refreshToken]);

  async function respond(request: StaffRequest, decision: 'active' | 'rejected') {
    setRespondingId(request.requestId);
    try {
      const result = await respondToStaffRequest(request.requestId, adminUserId, decision);
      if (result.kind === 'error') {
        Alert.alert('Something went wrong', result.message);
      }
      // Reload either way - on "already handled" the row should disappear too.
      await loadRequests();
      if (result.kind === 'success' && decision === 'active') onChanged();
    } finally {
      setRespondingId(null);
    }
  }

  function confirmReject(request: StaffRequest, name: string) {
    Alert.alert('Reject request', `Reject ${name}'s request to join as ${request.requestedRole}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => respond(request, 'rejected') },
    ]);
  }

  if (requests.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Pending Requests ({requests.length})</Text>
      <View style={styles.list}>
        {requests.map((request) => {
          const name = request.fullName || request.username || 'GymTrust member';
          const isResponding = respondingId === request.requestId;
          const summary = [
            request.yearsExperience != null
              ? `${request.yearsExperience} ${request.yearsExperience === 1 ? 'yr' : 'yrs'} experience`
              : null,
            `${request.certificationCount} ${request.certificationCount === 1 ? 'certification' : 'certifications'}`,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <View key={request.requestId} style={styles.card}>
              <Pressable
                style={styles.cardTop}
                onPress={() =>
                  router.push({ pathname: '/trainer/[id]', params: { id: request.requesterId } })
                }
              >
                {request.avatarUrl ? (
                  <Image source={{ uri: request.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{initials(name)}</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.role}>Wants to join as {request.requestedRole}</Text>
                  <Text style={styles.summary}>{summary}</Text>
                  {request.specialties.length > 0 ? (
                    <Text style={styles.specialties} numberOfLines={1}>
                      {request.specialties.join(', ')}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.rejectButton}
                  onPress={() => confirmReject(request, name)}
                  disabled={isResponding}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </Pressable>
                <Pressable
                  style={styles.approveButton}
                  onPress={() => respond(request, 'active')}
                  disabled={isResponding}
                >
                  {isResponding ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.approveButtonText}>Approve</Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  list: {
    gap: 8,
  },
  card: {
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 12,
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  role: {
    color: colors.emeraldLight,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  summary: {
    color: colors.textMuted,
    fontSize: 12,
  },
  specialties: {
    color: colors.textMuted,
    fontSize: 12,
  },
  buttonRow: {
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
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#f8717166',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 13,
  },
});
