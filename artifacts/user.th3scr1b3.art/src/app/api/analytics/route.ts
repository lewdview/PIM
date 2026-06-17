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

  // 1. Fetch profiles table details
  const { data: profile } = await client
    .from('profiles')
    .select('tokens, streak_count, total_pulls')
    .eq('id', user.id)
    .single();

  // 2. Fetch listening plays count from telemetry_events where event_type is 'game_start'
  const { count: totalListens } = await client
    .from('telemetry_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('event_type', 'game_start');

  // 3. Fetch cards inventory breakdown from vault_collections
  const { data: vaultCards } = await client
    .from('vault_collections')
    .select('rarity, is_echo')
    .eq('owner_id', user.id);

  const totalCards = vaultCards?.length || 0;
  const rarityBreakdown = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
  let echoesCount = 0;
  
  if (vaultCards) {
    for (const card of vaultCards) {
      if (card.is_echo) echoesCount++;
      const r = String(card.rarity || '').toLowerCase();
      if (r in rarityBreakdown) {
        rarityBreakdown[r as keyof typeof rarityBreakdown]++;
      }
    }
  }

  // 4. Fetch gaming scores / history from gameplay_records
  const { data: gameplay } = await client
    .from('gameplay_records')
    .select('*')
    .eq('user_id', user.id);

  // Compute game stats
  const totalGames = gameplay?.length || 0;
  let maxScore = 0;
  let maxCombo = 0;
  let avgAccuracy = 0;
  const medals = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0, NONE: 0 };

  if (gameplay && gameplay.length > 0) {
    let accuracySum = 0;
    for (const record of gameplay) {
      if (record.score > maxScore) maxScore = record.score;
      if (record.max_combo > maxCombo) maxCombo = record.max_combo;
      accuracySum += Number(record.accuracy || 0);
      const medalName = String(record.medal || '').toUpperCase() as keyof typeof medals;
      if (medalName in medals) {
        medals[medalName]++;
      }
    }
    avgAccuracy = Number((accuracySum / gameplay.length).toFixed(2));
  }

  return NextResponse.json({
    authenticated: true,
    stats: {
      profile: {
        tokens: profile?.tokens || 0,
        streakCount: profile?.streak_count || 0,
        totalPulls: profile?.total_pulls || 0,
      },
      collection: {
        totalCards,
        echoesCount,
        rarityBreakdown,
      },
      music: {
        totalListens: totalListens || 0,
      },
      gaming: {
        totalGames,
        maxScore,
        maxCombo,
        avgAccuracy,
        medals,
      }
    }
  }, { headers: corsHeaders });
}
