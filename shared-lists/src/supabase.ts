import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);

// Only the public anon / publishable key belongs here. RLS protects the data.
export const sb = createClient(url || 'http://localhost:54321', key || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export function errorText(e: { code?: string; message?: string } | null | undefined): string {
  if (!e) return 'השמירה נכשלה, נסו שוב';
  if (!navigator.onLine || /fetch|network/i.test(e.message ?? '')) return 'אין חיבור – השינוי לא נשמר';
  if (e.code === '42501') return 'אין לך הרשאה לפעולה הזו';
  return 'השמירה נכשלה, נסו שוב';
}
