/**
 * ETL: directory/*.doc  ->  data/alumni-import.csv, data/alumni-seed.sql,
 * data/alumni-review.csv
 *
 *   powershell scripts/extract-directory-docs.ps1     (Extract: .doc -> text)
 *   node scripts/build-alumni-import.mjs [textDir]    (Transform + Validate + Load files)
 *
 * Sources: roster (batch / semester / awards / deceased), directory (nickname,
 * birthday, address, phones, emails) and doctors (hospital / specialty).
 * Outputs contain personal data and are gitignored.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const textDir = process.argv[2] || path.join(os.tmpdir(), 'zbm');
const read = (re) => {
  const f = fs.readdirSync(textDir).find((n) => re.test(n));
  if (!f) throw new Error(`No text file matching ${re} in ${textDir}`);
  return fs.readFileSync(path.join(textDir, f), 'utf8').split(/\r?\n/);
};

// ------------------------------------------------------------------ helpers
const clean = (s) => String(s ?? '').replace(/[\u2018\u2019`]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();
const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'sj', 'md']);
const tokens = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter((t) => t.length > 1 && !SUFFIX.has(t));
const titleCase = (s) => clean(s).toLowerCase().replace(/(^|[\s.'(-])([a-zñ])/g, (m, a, b) => a + b.toUpperCase())
  .replace(/\b(Ii|Iii|Iv)\b/g, (m) => m.toUpperCase()).replace(/\bSj\b/, 'SJ');
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const normBatch = (s) => clean(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/\b7\b/g, 'seven').replace(/[^a-z0-9]/g, '');

// ================================================================== EXTRACT
// (Word -> text is done by scripts/extract-directory-docs.ps1)
const rosterLines = read(/roster/i);
const directoryLines = read(/^zbm directory/i);
const doctorLines = read(/doctors/i);

// ================================================================== TRANSFORM
// ---- roster
function parseRoster(lines) {
  const people = [];
  const batches = new Map();
  let batch = 'Founders', semester = 'August 21, 1971';
  batches.set(normBatch('Founders'), 'Founders');
  const headerRe = /^(.*?)\s*((?:1st|2nd)\s+Semester\s+\d{4}-\d{4}|Summer\s+\d{4}|Semestral\s+Break\s+\d{4}(?:-\d{4})?)\s*$/i;
  for (const raw of lines) {
    const line = raw.replace(/\s+\|\s+/g, ' | ').trim();
    if (!line || /^MEMBER ROSTER/i.test(line)) continue;
    if (/^Founders:/i.test(line)) { batch = 'Founders'; semester = 'August 21, 1971'; continue; }
    if (!/^\d{1,3}\./.test(line)) {
      const h = headerRe.exec(line);
      if (h && h[1]) { batch = clean(h[1]); semester = clean(h[2]); batches.set(normBatch(batch), batch); }
      continue;
    }
    const re = /(\d{1,3})\.\s*([^\d\t|]+?)\s*((?:\t+[^\d\t|]+?)*)\s*(?=\||\d{1,3}\.|$)/g;
    let m;
    while ((m = re.exec(line))) {
      let name = m[2];
      const deceased = /\(\+\)/.test(name);
      name = clean(name.replace(/\(\+\)/g, ''));
      const awards = m[3].split(/\t+/).map(clean).filter(Boolean).join('; ');
      people.push({ member_no: Number(m[1]), full_name: name, batch, semester, awards, is_deceased: deceased });
    }
  }
  return { people, batches };
}

const roster = parseRoster(rosterLines);
const knownBatches = roster.batches;
const BATCH_ALIASES = { millenium: 'millennium', companero: 'companeros', twinpeak: 'twinpeaks', adasperas: 'adasperas' };

function batchLookup(raw) {
  let key = normBatch(raw);
  if (!key) return null;
  key = BATCH_ALIASES[key] || key;
  if (knownBatches.has(key)) return knownBatches.get(key);
  if (key.length < 6) return null;
  const near = [...knownBatches.entries()].filter(([k]) => k.length >= 6 && lev(k, key) <= (key.length >= 9 ? 2 : 1));
  return near.length === 1 ? near[0][1] : null;
}

// ---- directory
const MOBILE_RE = /(?:\+?63|0)9\d{2}[-\s]?\d{3}[-\s]?\d{4}\b/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const EMAIL_OK = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
const TEXT_DATE_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+(\d{1,2})\s*,?\s*(\d{4})$/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const PHONE_LABELS = /\b(home|office|ofc|fax|cell|pager|tel#?|tel|phone|mobile|apt|clinic|local|loc\.?|direct line|active|reserve)\b/gi;

function isoDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return '';
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : '';
}
function parseBirthday(s) {
  let m = DATE_RE.exec(s);
  if (m) {
    let [, a, b, y] = m.map(Number);
    if (m[3].length === 2) y += y >= 30 ? 1900 : 2000;
    return isoDate(y, a, b) || (a > 12 ? isoDate(y, b, a) : '');
  }
  m = TEXT_DATE_RE.exec(s);
  return m ? isoDate(Number(m[3]), MONTHS.indexOf(m[1].toLowerCase()) + 1, Number(m[2])) : null;
}
function isPhoneLine(line) {
  const rest = line.replace(PHONE_LABELS, ' ').replace(/[()\s\d+/;,.#:\u2013-]/g, '');
  return rest === '' && (line.match(/\d/g) || []).length >= 6;
}
const trimTail = (s) => s.replace(/[\s;,/.\-\u2013]+$/g, '').replace(/^[\s;,/|]+/g, '').trim();
const uniq = (a) => [...new Set(a)];

function fixEmailText(line) {
  return line.replace(/@\s+/g, '@').replace(/\s+@/g, '@').replace(/(\.(?:com|net|org|ph|edu|gov))-[a-z]{1,3}\b/gi, '$1');
}

function parseDirectory(lines) {
  const nameRe = /^([A-ZÑ][A-ZÑ'’. -]*[A-ZÑ.]),\s*([A-Za-zÑñ].*)$/;
  const blocks = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.replace(/\s*\|\s*/g, ' ').trim();
    if (!line) continue;
    const m = nameRe.exec(line);
    if (m && m[1] === m[1].toUpperCase() && /[A-Z]{2}/.test(m[1])) {
      cur = { surname: m[1].trim(), given: m[2].trim(), rest: [] };
      blocks.push(cur);
    } else if (cur) cur.rest.push(line);
  }

  return blocks.map((b) => {
    const suffix = /,\s*(SJ|MD)\s*$/i.exec(b.given);
    const rec = {
      surname: b.surname, given: b.given.replace(/,\s*(SJ|MD)\s*$/i, '').replace(/\s*,\s*$/, '').trim(), suffix: suffix ? suffix[1].toUpperCase() : '',
      nickname: '', batch: '', batchRaw: '', semHint: '', birthday: '', email: [], mobile: [], telephone: [], address: [],
    };
    const pre = [];
    let seenData = false;
    for (let line of b.rest) {
      line = fixEmailText(line);
      const emails = line.match(EMAIL_RE);
      if (emails) { rec.email.push(...emails.map((e) => e.toLowerCase())); line = line.replace(EMAIL_RE, ' '); seenData = true; }
      const mobiles = line.match(MOBILE_RE);
      if (mobiles) { rec.mobile.push(...mobiles.map((x) => x.replace(/\s+/g, ''))); line = line.replace(MOBILE_RE, ' '); seenData = true; }
      line = trimTail(clean(line));
      if (line.length < 2) continue;
      const bd = parseBirthday(line);
      if (bd !== null) { if (bd && !rec.birthday) rec.birthday = bd; seenData = true; continue; }
      if (/^\d{1,2}\/\d{1,2}$/.test(line)) { seenData = true; continue; }
      if (isPhoneLine(line)) { rec.telephone.push(line); seenData = true; continue; }
      if (!seenData) { pre.push(line); continue; }
      rec.address.push(line);
    }
    const addrFromPre = [];
    for (const line of pre) {
      const canon = batchLookup(line);
      const simple = line.length <= 25 && !/[,\d]/.test(line);
      if (!rec.batch && canon) {
        rec.batch = canon;
        const sem = /\((1st|2nd)\s*sem/i.exec(line);
        if (sem) rec.semHint = sem[1].toLowerCase();
      } else if (!rec.nickname && !rec.batch && simple) rec.nickname = line;
      else if (!rec.batch && !rec.batchRaw && rec.nickname && simple) rec.batchRaw = line;
      else addrFromPre.push(line);
    }
    if (!rec.batch && rec.batchRaw) rec.batch = rec.batchRaw;
    rec.address = uniq([...addrFromPre, ...rec.address].filter((l) => !batchLookup(l) && !/^founders$/i.test(l)));
    rec.email = uniq(rec.email);
    rec.mobile = uniq(rec.mobile);
    rec.telephone = uniq(rec.telephone);
    return rec;
  });
}

