import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oybwrnokffjmdpnnymxm.supabase.co';
// Replace with your real Supabase Anon Key if not already set
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Yndybm9rZmZqbWRwbm55bXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMzgwNTMsImV4cCI6MjA1NTYxNDA1M30.qD2L9R6S8-e6_Qo1_bJ3tQ6E9l4x7j8k_n5m3_2k1p0';

declare global {
  interface Window {
    __eventbook_supabase_client?: SupabaseClient;
  }
}

if (!window.__eventbook_supabase_client) {
  window.__eventbook_supabase_client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export const supabase: SupabaseClient = window.__eventbook_supabase_client;
