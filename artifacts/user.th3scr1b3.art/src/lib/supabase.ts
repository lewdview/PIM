import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bm1wdHVkZ2ljcm1samphZmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDE4ODUsImV4cCI6MjA3OTg3Nzg4NX0.syu1bbr9OJ5LxCnTrybLVgsjac4UOkFVdAHuvhKMY2g';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pznmptudgicrmljjafex.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

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
    }
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: getAuthOptions()
});