// ---- doctors
const FIELD = {
  optha: 'Ophthalmology', ophtha: 'Ophthalmology', patho: 'Pathology', anaesthesia: 'Anesthesiology', aneasthesia: 'Anesthesiology',
  endocrinology: 'Endocrinology', surgery: 'Surgery', surg: 'Surgery', 'er med': 'Emergency Medicine', 'er medicine': 'Emergency Medicine',
  neonatology: 'Neonatology', radiology: 'Radiology', radio: 'Radiology', 'neuro psych': 'Neuropsychiatry', neuro: 'Neurology',
  'plastic surgery': 'Plastic Surgery', pulmo: 'Pulmonology', ent: 'Otolaryngology (ENT)', cardio: 'Cardiology', gastro: 'Gastroenterology',
  derma: 'Dermatology', im: 'Internal Medicine', uro: 'Urology', 'uro surg': 'Urologic Surgery', pedia: 'Pediatrics',
  'pedia-ortho': 'Pediatric Orthopedics', ortho: 'Orthopedics', orthopedics: 'Orthopedics', 'ob gyne': 'Obstetrics and Gynecology',
  onco: 'Oncology', nephro: 'Nephrology', psych: 'Psychiatry', 'rehab med': 'Rehabilitation Medicine', tcvs: 'Cardiothoracic Surgery',
  medicine: 'Internal Medicine',
};
const ROLE_RE = /director|administrator|chair|head|officer/i;

