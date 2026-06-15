import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pznmptudgicrmljjafex.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

  // 1. Fetch listening plays count
  const { count: totalListens } = await client
    .from('play_events_universal')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // 2. Fetch gaming scores / history
  const { data: gameplay } = await client
    .from('gameplay_records')
    .select('*')
    .eq('user_id', user.id)
    .order('timestamp', { ascending: false });

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
      const medalName = record.medal as keyof typeof medals;
      if (medalName in medals) {
        medals[medalName]++;
      }
    }
    avgAccuracy = Number((accuracySum / gameplay.length).toFixed(2));
  }

  return NextResponse.json({
    authenticated: true,
    stats: {
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
