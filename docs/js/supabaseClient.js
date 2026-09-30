// Singleton Supabase Client (Prevents multiple GoTrueClient warnings)
const supabaseUrl = 'https://oybwrnokffjmdpnnymxm.supabase.co';
const supabaseKey = 'sb_publishable_TJDC2IP_1j8uGuKpAekSEg_PvxPuHSr';

if (!window.__eventbook_supabase_client) {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.__eventbook_supabase_client = window.supabase.createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
}

export const supabase = window.__eventbook_supabase_client;
