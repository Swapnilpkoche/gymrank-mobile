import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AlbumThumb } from './AlbumThumb';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { AlbumItem } from '../../types/database';

export function AlbumCategoryPreview({
  title,
  items,
  countLabel,
  emptyLabel,
  onItemPress,
  onSeeAll,
  onAdd,
  onDeleteItem,
  onToggleVisibility,
  isAddBusy,
  uploadProgress,
}: {
  title: string;
  items: AlbumItem[];
  countLabel?: string;
  emptyLabel?: string;
  onItemPress: (item: AlbumItem) => void;
  onSeeAll: () => void;
  onAdd?: () => void;
  onDeleteItem?: (item: AlbumItem) => void;
  onToggleVisibility?: (item: AlbumItem) => void;
  isAddBusy?: boolean;
  uploadProgress?: { current: number; total: number } | null;
}) {
  const hasMore = items.length > 3;
  const visibleItems = items.slice(0, hasMore ? 2 : 3);
  const moreItem = hasMore ? items[2] : null;
  const moreCount = items.length - 2;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.headerTap}
          onPress={onSeeAll}
          disabled={items.length === 0}
          hitSlop={4}
        >
          <Text style={styles.title}>{title}</Text>
          {countLabel ? <Text style={styles.countLabel}>{countLabel}</Text> : null}
          {items.length > 0 ? (
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          ) : null}
        </Pressable>

        {onAdd ? (
          <Pressable style={styles.addButton} onPress={onAdd} disabled={isAddBusy}>
            {uploadProgress && uploadProgress.total > 1 ? (
              <Text style={styles.addButtonText}>
                Uploading {uploadProgress.current} of {uploadProgress.total}…
              </Text>
            ) : isAddBusy ? (
              <ActivityIndicator color={colors.emerald} size="small" />
            ) : (
              <>
                <Feather name="plus" size={14} color={colors.emerald} />
                <Text style={styles.addButtonText}>Add</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        emptyLabel ? <Text style={styles.empty}>{emptyLabel}</Text> : null
      ) : (
        <View style={styles.row}>
          {visibleItems.map((item) => (
            <AlbumThumb
              key={item.id}
              item={item}
              onPress={() => onItemPress(item)}
              onDelete={onDeleteItem ? () => onDeleteItem(item) : undefined}
              onToggleVisibility={onToggleVisibility ? () => onToggleVisibility(item) : undefined}
            />
          ))}
          {moreItem ? (
            <AlbumThumb
              key={moreItem.id}
              item={moreItem}
              onPress={onSeeAll}
              overlayLabel={`+${moreCount}`}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.base,
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.base,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
