import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pznmptudgicrmljjafex.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bm1wdHVkZ2ljcm1samphZmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDE4ODUsImV4cCI6MjA3OTg3Nzg4NX0.syu1bbr9OJ5LxCnTrybLVgsjac4UOkFVdAHuvhKMY2g';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function run() {
  try {
    console.log("Querying vault_collections...");
    const { data: list, error: err2 } = await supabase
      .from('vault_collections')
      .select('*')
      .limit(1);

    if (err2) {
      console.error("Failed to fetch vault_collections:", err2);
    } else {
      console.log("Columns in vault_collections:", Object.keys(list[0] || {}));
      console.log("Sample collection data:", list[0]);
    }
  } catch (err) {
    console.error("Execution error:", err);
  }
}

run();
