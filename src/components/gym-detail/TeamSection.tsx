import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useProfileNavigation } from '../../hooks/useProfileNavigation';
import { colors } from '../../theme/colors';
import type { TeamMember } from '../../types/database';

function initials(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function TeamSection({
  team,
  viewerUserId,
  viewerRole,
  onRemoveMember,
}: {
  team: TeamMember[];
  viewerUserId: string | null;
  // The viewer's role if they're an ACTIVE owner/admin of this gym; null for
  // everyone else, who get no management controls.
  viewerRole: 'owner' | 'admin' | null;
  onRemoveMember: (member: TeamMember) => void;
}) {
  const goToProfile = useProfileNavigation();
  const router = useRouter();

  if (team.length === 0) return null;

  // Mirrors the server's rule (remove_gym_staff_member) so the button only
  // shows where it would work: not yourself (that's "Leave this gym"), and an
  // owner or admin can only be removed by an owner - otherwise an admin could
  // seize the gym. The server enforces this regardless.
  function canRemove(member: TeamMember): boolean {
    if (!viewerRole || member.userId === viewerUserId) return false;
    if (member.role === 'owner' || member.role === 'admin') return viewerRole === 'owner';
    return true;
  }

  // Trainers link to their full trainer profile - including your own, since
  // that's where the edit entry lives. Everyone else (and any trainer without
  // a profile yet) keeps going to the plain public profile.
  function handlePress(member: TeamMember) {
    if (member.role === 'trainer' && member.hasTrainerProfile) {
      router.push({ pathname: '/trainer/[id]', params: { id: member.userId } });
      return;
    }
    goToProfile(member.userId);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Team</Text>
      <View style={styles.list}>
        {team.map((member) => {
          const isOwner = member.role === 'owner';
          const linksToTrainerProfile = member.role === 'trainer' && member.hasTrainerProfile;
          return (
            <Pressable
              key={member.id}
              style={[styles.row, isOwner && styles.rowOwner]}
              onPress={() => handlePress(member)}
            >
              {member.avatarUrl ? (
                <Image source={{ uri: member.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, isOwner && styles.avatarOwner]}>
                  <Text style={styles.avatarText}>{initials(member.displayName)}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name}>{member.displayName}</Text>
                <Text style={[styles.role, isOwner && styles.roleOwner]}>
                  {isOwner ? 'Owner' : member.role}
                </Text>
              </View>
              {linksToTrainerProfile ? (
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              ) : null}
              {canRemove(member) ? (
                <Pressable
                  style={styles.removeButton}
                  onPress={() => onRemoveMember(member)}
                  hitSlop={6}
                  accessibilityLabel={`Remove ${member.displayName} from team`}
                >
                  <Feather name="user-minus" size={13} color="#f87171" />
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              ) : null}
            </Pressable>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
  },
  rowOwner: {
    borderColor: colors.emerald,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOwner: {
    backgroundColor: colors.emerald,
  },
  avatarText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#f8717166',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  removeButtonText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  role: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  roleOwner: {
    color: colors.emeraldLight,
    fontWeight: '700',
  },
});
