import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, ScreenMargin, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { track } from '@/lib/analytics';
import { isBiometricAvailable, isBiometricLockEnabled, setBiometricLockEnabled } from '@/lib/biometric-lock';
import { exportUserData } from '@/lib/export-data';
import { FORM_TYPE_LABELS } from '@/lib/form-type';
import { getDeviceTimezone, registerForPushNotificationsAsync } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useCasesList } from '@/lib/use-cases-list';

function useNotificationsEnabled() {
  return useQuery({
    queryKey: ['notifications-enabled'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.from('users').select('push_token').eq('id', user.id).maybeSingle();
      return Boolean(data?.push_token);
    },
  });
}

function useBiometricLockState() {
  return useQuery({
    queryKey: ['biometric-lock-state'],
    queryFn: async () => {
      const [available, enabled] = await Promise.all([isBiometricAvailable(), isBiometricLockEnabled()]);
      return { available, enabled };
    },
  });
}

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { data: cases } = useCasesList();
  const { data: notificationsEnabled } = useNotificationsEnabled();
  const { data: biometricLock } = useBiometricLockState();
  const [togglingNotifications, setTogglingNotifications] = useState(false);
  const [togglingBiometricLock, setTogglingBiometricLock] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggleBiometricLock(next: boolean) {
    setTogglingBiometricLock(true);
    await setBiometricLockEnabled(next);
    setTogglingBiometricLock(false);
    queryClient.invalidateQueries({ queryKey: ['biometric-lock-state'] });
  }

  async function handleToggleNotifications(next: boolean) {
    setTogglingNotifications(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      if (next) {
        const token = await registerForPushNotificationsAsync();
        await supabase.from('users').update({ push_token: token, timezone: getDeviceTimezone() }).eq('id', user.id);
        if (token) void track('notifications_enabled');
      } else {
        await supabase.from('users').update({ push_token: null }).eq('id', user.id);
      }
    }
    setTogglingNotifications(false);
    queryClient.invalidateQueries({ queryKey: ['notifications-enabled'] });
  }

  function confirmRemoveCase(caseId: string, label: string) {
    Alert.alert(strings.settings.removeCaseConfirmTitle.replace('{label}', label), strings.settings.removeCaseConfirmBody, [
      { text: strings.settings.cancel, style: 'cancel' },
      {
        text: strings.settings.confirm,
        style: 'destructive',
        onPress: async () => {
          await supabase.from('cases').delete().eq('id', caseId);
          queryClient.invalidateQueries({ queryKey: ['cases-list'] });
          queryClient.invalidateQueries({ queryKey: ['my-case-ids'] });
        },
      },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(strings.settings.deleteAccountConfirmTitle, strings.settings.deleteAccountConfirmBody, [
      { text: strings.settings.cancel, style: 'cancel' },
      {
        text: strings.settings.confirm,
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          const { error } = await supabase.functions.invoke('delete-account');
          if (error) {
            setDeleting(false);
            Alert.alert(strings.auth.genericError);
            return;
          }
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/auth');
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">{strings.settings.title}</ThemedText>

          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <ThemedText type="bodyMedium">{strings.settings.notifications}</ThemedText>
                <ThemedText type="label" color="muted">
                  {strings.settings.notificationsSubtitle}
                </ThemedText>
              </View>
              {togglingNotifications ? (
                <ActivityIndicator />
              ) : (
                <Switch
                  value={notificationsEnabled ?? false}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: Colors.hairline, true: Colors.amber }}
                  thumbColor={Colors.paper}
                />
              )}
            </View>
          </View>

          {biometricLock?.available ? (
            <View style={styles.section}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <ThemedText type="bodyMedium">{strings.settings.biometricLock}</ThemedText>
                  <ThemedText type="label" color="muted">
                    {strings.settings.biometricLockSubtitle}
                  </ThemedText>
                </View>
                {togglingBiometricLock ? (
                  <ActivityIndicator />
                ) : (
                  <Switch
                    value={biometricLock?.enabled ?? false}
                    onValueChange={handleToggleBiometricLock}
                    trackColor={{ false: Colors.hairline, true: Colors.amber }}
                    thumbColor={Colors.paper}
                  />
                )}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="label" color="muted">
              {strings.cases.title}
            </ThemedText>
            {(cases ?? []).map((c) => (
              <View key={c.id} style={styles.row}>
                <ThemedText type="body" numberOfLines={1} style={styles.rowText}>
                  {c.nickname ?? FORM_TYPE_LABELS[c.formType]}
                </ThemedText>
                <Pressable
                  onPress={() => confirmRemoveCase(c.id, c.nickname ?? FORM_TYPE_LABELS[c.formType])}
                  accessibilityRole="button"
                  accessibilityLabel={strings.settings.removeCase}
                >
                  <ThemedText type="label" color="amber">
                    {strings.settings.removeCase}
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Button variant="secondary" label={strings.settings.exportData} onPress={() => exportUserData()} />
            <Button variant="secondary" label={strings.settings.signOut} onPress={handleSignOut} />
            <Button
              variant="secondary"
              label={strings.settings.deleteAccount}
              onPress={confirmDeleteAccount}
              loading={deleting}
            />
          </View>

          <View style={styles.footerDisclaimers}>
            <ThemedText type="label" color="dim" style={styles.disclaimer}>
              {strings.legal.disclaimer}
            </ThemedText>
            <ThemedText type="label" color="dim" style={styles.disclaimer}>
              {strings.legal.notAffiliated}
            </ThemedText>
          </View>
        </ScrollView>
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
  },
  content: {
    paddingHorizontal: ScreenMargin,
    paddingVertical: Spacing.lg,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    minHeight: 44,
  },
  rowText: {
    flex: 1,
    gap: Spacing.xs,
  },
  footerDisclaimers: {
    gap: Spacing.xs,
  },
  disclaimer: {
    textAlign: 'center',
  },
});
