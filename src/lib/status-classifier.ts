/**
 * Maps a raw USCIS status (title + description) to a timeline event kind
 * and, per the detail-capture table (build brief §7), which question — if
 * any — that change should trigger. Pure pattern matching, no I/O.
 *
 * Order matters: rules are checked top to bottom and the first match wins,
 * so more specific phrases (decision, transfer) are checked before generic
 * ones ("notice was mailed").
 */

import type { CaseEventKind, PendingDetailKind } from '@/lib/database.types';

export interface StatusClassification {
  eventKind: CaseEventKind;
  pendingDetailKind: PendingDetailKind | null;
  isDecision: boolean;
  isDenial: boolean;
}

interface Rule {
  test: (text: string) => boolean;
  classify: (text: string) => StatusClassification;
}

const rules: Rule[] = [
  {
    // "Case Was Denied" / "Case Was Rejected" — checked before the generic
    // decision rule so we can flag the denial explicitly (§13: no alarm, no
    // advice, but the app still needs to know reminders/prompts should stop).
    test: (t) => /\bdeni(ed|al)\b|\brejected\b/.test(t),
    classify: () => ({ eventKind: 'decision', pendingDetailKind: null, isDecision: true, isDenial: true }),
  },
  {
    test: (t) => /\bapproved\b|\bdecision\b|\bwelcome notice\b/.test(t),
    classify: () => ({ eventKind: 'decision', pendingDetailKind: null, isDecision: true, isDenial: false }),
  },
  {
    test: (t) => /\bcard\b.*\b(mail|produc)/.test(t),
    classify: () => ({ eventKind: 'card_mailed', pendingDetailKind: null, isDecision: false, isDenial: false }),
  },
  {
    test: (t) => /\btransferred\b|\bnew office has jurisdiction\b/.test(t),
    classify: () => ({ eventKind: 'transferred', pendingDetailKind: 'office_reresolve', isDecision: false, isDenial: false }),
  },
  {
    test: (t) => /\binterview\b.*\bschedul/.test(t),
    classify: () => ({
      eventKind: 'interview_scheduled',
      pendingDetailKind: 'interview_date',
      isDecision: false,
      isDenial: false,
    }),
  },
  {
    test: (t) => /\bbiometric|fingerprint/.test(t),
    classify: () => ({
      eventKind: 'biometrics_scheduled',
      pendingDetailKind: 'biometrics_date',
      isDecision: false,
      isDenial: false,
    }),
  },
  {
    test: (t) => /\brequest for (additional )?evidence\b|\brfe\b/.test(t),
    classify: () => ({ eventKind: 'rfe', pendingDetailKind: 'rfe_deadline', isDecision: false, isDenial: false }),
  },
  {
    test: (t) => /\bnotice\b.*\b(mail|sent)/.test(t),
    classify: () => ({ eventKind: 'other', pendingDetailKind: 'notice_mailed', isDecision: false, isDenial: false }),
  },
];

export function classifyStatusChange(statusTitle: string, statusText: string): StatusClassification {
  const haystack = `${statusTitle} ${statusText}`.toLowerCase();
  for (const rule of rules) {
    if (rule.test(haystack)) {
      return rule.classify(haystack);
    }
  }
  return { eventKind: 'other', pendingDetailKind: null, isDecision: false, isDenial: false };
}
