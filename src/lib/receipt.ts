/**
 * Receipt number validation and masking (build brief §2, §4). A receipt
 * number is 3 uppercase letters (service center prefix) + 10 digits — e.g.
 * `IOE0912345678`. Pure, no I/O.
 */

const RECEIPT_PATTERN = /^[A-Z]{3}[0-9]{10}$/;

export function normalizeReceiptNumber(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidReceiptNumber(input: string): boolean {
  return RECEIPT_PATTERN.test(normalizeReceiptNumber(input));
}

export function receiptPrefix(receiptNumber: string): string {
  return normalizeReceiptNumber(receiptNumber).slice(0, 3);
}

/**
 * Masks a receipt number for any shareable or on-screen display: keeps the
 * first 7 and last 3 characters, and always replaces the middle with exactly
 * five bullets regardless of how many characters that actually covers —
 * `IOE0912345678` -> `IOE0912•••••678`. The full number must never appear in
 * any shareable output.
 */
export function maskReceiptNumber(receiptNumber: string): string {
  const normalized = normalizeReceiptNumber(receiptNumber);
  if (normalized.length < 10) {
    return '•••••';
  }
  return `${normalized.slice(0, 7)}•••••${normalized.slice(-3)}`;
}