function parseSpecialty(raw) {
  const s = clean(raw).replace(/-res$/i, '');
  const key = s.toLowerCase();
  if (FIELD[key]) return { field: FIELD[key], role: '' };
  if (ROLE_RE.test(s)) {
    const first = key.split(/[\s,]+/)[0];
    let field = FIELD[first] || '';
    if (!field && /cardio/i.test(s)) field = 'Cardiology';
    if (!field && /surgery/i.test(s)) field = 'Surgery';
    return { field, role: FIELD[first] ? s.slice(first.length).trim() : s };
  }
  return { field: '', role: '' };
}

const US_PLACES = new Set(['CALIFORNIA', 'CONNECTICUT', 'DELAWARE', 'FLORIDA', 'ILLINOIS', 'INDIANA', 'LOS ANGELES', 'MICHIGAN', 'MISSISSIPPI', 'NEVADA', 'NEW JERSEY', 'NEW YORK', 'PENNSYLVANIA', 'PHILADELPHIA', 'TENNESSEE', 'TEXAS', 'UTAH', 'VIRGINIA', 'WISCONSIN']);
const PH_PLACES = new Set(['DAGUPAN', 'SAN RAFAEL', 'TARLAC']);

function parseDoctors(lines) {
  const out = [];
  let place = {};
  for (const raw of lines) {
    const line = clean(raw.replace(/\|/g, ' '));
    if (!line) continue;
    const m = /^Par?trix\s*Dr\.?\s*(.+)$/i.exec(line);
    if (!m) {
      if (/^(Zeta Beta|University of|Faculty of|List of|UNITED STATES)/i.test(line)) continue;
      const h = line.replace(/:$/, '').trim();
      const up = h.toUpperCase();
      if (US_PLACES.has(up)) place = { address: `${titleCase(h)}, USA` };
      else if (PH_PLACES.has(up)) place = { address: `${titleCase(h)}, Philippines` };
      else if (up === 'ASTRA ZENECA') place = { hospital: 'AstraZeneca' };
      else if (/^Director Philhealth$/i.test(h)) place = { hospital: 'PhilHealth' };
      else place = { hospital: h === up ? (h.length <= 7 ? h : titleCase(h)) : h.replace(/\(/, ' (').replace(/\s+/g, ' ') };
      continue;
    }
    let body = clean(m[1]);
    let specRaw = '';
    const paren = /\(([^)]+)\)\s*R?\s*$/.exec(body);
    if (paren) { specRaw = paren[1]; body = body.slice(0, paren.index).trim(); }
    let role = '';
    const dash = /^(.*?,[^-]+?)\s*-\s*(.+)$/.exec(body);
    if (dash) { body = dash[1].trim(); role = dash[2].trim(); }
    let surname, nick;
    if (body.includes(',')) { [surname, nick] = body.split(',').map((x) => x.trim()); }
    else { const w = body.split(/\s+/); surname = w.pop(); nick = w.join(' '); }
    const sp = parseSpecialty(specRaw || role);
    out.push({ surname, nick: nick || '', field: sp.field, role: sp.role || (specRaw && role ? role : ''), place });
  }
  return out;
}

