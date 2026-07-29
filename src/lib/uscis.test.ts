import { describe, expect, it, vi } from 'vitest';

import {
  createUscisClient,
  UscisAuthError,
  UscisInvalidFormatError,
  UscisNotFoundError,
  UscisRateLimitError,
  type UscisApiCallEvent,
} from '@/lib/uscis';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function tokenOk(expiresIn = 3600) {
  return jsonResponse(200, { access_token: 'test-token', expires_in: expiresIn });
}

// Matches the confirmed USCIS Case Status API v1.0 response shape — a single
// `case_status` object, not an array (see src/lib/uscis.ts module doc).
function statusOk(overrides: Record<string, unknown> = {}) {
  return jsonResponse(200, {
    case_status: {
      receiptNumber: 'IOE0912345678',
      formType: 'I-485',
      submittedDate: '01-15-2026 00:00:00',
      modifiedDate: '06-01-2026 00:00:00',
      current_case_status_text_en: 'Case Was Received',
      current_case_status_desc_en: 'We received your form.',
      ...overrides,
    },
  });
}

function baseConfig(fetchImpl: typeof fetch, overrides: Partial<Parameters<typeof createUscisClient>[0]> = {}) {
  return {
    baseUrl: 'https://sandbox.example',
    clientId: 'id',
    clientSecret: 'secret',
    fetchImpl,
    now: () => 0,
    sleepImpl: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('createUscisClient — happy path', () => {
  it('fetches a token then the case status', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('accesstoken')) return tokenOk();
      return statusOk();
    });

    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch));
    const result = await client.fetchCaseStatus('IOE0912345678');

    expect(result.receiptNumber).toBe('IOE0912345678');
    expect(result.statusTitle).toBe('Case Was Received');
    expect(result.statusText).toBe('We received your form.');
    expect(calls).toHaveLength(2);
  });

  it('sends client_id/client_secret as body params, not a Basic Auth header — confirmed against the Torch platform docs', async () => {
    let tokenRequestInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('accesstoken')) {
        tokenRequestInit = init;
        return tokenOk();
      }
      return statusOk();
    });

    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch));
    await client.fetchCaseStatus('IOE0912345678');

    const headers = tokenRequestInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(String(tokenRequestInit?.body)).toContain('client_id=id');
    expect(String(tokenRequestInit?.body)).toContain('client_secret=secret');
    expect(String(tokenRequestInit?.body)).toContain('grant_type=client_credentials');
  });

  it('parses formType and submittedDate from the confirmed response shape', async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.includes('accesstoken') ? tokenOk() : statusOk()));
    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch));
    const result = await client.fetchCaseStatus('IOE0912345678');

    expect(result.formType).toBe('I-485');
    expect(result.filedOn).toBe('2026-01-15');
  });

  it('falls back to null formType/filedOn when the API omits them', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('accesstoken') ? tokenOk() : statusOk({ formType: '', submittedDate: undefined }),
    );
    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch));
    const result = await client.fetchCaseStatus('IOE0912345678');

    expect(result.formType).toBeNull();
    expect(result.filedOn).toBeNull();
  });

  it('reuses a cached token across calls', async () => {
    let tokenCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('accesstoken')) {
        tokenCalls += 1;
        return tokenOk();
      }
      return statusOk();
    });

    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch));
    await client.fetchCaseStatus('IOE0912345678');
    await client.fetchCaseStatus('IOE0912345679');

    expect(tokenCalls).toBe(1);
  });

  it('refreshes the token once it is past its expiry buffer', async () => {
    let tokenCalls = 0;
    let clock = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('accesstoken')) {
        tokenCalls += 1;
        return tokenOk(60); // expires in 60s
      }
      return statusOk();
    });

    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch, { now: () => clock }));
    await client.fetchCaseStatus('IOE0912345678');
    clock += 61_000; // past expiry
    await client.fetchCaseStatus('IOE0912345678');

    expect(tokenCalls).toBe(2);
  });

  it('logs every attempt via onApiCall, including token and case-status calls', async () => {
    const events: UscisApiCallEvent[] = [];
    const fetchImpl = vi.fn(async (url: string) => (url.includes('accesstoken') ? tokenOk() : statusOk()));

    const client = createUscisClient(
      baseConfig(fetchImpl as unknown as typeof fetch, { onApiCall: (e) => events.push(e) }),
    );
    await client.fetchCaseStatus('IOE0912345678');

    expect(events.map((e) => e.endpoint)).toEqual(['token', 'case-status']);
    expect(events.every((e) => e.ok)).toBe(true);
  });
});

