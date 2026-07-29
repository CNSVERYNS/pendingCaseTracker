import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { computeRulerGeometry, RULER_SCALE_MAX_DAYS, type ProcessingRangeInput } from '@/lib/ruler';

const MINOR_TICKS = Array.from({ length: RULER_SCALE_MAX_DAYS / 10 + 1 }, (_, i) => i * 10);
const MAJOR_TICKS = [0, 100, 200, 300, 400];

export interface RulerProps {
  days: number;
  range: ProcessingRangeInput;
}

export function Ruler({ days, range }: RulerProps) {
  const geometry = computeRulerGeometry(days, range);

  return (
    <View>
      <View
        style={styles.track}
        accessible
        accessibilityLabel={geometry.accessibilityLabel}
        accessibilityRole="adjustable"
      >
        <View importantForAccessibility="no-hide-descendants">
          <View style={styles.tickRow}>
            {MINOR_TICKS.map((tick) => (
              <View key={tick} style={styles.minorTick} />
            ))}
          </View>

          <View
            style={[
              styles.band,
              { left: `${geometry.bandStartPercent}%`, width: `${geometry.bandEndPercent - geometry.bandStartPercent}%` },
            ]}
          />

          <View style={[styles.marker, { left: `${geometry.youPercent}%` }]}>
            <ThemedText type="label" color="amber" style={styles.markerLabel}>
              {strings.home.rulerYou}
            </ThemedText>
            <ThemedText style={styles.triangle}>▲</ThemedText>
          </View>

          <View style={styles.majorRow}>
            {MAJOR_TICKS.map((tick) => (
              <ThemedText key={tick} type="mono" color="dim" style={styles.majorLabel}>
                {tick}
              </ThemedText>
            ))}
          </View>
        </View>
      </View>

      <ThemedText type="body" color="muted" style={styles.sentence}>
        {geometry.isPastRange ? strings.home.rulerPastRange : strings.home.rulerInRange}
      </ThemedText>
    </View>
  );
}

const TRACK_HEIGHT = 56;

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    justifyContent: 'flex-end',
  },
  tickRow: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    height: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  minorTick: {
    width: 1,
    height: 8,
    backgroundColor: Colors.hairline,
  },
  band: {
    position: 'absolute',
    bottom: 18,
    height: 12,
    backgroundColor: Colors.surface,
    borderRadius: 6,
  },
  marker: {
    position: 'absolute',
    bottom: 26,
    alignItems: 'center',
    transform: [{ translateX: -12 }],
    width: 24,
  },
  markerLabel: {
    letterSpacing: 1,
  },
  triangle: {
    color: Colors.amber,
    fontSize: 10,
    lineHeight: 10,
  },
  majorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  majorLabel: {
    fontFamily: FontFamily.mono,
  },
  sentence: {
    marginTop: Spacing.md,
  },
});
