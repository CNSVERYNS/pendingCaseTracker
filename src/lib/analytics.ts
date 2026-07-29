/**
 * First-party analytics only (build brief §11): exactly four events, no
 * case content, no third-party SDK. Fire-and-forget — a failed insert must
 * never surface to the user or block whatever they were doing.
 */

import type { AnalyticsEventName } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export async function track(eventName: AnalyticsEventName): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('analytics_events').insert({ user_id: user.id, event_name: eventName });
  } catch {
    // Analytics must never break the product.
  }
}
