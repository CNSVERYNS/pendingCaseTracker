import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { supabase } from '@/lib/supabase';

/**
 * "Export my data" (build brief §10 Settings). Everything here is scoped by
 * RLS to the signed-in user's own rows — no admin access needed.
 */
export async function exportUserData(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: cases } = await supabase.from('cases').select('*');
  const caseIds = (cases ?? []).map((c) => c.id);

  const [{ data: events }, { data: snapshots }, { data: pendingDetails }, { data: reminders }] = caseIds.length
    ? await Promise.all([
        supabase.from('case_events').select('*').in('case_id', caseIds),
        supabase.from('status_snapshots').select('*').in('case_id', caseIds),
        supabase.from('pending_details').select('*').in('case_id', caseIds),
        supabase.from('reminders').select('*').in('case_id', caseIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const payload = {
    exportedAt: new Date().toISOString(),
    cases: cases ?? [],
    caseEvents: events ?? [],
    statusSnapshots: snapshots ?? [],
    pendingDetails: pendingDetails ?? [],
    reminders: reminders ?? [],
  };

  const file = new File(Paths.cache, `pending-export-${Date.now()}.json`);
  file.write(JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export your data' });
  }
}
