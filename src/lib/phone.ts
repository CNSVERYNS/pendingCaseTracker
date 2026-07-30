/**
 * Phone-number and OTP-code validation for the phone sign-in path (build
 * brief follow-up, 2026-07-29). Pure, no I/O. Deliberately no country picker
 * or per-country formatting — a single free-text E.164 field ("+1 555 010
 * 1234") matches the app's existing minimal-input style (receipt number,
 * ZIP) rather than adding a new UI dependency for this.
 */

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const OTP_CODE_PATTERN = /^\d{6}$/;

/** Strips spaces/hyphens/parentheses before validating — display formatting shouldn't affect submission. */
export function normalizePhoneNumber(input: string): string {
  return input.trim().replace(/[\s\-()]/g, '');
}

export function isValidPhoneNumber(input: string): boolean {
  return E164_PATTERN.test(normalizePhoneNumber(input));
}

export function isValidOtpCode(input: string): boolean {
  return OTP_CODE_PATTERN.test(input.trim());
}
