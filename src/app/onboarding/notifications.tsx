import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { track } from '@/lib/analytics';
import { useOnboarding } from '@/lib/onboarding-context';
import { getDeviceTimezone, registerForPushNotificationsAsync } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

export default function NotificationsStep() {
  const { state } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  async function finish(pushToken: string | null) {
    setSubmitting(true);
    setSubmitError(undefined);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('users')
        .update({ timezone: getDeviceTimezone(), push_token: pushToken })
        .eq('id', user.id);
    }

    const { data, error } = await supabase.functions.invoke<{ caseId: string; error?: string }>('create-case', {
      body: {
        receiptNumber: state.receiptNumber,
        formType: state.formType,
        officeCode: state.officeCode,
        officeLabel: state.officeLabel,
        filedOn: state.filedOn,
        milestones: state.milestones,
      },
    });

    setSubmitting(false);

    if (error || !data || data.error) {
      setSubmitError(strings.auth.genericError);
      return;
    }

    void track('case_added');
    router.replace('/');
  }

  async function handleEnable() {
    const token = await registerForPushNotificationsAsync();
    if (token) void track('notifications_enabled');
    await finish(token);
  }

  return (
    <OnboardingScreen
      step={5}
      totalSteps={5}
      title={strings.onboarding.notifications.title}
      subtitle={strings.onboarding.notifications.subtitle}
      footer={
        <>
          <Button label={strings.onboarding.notifications.enable} onPress={handleEnable} loading={submitting} />
          <Button
            variant="secondary"
            label={strings.onboarding.notifications.skip}
            onPress={() => finish(null)}
            disabled={submitting}
          />
        </>
      }
    >
      <View style={styles.center}>
        {submitting ? (
          <View style={styles.row}>
            <ActivityIndicator />
            <ThemedText type="body" color="muted">
              {strings.onboarding.notifications.finishing}
            </ThemedText>
          </View>
        ) : null}
        {submitError ? (
          <ThemedText type="body" color="amber">
            {submitError}
          </ThemedText>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
