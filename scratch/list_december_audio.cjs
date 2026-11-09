delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGDATABASE;
delete process.env.PGHOST;
delete process.env.PGPORT;

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, key);

async function run() {
  const { data, error } = await supabase.storage.from('releaseready').list('audio/december', { limit: 100 });
  if (error) {
    console.error(error);
  } else {
    console.log(data.map(f => f.name));
  }
}

run().catch(console.error);