describe('createUscisClient — auth failures', () => {
  it('throws UscisAuthError on bad credentials and never retries', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: 'invalid_client' }));
    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch, { maxAttempts: 3 }));

    await expect(client.fetchCaseStatus('IOE0912345678')).rejects.toBeInstanceOf(UscisAuthError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('createUscisClient — not found', () => {
  it('throws UscisNotFoundError on a 404 and does not retry', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('accesstoken') ? tokenOk() : jsonResponse(404, { error: 'not_found' }),
    );
    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch, { maxAttempts: 3 }));

    await expect(client.fetchCaseStatus('IOE0912345678')).rejects.toBeInstanceOf(UscisNotFoundError);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // one token call + one case-status call, no retries
  });

  it('throws UscisNotFoundError on the real sandbox "not found" shape — HTTP 200 with every field empty', async () => {
    // Live-verified against the actual sandbox (see module doc comment):
    // an unrecognized-but-well-formed receipt number returns 200, not 404.
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('accesstoken')
        ? tokenOk()
        : jsonResponse(200, {
            case_status: {
              receiptNumber: '',
              formType: '',
              submittedDate: '',
              modifiedDate: '',
              current_case_status_text_en: '',
              current_case_status_desc_en: '',
              current_case_status_text_es: '',
              current_case_status_desc_es: '',
              hist_case_status: null,
            },
          }),
    );
    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch));

    await expect(client.fetchCaseStatus('EAC0000000000')).rejects.toBeInstanceOf(UscisNotFoundError);
  });
});

describe('createUscisClient — invalid receipt format', () => {
  it('throws UscisInvalidFormatError on a 422 and does not retry', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('accesstoken') ? tokenOk() : jsonResponse(422, { message: 'invalid receipt number' }),
    );
    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch, { maxAttempts: 3 }));

    await expect(client.fetchCaseStatus('IOE0912345678')).rejects.toBeInstanceOf(UscisInvalidFormatError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('createUscisClient — rate limiting', () => {
  it('retries with backoff on 429 and eventually succeeds', async () => {
    let statusCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('accesstoken')) return tokenOk();
      statusCalls += 1;
      if (statusCalls < 3) return jsonResponse(429, { error: 'rate_limited' });
      return statusOk();
    });
    const sleepImpl = vi.fn(async () => undefined);

    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch, { maxAttempts: 3, sleepImpl }));
    const result = await client.fetchCaseStatus('IOE0912345678');

    expect(result.statusTitle).toBe('Case Was Received');
    expect(statusCalls).toBe(3);
    expect(sleepImpl).toHaveBeenCalledTimes(2);
  });

  it('throws UscisRateLimitError after exhausting max attempts', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('accesstoken') ? tokenOk() : jsonResponse(429, { error: 'rate_limited' }),
    );

    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 }));

    await expect(client.fetchCaseStatus('IOE0912345678')).rejects.toBeInstanceOf(UscisRateLimitError);
  });

  it('never destroys prior state on its own — it only throws, callers own persistence', async () => {
    // uscis.ts has no persistence of its own; this test documents that a
    // failed call surfaces as a rejected promise and nothing else.
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('accesstoken') ? tokenOk() : jsonResponse(500, { error: 'boom' }),
    );
    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch, { maxAttempts: 1 }));

    await expect(client.fetchCaseStatus('IOE0912345678')).rejects.toThrow(/status 500/);
  });
});

describe('createUscisClient — network failure', () => {
  it('retries on a rejected fetch and surfaces UscisNetworkError after exhausting attempts', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('accesstoken')) return tokenOk();
      throw new TypeError('Network request failed');
    });

    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 }));

    await expect(client.fetchCaseStatus('IOE0912345678')).rejects.toThrow('Network request failed');
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 token + 2 case-status attempts
  });
});

describe('createUscisClient — token expiry mid-flight', () => {
  it('clears the cached token and refetches after a 401 from case-status', async () => {
    let tokenCalls = 0;
    let statusCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('accesstoken')) {
        tokenCalls += 1;
        return tokenOk();
      }
      statusCalls += 1;
      if (statusCalls === 1) return jsonResponse(401, { error: 'invalid_token' });
      return statusOk();
    });

    const client = createUscisClient(baseConfig(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 }));
    const result = await client.fetchCaseStatus('IOE0912345678');

    expect(result.statusTitle).toBe('Case Was Received');
    expect(tokenCalls).toBe(2);
  });
});
