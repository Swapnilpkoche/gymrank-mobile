import { StyleSheet, View } from 'react-native';

import { AlbumThumb } from './AlbumThumb';
import type { AlbumItem } from '../../types/database';
import { spacing } from '../../theme';

export function AlbumGrid({
  items,
  onItemPress,
  onDeleteItem,
  onToggleVisibility,
}: {
  items: AlbumItem[];
  onItemPress: (item: AlbumItem) => void;
  onDeleteItem?: (item: AlbumItem) => void;
  onToggleVisibility?: (item: AlbumItem) => void;
}) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <AlbumThumb
          key={item.id}
          item={item}
          onPress={() => onItemPress(item)}
          onDelete={onDeleteItem ? () => onDeleteItem(item) : undefined}
          onToggleVisibility={onToggleVisibility ? () => onToggleVisibility(item) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
