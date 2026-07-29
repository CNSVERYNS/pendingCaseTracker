/**
 * Office resolution (build brief §8). Getting the office right matters more
 * than any other input, because it drives the ruler and the inquiry date.
 *
 * Non-IOE receipts: the 3-letter prefix identifies the service center — this
 * mapping is derived silently, never asked. IOE receipts (USCIS's online
 * filing system, ELIS) don't carry a service-center prefix, so we resolve
 * the field office from the ZIP code the user enters — but that ZIP is used
 * for exactly one lookup and is never sent anywhere or persisted; only the
 * resulting `office_code` is (§8, §11).
 *
 * KNOWN GAP (researched 2026-07-29, still open): USCIS does not publish a
 * bulk ZIP-to-field-office jurisdiction dataset anywhere — the only official
 * tool is the interactive locator at uscis.gov/about-us/find-a-uscis-office,
 * which resolves one ZIP at a time and sits behind bot protection that
 * blocks programmatic fetching. There are 92 field offices total; the table
 * below covers roughly 35 of the largest metros, each pairing a confirmed
 * "this city has a USCIS field office" (cross-checked across two
 * independent directories) with that metro's well-known 3-digit ZIP prefix.
 * That's standard postal geography, not verified USCIS jurisdiction
 * boundaries, so it will be wrong at the edges (a ZIP just outside a metro
 * that's actually assigned to a neighboring office). Filling in the rest
 * needs either manual per-ZIP entry against the official locator or a
 * licensed third-party dataset — a real data-entry task, not something
 * scrapable in bulk. Everything not in this table correctly falls back to
 * the national range (§8) rather than guessing.
 */

export interface Office {
  code: string;
  label: string;
}

const SERVICE_CENTER_BY_PREFIX: Record<string, Office> = {
  WAC: { code: 'CSC', label: 'California Service Center' },
  LIN: { code: 'NSC', label: 'Nebraska Service Center' },
  EAC: { code: 'VSC', label: 'Vermont Service Center' },
  SRC: { code: 'TSC', label: 'Texas Service Center' },
  MSC: { code: 'NBC', label: 'National Benefits Center' },
  NBC: { code: 'NBC', label: 'National Benefits Center' },
  YSC: { code: 'PSC', label: 'Potomac Service Center' },
};

/**
 * ZIP-prefix -> field office, ~35 largest metros. Partial coverage only —
 * see the KNOWN GAP note in the module doc above for why and what's missing.
 */
const OFFICE_BY_ZIP_PREFIX: Record<string, Office> = {
  '100': { code: 'NYC', label: 'New York City Field Office' },
  '104': { code: 'NYC', label: 'New York City Field Office' },
  '900': { code: 'LOS', label: 'Los Angeles Field Office' },
  '902': { code: 'LOS', label: 'Los Angeles Field Office' },
  '606': { code: 'CHI', label: 'Chicago Field Office' },
  '770': { code: 'HOU', label: 'Houston Field Office' },
  '750': { code: 'DAL', label: 'Dallas Field Office' },
  '331': { code: 'MIA', label: 'Miami Field Office' },
  '981': { code: 'SEA', label: 'Seattle Field Office' },
  '980': { code: 'SEA', label: 'Seattle Field Office' },
  '852': { code: 'PHX', label: 'Phoenix Field Office' },
  '303': { code: 'ATL', label: 'Atlanta Field Office' },
  '191': { code: 'PHI', label: 'Philadelphia Field Office' },
  '021': { code: 'BOS', label: 'Boston Field Office' },
  '941': { code: 'SFR', label: 'San Francisco Field Office' },
  '800': { code: 'DEN', label: 'Denver Field Office' },
  '802': { code: 'DEN', label: 'Denver Field Office' },
  '482': { code: 'DET', label: 'Detroit Field Office' },
  '282': { code: 'CLT', label: 'Charlotte Field Office' },
  '071': { code: 'NWK', label: 'Newark Field Office' },
  '212': { code: 'BAL', label: 'Baltimore Field Office' },
  '200': { code: 'WAS', label: 'Washington District Office' },
  '891': { code: 'LAS', label: 'Las Vegas Field Office' },
  '972': { code: 'POR', label: 'Portland Field Office' },
  '631': { code: 'STL', label: 'St. Louis Field Office' },
  '372': { code: 'NAS', label: 'Nashville Field Office' },
  '701': { code: 'NOL', label: 'New Orleans Field Office' },
  '462': { code: 'IND', label: 'Indianapolis Field Office' },
  '432': { code: 'CMH', label: 'Columbus Field Office' },
  '532': { code: 'MIL', label: 'Milwaukee Field Office' },
  '841': { code: 'SLC', label: 'Salt Lake City Field Office' },
  '731': { code: 'OKC', label: 'Oklahoma City Field Office' },
  '381': { code: 'MEM', label: 'Memphis Field Office' },
  '641': { code: 'KC', label: 'Kansas City Field Office' },
  '968': { code: 'HON', label: 'Honolulu Field Office' },
  '995': { code: 'ANC', label: 'Anchorage Field Office' },
  '871': { code: 'ABQ', label: 'Albuquerque Field Office' },
  '061': { code: 'HAR', label: 'Hartford Field Office' },
  '029': { code: 'PRO', label: 'Providence Field Office' },
  '152': { code: 'PIT', label: 'Pittsburgh Field Office' },
  '322': { code: 'JAX', label: 'Jacksonville Field Office' },
};

/**
 * Derives the service center from a non-IOE receipt number's 3-letter
 * prefix. Returns null for prefixes we don't yet map (including IOE, which
 * must go through `resolveOfficeByZip` instead) or malformed input.
 */
export function resolveOfficeByPrefix(receiptNumber: string): Office | null {
  const prefix = receiptNumber.trim().toUpperCase().slice(0, 3);
  return SERVICE_CENTER_BY_PREFIX[prefix] ?? null;
}

export function isOnlineFilingReceipt(receiptNumber: string): boolean {
  return receiptNumber.trim().toUpperCase().startsWith('IOE');
}

/**
 * Resolves a ZIP code to a field office. The ZIP itself must be discarded by
 * the caller immediately after this call — only the returned Office should
 * ever reach storage.
 */
export function resolveOfficeByZip(zip: string): Office | null {
  const digitsOnly = zip.trim().replace(/\D/g, '');
  if (digitsOnly.length < 3) {
    return null;
  }
  return OFFICE_BY_ZIP_PREFIX[digitsOnly.slice(0, 3)] ?? null;
}

export const NATIONAL_OFFICE_CODE = 'NATIONAL';
