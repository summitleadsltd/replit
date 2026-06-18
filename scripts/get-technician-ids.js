const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wggmfykmabandkllqodc.supabase.co';
// Note: This needs the service role key, not the anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getTechnicianIds() {
  const { data, error } = await supabase
    .from('technicians')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('Error fetching technicians:', error);
    process.exit(1);
  }

  console.log('Technician IDs:');
  data.forEach(tech => {
    console.log(`${tech.name}: ${tech.id}`);
  });
}

getTechnicianIds();
