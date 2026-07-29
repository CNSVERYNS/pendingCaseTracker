/**
 * Detail-capture re-ask rule (build brief §7): "If ignored, ask once more
 * after 3 days, then stop." Pure — used both by the Home screen (which card
 * to show, if any) and by the poll Edge Function (whether to re-notify).
 *
 * Encoded using only the existing pending_details columns (asked_at,
 * answered_at, dismissed_at) — no extra "how many times shown" counter:
 * a dismissal that happened before the 3-day mark earns exactly one
 * re-surface once that mark passes; a dismissal at or after the 3-day mark
 * does not, which is what makes this "once more, then stop".
 */

const RE_ASK_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

export interface PendingDetailLike {
  askedAt: string;
  answeredAt: string | null;
  dismissedAt: string | null;
}

export function isPendingDetailDue(detail: PendingDetailLike, now: string): boolean {
  if (detail.answeredAt) {
    return false;
  }
  if (!detail.dismissedAt) {
    return true;
  }

  const reAskAt = new Date(Date.parse(detail.askedAt) + RE_ASK_DELAY_MS).toISOString();
  return now >= reAskAt && detail.dismissedAt < reAskAt;
}
