import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { FORM_TYPE_LABELS, SUPPORTED_FORM_TYPES } from '@/lib/form-type';
import { isValidReceiptNumber, normalizeReceiptNumber } from '@/lib/receipt';
import { isOnlineFilingReceipt, resolveOfficeByPrefix } from '@/lib/office-resolver';
import { useOnboarding } from '@/lib/onboarding-context';
import { supabase } from '@/lib/supabase';
import type { FormType } from '@/lib/database.types';

type LookupPhase = 'idle' | 'checking' | 'done';

export default function ReceiptStep() {
  const { state, setReceipt, setOffice, setLookup, setFormType } = useOnboarding();
  const [input, setInput] = useState(state.receiptNumber);
  const [formatError, setFormatError] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<LookupPhase>('idle');
  const [notFound, setNotFound] = useState(false);
  const [duplicateCaseId, setDuplicateCaseId] = useState<string | null>(null);

  async function handleCheck() {
    const normalized = normalizeReceiptNumber(input);
    if (!isValidReceiptNumber(normalized)) {
      setFormatError(strings.onboarding.receipt.invalidFormat);
      return;
    }
    setFormatError(undefined);
    setNotFound(false);
    setDuplicateCaseId(null);
    setPhase('checking');

    const isOnlineFiling = isOnlineFilingReceipt(normalized);
    setReceipt(normalized, isOnlineFiling);

    if (!isOnlineFiling) {
      const office = resolveOfficeByPrefix(normalized);
      setOffice(office?.code ?? null, office?.label ?? null);
    } else {
      setOffice(null, null);
    }

    const [{ data: existing }, lookupResult] = await Promise.all([
      supabase.from('cases').select('id').eq('receipt_number', normalized).maybeSingle(),
      supabase.functions.invoke<{
        statusTitle: string;
        statusText: string;
        formType: FormType | null;
        filedOn: string | null;
        error?: string;
      }>('lookup-case', { body: { receiptNumber: normalized } }),
    ]);

    if (existing) {
      setDuplicateCaseId(existing.id);
      setPhase('done');
      return;
    }

    const body = lookupResult.data;
    if (lookupResult.error || !body || body.error === 'unavailable') {
      setLookup(null, null, null, null, true);
    } else if (body.error === 'not_found') {
      setNotFound(true);
      setPhase('idle');
      return;
    } else {
      setLookup(body.statusTitle, body.statusText, body.formType, body.filedOn, false);
    }
    setPhase('done');
  }

  function handleContinue() {
    if (!state.formType) return;
    router.push('/onboarding/filing-date');
  }

  if (duplicateCaseId) {
    return (
      <OnboardingScreen
        step={1}
        totalSteps={5}
        title={strings.onboarding.receipt.duplicateTitle}
        footer={<Button label={strings.onboarding.receipt.openExisting} onPress={() => router.replace('/')} />}
      >
        <ThemedText type="body" color="muted">
          {strings.onboarding.receipt.duplicateBody}
        </ThemedText>
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen
      step={1}
      totalSteps={5}
      title={strings.onboarding.receipt.title}
      subtitle={strings.onboarding.receipt.subtitle}
      footer={
        <Button
          label={strings.common.continue}
          disabled={!state.formType || phase === 'checking'}
          onPress={handleContinue}
        />
      }
    >
      <TextField
        label={strings.onboarding.receipt.label}
        placeholder={strings.onboarding.receipt.placeholder}
        value={input}
        onChangeText={(value: string) => {
          setInput(value);
          if (formatError) setFormatError(undefined);
          if (notFound) setNotFound(false);
        }}
        onBlur={handleCheck}
        onSubmitEditing={handleCheck}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={13}
        mono
        error={formatError ?? (notFound ? strings.onboarding.receipt.notFound : undefined)}
      />

      {phase === 'checking' ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <ThemedText type="body" color="muted">
            {strings.onboarding.receipt.checking}
          </ThemedText>
        </View>
      ) : null}

      {phase === 'done' && state.lookupStatusTitle ? (
        <View style={styles.statusCard}>
          <ThemedText type="label" color="muted">
            {strings.onboarding.receipt.checkedTitle}
          </ThemedText>
          <ThemedText type="subtitle">{state.lookupStatusTitle}</ThemedText>
        </View>
      ) : null}

      {phase === 'done' && state.lookupFailed ? (
        <ThemedText type="body" color="muted">
          {strings.onboarding.receipt.unavailable}
        </ThemedText>
      ) : null}

      {phase === 'done' ? (
        <View style={styles.formTypeSection}>
          <ThemedText type="label" color="muted">
            {strings.onboarding.formType.label}
          </ThemedText>
          <View style={styles.chipRow}>
            {SUPPORTED_FORM_TYPES.map((ft) => (
              <Chip key={ft} label={`${ft} · ${FORM_TYPE_LABELS[ft]}`} selected={state.formType === ft} onPress={() => setFormType(ft)} />
            ))}
          </View>
        </View>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusCard: {
    gap: Spacing.xs,
  },
  formTypeSection: {
    gap: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
