import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenMargin, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { authenticateWithBiometrics, consumeJustSignedIn, isBiometricLockEnabled } from '@/lib/biometric-lock';
import { useSession } from '@/lib/session';

/**
 * A local-only gate in front of the already-persisted Supabase session (see
 * biometric-lock.ts) — never touches the network. Locks on cold start and on
 * returning from the background, but not immediately after a fresh sign-in
 * in the same JS instance (see consumeJustSignedIn).
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  async function tryUnlock() {
    setFailed(false);
    const success = await authenticateWithBiometrics();
    if (success) {
      setLocked(false);
    } else {
      setFailed(true);
    }
  }

  useEffect(() => {
    if (loading || !session) return;

    if (consumeJustSignedIn()) {
      return;
    }

    isBiometricLockEnabled().then((enabled) => {
      if (enabled) {
        setLocked(true);
        void tryUnlock();
      }
    });
    // Only re-check on the initial session-becoming-available transition, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, Boolean(session)]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const wasBackground = appState.current !== 'active';
      appState.current = next;
      if (wasBackground && next === 'active' && session) {
        isBiometricLockEnabled().then((enabled) => {
          if (enabled) {
            setLocked(true);
            void tryUnlock();
          }
        });
      }
    });
    return () => subscription.remove();
  }, [session]);

  if (!locked) {
    return <>{children}</>;
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.text}>
          {strings.biometricLock.title}
        </ThemedText>
        <ThemedText type="body" color="muted" style={styles.text}>
          {strings.biometricLock.subtitle}
        </ThemedText>
        {failed ? (
          <ThemedText type="label" color="amber" style={styles.text}>
            {strings.biometricLock.failed}
          </ThemedText>
        ) : null}
        <Button label={strings.biometricLock.unlock} onPress={tryUnlock} />
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ScreenMargin,
    gap: Spacing.lg,
  },
  text: {
    textAlign: 'center',
  },
});
