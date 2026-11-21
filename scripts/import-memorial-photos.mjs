/**
 * Bulk-upload memorial photos from a local folder.
 *
 *   node scripts/import-memorial-photos.mjs <folder> [--dry-run] [--overwrite]
 *
 * - The folder is always passed on the command line; nothing is hard-coded.
 * - Files are matched to memorials by name (see scripts/lib/match-photos.mjs).
 * - Each photo is resized to <=1024px WebP, uploaded to R2 as
 *   memorials/<uuid>.webp and saved on the memorial row.
 * - Memorials that already have a photo are skipped unless --overwrite.
 * - Anything unmatched or ambiguous is reported; upload those from
 *   Officer Tools > In Memoriam.
 *
 * Needs the same environment variables as the Netlify functions:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { matchPhotos } from './lib/match-photos.mjs';

const require = createRequire(import.meta.url);
const r2 = require('../netlify/functions/_lib/r2.js');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const [folder, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');
const overwrite = flags.includes('--overwrite');
if (!folder) {
  console.error('Usage: node scripts/import-memorial-photos.mjs <folder> [--dry-run] [--overwrite]');
  process.exit(1);
}

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'];
const missing = REQUIRED.filter(n => !String(process.env[n] || '').trim());
if (missing.length && !dryRun) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const files = readdirSync(folder).filter(f => IMAGE_EXT.has(extname(f).toLowerCase()));
console.log(`Found ${files.length} image(s) in the folder.`);

let memorials = [];
if (missing.length) {
  console.log('(dry run without Supabase credentials: reading names from data/memorials.json)');
  memorials = JSON.parse(readFileSync(new URL('../data/memorials.json', import.meta.url), 'utf8')).map((m, i) => ({ id: i + 1, ...m, photo_key: null }));
} else {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.from('memorials').select('id, full_name, photo_key').is('deleted_at', null);
  if (error) { console.error('Could not read memorials:', error.message); process.exit(1); }
  memorials = data;
}

const { matched, unmatched, ambiguous } = matchPhotos(files, memorials);
const todo = matched.filter(m => overwrite || !m.memorial.photo_key);
const skippedExisting = matched.length - todo.length;

console.log(`\nMatched: ${matched.length} (to upload: ${todo.length}, already have a photo: ${skippedExisting})`);
matched.forEach(m => console.log(`  ${m.file}  ->  ${m.memorial.full_name}`));
if (ambiguous.length) {
  console.log(`\nAmbiguous (skipped): ${ambiguous.length}`);
  ambiguous.forEach(a => console.log(`  ${a.file}  ->  ${a.candidates.join(' / ')}`));
}
if (unmatched.length) {
  console.log(`\nNo match (upload manually): ${unmatched.length}`);
  unmatched.forEach(f => console.log(`  ${f}`));
}
if (dryRun) { console.log('\nDry run: nothing uploaded.'); process.exit(0); }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const s3 = r2.client();
let done = 0;
for (const { file, memorial } of todo) {
  try {
    const body = await sharp(join(folder, file))
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const key = `memorials/${randomUUID()}.webp`;
    await s3.send(new PutObjectCommand({
      Bucket: r2.env('R2_BUCKET'),
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    const { error } = await supabase.from('memorials').update({ photo_url: r2.publicUrl(key), photo_key: key }).eq('id', memorial.id);
    if (error) throw new Error(error.message);
    if (memorial.photo_key) await r2.deleteKeys([memorial.photo_key]).catch(() => {});
    done++;
    console.log(`Uploaded ${file} -> ${memorial.full_name}`);
  } catch (err) {
    console.error(`FAILED ${file}: ${err.message}`);
  }
}
console.log(`\nDone: ${done}/${todo.length} uploaded.`);
