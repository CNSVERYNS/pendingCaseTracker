/**
 * The one place that talks to USCIS (build brief §5). Runs only inside the
 * `poll-cases` Edge Function, never in the client bundle — the client never
 * talks to USCIS, and credentials live in Edge Function env only (§16).
 *
 * Everything USCIS-specific (endpoint paths, the token grant, the response
 * shape) is injectable/isolated behind `createUscisClient` so it can be
 * replaced without touching any caller.
 *
 * Verified 2026-07-29 against the USCIS Case Status API v1.0 OpenAPI spec
 * (developer.uscis.gov/api/case-status, spec file
 * apidoc_specs/case-status-api-smartdoc_26.yaml), the Torch platform's
 * "How to Get Access Tokens with Client Credentials" article, AND a live
 * sandbox call against a real Team App (token request, a known-good
 * receipt number, an unrecognized one, and a malformed one):
 *   - Sandbox host: https://api-int.uscis.gov
 *   - Token endpoint: POST /oauth/accesstoken — client_id/client_secret sent
 *     as url-encoded BODY parameters alongside grant_type=client_credentials
 *     (NOT an HTTP Basic Auth header — that was this file's one guess, and
 *     it was wrong). Tokens expire in ~1799s (~30 min), per `expires_in`.
 *     Live-tested: works exactly as documented.
 *   - Case-status endpoint: GET /case-status/{receiptNumber}
 *   - Response: `{ case_status: { receiptNumber, formType, submittedDate,
 *     modifiedDate, current_case_status_text_en, current_case_status_desc_en,
 *     ... }, message }` — a single object, not an array. Live-tested: exact
 *     match.
 *   - Malformed receipt number (live-tested, e.g. "ABC123"): HTTP 422 with
 *     `{ message: "..." }` — matches the spec.
 *   - Unrecognized-but-well-formed receipt number (live-tested, e.g.
 *     "EAC0000000000"): HTTP 200 with every `case_status` field as an empty
 *     string and `hist_case_status: null` — NOT the 404 the spec's error
 *     table implies. `parseCaseStatusResponse` treats an empty
 *     `current_case_status_text_en` as the real not-found signal; the 404
 *     branch in `requestCaseStatus` is kept as a second path in case the API
 *     ever does use it.
 *   - Rate limits per the spec (untested live — would require exhausting
 *     quota): sandbox 5 req/s, 1,000/day; production 10 req/s, 150,000/day.
 *   - `hist_case_status` (live-verified 2026-07-29 across several sandbox
 *     receipts): an array of `{ date, completed_text_en, completed_text_es }`
 *     milestone entries — the receipt's full history *to date*, already
 *     populated on the very first lookup, not something Pending has to
 *     accumulate over repeated polls. `create-case` uses this to backfill
 *     `case_events` once at creation time so a case's timeline reflects its
 *     real history immediately, not just changes detected after it was added.
 */

export type UscisApiEndpoint = 'token' | 'case-status';

export interface UscisApiCallEvent {
  endpoint: UscisApiEndpoint;
  receiptNumber?: string;
  statusCode: number | null;
  ok: boolean;
  attempt: number;
  calledAt: string;
}

export interface CaseHistoryEntry {
  /** Already YYYY-MM-DD in the API's `hist_case_status[].date` field, unlike `submittedDate`/`modifiedDate`. */
  occurredOn: string;
  label: string;
}

export interface CaseStatusResult {
  receiptNumber: string;
  statusTitle: string;
  statusText: string;
  /** From the API's `formType` field — null if it ever comes back empty. */
  formType: string | null;
  /** From the API's `submittedDate`, normalized to YYYY-MM-DD — null if absent/unparseable. */
  filedOn: string | null;
  /**
   * From `hist_case_status` — live-verified 2026-07-29 to be the receipt's
   * full milestone history to date (e.g. biometrics/interview/decision
   * entries with real dates), not just a log of Pending's own past polls.
   * Oldest first. Empty when the API omits it or every entry is malformed.
   */
  history: CaseHistoryEntry[];
  receivedAt: string;
}

