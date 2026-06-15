import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bm1wdHVkZ2ljcm1samphZmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDE4ODUsImV4cCI6MjA3OTg3Nzg4NX0.syu1bbr9OJ5LxCnTrybLVgsjac4UOkFVdAHuvhKMY2g';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pznmptudgicrmljjafex.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

function getCorsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const authHeader = request.headers.get('Authorization');
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    return NextResponse.json({ authenticated: false, error: 'No authorization token provided' }, { status: 401, headers: corsHeaders });
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ authenticated: false, error: 'Invalid session or token' }, { status: 401, headers: corsHeaders });
  }

  // Query profile data
  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      wallet: user.user_metadata?.wallet || (profile as Record<string, unknown> | null)?.wallet as string | undefined || null,
    },
    profile: profile || { display_name: null, avatar_url: null, lab_access: false },
  }, { headers: corsHeaders });
}