const directory = parseDirectory(directoryLines);
const doctors = parseDoctors(doctorLines);

// ---- merge
const review = [];
const note = (name, issue) => review.push({ name, issue });
const people = roster.people.map((p) => ({ ...p, tokens: new Set(tokens(p.full_name)), sources: ['roster'] }));

function findRoster(d) {
  const S = tokens(d.surname);
  const g = tokens(d.given);
  const all = new Set([...S, ...g, ...tokens(d.nickname)]);
  let cands = people.filter((p) => !p.dir && S.every((t) => p.tokens.has(t)) && (!g.length || g.some((t) => p.tokens.has(t))) && [...p.tokens].every((t) => all.has(t)));
  if (cands.length > 1 && d.batch) cands = cands.filter((p) => p.batch === d.batch);
  if (cands.length > 1 && d.semHint) cands = cands.filter((p) => (p.semester || '').toLowerCase().startsWith(d.semHint));
  return cands.length === 1 ? { p: cands[0] } : null;
}

function findFuzzy(d) {
  const S = tokens(d.surname);
  const g0 = tokens(d.given)[0];
  if (!d.batch || !g0) return null;
  const cands = people.filter((p) => !p.dir && p.batch === d.batch && S.every((t) => p.tokens.has(t)) &&
    [...p.tokens].some((t) => !S.includes(t) && (t.startsWith(g0) || g0.startsWith(t) || lev(t, g0) <= 2)));
  if (cands.length === 1) return { p: cands[0], fuzzy: true };
  // Surname spelled differently in the two sources (e.g. Guarrano/Gaurano): same batch, similar first name, similar surname.
  const sj = S.join('');
  const near = people.filter((p) => {
    if (p.dir || p.batch !== d.batch) return false;
    const list = tokens(p.full_name);
    if (!list.some((t) => t.startsWith(g0) || g0.startsWith(t) || lev(t, g0) <= 2)) return false;
    for (let k = 1; k <= 3 && k < list.length; k++) if (lev(list.slice(-k).join(''), sj) <= 2) return true;
    return false;
  });
  return near.length === 1 ? { p: near[0], fuzzy: true } : null;
}

function directoryName(d) {
  const suffix = /\b(JR|SR|II|III|IV)\b\.?/i.exec(d.given);
  const given = d.given.replace(/,?\s*\b(JR|SR|II|III|IV)\b\.?/gi, '').replace(/[\s,]+$/, '');
  return titleCase(`${given} ${d.surname}${suffix ? ` ${suffix[1].length <= 2 && /^jr|sr$/i.test(suffix[1]) ? suffix[1] + '.' : suffix[1]}` : ''}`);
}

