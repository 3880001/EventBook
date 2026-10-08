import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://oybwrnokffjmdpnnymxm.supabase.co";
export const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Yndybm9rZmZqbWRwbm55bXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjUzNTUsImV4cCI6MjEwNjEwMTM1NX0.HwJi4TPXQd_prCuQSxF41ux8-iFZaR3zamTkaOa5sl4";

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
