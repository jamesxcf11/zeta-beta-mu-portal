/**
 * Bulk-import deceased brothers into the `memorials` table from a CSV file.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-memorials.mjs list.csv [--dry-run]
 *
 * Header row (any order, extra columns ignored):
 *   full_name,nickname,batch,specialty,birth_year,death_year,tribute
 * Photos are attached afterwards from Officer Tools > In Memoriam.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}

const [file, flag] = process.argv.slice(2);
if (!file) { console.error('Usage: node scripts/import-memorials.mjs <file.csv> [--dry-run]'); process.exit(1); }

const [header, ...body] = parseCsv(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const cols = header.map(h => h.trim().toLowerCase());
const year = (v) => { const n = parseInt(v, 10); return n >= 1800 && n <= 2200 ? n : null; };

const records = body.map(r => {
  const get = (k) => (r[cols.indexOf(k)] || '').trim();
  return {
    full_name: get('full_name').slice(0, 255),
    nickname: get('nickname').slice(0, 100) || null,
    batch: get('batch').slice(0, 50) || null,
    specialty: get('specialty').slice(0, 255) || null,
    birth_year: year(get('birth_year')),
    death_year: year(get('death_year')),
    tribute: get('tribute') || null,
  };
}).filter(r => r.full_name);

console.log(`Parsed ${records.length} memorial(s) from ${file}`);
if (flag === '--dry-run') { console.table(records); process.exit(0); }

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error } = await supabase.from('memorials').insert(records);
if (error) { console.error('Import failed:', error.message); process.exit(1); }
console.log('Imported.');
