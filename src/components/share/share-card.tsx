import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { computeRulerGeometry, type ProcessingRangeInput } from '@/lib/ruler';
import type { ShareMilestoneRow } from '@/lib/share-card';

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

export interface ShareCardProps {
  eyebrow: string;
  days: number;
  range: ProcessingRangeInput | null;
  milestones: ShareMilestoneRow[];
}

function ShareRuler({ days, range }: { days: number; range: ProcessingRangeInput }) {
  const geometry = computeRulerGeometry(days, range);
  return (
    <View style={shareRulerStyles.track}>
      <View style={shareRulerStyles.baseline} />
      <View
        style={[
          shareRulerStyles.band,
          { left: `${geometry.bandStartPercent}%`, width: `${geometry.bandEndPercent - geometry.bandStartPercent}%` },
        ]}
      />
      <View style={[shareRulerStyles.marker, { left: `${geometry.youPercent}%` }]} />
    </View>
  );
}

export function ShareCard({ eyebrow, days, range, milestones }: ShareCardProps) {
  return (
    <View style={styles.card}>
      <ThemedTextLike style={styles.eyebrow}>{eyebrow}</ThemedTextLike>

      <View style={styles.dayRow}>
        <ThemedTextLike style={styles.dayCount}>{days}</ThemedTextLike>
        <ThemedTextLike style={styles.dayLabel}>{strings.home.shareDaysWaiting}</ThemedTextLike>
      </View>

      {range ? <ShareRuler days={days} range={range} /> : null}

      <View style={styles.milestones}>
        {milestones.map((m, index) => (
          <View key={`${m.label}-${index}`} style={styles.milestoneRow}>
            <ThemedTextLike style={[styles.milestoneLabel, m.amber && styles.amberText]} numberOfLines={1}>
              {m.label}
            </ThemedTextLike>
            <View style={styles.leader} />
            <ThemedTextLike style={[styles.milestoneValue, m.amber && styles.amberText]} numberOfLines={1}>
              {m.value}
            </ThemedTextLike>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <ThemedTextLike style={styles.wordmark}>PENDING</ThemedTextLike>
        <ThemedTextLike style={styles.domain}>{strings.home.shareDomain}</ThemedTextLike>
      </View>
    </View>
  );
}

/**
 * A plain Text with the card's own fixed typography — deliberately not the
 * app's <ThemedText>, whose sizes are tuned for a phone screen, not a
 * 1080x1350 export canvas.
 */
function ThemedTextLike({
  style,
  children,
  numberOfLines,
}: {
  style?: TextStyle | (TextStyle | false | undefined)[];
  children: ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: Colors.ink,
    padding: 72,
  },
  eyebrow: {
    fontFamily: FontFamily.mono,
    fontSize: 26,
    letterSpacing: 2,
    color: Colors.muted,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    marginTop: 48,
  },
  dayCount: {
    fontFamily: FontFamily.serifLight,
    fontSize: 240,
    lineHeight: 240,
    color: Colors.paper,
  },
  dayLabel: {
    fontFamily: FontFamily.sans,
    fontSize: 30,
    color: Colors.muted,
    marginBottom: 24,
  },
  milestones: {
    marginTop: 72,
    gap: 28,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  milestoneLabel: {
    fontFamily: FontFamily.sans,
    fontSize: 30,
    color: Colors.paper,
    flexShrink: 1,
  },
  milestoneValue: {
    fontFamily: FontFamily.mono,
    fontSize: 26,
    color: Colors.muted,
  },
  leader: {
    flex: 1,
    borderBottomWidth: 2,
    borderStyle: 'dotted',
    borderColor: Colors.hairline,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  amberText: {
    color: Colors.amber,
  },
  footer: {
    position: 'absolute',
    bottom: 72,
    left: 72,
    right: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontFamily: FontFamily.mono,
    fontSize: 26,
    letterSpacing: 4,
    color: Colors.muted,
  },
  domain: {
    fontFamily: FontFamily.mono,
    fontSize: 26,
    color: Colors.dim,
  },
});

const shareRulerStyles = StyleSheet.create({
  track: {
    height: 48,
    marginTop: 56,
    justifyContent: 'center',
  },
  baseline: {
    height: 1,
    backgroundColor: Colors.hairline,
  },
  band: {
    position: 'absolute',
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  marker: {
    position: 'absolute',
    width: 8,
    height: 40,
    borderRadius: 4,
    backgroundColor: Colors.amber,
    transform: [{ translateX: -4 }],
  },
});
