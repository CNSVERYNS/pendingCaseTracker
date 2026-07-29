import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors, Motion, Spacing } from '@/constants/theme';
import type { TimelineRow as TimelineRowData } from '@/lib/timeline';

const DOT_SIZE = 10;
const RAIL_WIDTH = 26;

function BreathingDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: Motion.breatheDurationMs / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, styles.currentDot, style]} />;
}

function Dot({ status }: { status: TimelineRowData['status'] }) {
  if (status === 'current') return <BreathingDot />;
  if (status === 'completed') return <View style={[styles.dot, styles.completedDot]} />;
  return <View style={[styles.dot, styles.futureDot]} />;
}

function Connector({ dotted }: { dotted: boolean }) {
  return <View style={[styles.connector, dotted && styles.connectorDotted]} />;
}

function TimelineRowView({ row, showConnector, dotted }: { row: TimelineRowData; showConnector: boolean; dotted: boolean }) {
  const color = row.status === 'completed' ? 'muted' : row.status === 'future' ? 'dim' : 'paper';

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <Dot status={row.status} />
        {showConnector ? <Connector dotted={dotted} /> : null}
      </View>
      <View style={styles.content}>
        {row.status === 'current' ? (
          <>
            <ThemedText type="title" color={color}>
              {row.title}
            </ThemedText>
            <ThemedText type="mono" color="muted" style={styles.subline}>
              {row.timeDisplay ? `${row.dateDisplay}, ${row.timeDisplay} · ${row.countdownLabel}` : `${row.dateDisplay} · ${row.countdownLabel}`}
            </ThemedText>
          </>
        ) : (
          <View style={styles.plainRow}>
            <ThemedText type="body" color={color} style={styles.plainTitle}>
              {row.title}
            </ThemedText>
            <ThemedText type="mono" color={color}>
              {row.dateDisplay}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

export function Timeline({ rows }: { rows: TimelineRowData[] }) {
  return (
    <View>
      {rows.map((row, index) => {
        const next = rows[index + 1];
        const dotted = row.status === 'future' || next?.status === 'future';
        return (
          <TimelineRowView key={row.key} row={row} showConnector={index < rows.length - 1} dotted={dotted} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  completedDot: {
    backgroundColor: Colors.muted,
  },
  currentDot: {
    backgroundColor: Colors.ink,
    borderWidth: 2,
    borderColor: Colors.amber,
  },
  futureDot: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.dim,
  },
  connector: {
    width: 1,
    flex: 1,
    minHeight: Spacing.xl,
    backgroundColor: Colors.hairline,
    marginVertical: Spacing.xs,
  },
  connectorDotted: {
    backgroundColor: 'transparent',
    borderLeftWidth: 1,
    borderLeftColor: Colors.dim,
    borderStyle: 'dotted',
    width: 0,
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.lg,
  },
  plainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  plainTitle: {
    flexShrink: 1,
  },
  subline: {
    marginTop: Spacing.xs,
  },
});
