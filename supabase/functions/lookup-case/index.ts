// Deno Edge Function — the one path onboarding uses to preview a case
// before it's saved (build brief §10 step 1). Does not write to the
// database; onboarding's final step does that once the whole wizard is
// complete. Requires a valid user JWT (see supabase/config.toml) so an
// unauthenticated caller can't spend USCIS quota.
import { createUscisClient, UscisInvalidFormatError, UscisNotFoundError } from '../../../src/lib/uscis.ts';
import { isValidReceiptNumber, normalizeReceiptNumber } from '../../../src/lib/receipt.ts';
import { detectFormType, SUPPORTED_FORM_TYPES } from '../../../src/lib/form-type.ts';
import { corsHeaders } from '../_shared/cors.ts';

const USCIS_BASE_URL = Deno.env.get('USCIS_BASE_URL')!;
const USCIS_CLIENT_ID = Deno.env.get('USCIS_CLIENT_ID')!;
const USCIS_CLIENT_SECRET = Deno.env.get('USCIS_CLIENT_SECRET')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let receiptNumber: string;
  try {
    const body = await req.json();
    receiptNumber = normalizeReceiptNumber(String(body.receiptNumber ?? ''));
  } catch {
    return json({ error: 'invalid_format' }, 400);
  }

  if (!isValidReceiptNumber(receiptNumber)) {
    // 200, not 400: supabase-js's functions.invoke() nulls out `data` and
    // throws a generic FunctionsHttpError on any non-2xx status *before*
    // the caller ever sees the response body, which would make onboarding's
    // `body.error === '...'` branching on this value unreachable.
    return json({ error: 'invalid_format' });
  }

  const uscis = createUscisClient({
    baseUrl: USCIS_BASE_URL,
    clientId: USCIS_CLIENT_ID,
    clientSecret: USCIS_CLIENT_SECRET,
  });

  try {
    const status = await uscis.fetchCaseStatus(receiptNumber);
    // The API's formType isn't guaranteed to be one of our six supported
    // forms — fall back to the text-detected guess (and ultimately to no
    // pre-selection) rather than ever sending an unsupported value to the
    // client's form-type picker.
    const apiFormType = status.formType && (SUPPORTED_FORM_TYPES as readonly string[]).includes(status.formType)
      ? status.formType
      : null;

    return json({
      statusTitle: status.statusTitle,
      statusText: status.statusText,
      formType: apiFormType ?? detectFormType(status.statusText),
      filedOn: status.filedOn,
    });
  } catch (err) {
    if (err instanceof UscisNotFoundError || err instanceof UscisInvalidFormatError) {
      return json({ error: 'not_found' });
    }
    // Onboarding must never be blocked by an API failure (§10) — the client
    // treats this the same as "unavailable" and lets the user continue.
    return json({ error: 'unavailable' });
  }
});
