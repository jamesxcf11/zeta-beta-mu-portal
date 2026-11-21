/**
 * Upload the headshots embedded in the ZBM master Excel file.
 *
 *   node scripts/import-alumni-photos.mjs [path-to.xlsx] [--dry-run] [--overwrite]
 *
 * - Each photo sits in the HEADSHOT cell next to Last Name / First Name / Batch
 *   on the "ZBM Headshots" sheet (two side-by-side blocks).
 * - Photos are matched to alumni rows by last name + first name + batch; anything
 *   unmatched or ambiguous is reported (upload those via Edit in the directory).
 * - Each photo is resized to <=512px WebP, uploaded to R2 as alumni/<uuid>.webp and
 *   saved in alumni.avatar_url. Alumni that already have a photo are skipped unless
 *   --overwrite.
 * - --dry-run needs no credentials: it only reports the matching (and, without
 *   Supabase credentials, matches against data/alumni-import.csv).
 *
 * Needs the same environment variables as the Netlify functions:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { clean, cellText, normKey, levenshtein } from './lib/alumni-xlsx.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const overwrite = args.includes('--overwrite');
const file = args.find((a) => !a.startsWith('--')) || path.join(root, 'data', 'CSV database', 'ZBM DATABASE 2026 -MASTERFILE-.xlsx');

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'];
const missing = REQUIRED.filter((n) => !String(process.env[n] || '').trim());
if (missing.length && !dryRun) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.getWorksheet('ZBM Headshots');
if (!ws) throw new Error('Sheet "ZBM Headshots" not found');

const photos = [];
for (const img of ws.getImages()) {
  const row = img.range.tl.nativeRow + 1;
  const col = img.range.tl.nativeCol + 1;
  const base = col <= 5 ? 1 : 6;
  const last = clean(cellText(ws.getRow(row).getCell(base).value));
  const first = clean(cellText(ws.getRow(row).getCell(base + 1).value));
  const batch = clean(cellText(ws.getRow(row).getCell(base + 2).value));
  const media = wb.model.media.find((m) => m.index === img.imageId) || wb.model.media[img.imageId];
  if (media && last) photos.push({ last, first, batch, buffer: media.buffer, label: `${first} ${last} (${batch})` });
}
console.log(`Found ${photos.length} photo(s) in the Headshots sheet.`);

let people = [];
let supabase = null;
if (!missing.length) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('alumni').select('id, full_name, last_name, first_name, batch, avatar_url').is('deleted_at', null).order('id').range(from, from + 999);
    if (error) { console.error('Could not read alumni:', error.message); process.exit(1); }
    people.push(...data);
    if (data.length < 1000) break;
  }
} else {
  console.log('(dry run without Supabase credentials: matching against data/alumni-import.csv)');
  const text = fs.readFileSync(path.join(root, 'data', 'alumni-import.csv'), 'utf8').replace(/^\ufeff/, '');
  const { default: parse } = await import('./lib/csv-lite.mjs');
  const [header, ...rows] = parse(text);
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  people = rows.map((r, i) => ({ id: i + 1, full_name: r[idx.full_name], last_name: r[idx.last_name], first_name: r[idx.first_name], batch: r[idx.batch], avatar_url: null }));
}

const SUFFIX_RE = /\s+(Jr\.?|Sr\.?|II|III|IV|SJ)\.?$/i;
const stripSuffix = (s) => clean(s).replace(SUFFIX_RE, '').replace(SUFFIX_RE, '');
const firstWord = (s) => normKey(stripSuffix(s).split(' ')[0]);
const matched = [];
const unmatched = [];
const ambiguous = [];
for (const p of photos) {
  const batchOk = (x) => { const a = normKey(x.batch); const b = normKey(p.batch); return a === b || (a.length >= 5 && b.length >= 5 && (levenshtein(a, b) <= 2 || a.startsWith(b) || b.startsWith(a))); };
  const lastOk = (x) => normKey(stripSuffix(x.last_name || '')) === normKey(stripSuffix(p.last)) || normKey(stripSuffix(x.full_name)).endsWith(normKey(stripSuffix(p.last)));
  const firstExact = (x) => firstWord(x.first_name || x.full_name) === firstWord(p.first);
  const firstNear = (x) => levenshtein(firstWord(x.first_name || x.full_name), firstWord(p.first)) <= 2;
  let cands = people.filter((x) => lastOk(x) && batchOk(x) && firstExact(x));
  if (!cands.length) cands = people.filter((x) => lastOk(x) && batchOk(x) && firstNear(x));
  if (!cands.length) cands = people.filter((x) => lastOk(x) && firstExact(x));
  if (cands.length === 1) matched.push({ photo: p, person: cands[0] });
  else if (cands.length > 1) ambiguous.push({ photo: p, candidates: cands.map((c) => c.full_name) });
  else unmatched.push(p.label);
}
const todo = matched.filter((m) => overwrite || !m.person.avatar_url);
console.log(`\nMatched: ${matched.length} (to upload: ${todo.length}, already have a photo: ${matched.length - todo.length})`);
if (ambiguous.length) { console.log(`\nAmbiguous (skipped): ${ambiguous.length}`); ambiguous.forEach((a) => console.log(`  ${a.photo.label} -> ${a.candidates.join(' / ')}`)); }
if (unmatched.length) { console.log(`\nNo match (upload manually): ${unmatched.length}`); unmatched.forEach((l) => console.log(`  ${l}`)); }
if (dryRun) { console.log('\nDry run: nothing uploaded.'); process.exit(0); }

const r2 = require('../netlify/functions/_lib/r2.js');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = r2.client();
let done = 0;
for (const { photo, person } of todo) {
  try {
    const body = await sharp(photo.buffer).rotate().resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const key = `alumni/${randomUUID()}.webp`;
    await s3.send(new PutObjectCommand({ Bucket: r2.env('R2_BUCKET'), Key: key, Body: body, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable' }));
    const { error } = await supabase.from('alumni').update({ avatar_url: r2.publicUrl(key) }).eq('id', person.id);
    if (error) throw new Error(error.message);
    done++;
    console.log(`Uploaded ${photo.label} -> ${person.full_name}`);
  } catch (err) {
    console.error(`FAILED ${photo.label}: ${err.message}`);
  }
}
console.log(`\nDone: ${done}/${todo.length} uploaded.`);
