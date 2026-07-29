import { describe, expect, it } from 'vitest';

import { classifyStatusChange } from '@/lib/status-classifier';

describe('classifyStatusChange — §7 detail-capture table', () => {
  it('interview scheduled -> asks for interview date', () => {
    const result = classifyStatusChange('Interview Was Scheduled', 'We scheduled you for an interview.');
    expect(result).toEqual({
      eventKind: 'interview_scheduled',
      pendingDetailKind: 'interview_date',
      isDecision: false,
      isDenial: false,
    });
  });

  it('biometrics scheduled -> asks for appointment date', () => {
    const result = classifyStatusChange('Biometrics Appointment Was Scheduled', '');
    expect(result.eventKind).toBe('biometrics_scheduled');
    expect(result.pendingDetailKind).toBe('biometrics_date');
  });

  it('fingerprint wording also maps to biometrics', () => {
    const result = classifyStatusChange('Fingerprint Fee Was Received', '');
    expect(result.eventKind).toBe('biometrics_scheduled');
  });

  it('a notice was mailed -> asks which notice and its date', () => {
    const result = classifyStatusChange('Notice Was Mailed', 'We mailed you a notice about your case.');
    expect(result.eventKind).toBe('other');
    expect(result.pendingDetailKind).toBe('notice_mailed');
  });

  it('request for evidence -> asks for the response deadline', () => {
    const result = classifyStatusChange('Request for Evidence Was Sent', '');
    expect(result.eventKind).toBe('rfe');
    expect(result.pendingDetailKind).toBe('rfe_deadline');
  });

  it('case was transferred -> re-resolve office', () => {
    const result = classifyStatusChange('Case Was Transferred And A New Office Has Jurisdiction', '');
    expect(result.eventKind).toBe('transferred');
    expect(result.pendingDetailKind).toBe('office_reresolve');
  });

  it('decision (approved) -> never prompts', () => {
    const result = classifyStatusChange('Case Was Approved', '');
    expect(result).toEqual({ eventKind: 'decision', pendingDetailKind: null, isDecision: true, isDenial: false });
  });

  it('decision (denied) -> never prompts, flagged as a denial', () => {
    const result = classifyStatusChange('Case Was Denied', '');
    expect(result).toEqual({ eventKind: 'decision', pendingDetailKind: null, isDecision: true, isDenial: true });
  });

  it('card produced/mailed -> never prompts', () => {
    const result = classifyStatusChange('Card Was Mailed To Me', '');
    expect(result).toEqual({ eventKind: 'card_mailed', pendingDetailKind: null, isDecision: false, isDenial: false });
  });

  it('falls back to "other" with no prompt for unrecognized status text', () => {
    const result = classifyStatusChange('Case Was Received', 'We received your form and will begin processing.');
    expect(result).toEqual({ eventKind: 'other', pendingDetailKind: null, isDecision: false, isDenial: false });
  });
});

describe('classifyStatusChange — priority ordering', () => {
  it('treats a denial before any generic "notice was mailed" phrasing', () => {
    const result = classifyStatusChange('Case Was Denied', 'We mailed you a notice explaining the denial.');
    expect(result.eventKind).toBe('decision');
    expect(result.isDenial).toBe(true);
  });

  it('treats a transfer before a generic notice match', () => {
    const result = classifyStatusChange('Case Was Transferred', 'We mailed you a notice about the transfer.');
    expect(result.eventKind).toBe('transferred');
  });
});
