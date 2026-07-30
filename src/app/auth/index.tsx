import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenMargin, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { enableBiometricLockIfAvailable, markJustSignedIn } from '@/lib/biometric-lock';
import { isValidOtpCode, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone sign-in is fully implemented (Supabase phone auth + Twilio account
// wired up) but hidden until Twilio's Messaging Service is ready — the
// account is still on a trial plan that blocks creating one. Flip this back
// on once that's sorted; nothing else needs to change.
const PHONE_SIGN_IN_ENABLED = false;

type Method = 'email' | 'phone';
type Stage = 'contact' | 'code';

export default function AuthScreen() {
  const [method, setMethod] = useState<Method>('email');
  const [stage, setStage] = useState<Stage>('contact');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const contact = method === 'email' ? email.trim() : normalizePhoneNumber(phone);

  async function handleSendCode() {
    if (method === 'email' && !EMAIL_PATTERN.test(contact)) {
      setError(strings.auth.invalidEmail);
      return;
    }
    if (method === 'phone' && !isValidPhoneNumber(contact)) {
      setError(strings.auth.invalidPhone);
      return;
    }
    setError(undefined);
    setSending(true);
    const { error: signInError } =
      method === 'email'
        ? await supabase.auth.signInWithOtp({ email: contact })
        : await supabase.auth.signInWithOtp({ phone: contact });
    setSending(false);
    if (signInError) {
      setError(strings.auth.genericError);
      return;
    }
    setStage('code');
  }

  async function handleVerifyCode() {
    const trimmedCode = code.trim();
    if (!isValidOtpCode(trimmedCode)) {
      setError(strings.auth.invalidCode);
      return;
    }
    setError(undefined);
    setVerifying(true);
    const { error: verifyError } =
      method === 'email'
        ? await supabase.auth.verifyOtp({ email: contact, token: trimmedCode, type: 'email' })
        : await supabase.auth.verifyOtp({ phone: contact, token: trimmedCode, type: 'sms' });
    setVerifying(false);
    if (verifyError) {
      setError(strings.auth.wrongCode);
      return;
    }
    markJustSignedIn();
    await enableBiometricLockIfAvailable();
    router.replace('/');
  }

  function resetToContact() {
    setStage('contact');
    setCode('');
    setError(undefined);
  }

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.content}>
            {stage === 'code' ? (
              <>
                <ThemedText type="title">{strings.auth.codeTitle}</ThemedText>
                <ThemedText type="body" color="muted" style={styles.subtitle}>
                  {(method === 'email' ? strings.auth.codeBodyEmail : strings.auth.codeBodyPhone).replace(
                    '{contact}',
                    contact,
                  )}
                </ThemedText>
                <TextField
                  label={strings.auth.codeLabel}
                  placeholder={strings.auth.codePlaceholder}
                  value={code}
                  onChangeText={(value: string) => {
                    setCode(value);
                    if (error) setError(undefined);
                  }}
                  error={error}
                  keyboardType="number-pad"
                  maxLength={6}
                  mono
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyCode}
                />
                <Button
                  label={verifying ? strings.auth.verifying : strings.auth.verify}
                  onPress={handleVerifyCode}
                  loading={verifying}
                />
                <Button variant="secondary" label={strings.auth.resendCode} onPress={handleSendCode} />
                <Button variant="secondary" label={strings.auth.useDifferentContact} onPress={resetToContact} />
              </>
            ) : (
              <>
                <ThemedText type="title">{strings.auth.title}</ThemedText>
                <ThemedText type="body" color="muted" style={styles.subtitle}>
                  {strings.auth.subtitle}
                </ThemedText>
                {PHONE_SIGN_IN_ENABLED ? (
                  <ThemedView style={styles.methodRow}>
                    <Chip
                      label={strings.auth.methodEmail}
                      selected={method === 'email'}
                      onPress={() => {
                        setMethod('email');
                        setError(undefined);
                      }}
                    />
                    <Chip
                      label={strings.auth.methodPhone}
                      selected={method === 'phone'}
                      onPress={() => {
                        setMethod('phone');
                        setError(undefined);
                      }}
                    />
                  </ThemedView>
                ) : null}
                {method === 'email' ? (
                  <TextField
                    label={strings.auth.emailLabel}
                    placeholder={strings.auth.emailPlaceholder}
                    value={email}
                    onChangeText={(value: string) => {
                      setEmail(value);
                      if (error) setError(undefined);
                    }}
                    error={error}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="send"
                    onSubmitEditing={handleSendCode}
                  />
                ) : (
                  <TextField
                    label={strings.auth.phoneLabel}
                    placeholder={strings.auth.phonePlaceholder}
                    value={phone}
                    onChangeText={(value: string) => {
                      setPhone(value);
                      if (error) setError(undefined);
                    }}
                    error={error}
                    autoCorrect={false}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    returnKeyType="send"
                    onSubmitEditing={handleSendCode}
                  />
                )}
                <Button
                  label={sending ? strings.auth.sending : strings.auth.sendCode}
                  onPress={handleSendCode}
                  loading={sending}
                />
              </>
            )}
          </ThemedView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: ScreenMargin,
    gap: Spacing.lg,
  },
  subtitle: {
    marginBottom: Spacing.md,
  },
  methodRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: 'transparent',
  },
});
