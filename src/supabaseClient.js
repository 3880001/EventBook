import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://oybwrnokffjmdpnnymxm.supabase.co";
export const supabaseKey = "";

if (!window.__eventbook_supabase_client) {
  window.__eventbook_supabase_client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export const supabase = window.__eventbook_supabase_client;
window.supabase = supabase;
export default supabase;