export interface UscisConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  tokenPath?: string;
  caseStatusPath?: (receiptNumber: string) => string;
  fetchImpl?: typeof fetch;
  /** Injected clock, so token-expiry math is deterministic in tests. */
  now?: () => number;
  maxAttempts?: number;
  /** Injected so tests don't wait on real backoff timers. */
  sleepImpl?: (ms: number) => Promise<void>;
  onApiCall?: (event: UscisApiCallEvent) => void;
}

export class UscisApiError extends Error {
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(message: string, opts: { statusCode?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'UscisApiError';
    this.statusCode = opts.statusCode;
    this.retryable = opts.retryable ?? false;
  }
}

export class UscisRateLimitError extends UscisApiError {
  constructor(message: string, statusCode?: number) {
    super(message, { statusCode, retryable: true });
    this.name = 'UscisRateLimitError';
  }
}

export class UscisAuthError extends UscisApiError {
  constructor(message: string, statusCode?: number) {
    super(message, { statusCode, retryable: false });
    this.name = 'UscisAuthError';
  }
}

export class UscisTokenExpiredError extends UscisApiError {
  constructor(message: string, statusCode?: number) {
    super(message, { statusCode, retryable: true });
    this.name = 'UscisTokenExpiredError';
  }
}

export class UscisNotFoundError extends UscisApiError {
  constructor(message: string, statusCode?: number) {
    super(message, { statusCode, retryable: false });
    this.name = 'UscisNotFoundError';
  }
}

export class UscisInvalidFormatError extends UscisApiError {
  constructor(message: string, statusCode?: number) {
    super(message, { statusCode, retryable: false });
    this.name = 'UscisInvalidFormatError';
  }
}

export class UscisNetworkError extends UscisApiError {
  constructor(message: string) {
    super(message, { retryable: true });
    this.name = 'UscisNetworkError';
  }
}

const TOKEN_EXPIRY_BUFFER_MS = 30_000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number, err: UscisApiError): number {
  const base = err instanceof UscisRateLimitError ? 2000 : 500;
  return base * 2 ** (attempt - 1);
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/** "MM-DD-YYYY HH:MM:SS" (the API's format) -> "YYYY-MM-DD", or null if unparseable. */
function parseUscisDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

/** `hist_case_status[].date` is already YYYY-MM-DD, unlike `submittedDate`/`modifiedDate` — live-verified 2026-07-29. */
function parseCaseHistory(value: unknown): CaseHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: CaseHistoryEntry[] = [];
  for (const item of value) {
    const record = item as Record<string, unknown>;
    const occurredOn = typeof record?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date) ? record.date : null;
    const label = typeof record?.completed_text_en === 'string' ? record.completed_text_en : null;
    if (occurredOn && label) {
      entries.push({ occurredOn, label });
    }
  }
  return entries.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
}

/** Confirmed response shape — see the module doc comment above. */
export function parseCaseStatusResponse(receiptNumber: string, body: unknown, receivedAt: string): CaseStatusResult {
  const record = (body as { case_status?: Record<string, unknown> })?.case_status;

  const statusTitle = typeof record?.current_case_status_text_en === 'string' ? record.current_case_status_text_en : '';
  const statusText =
    typeof record?.current_case_status_desc_en === 'string' ? record.current_case_status_desc_en : statusTitle;

  if (!statusTitle) {
    // Confirmed 2026-07-29 against a live sandbox call: an unrecognized-but-
    // well-formed receipt number does NOT come back as 404 (despite the
    // OpenAPI spec's error table) — it's HTTP 200 with every case_status
    // field as an empty string and hist_case_status as null. That's the
    // real "not found" signal; the 404 branch in requestCaseStatus is kept
    // as a second path in case the API ever does use it.
    throw new UscisNotFoundError(`No USCIS case found for receipt number ${receiptNumber}`);
  }

  return {
    receiptNumber,
    statusTitle,
    statusText,
    formType: typeof record?.formType === 'string' && record.formType ? record.formType : null,
    filedOn: parseUscisDate(record?.submittedDate),
    history: parseCaseHistory((body as { case_status?: Record<string, unknown> })?.case_status?.hist_case_status),
    receivedAt,
  };
}

