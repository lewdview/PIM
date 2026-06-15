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

  const { data: cards, error: cardsError } = await client
    .from('user_cards')
    .select('*')
    .order('claimed_at', { ascending: false });

  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({
    authenticated: true,
    cards: cards || [],
  }, { headers: corsHeaders });
}

export async function POST(request: Request) {
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

  try {
    const { cardId, rarity, source, proof } = await request.json();

    if (!cardId || !rarity) {
      return NextResponse.json({ error: 'cardId and rarity are required' }, { status: 400, headers: corsHeaders });
    }

    const { data: newCard, error: insertError } = await client
      .from('user_cards')
      .insert({
        user_id: user.id,
        card_id: cardId,
        rarity,
        source: source || 'api',
        proof: proof || {},
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json({ success: true, card: newCard }, { headers: corsHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
