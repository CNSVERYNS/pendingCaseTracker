import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import type { CaseEventKind } from '@/lib/database.types';
import { useOnboarding } from '@/lib/onboarding-context';

const MILESTONE_CHIPS: { kind: CaseEventKind; label: string }[] = [
  { kind: 'biometrics', label: strings.onboarding.milestones.biometrics },
  { kind: 'interview_scheduled', label: strings.onboarding.milestones.interviewScheduled },
  { kind: 'interview', label: strings.onboarding.milestones.interviewed },
  { kind: 'rfe', label: strings.onboarding.milestones.rfe },
];

export default function MilestonesStep() {
  const { state, setMilestone, removeMilestone } = useOnboarding();

  function toggle(kind: CaseEventKind) {
    const existing = state.milestones.find((m) => m.kind === kind);
    if (existing) {
      removeMilestone(kind);
    } else {
      setMilestone({ kind, occurredOn: new Date().toISOString().slice(0, 10) });
    }
  }

  return (
    <OnboardingScreen
      step={4}
      totalSteps={5}
      title={strings.onboarding.milestones.title}
      subtitle={strings.onboarding.milestones.subtitle}
      footer={<Button label={strings.common.continue} onPress={() => router.push('/onboarding/notifications')} />}
    >
      <View style={styles.list}>
        {MILESTONE_CHIPS.map(({ kind, label }) => {
          const milestone = state.milestones.find((m) => m.kind === kind);
          return (
            <View key={kind} style={styles.row}>
              <Chip label={label} selected={Boolean(milestone)} onPress={() => toggle(kind)} />
              {milestone ? (
                <DateField
                  label={label}
                  value={milestone.occurredOn}
                  onChange={(isoDate) => setMilestone({ kind, occurredOn: isoDate })}
                  maximumDate={new Date()}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.lg,
  },
  row: {
    gap: Spacing.sm,
  },
});
