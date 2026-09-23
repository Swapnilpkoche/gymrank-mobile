import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { StarRatingInput } from './StarRatingInput';
import { fetchHasGymCheckIn, submitGymReview } from '../../lib/gymDetail';
import { colors, fontSize, radius, spacing } from '../../theme';

const SUB_RATINGS: Array<{ key: SubRatingKey; label: string }> = [
  { key: 'equipment', label: 'Equipment' },
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'staff', label: 'Staff' },
  { key: 'crowd', label: 'Crowd' },
  { key: 'value', label: 'Value' },
];

type SubRatingKey = 'equipment' | 'cleanliness' | 'staff' | 'crowd' | 'value';
type SubRatings = Record<SubRatingKey, number>;

const EMPTY_SUB_RATINGS: SubRatings = {
  equipment: 0,
  cleanliness: 0,
  staff: 0,
  crowd: 0,
  value: 0,
};

export function WriteReviewModal({
  visible,
  gymId,
  locationId,
  userId,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  gymId: number;
  locationId: number | null;
  userId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [subRatings, setSubRatings] = useState<SubRatings>(EMPTY_SUB_RATINGS);
  const [title, setTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [isVerifiedVisit, setIsVerifiedVisit] = useState(false);
  const [isCheckingVisit, setIsCheckingVisit] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setSubRatings(EMPTY_SUB_RATINGS);
    setTitle('');
    setReviewText('');
    setErrorMessage(null);
    setIsCheckingVisit(true);

    let cancelled = false;
    fetchHasGymCheckIn(gymId, userId)
      .then((hasCheckIn) => {
        if (!cancelled) setIsVerifiedVisit(hasCheckIn);
      })
      .catch(() => {
        if (!cancelled) setIsVerifiedVisit(false);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingVisit(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, gymId, userId]);

  function updateSubRating(key: SubRatingKey, value: number) {
    setSubRatings((prev) => ({ ...prev, [key]: value }));
  }

  // The rating column is numeric(2,1) - one decimal place - so round the
  // average of whatever sub-ratings the user actually filled in to match.
  const filledRatings = (Object.keys(subRatings) as SubRatingKey[])
    .map((key) => subRatings[key])
    .filter((value) => value > 0);
  const computedAverage =
    filledRatings.length > 0
      ? Number((filledRatings.reduce((sum, value) => sum + value, 0) / filledRatings.length).toFixed(1))
      : null;

  const canSubmit = locationId !== null && !isSubmitting;

  async function handleSubmit() {
    if (locationId === null) return;
    if (computedAverage === null) {
      setErrorMessage('Please rate at least one category.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await submitGymReview({
        gymId,
        locationId,
        userId,
        rating: computedAverage,
        title: title.trim() || null,
        reviewText: reviewText.trim() || null,
        equipmentRating: subRatings.equipment || null,
        cleanlinessRating: subRatings.cleanliness || null,
        staffRating: subRatings.staff || null,
        crowdRating: subRatings.crowd || null,
        valueRating: subRatings.value || null,
      });

      if (result.kind === 'success') {
        onSubmitted();
        onClose();
        return;
      }

      if (result.kind === 'blocked') {
        setErrorMessage(result.message);
      } else if (result.kind === 'duplicate') {
        setErrorMessage("You've already reviewed this gym.");
      } else {
        setErrorMessage(result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Write a Review</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {isCheckingVisit ? (
              <ActivityIndicator color={colors.emerald} size="small" />
            ) : isVerifiedVisit ? (
              <View style={styles.verifiedBadge}>
                <Feather name="check-circle" size={14} color={colors.emeraldLight} />
                <Text style={styles.verifiedBadgeText}>
                  Verified visit — you&apos;ve checked in here
                </Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <View style={styles.subRatingsHeader}>
                <Text style={styles.label}>Rate specific areas *</Text>
                {computedAverage !== null ? (
                  <Text style={styles.overallText}>Overall: {computedAverage.toFixed(1)}</Text>
                ) : null}
              </View>
              <Text style={styles.helperText}>
                Rate at least one category — your overall rating is the average of these.
              </Text>
              <View style={styles.subRatingList}>
                {SUB_RATINGS.map(({ key, label }) => (
                  <View key={key} style={styles.subRatingRow}>
                    <Text style={styles.subRatingLabel}>{label}</Text>
                    <StarRatingInput
                      value={subRatings[key]}
                      onChange={(value) => updateSubRating(key, value)}
                      size={18}
                    />
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Title (optional)</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Sum it up in a few words"
                placeholderTextColor={colors.textMuted}
                maxLength={120}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Review (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Share what stood out about your visit"
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Feather name="alert-triangle" size={14} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {locationId === null ? (
              <Text style={styles.errorText}>
                This gym doesn&apos;t have a location set up yet, so a review can&apos;t be
                submitted right now.
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Submit</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '88%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  verifiedBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.emeraldLight,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subRatingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overallText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.emeraldLight,
  },
  helperText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  subRatingList: {
    gap: spacing.md,
  },
  subRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subRatingLabel: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerTint,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.danger,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
});
