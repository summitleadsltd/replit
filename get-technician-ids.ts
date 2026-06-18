import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wggmfykmabandkllqodc.supabase.co';
const supabaseKey = 'lNlufsiYo9uMC8A1'; // This should be the service role key

const supabase = createClient(supabaseUrl, supabaseKey);

async function getTechnicianIds() {
  const { data, error } = await supabase
    .from('technicians')
    .select('id, first_name, last_name')
    .order('first_name');

  if (error) {
    console.error('Error fetching technicians:', error);
    return;
  }

  console.log('Technician IDs:');
  data.forEach(tech => {
    console.log(`${tech.first_name} ${tech.last_name}: ${tech.id}`);
  });
}

getTechnicianIds();
