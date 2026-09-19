delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGDATABASE;
delete process.env.PGHOST;
delete process.env.PGPORT;

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://toemkhrfsbkfkutwcjkd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZW1raHJmc2JrZmt1dHdjamtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MTQxNTQsImV4cCI6MjEwMzE5MDE1NH0.nAtlMU_ukqXMkIhKppwv1mxDKpxuwHa6ddQBBwK3Iu8';

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
