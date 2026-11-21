/**
 * ETL: ZBM DATABASE 2026 master Excel  ->  data/alumni-import.csv,
 * data/alumni-seed.sql, data/alumni-review.csv
 *
 *   node scripts/build-alumni-from-xlsx.mjs [path-to.xlsx]
 *
 * Reads the DATABASE sheet (people), ZBM INTL (location), the hidden FOR MBM
 * sheet (gap fill only) and ZBM Headshots (to recover blank last names).
 * Outputs contain personal data and are gitignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import {
  EMAIL_OK, clean, cellText, joinLines, tidyMultiline, parseName, parseBirthday, parsePhones, parseEmails,
  fieldFromSpecialization, normKey, levenshtein, personKey,
} from './lib/alumni-xlsx.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || path.join(root, 'data', 'CSV database', 'ZBM DATABASE 2026 -MASTERFILE-.xlsx');

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const sheet = (name) => { const s = wb.getWorksheet(name); if (!s) throw new Error(`Sheet "${name}" not found`); return s; };
const review = [];
const note = (name, issue) => review.push({ name, issue });

// ------------------------------------------------------------- read sheets
function headerMap(ws) {
  const map = {};
  ws.getRow(1).eachCell((c, i) => { const k = normKey(cellText(c.value)); if (k && !(k in map)) map[k] = i; });
  return map;
}
const get = (row, map, key) => row.getCell(map[key] || 0).value;

// Headshots: two side-by-side blocks (Last, First, Batch, photo). Used to repair blank last names.
const headshotNames = [];
{
  const ws = sheet('ZBM Headshots');
  ws.eachRow((row, n) => {
    if (n < 2) return;
    for (const base of [1, 6]) {
      const last = clean(cellText(row.getCell(base).value));
      const first = clean(cellText(row.getCell(base + 1).value));
      const batch = clean(cellText(row.getCell(base + 2).value));
      if (last && first) headshotNames.push({ last, first, batch });
    }
  });
}

const intlByKey = new Map();
{
  const ws = sheet('ZBM INTL');
  const m = headerMap(ws);
  ws.eachRow((row, n) => {
    if (n < 2) return;
    const loc = clean(cellText(get(row, m, 'zbmintl')));
    const last = cellText(get(row, m, 'lastname'));
    if (loc && last) intlByKey.set(personKey(last, cellText(get(row, m, 'firstname')), cellText(get(row, m, 'batch'))), loc);
  });
}

const mbmByKey = new Map();
{
  const ws = wb.getWorksheet('FOR MBM');
  if (ws) {
    const m = headerMap(ws);
    ws.eachRow((row, n) => {
      if (n < 2) return;
      const last = cellText(get(row, m, 'lastname'));
      if (!last) return;
      mbmByKey.set(personKey(last, cellText(get(row, m, 'firstname')), cellText(get(row, m, 'batch'))), {
        birthday: get(row, m, 'birthday'), address: cellText(get(row, m, 'homeaddress')), contact: cellText(get(row, m, 'contactnumber')),
        email: cellText(get(row, m, 'emailaddress')), hospital: cellText(get(row, m, 'hospitalaffiliation')),
        specialization: cellText(get(row, m, 'specialization')), schedule: cellText(get(row, m, 'schedule')),
      });
    });
  }
}

// ----------------------------------------------------------------- people
const db = sheet('DATABASE');
const dm = headerMap(db);
const required = ['lastname', 'firstname', 'batch'];
for (const k of required) if (!dm[k]) throw new Error(`DATABASE sheet is missing the "${k}" column`);
const memberNoCol = dm.f || 1;

const raw = [];
db.eachRow((row, n) => {
  if (n < 2) return;
  const first = cellText(get(row, dm, 'firstname'));
  const last = cellText(get(row, dm, 'lastname'));
  if (!clean(first) && !clean(last)) return;
  raw.push({ n, row, first, last });
});

// Batch spellings: group near-identical spellings (lev <= 1) and use the most common one.
const batchCount = new Map();
raw.forEach(({ row }) => { const b = clean(cellText(get(row, dm, 'batch'))); if (b) batchCount.set(b, (batchCount.get(b) || 0) + 1); });
const batchCanon = new Map();
const sorted = [...batchCount.entries()].sort((a, b) => b[1] - a[1]);
for (const [b] of sorted) {
  const k = normKey(b);
  const hit = [...batchCanon.keys()].find((ck) => ck === k || (ck.length >= 7 && k.length >= 7 && levenshtein(ck, k) <= 1));
  if (hit) {
    const canon = batchCanon.get(hit);
    batchCanon.set(k, canon);
    if (canon !== b) note(`(batch) ${b}`, `Batch spelling merged into "${canon}"`);
  } else batchCanon.set(k, b);
}
const canonBatch = (b) => (clean(b) ? batchCanon.get(normKey(b)) || clean(b) : '');

const people = [];
const usedHeadshots = new Set();
for (const { n, row, first, last } of raw) {
  const batch = canonBatch(cellText(get(row, dm, 'batch')));
  let lastName = last;
  if (!clean(lastName)) {
    const hits = headshotNames.filter((h) => normKey(h.first.split(' ')[0]) === normKey(clean(first).split(' ')[0]) && normKey(h.batch) === normKey(batch));
    if (hits.length === 1) { lastName = hits[0].last; note(`${clean(first)} (row ${n})`, `Last name was blank; taken from the Headshots sheet: "${lastName}"`); }
    else note(`${clean(first)} (row ${n})`, 'Last name is blank in the DATABASE sheet - please fill it in');
  }
  const name = parseName({ last: lastName, first, middle: cellText(get(row, dm, 'middlename')) });
  const key = personKey(lastName, first, batch);
  const mbm = mbmByKey.get(key) || mbmByKey.get(personKey(lastName, first, cellText(get(row, dm, 'batch'))));

  let { iso: birthday, issue } = parseBirthday(get(row, dm, 'birthday'));
  if (issue) note(name.full_name, issue);
  let address = joinLines(cellText(get(row, dm, 'homeaddress')), ', ');
  let hospital = joinLines(cellText(get(row, dm, 'hospitalaffiliation')));
  let specialization = joinLines(cellText(get(row, dm, 'specialization')), ' ');
  let schedule = tidyMultiline(cellText(get(row, dm, 'schedule')));
  let phones = parsePhones(cellText(get(row, dm, 'contactnumber')));
  let emails = parseEmails(cellText(get(row, dm, 'emailaddress')));
  const filled = [];
  if (mbm) {
    if (!birthday) { const b = parseBirthday(mbm.birthday); if (b.iso) { birthday = b.iso; filled.push('birthday'); } }
    if (!address && mbm.address) { address = joinLines(mbm.address, ', '); filled.push('address'); }
    if (!hospital && mbm.hospital) { hospital = joinLines(mbm.hospital); filled.push('hospital'); }
    if (!specialization && mbm.specialization) { specialization = joinLines(mbm.specialization, ' '); filled.push('specialization'); }
    if (!schedule && mbm.schedule) { schedule = tidyMultiline(mbm.schedule); filled.push('schedule'); }
    if (!phones.mobile.length && !phones.telephone.length && mbm.contact) { phones = parsePhones(mbm.contact); filled.push('contact'); }
    if (!emails.valid.length && mbm.email) { emails = parseEmails(mbm.email); filled.push('email'); }
    if (filled.length) note(name.full_name, `Filled from the FOR MBM sheet: ${filled.join(', ')}`);
  }
  emails.invalid.forEach((e) => note(name.full_name, `Invalid email dropped: "${e}"`));

  const remarks = clean(cellText(get(row, dm, 'remarks'))).toLowerCase();
  people.push({
    ...name,
    nickname: clean(cellText(get(row, dm, 'nickname'))).replace(/^n\/?a$/i, ''),
    batch,
    member_no: Number(row.getCell(memberNoCol).value) || '',
    is_deceased: /deceased|†/.test(remarks) ? 'true' : '',
    is_retired: /retired/.test(remarks) ? 'true' : '',
    birthday,
    hospital,
    field_of_medicine: fieldFromSpecialization(specialization),
    specialization,
    email: emails.valid[0] || '',
    other_emails: emails.valid.slice(1).join('; '),
    mobile: phones.mobile.join('; '),
    telephone: phones.telephone.join('; '),
    address,
    intl_location: clean(cellText(get(row, dm, 'zbmintl'))) || intlByKey.get(key) || '',
    schedule,
  });
  if (mbm) usedHeadshots.add(key);
}

// Same person listed twice (same name + batch): keep the first row and fill its blanks from the later one.
{
  const first = new Map();
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const k = `${p.full_name.toLowerCase()}|${p.batch.toLowerCase()}`;
    const keep = first.get(k);
    if (!keep) { first.set(k, p); continue; }
    for (const [c, v] of Object.entries(p)) if (!keep[c] && v) keep[c] = v;
    note(p.full_name, `Listed twice in the DATABASE sheet (${p.batch}) - merged into one row`);
    people.splice(i--, 1);
  }
}

// -------------------------------------------------------------- validation
const COLS = ['full_name', 'last_name', 'first_name', 'middle_name', 'nickname', 'batch', 'member_no', 'is_deceased', 'is_retired', 'birthday', 'hospital', 'field_of_medicine', 'specialization', 'email', 'other_emails', 'mobile', 'telephone', 'address', 'intl_location', 'schedule'];
const MAX = { full_name: 255, last_name: 100, first_name: 100, middle_name: 100, nickname: 100, batch: 50, hospital: 2000, field_of_medicine: 100, specialization: 2000, email: 255, other_emails: 500, mobile: 255, telephone: 255, address: 2000, intl_location: 100, schedule: 2000 };
const errors = [];
const seen = new Map();
const nos = new Map();
for (const p of people) {
  if (!p.full_name) errors.push('row without a name');
  if (!p.last_name) errors.push(`${p.full_name}: no last name`);
  for (const [c, max] of Object.entries(MAX)) if (String(p[c]).length > max) errors.push(`${p.full_name}: ${c} longer than ${max}`);
  for (const e of [p.email, ...(p.other_emails ? p.other_emails.split('; ') : [])].filter(Boolean)) if (!EMAIL_OK.test(e)) errors.push(`${p.full_name}: invalid email ${e}`);
  const k = `${p.full_name.toLowerCase()}|${p.batch.toLowerCase()}`;
  if (seen.has(k)) errors.push(`duplicate name+batch: ${p.full_name} (${p.batch})`);
  seen.set(k, true);
  if (p.member_no) nos.set(p.member_no, [...(nos.get(p.member_no) || []), p.full_name]);
  if (!p.batch) note(p.full_name, 'No batch');
}
nos.forEach((names, no) => { if (names.length > 1) note(names.join(' / '), `Roster number ${no} used more than once`); });
const byEmail = new Map();
people.forEach((p) => { if (p.email) byEmail.set(p.email, [...(byEmail.get(p.email) || []), p.full_name]); });
byEmail.forEach((names, e) => { if (names.length > 1) note(names.join(' / '), `Same email on several people (${e})`); });

// ------------------------------------------------------------ output files
const esc = (v) => { const s = v === undefined || v === null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'alumni-import.csv'), '\ufeff' + [COLS.join(','), ...people.map((p) => COLS.map((c) => esc(p[c])).join(','))].join('\r\n') + '\r\n');
fs.writeFileSync(path.join(root, 'data', 'alumni-review.csv'), '\ufeffname,issue\r\n' + review.map((r) => `${esc(r.name)},${esc(r.issue)}`).join('\r\n') + '\r\n');

const lit = (v) => (v === '' || v === undefined || v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const sql = `-- Alumni seed from the ZBM master Excel (generated by scripts/build-alumni-from-xlsx.mjs). Contains personal data - do not commit.
-- Requires migrations 007, 010 and 011. Safe to re-run: people already on file (same name + batch) are skipped.
BEGIN;

INSERT INTO alumni (${COLS.join(', ')})
SELECT v.full_name, v.last_name, v.first_name, v.middle_name, v.nickname, v.batch, v.member_no::integer, COALESCE(v.is_deceased::boolean, FALSE), COALESCE(v.is_retired::boolean, FALSE), v.birthday::date, v.hospital, v.field_of_medicine, v.specialization, v.email, v.other_emails, v.mobile, v.telephone, v.address, v.intl_location, v.schedule
FROM (VALUES
${people.map((p) => `  (${COLS.map((c) => lit(p[c])).join(', ')})`).join(',\n')}
) AS v(${COLS.join(', ')})
WHERE NOT EXISTS (
  SELECT 1 FROM alumni a
  WHERE a.deleted_at IS NULL
    AND lower(a.full_name) = lower(v.full_name)
    AND COALESCE(lower(a.batch), '') = COALESCE(lower(v.batch), '')
);

COMMIT;
`;
fs.writeFileSync(path.join(root, 'data', 'alumni-seed.sql'), sql);

const count = (f) => people.filter(f).length;
console.log(JSON.stringify({
  people: people.length, batches: new Set(people.map((p) => p.batch)).size,
  deceased: count((p) => p.is_deceased), retired: count((p) => p.is_retired), abroad: count((p) => p.intl_location),
  withBirthday: count((p) => p.birthday), withEmail: count((p) => p.email), withMobile: count((p) => p.mobile),
  withTelephone: count((p) => p.telephone), withHospital: count((p) => p.hospital), withSpecialization: count((p) => p.specialization),
  withField: count((p) => p.field_of_medicine), reviewItems: review.length, validationErrors: errors.length,
}, null, 2));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