for (const d of directory) {
  const hit = findRoster(d) || findFuzzy(d);
  let target;
  if (hit) {
    target = hit.p;
    if (hit.fuzzy) note(target.full_name, `Fuzzy match with directory entry "${directoryName(d)}" (same batch + surname) - please confirm`);
  } else if (!d.batch) {
    note(directoryName(d), `Directory entry skipped: no roster match and no batch (nickname/notes: "${d.nickname}") - confirm if this is a member`);
    continue;
  } else {
    target = { full_name: directoryName(d), batch: d.batch, semester: '', awards: '', is_deceased: false, member_no: '', tokens: new Set([...tokens(d.surname), ...tokens(d.given)]), sources: [] };
    people.push(target);
    note(target.full_name, 'In directory but not found in roster - added with directory details only');
  }
  target.dir = d;
  target.sources.push('directory');
  target.nickname = d.nickname;
  target.birthday = d.birthday;
  target.email = d.email[0] || '';
  target.other_emails = d.email.slice(1).join('; ');
  target.mobile = d.mobile.join('; ');
  target.telephone = d.telephone.join('; ');
  target.address = d.address.join(', ');
  if (!target.batch) target.batch = d.batch;
  if (hit && d.batch && target.batch !== d.batch) note(target.full_name, `Batch differs: roster "${target.batch}" vs directory "${d.batch}" (roster used)`);
}

function nickMatch(p, nick) {
  const n = nick.toLowerCase().trim();
  if (!n) return false;
  const pn = (p.nickname || '').toLowerCase().split(/[\/\s]+/);
  const nt = tokens(nick);
  return pn.includes(n) || (nt.length > 0 && nt.every((t) => p.tokens.has(t) || (t.length >= 3 && [...p.tokens].some((x) => x.startsWith(t)))));
}

for (const doc of doctors) {
  const S = tokens(doc.surname);
  let cands = people.filter((p) => S.length && S.every((t) => p.tokens.has(t)) && nickMatch(p, doc.nick));
  if (cands.length > 1) cands = cands.filter((p) => (p.nickname || '').toLowerCase() === doc.nick.toLowerCase());
  let fuzzy = false;
  if (cands.length === 0 && doc.nick) {
    const nk = doc.nick.toLowerCase();
    cands = people.filter((p) => S.length && S.every((t) => [...p.tokens].some((x) => x === t || lev(x, t) <= 1)) &&
      [(p.nickname || '').toLowerCase(), ...p.tokens].some((x) => x && lev(x, nk) <= 2 && Math.abs(x.length - nk.length) <= 2));
    fuzzy = cands.length === 1;
  }
  if (cands.length !== 1) {
    note(`${doc.nick} ${doc.surname}`.trim(), cands.length > 1 ? 'Doctors list: several possible people - not merged' : 'Doctors list: no matching member found - not imported');
    continue;
  }
  const p = cands[0];
  if (fuzzy) note(p.full_name, `Doctors list entry "${doc.nick} ${doc.surname}" fuzzy-matched to this member - please confirm`);
  p.sources.push('doctors');
  if (doc.place.hospital) p.hospital = doc.place.hospital;
  else if (doc.place.address && !p.address) p.address = doc.place.address;
  if (doc.field) p.field_of_medicine = doc.field;
  if (doc.role) p.specialization = doc.role;
}

for (const p of people) {
  if (p.sources.length === 1 && p.sources[0] === 'roster') note(p.full_name, 'In roster but no directory entry (no contact details)');
}

