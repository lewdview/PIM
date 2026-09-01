import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.SUPABASE_URL || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  ''
).trim();

export const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  ''
).trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

// Dynamically determine cookie options for cross-subdomain sharing
const getAuthOptions = () => {
  if (typeof window === 'undefined') return {};

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  return {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'th3scr1b3-auth-token',
    cookieOptions: isLocalhost ? undefined : {
      domain: '.th3scr1b3.art',
      path: '/',
      sameSite: 'lax' as const,
      secure: true,
    },
    experimental: {
      passkey: true,
    },
  };
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: getAuthOptions()
});

const rawStorageBase = (
  import.meta.env.VITE_STORAGE_BASE_URL ||
  import.meta.env.VITE_R2_URL ||
  import.meta.env.VITE_WASABI_URL ||
  import.meta.env.VITE_MEDIA_BASE_URL ||
  import.meta.env.STORAGE_BASE_URL ||
  'https://files.th3scr1b3.art/'
).replace(/\/?$/, '/');

export const STORAGE_BASE = rawStorageBase.replace(/^(https?:\/\/)(?!files\.)th3scr1b3\.art\//i, '$1files.th3scr1b3.art/');
