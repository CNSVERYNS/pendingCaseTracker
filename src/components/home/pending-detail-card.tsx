import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimeField } from '@/components/time-field';
import { Radius, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { track } from '@/lib/analytics';
import { diffDays } from '@/lib/dates';
import type { CaseEventKind, FormType, PendingDetailRow } from '@/lib/database.types';
import { resolveOfficeByZip } from '@/lib/office-resolver';
import { supabase } from '@/lib/supabase';

interface AnswerPlan {
  eventKind: CaseEventKind;
  fromKind: string;
  needsTime: boolean;
}

const ANSWER_PLAN: Partial<Record<PendingDetailRow['kind'], AnswerPlan>> = {
  interview_date: { eventKind: 'interview', fromKind: 'interview_scheduled', needsTime: true },
  biometrics_date: { eventKind: 'biometrics', fromKind: 'biometrics_scheduled', needsTime: true },
  rfe_deadline: { eventKind: 'rfe', fromKind: 'rfe', needsTime: false },
};

const NOTICE_CHIPS = [
  { label: strings.pendingDetails.noticeChips.approval, kind: 'decision' as CaseEventKind },
  { label: strings.pendingDetails.noticeChips.rfeNotice, kind: 'rfe' as CaseEventKind },
  { label: strings.pendingDetails.noticeChips.transferNotice, kind: 'transferred' as CaseEventKind },
  { label: strings.pendingDetails.noticeChips.biometricsNotice, kind: 'biometrics' as CaseEventKind },
  { label: strings.pendingDetails.noticeChips.interviewNotice, kind: 'interview' as CaseEventKind },
  { label: strings.pendingDetails.noticeChips.other, kind: 'other' as CaseEventKind },
];

export interface PendingDetailCardProps {
  detail: PendingDetailRow;
  caseId: string;
  formType: FormType;
  officeCode: string | null;
  onResolved: () => void;
}

export function PendingDetailCard({ detail, caseId, formType, officeCode, onResolved }: PendingDetailCardProps) {
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [zip, setZip] = useState('');
  const [noticeChip, setNoticeChip] = useState<(typeof NOTICE_CHIPS)[number] | null>(null);
  const [saving, setSaving] = useState(false);

  const copy = strings.pendingDetails[detail.kind];

  async function dismiss() {
    await supabase.from('pending_details').update({ dismissed_at: new Date().toISOString() }).eq('id', detail.id);
    onResolved();
  }

  async function saveDateAnswer() {
    const plan = ANSWER_PLAN[detail.kind];
    if (!plan || !date) return;
    setSaving(true);

    await supabase.from('case_events').insert({
      case_id: caseId,
      kind: plan.eventKind,
      occurred_on: date,
      occurred_at_time: plan.needsTime ? (time ?? null) : null,
      source: 'manual',
    });
    await supabase.from('pending_details').update({ answered_at: new Date().toISOString() }).eq('id', detail.id);

    const askedOnDate = detail.asked_at.slice(0, 10);
    const gapDays = diffDays(askedOnDate, date);
    if (gapDays >= 0) {
      await supabase.rpc('record_interval', {
        p_form_type: formType,
        p_office_code: officeCode ?? 'NATIONAL',
        p_from_kind: plan.fromKind,
        p_to_kind: plan.eventKind,
        p_days: gapDays,
      });
    }

    setSaving(false);
    void track('detail_prompt_answered');
    onResolved();
  }

  async function saveNoticeAnswer() {
    if (!date || !noticeChip) return;
    setSaving(true);
    await supabase.from('case_events').insert({
      case_id: caseId,
      kind: noticeChip.kind,
      label: noticeChip.label,
      occurred_on: date,
      source: 'manual',
    });
    await supabase.from('pending_details').update({ answered_at: new Date().toISOString() }).eq('id', detail.id);
    setSaving(false);
    void track('detail_prompt_answered');
    onResolved();
  }

  async function saveOfficeAnswer() {
    setSaving(true);
    const office = resolveOfficeByZip(zip);
    await supabase
      .from('cases')
      .update({ office_code: office?.code ?? null, office_label: office?.label ?? null })
      .eq('id', caseId);
    await supabase.from('pending_details').update({ answered_at: new Date().toISOString() }).eq('id', detail.id);
    setSaving(false);
    void track('detail_prompt_answered');
    onResolved();
  }

  return (
    <ThemedView background="surface" style={styles.card}>
      <ThemedText type="bodyMedium">{copy.question}</ThemedText>
      <ThemedText type="body" color="muted">
        {copy.prompt}
      </ThemedText>

      {detail.kind === 'office_reresolve' ? (
        <TextField label="ZIP code" value={zip} onChangeText={setZip} keyboardType="number-pad" maxLength={5} mono />
      ) : null}

      {detail.kind === 'notice_mailed' ? (
        <View style={styles.chipRow}>
          {NOTICE_CHIPS.map((chip) => (
            <Chip
              key={chip.label}
              label={chip.label}
              selected={noticeChip?.label === chip.label}
              onPress={() => setNoticeChip(chip)}
            />
          ))}
        </View>
      ) : null}

      {detail.kind !== 'office_reresolve' ? <DateField label="Date" value={date} onChange={setDate} /> : null}

      {ANSWER_PLAN[detail.kind]?.needsTime ? <TimeField label="Time (optional)" value={time} onChange={setTime} /> : null}

      <View style={styles.actions}>
        <Button
          label={strings.pendingDetails.save}
          loading={saving}
          disabled={
            detail.kind === 'office_reresolve'
              ? zip.trim().length < 5
              : detail.kind === 'notice_mailed'
                ? !date || !noticeChip
                : !date
          }
          onPress={
            detail.kind === 'office_reresolve'
              ? saveOfficeAnswer
              : detail.kind === 'notice_mailed'
                ? saveNoticeAnswer
                : saveDateAnswer
          }
        />
        <Button variant="secondary" label={strings.pendingDetails.dismiss} onPress={dismiss} disabled={saving} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
