import type { FormType } from '@/lib/database.types';

export const SUPPORTED_FORM_TYPES: readonly FormType[] = ['I-485', 'I-765', 'I-130', 'N-400', 'I-131', 'I-751'];

const FORM_TYPE_PATTERN = /\b(I-485|I-765|I-130|N-400|I-131|I-751)\b/i;

/**
 * The public case-status text often mentions the form ("...received your
 * Form I-485...") even though it isn't a structured field — best-effort
 * detection so onboarding can pre-select it, but the user always confirms
 * via the form-type picker rather than this being silently trusted (§10).
 */
export function detectFormType(statusText: string): FormType | null {
  const match = statusText.match(FORM_TYPE_PATTERN);
  if (!match) return null;
  const normalized = match[1].toUpperCase() as FormType;
  return SUPPORTED_FORM_TYPES.includes(normalized) ? normalized : null;
}

export const FORM_TYPE_LABELS: Record<FormType, string> = {
  'I-485': 'Green card application',
  'I-765': 'Work permit (EAD)',
  'I-130': 'Family petition',
  'N-400': 'Naturalization',
  'I-131': 'Travel document',
  'I-751': 'Remove conditions on residence',
};
