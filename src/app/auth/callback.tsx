import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { strings } from '@/constants/strings';
import { ScreenMargin, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [exchangeFailed, setExchangeFailed] = useState(false);
  const error = !code || exchangeFailed;

  useEffect(() => {
    if (!code) return;
    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setExchangeFailed(true);
        return;
      }
      router.replace('/');
    });
  }, [code]);

  return (
    <ThemedView style={styles.container}>
      {error ? (
        <>
          <ThemedText type="body" color="muted" style={styles.message}>
            {strings.auth.callbackError}
          </ThemedText>
          <Button label={strings.common.retry} onPress={() => router.replace('/auth')} />
        </>
      ) : (
        <>
          <ActivityIndicator />
          <ThemedText type="body" color="muted" style={styles.message}>
            {strings.auth.signingIn}
          </ThemedText>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ScreenMargin,
    gap: Spacing.lg,
  },
  message: {
    textAlign: 'center',
  },
});
