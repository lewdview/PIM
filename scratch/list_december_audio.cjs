delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGDATABASE;
delete process.env.PGHOST;
delete process.env.PGPORT;

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pznmptudgicrmljjafex.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bm1wdHVkZ2ljcm1samphZmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDE4ODUsImV4cCI6MjA3OTg3Nzg4NX0.syu1bbr9OJ5LxCnTrybLVgsjac4UOkFVdAHuvhKMY2g';

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
