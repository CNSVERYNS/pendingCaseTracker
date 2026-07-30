/**
 * Face ID / Touch ID app-lock (build brief follow-up, 2026-07-29): once a
 * device has signed in once (email or phone), it should unlock with
 * biometrics on every later launch instead of repeating the OTP flow. This
 * is a purely local gate in front of the already-persisted Supabase
 * session — it never talks to the network and has no server-side
 * counterpart. I/O glue, not pure logic, so (like notifications.ts) it has
 * no dedicated unit tests; the pure OTP/phone validation it sits behind is
 * tested in phone.test.ts.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const LOCK_ENABLED_KEY = 'pending.biometricLockEnabled';

// In-memory only (not persisted) — true for the rest of this JS instance
// right after a fresh sign-in, so AppLockGate doesn't immediately re-lock
// the screen the user just unlocked by typing their OTP code. Resets to
// false on a real cold start, which is exactly when the lock should apply.
let justSignedIn = false;

export function markJustSignedIn(): void {
  justSignedIn = true;
}

/** Reads and clears the flag in one step so it only ever skips the lock once. */
export function consumeJustSignedIn(): boolean {
  const value = justSignedIn;
  justSignedIn = false;
  return value;
}

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

export async function isBiometricLockEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(LOCK_ENABLED_KEY);
  return value === 'true';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
}

/** Called right after a fresh sign-in — turns the lock on by default if this device can use it. */
export async function enableBiometricLockIfAvailable(): Promise<void> {
  const available = await isBiometricAvailable();
  if (available) {
    await setBiometricLockEnabled(true);
  }
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Pending',
    disableDeviceFallback: false,
  });
  return result.success;
}
