import * as Linking from 'expo-linking';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenMargin, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSendLink() {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(strings.auth.invalidEmail);
      return;
    }
    setError(undefined);
    setSending(true);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: Linking.createURL('auth/callback'),
      },
    });
    setSending(false);
    if (signInError) {
      setError(strings.auth.genericError);
      return;
    }
    setSent(true);
  }

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.content}>
            {sent ? (
              <>
                <ThemedText type="title">{strings.auth.checkEmailTitle}</ThemedText>
                <ThemedText type="body" color="muted" style={styles.subtitle}>
                  {strings.auth.checkEmailBody.replace('{email}', email.trim())}
                </ThemedText>
                <Button
                  variant="secondary"
                  label={strings.auth.useDifferentEmail}
                  onPress={() => setSent(false)}
                />
              </>
            ) : (
              <>
                <ThemedText type="title">{strings.auth.title}</ThemedText>
                <ThemedText type="body" color="muted" style={styles.subtitle}>
                  {strings.auth.subtitle}
                </ThemedText>
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
                  onSubmitEditing={handleSendLink}
                />
                <Button
                  label={sending ? strings.auth.sending : strings.auth.sendLink}
                  onPress={handleSendLink}
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
});
