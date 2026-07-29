import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenMargin, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';

export interface OnboardingScreenProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function OnboardingScreen({ step, totalSteps, title, subtitle, children, footer }: OnboardingScreenProps) {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="label" color="dim">
          {strings.onboarding.stepOf.replace('{current}', String(step)).replace('{total}', String(totalSteps))}
        </ThemedText>
        <ThemedText type="title" style={styles.title}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="body" color="muted" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
        <ThemedView style={styles.content}>{children}</ThemedView>
        <ThemedView style={styles.footer}>{footer}</ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: ScreenMargin,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  title: {
    marginTop: Spacing.sm,
  },
  subtitle: {
    marginTop: Spacing.sm,
  },
  content: {
    flex: 1,
    marginTop: Spacing.xl,
    gap: Spacing.lg,
  },
  footer: {
    gap: Spacing.md,
  },
});
