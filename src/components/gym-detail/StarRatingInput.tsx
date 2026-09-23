import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';

export function StarRatingInput({
  value,
  onChange,
  size = 26,
}: {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(star === value ? 0 : star)}
          hitSlop={6}
        >
          <Feather
            name="star"
            size={size}
            color={star <= value ? colors.emeraldLight : colors.textMuted}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
});
