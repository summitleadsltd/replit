const XLSX = require('xlsx');
const workbook = XLSX.readFile('c:\\Users\\cyber sev3n\\Downloads\\Technician_Territory_ZipCodes.xlsx');
const data = XLSX.utils.sheet_to_json(workbook.Sheets['All Technicians']);

console.log('-- Technician Territories Import');
console.log('-- Generated from Technician_Territory_ZipCodes.xlsx');
console.log('-- Total records:', data.length);
console.log('');

data.forEach(row => {
  const technician = row['Technician'];
  const county = row['County'];
  const zipCode = row['ZIP Code'];
  
  // Map technician names to IDs (will need to be updated with actual technician IDs from database)
  const technicianMap = {
    'JJ': 'TECH_JJ_ID',
    'PK': 'TECH_PK_ID',
    'Darian': 'TECH_DARIAN_ID'
  };
  
  const techId = technicianMap[technician] || 'UNKNOWN';
  
  console.log(`INSERT INTO public.technician_territories (technician_id, zip_code, county, priority, active, created_at)`);
  console.log(`VALUES ('${techId}', '${zipCode}', '${county}', 1, true, now());`);
});

console.log('\n-- Note: Replace TECH_JJ_ID, TECH_PK_ID, TECH_DARIAN_ID with actual technician UUIDs from the technicians table');