// ================================================================== VALIDATE
const errors = [];
for (const p of people) {
  const emails = [p.email, ...(p.other_emails ? p.other_emails.split('; ') : [])].filter(Boolean);
  for (const e of emails) if (!EMAIL_OK.test(e)) errors.push(`${p.full_name}: invalid email "${e}"`);
}
const COLS = ['full_name', 'nickname', 'batch', 'semester', 'member_no', 'awards', 'is_deceased', 'birthday', 'hospital', 'field_of_medicine', 'specialization', 'email', 'other_emails', 'mobile', 'telephone', 'address'];
const MAX = { full_name: 255, nickname: 100, batch: 50, semester: 100, awards: 255, hospital: 255, field_of_medicine: 100, specialization: 255, email: 255, other_emails: 500, mobile: 255, telephone: 255, address: 2000 };
const rows = people.map((p) => {
  const r = {};
  for (const c of COLS) r[c] = c === 'is_deceased' ? (p.is_deceased ? 'true' : '') : (c === 'member_no' ? (p.member_no || '') : clean(p[c]));
  return r;
});
const seen = new Map();
rows.forEach((r) => {
  if (!r.full_name) errors.push('row without full_name');
  for (const [c, max] of Object.entries(MAX)) if (String(r[c]).length > max) errors.push(`${r.full_name}: ${c} longer than ${max}`);
  if (r.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(r.birthday)) errors.push(`${r.full_name}: bad birthday ${r.birthday}`);
  const key = `${r.full_name.toLowerCase()}|${r.batch.toLowerCase()}`;
  if (seen.has(key)) errors.push(`duplicate name+batch: ${r.full_name} (${r.batch})`);
  seen.set(key, true);
});
const byEmail = new Map();
rows.forEach((r) => { if (r.email) byEmail.set(r.email.toLowerCase(), [...(byEmail.get(r.email.toLowerCase()) || []), r.full_name]); });
byEmail.forEach((names, e) => { if (names.length > 1) note(names.join(' / '), `Same email on several people (${e}) - possible typo in source`); });
const rosterNos = roster.people.map((p) => p.member_no);
const dupNos = rosterNos.filter((n, i) => rosterNos.indexOf(n) !== i);
if (dupNos.length) note('(roster numbering)', `Roster numbers repeated in the source: ${uniq(dupNos).join(', ')}`);
const unknownBatch = uniq(rows.map((r) => r.batch).filter((b) => b && ![...knownBatches.values()].includes(b)));
unknownBatch.forEach((b) => note('(batch)', `Batch "${b}" from directory is not in the roster`));

// ================================================================== LOAD FILES
const esc = (v) => { const s = v === undefined || v === null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'alumni-import.csv'), '\ufeff' + [COLS.join(','), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(','))].join('\r\n') + '\r\n');
fs.writeFileSync(path.join(root, 'data', 'alumni-review.csv'), '\ufeffname,issue\r\n' + review.map((r) => `${esc(r.name)},${esc(r.issue)}`).join('\r\n') + '\r\n');

const lit = (v) => (v === '' || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const valueRows = rows.map((r) => `  (${COLS.map((c) => lit(r[c])).join(', ')})`).join(',\n');
const sql = `-- Alumni seed (generated by scripts/build-alumni-import.mjs). Contains personal data - do not commit.
-- Requires migrations 007 and 010. Safe to re-run: people already on file (same name + batch) are skipped.
BEGIN;

INSERT INTO alumni (full_name, nickname, batch, semester, member_no, awards, is_deceased, birthday, hospital, field_of_medicine, specialization, email, other_emails, mobile, telephone, address)
SELECT v.full_name, v.nickname, v.batch, v.semester, v.member_no::integer, v.awards, COALESCE(v.is_deceased::boolean, FALSE), v.birthday::date, v.hospital, v.field_of_medicine, v.specialization, v.email, v.other_emails, v.mobile, v.telephone, v.address
FROM (VALUES
${valueRows}
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
  roster: roster.people.length, batches: knownBatches.size, directory: directory.length, doctors: doctors.length, output: people.length,
  mergedRosterDirectory: count((p) => p.sources.includes('roster') && p.sources.includes('directory')),
  directoryOnly: count((p) => !p.sources.includes('roster')),
  rosterOnly: count((p) => p.sources.length === 1 && p.sources[0] === 'roster'),
  doctorsMerged: count((p) => p.sources.includes('doctors')),
  withEmail: rows.filter((r) => r.email).length, withMobile: rows.filter((r) => r.mobile).length, withBirthday: rows.filter((r) => r.birthday).length,
  reviewItems: review.length, validationErrors: errors.length,
}, null, 2));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
