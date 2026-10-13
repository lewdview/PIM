import { createClient } from '@supabase/supabase-js';
import { sharedAuthStorage } from './sharedAuthStorage';

const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZW1raHJmc2JrZmt1dHdjamtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MTQxNTQsImV4cCI6MjEwMzE5MDE1NH0.nAtlMU_ukqXMkIhKppwv1mxDKpxuwHa6ddQBBwK3Iu8';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://toemkhrfsbkfkutwcjkd.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Auth options: browser only (server routes use bearer tokens)
const getAuthOptions = () => {
  if (typeof window === 'undefined') return {};
  
  return {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'th3scr1b3-auth-token',
    // One session across every *.th3scr1b3.art site (see sharedAuthStorage.ts).
    storage: sharedAuthStorage(),
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: getAuthOptions()
});
