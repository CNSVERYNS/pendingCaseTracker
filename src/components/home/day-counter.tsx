import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';

export function DayCounter({ days }: { days: number }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${days} ${strings.home.daysLabel} ${strings.home.waitingLabel}`}>
      <ThemedText
        type="hero"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.4}
        style={styles.number}
      >
        {days}
      </ThemedText>
      <View style={styles.labelStack}>
        <ThemedText type="label" color="muted">
          {strings.home.daysLabel}
        </ThemedText>
        <ThemedText type="label" color="muted">
          {strings.home.waitingLabel}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  number: {
    flexShrink: 1,
  },
  labelStack: {
    paddingBottom: Spacing.md,
  },
});
