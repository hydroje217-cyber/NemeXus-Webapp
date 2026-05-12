import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const placeholderPattern = /your-project-ref|your-supabase|publishable-key/i;
const validSupabaseUrl = /^https:\/\/[^/]+\.supabase\.co\/?$/i;

function getSupabaseConfigIssue() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.';
  }

  if (placeholderPattern.test(supabaseUrl) || placeholderPattern.test(supabaseAnonKey)) {
    return 'Supabase environment variables still look like placeholders.';
  }

  if (!validSupabaseUrl.test(supabaseUrl)) {
    return 'VITE_SUPABASE_URL should look like https://your-project-ref.supabase.co.';
  }

  return '';
}

export const supabaseConfigIssue = getSupabaseConfigIssue();
export const supabaseReady = !supabaseConfigIssue;

export const supabase = supabaseReady
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
