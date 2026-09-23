import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';
import type { Message } from '../../types/database';

export function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  return (
    <View style={[styles.row, isMine && styles.rowMine]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.text, isMine && styles.textMine]}>{message.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: colors.emerald,
    borderBottomRightRadius: 4,
  },
  text: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  textMine: {
    color: colors.white,
  },
});
