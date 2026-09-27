// Supabase Client Wrapper
export const SUPABASE_URL = window.__ENV_SUPABASE_URL || 'https://oybwrnokffjmdpnnymxm.supabase.co';
export const SUPABASE_ANON_KEY = window.__ENV_SUPABASE_ANON_KEY || 'sb_publishable_TJDC2IP_1j8uGuKpAekSEg_PvxPuHSr';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Realtime Helper
export function subscribeToEventSlots(eventId, onUpdate) {
  return supabase
    .channel(`public:timeslots:event_id=eq.${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'timeslots', filter: `event_id=eq.${eventId}` },
      (payload) => onUpdate(payload)
    )
    .subscribe();
}
