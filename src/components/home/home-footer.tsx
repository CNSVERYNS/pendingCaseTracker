import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';

function relativeCheckedLabel(checkedAt: string, now: number): string {
  const diffMin = Math.floor((now - Date.parse(checkedAt)) / 60_000);
  if (diffMin < 1) return strings.home.checkedJustNow;
  if (diffMin < 60) return strings.home.checkedAgo.replace('{time}', `${diffMin} min`);
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return strings.home.checkedAgo.replace('{time}', `${diffHour} hr${diffHour === 1 ? '' : 's'}`);
  const diffDay = Math.floor(diffHour / 24);
  return strings.home.checkedAgo.replace('{time}', `${diffDay} day${diffDay === 1 ? '' : 's'}`);
}

export interface HomeFooterProps {
  checkedAt: string | null;
  onShare: () => void;
}

/** Ticks once a minute so "Checked N ago" stays current without a screen refresh. */
function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

export function HomeFooter({ checkedAt, onShare }: HomeFooterProps) {
  const now = useMinuteTick();
  const label = checkedAt ? relativeCheckedLabel(checkedAt, now) : '';

  return (
    <View style={styles.row}>
      <ThemedText type="label" color="dim">
        {label}
      </ThemedText>
      <Pressable
        style={styles.pill}
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={strings.home.shareTimeline}
      >
        <ThemedText type="label">{strings.home.shareTimeline}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  pill: {
    minHeight: MinTouchTarget,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
});
