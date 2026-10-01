import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_ANON_KEY = "";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Dynamically determine cookie options for cross-subdomain sharing
const getAuthOptions = () => {
  if (typeof window === 'undefined') return {};
  
  const hostname = window.location.hostname;
  const isTh3Scrib3Domain = hostname.endsWith('th3scr1b3.art');
  
  return {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'th3scr1b3-auth-token',
    cookieOptions: isTh3Scrib3Domain ? {
      domain: '.th3scr1b3.art',
      path: '/',
      sameSite: 'lax' as const,
      secure: true,
    } : undefined
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: getAuthOptions()
});