export function createUscisClient(config: UscisConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const now = config.now ?? Date.now;
  const maxAttempts = config.maxAttempts ?? 3;
  const sleepImpl = config.sleepImpl ?? defaultSleep;
  const tokenPath = config.tokenPath ?? '/oauth/accesstoken';
  const caseStatusPath = config.caseStatusPath ?? ((receiptNumber: string) => `/case-status/${receiptNumber}`);

  let cachedToken: CachedToken | null = null;

  async function doFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchImpl(url, init);
    } catch (cause) {
      throw new UscisNetworkError(cause instanceof Error ? cause.message : 'Network request to USCIS failed');
    }
  }

  async function requestToken(attempt: number): Promise<CachedToken> {
    const calledAt = new Date(now()).toISOString();
    let res: Response;
    try {
      res = await doFetch(`${config.baseUrl}${tokenPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
      });
    } catch (err) {
      config.onApiCall?.({ endpoint: 'token', statusCode: null, ok: false, attempt, calledAt });
      throw err;
    }

    config.onApiCall?.({ endpoint: 'token', statusCode: res.status, ok: res.ok, attempt, calledAt });

    if (res.status === 401 || res.status === 403) {
      throw new UscisAuthError('USCIS rejected the client credentials', res.status);
    }
    if (res.status === 429) {
      throw new UscisRateLimitError('USCIS token endpoint rate limited this request', res.status);
    }
    if (!res.ok) {
      throw new UscisApiError(`USCIS token request failed with status ${res.status}`, {
        statusCode: res.status,
        retryable: res.status >= 500,
      });
    }

    const body = (await res.json()) as { access_token: string; expires_in: number };
    return { accessToken: body.access_token, expiresAt: now() + body.expires_in * 1000 };
  }

  async function getToken(attempt: number): Promise<string> {
    if (cachedToken && cachedToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS > now()) {
      return cachedToken.accessToken;
    }
    cachedToken = await requestToken(attempt);
    return cachedToken.accessToken;
  }

  async function requestCaseStatus(receiptNumber: string, token: string, attempt: number): Promise<CaseStatusResult> {
    const calledAt = new Date(now()).toISOString();
    let res: Response;
    try {
      res = await doFetch(`${config.baseUrl}${caseStatusPath(receiptNumber)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      config.onApiCall?.({ endpoint: 'case-status', receiptNumber, statusCode: null, ok: false, attempt, calledAt });
      throw err;
    }

    config.onApiCall?.({
      endpoint: 'case-status',
      receiptNumber,
      statusCode: res.status,
      ok: res.ok,
      attempt,
      calledAt,
    });

    if (res.status === 401) {
      throw new UscisTokenExpiredError('USCIS access token was rejected — refreshing and retrying', res.status);
    }
    if (res.status === 404) {
      throw new UscisNotFoundError(`No USCIS case found for receipt number ${receiptNumber}`, res.status);
    }
    if (res.status === 422) {
      throw new UscisInvalidFormatError(`USCIS rejected the receipt number format: ${receiptNumber}`, res.status);
    }
    if (res.status === 429) {
      throw new UscisRateLimitError('USCIS case-status endpoint rate limited this request', res.status);
    }
    if (!res.ok) {
      throw new UscisApiError(`USCIS case-status request failed with status ${res.status}`, {
        statusCode: res.status,
        retryable: res.status >= 500,
      });
    }

    const body = await res.json();
    return parseCaseStatusResponse(receiptNumber, body, calledAt);
  }

  async function fetchCaseStatus(receiptNumber: string): Promise<CaseStatusResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const token = await getToken(attempt);
        return await requestCaseStatus(receiptNumber, token, attempt);
      } catch (err) {
        lastError = err;

        if (err instanceof UscisTokenExpiredError) {
          cachedToken = null;
        }

        const retryable = err instanceof UscisApiError ? err.retryable : false;
        if (!retryable || attempt === maxAttempts) {
          throw err;
        }
        await sleepImpl(backoffMs(attempt, err as UscisApiError));
      }
    }

    // Unreachable — the loop always returns or throws — but keeps TS happy.
    throw lastError;
  }

  return { fetchCaseStatus };
}
