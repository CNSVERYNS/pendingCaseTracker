import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DayCounter } from '@/components/home/day-counter';
import { HomeFooter } from '@/components/home/home-footer';
import { HomeHeader } from '@/components/home/home-header';
import { PendingDetailCard } from '@/components/home/pending-detail-card';
import { Ruler } from '@/components/home/ruler';
import { Timeline } from '@/components/home/timeline';
import { ShareCard } from '@/components/share/share-card';
import { useShareCardExport } from '@/components/share/use-share-card-export';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenMargin, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { computeDaysWaiting } from '@/lib/case-clock';
import { isPendingDetailDue } from '@/lib/pending-details';
import { receiptPrefix } from '@/lib/receipt';
import { buildShareMilestones } from '@/lib/share-card';
import { buildTimeline } from '@/lib/timeline';
import { useCaseDetail } from '@/lib/use-case-detail';

export default function CaseHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useCaseDetail(id);
  const shareViewRef = useRef<View>(null);
  const shareExport = useShareCardExport(shareViewRef);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (isError || !data) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="body" color="muted" style={styles.centeredText}>
          {strings.common.loadError}
        </ThemedText>
        <Button label={strings.common.retry} onPress={() => refetch()} />
      </ThemedView>
    );
  }

  const days = computeDaysWaiting(
    data.events.map((e) => ({ kind: e.kind, occurredOn: e.occurred_on })),
    data.case.filed_on,
    today,
  );

  const timelineRows = buildTimeline(
    data.events.map((e) => ({
      id: e.id,
      kind: e.kind,
      source: e.source,
      label: e.label,
      occurredOn: e.occurred_on,
      occurredAtTime: e.occurred_at_time,
    })),
    today,
  );

  const nowISO = new Date().toISOString();
  const activeDetail = data.pendingDetails
    .filter((d) =>
      isPendingDetailDue({ askedAt: d.asked_at, answeredAt: d.answered_at, dismissedAt: d.dismissed_at }, nowISO),
    )
    .sort((a, b) => (a.asked_at < b.asked_at ? -1 : 1))[0];

  const range = data.processingTime
    ? { lowDays: data.processingTime.low_days, highDays: data.processingTime.high_days }
    : null;
  const shareMilestones = buildShareMilestones(timelineRows, data.case.state === 'decided', days);
  const shareEyebrow = `${data.case.form_type} · ${receiptPrefix(data.case.receipt_number)} · ${data.case.office_label ?? 'National range'}`;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <HomeHeader
            formType={data.case.form_type}
            officeLabel={data.case.office_label}
            receiptNumber={data.case.receipt_number}
          />

          <DayCounter days={days} />

          {activeDetail ? (
            <PendingDetailCard
              detail={activeDetail}
              caseId={data.case.id}
              formType={data.case.form_type}
              officeCode={data.case.office_code}
              onResolved={() => refetch()}
            />
          ) : null}

          {range ? <Ruler days={days} range={range} /> : null}

          <Timeline rows={timelineRows} />

          <ThemedText type="label" color="dim" style={styles.disclaimer}>
            {strings.legal.disclaimer}
          </ThemedText>

          <HomeFooter checkedAt={data.snapshot?.checked_at ?? null} onShare={shareExport.trigger} />
        </ScrollView>
      </SafeAreaView>

      {shareExport.rendering ? (
        <View style={styles.offscreen} collapsable={false}>
          <View ref={shareViewRef} collapsable={false}>
            <ShareCard eyebrow={shareEyebrow} days={days} range={range} milestones={shareMilestones} />
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ScreenMargin,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: ScreenMargin,
  },
  centeredText: {
    textAlign: 'center',
  },
  disclaimer: {
    textAlign: 'center',
  },
  offscreen: {
    position: 'absolute',
    top: -100000,
    left: 0,
  },
});
