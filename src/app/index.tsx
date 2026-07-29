import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

function useMyCaseIds(enabled: boolean) {
  return useQuery({
    queryKey: ['my-case-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cases').select('id').order('created_at', { ascending: true });
      if (error) throw error;
      return data.map((c) => c.id);
    },
    enabled,
  });
}

export default function Index() {
  const { session, loading } = useSession();
  const { data: caseIds, isLoading: casesLoading } = useMyCaseIds(Boolean(session));

  if (loading || (session && casesLoading)) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  if (!caseIds || caseIds.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  // A proper household list lands in build-order step 9 — until then, the
  // most recently added case is home.
  return <Redirect href={`/case/${caseIds[caseIds.length - 1]}`} />;
}
