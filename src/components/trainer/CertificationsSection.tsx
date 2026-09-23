import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MAX_CERTIFICATIONS } from '../../lib/trainer';
import { colors } from '../../theme/colors';
import type { TrainerCertification } from '../../types/database';

export function CertificationsSection({
  certifications,
  photoUrls,
  isOwner,
  onAddPress,
  onDelete,
}: {
  certifications: TrainerCertification[];
  // path -> signed URL. Missing for viewers who aren't allowed to see the
  // photo (it's a private bucket), in which case the row shows without one.
  photoUrls: Record<string, string>;
  isOwner: boolean;
  onAddPress: () => void;
  onDelete: (certification: TrainerCertification) => void;
}) {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  if (certifications.length === 0 && !isOwner) return null;

  function confirmDelete(certification: TrainerCertification) {
    Alert.alert('Remove certification', `Remove "${certification.title}" from your profile?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(certification) },
    ]);
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Certifications</Text>
        {isOwner && certifications.length < MAX_CERTIFICATIONS ? (
          <Pressable style={styles.addButton} onPress={onAddPress} hitSlop={8}>
            <Feather name="plus" size={14} color={colors.emerald} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      {certifications.length === 0 ? (
        <Text style={styles.empty}>
          Add your certifications so gyms and members can see your credentials.
        </Text>
      ) : (
        <View style={styles.list}>
          {certifications.map((certification) => {
            const photoUrl = certification.photoPath ? photoUrls[certification.photoPath] : undefined;
            return (
              <View key={certification.id} style={styles.row}>
                {photoUrl ? (
                  <Pressable onPress={() => setViewerUrl(photoUrl)}>
                    <Image source={{ uri: photoUrl }} style={styles.thumb} />
                  </Pressable>
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Feather name="award" size={18} color={colors.emeraldLight} />
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.certTitle}>{certification.title}</Text>
                  <Text style={styles.issuer}>{certification.issuingBody}</Text>
                </View>
                {isOwner ? (
                  <Pressable onPress={() => confirmDelete(certification)} hitSlop={10}>
                    <Feather name="trash-2" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={viewerUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUrl(null)}
      >
        <Pressable style={styles.viewerOverlay} onPress={() => setViewerUrl(null)}>
          {viewerUrl ? (
            <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  addButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 12,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  thumbFallback: {
    backgroundColor: '#052e1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  certTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  issuer: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: '#000000e6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
});
