/**
 * Cleaning helpers for the ZBM master Excel file (pure functions, unit-tested).
 */

export const EMAIL_OK = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export const clean = (s) => String(s ?? '').replace(/[\u2018\u2019`]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();

export function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (value.richText) return value.richText.map((t) => t.text).join('');
    if (value.text !== undefined) return String(value.text);
    if (value.result !== undefined) return String(value.result);
    return '';
  }
  return String(value);
}

/** Lines of a multi-line cell, trimmed, empty lines dropped. */
export const lines = (s) => String(s ?? '').replace(/\r/g, '').split('\n').map((l) => l.replace(/[\u2018\u2019`]/g, "'").replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Keeps line breaks (for schedules) but tidies spacing. */
export const tidyMultiline = (s) => lines(s).join('\n');

export const joinLines = (s, sep = '; ') => lines(s).join(sep);

export function parseName({ last, first, middle }) {
  let l = clean(last);
  let f = clean(first);
  const suffix = /\s+(Jr\.?|Sr\.?|II|III|IV)$/i.exec(f);
  if (suffix && !new RegExp(`\\b${suffix[1].replace('.', '\\.?')}$`, 'i').test(l)) { f = f.slice(0, suffix.index); l = `${l} ${suffix[1]}`; }
  let m = clean(middle).replace(/,$/, '').trim();
  if (/^[A-Za-z]$/.test(m)) m += '.';
  return { last_name: l, first_name: f, middle_name: m, full_name: [f, m, l].filter(Boolean).join(' ') };
}

/** Birthday cell -> { iso, issue }. Accepts Dates, Excel serials, "04/13/1960", "8241985", "01/071989", "04 /06/1954". */
export function parseBirthday(value) {
  const iso = (y, m, d) => {
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
    const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s ? s : null;
  };
  if (value === null || value === undefined || value === '') return { iso: '', issue: '' };
  if (value instanceof Date) return { iso: value.toISOString().slice(0, 10), issue: '' };
  if (typeof value === 'number') {
    const d = new Date(Math.round((value - 25569) * 86400000));
    return { iso: d.toISOString().slice(0, 10), issue: '' };
  }
  const s = clean(value);
  if (!s || /^n\/?a$/i.test(s) || /^\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*(?:n\/?a)?$/i.test(s)) return { iso: '', issue: '' };
  let m = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/?\s*(\d{4})$/.exec(s) || /^(\d{1,2})\s*\/\s*(\d{2})(\d{4})$/.exec(s) || /^(\d)(\d{2})(\d{4})$/.exec(s);
  if (m) {
    const r = iso(Number(m[3]), Number(m[1]), Number(m[2])) || iso(Number(m[3]), Number(m[2]), Number(m[1]));
    if (r) return { iso: r, issue: '' };
  }
  return { iso: '', issue: `Birthday not understood: "${s}"` };
}

/** Phone cell -> { mobile: [], telephone: [] } (PH mobiles as 09xx-xxx-xxxx). */
export function parsePhones(cell) {
  const mobile = [];
  const telephone = [];
  const push = (arr, v) => { if (v && !arr.includes(v) && !mobile.includes(v) && !telephone.includes(v)) arr.push(v); };
  for (const line of lines(cell)) {
    const tag = (/\((home|office|ofc|cell|work|fax)\)/i.exec(line) || [])[1];
    const raw = line.replace(/\((home|office|ofc|cell|work|fax)\)/gi, '').trim();
    const digits = raw.replace(/\D/g, '');
    const fmt = (d) => `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
    let ph = null;
    if (/^9\d{9}$/.test(digits)) ph = `0${digits}`;
    else if (/^09\d{9}$/.test(digits)) ph = digits;
    else if (/^639\d{9}$/.test(digits)) ph = `0${digits.slice(2)}`;
    if (ph && !raw.startsWith('+') || ph && /^\+?63/.test(raw)) { push(mobile, fmt(ph)); continue; }
    if (digits.length < 5) continue;
    push(telephone, tag ? `${raw} (${tag.toLowerCase()})` : raw);
  }
  return { mobile, telephone };
}

/** Email cell -> { valid: [], invalid: [] }; repairs addresses broken over two lines. */
export function parseEmails(cell) {
  const tokens = String(cell ?? '').replace(/\r/g, '').split(/[\s;,]+/).map((t) => t.trim()).filter(Boolean);
  const fix = (s) => s.toLowerCase().replace(/^mailto:/, '').replace(/\.{2,}/g, '.').replace(/(\.(?:com|net|org|ph|edu|gov))-[a-z]{1,3}$/i, '$1')
    .replace(/@([a-z0-9-]+?)(com|net|org)$/i, '@$1.$2').replace(/[.,]+$/, '');
  const merged = [];
  for (const t of tokens) {
    const prev = merged[merged.length - 1];
    const joined = prev && !t.includes('@') ? [prev + t, `${prev}.${t}`].find((c) => EMAIL_OK.test(fix(c))) : null;
    const brokenTld = prev && !t.includes('@') && /^[a-z]{1,2}$/i.test(t) && /@[^\s]+\.(?:co|c|ne|n|or|o)$/i.test(prev) && /\.(?:com|net|org)$/i.test(prev + t);
    if (brokenTld) merged[merged.length - 1] = prev + t;
    else if (prev && !EMAIL_OK.test(fix(prev)) && joined) merged[merged.length - 1] = joined;
    else merged.push(t);
  }
  const valid = [];
  const invalid = [];
  for (const raw of merged) {
    const e = fix(raw);
    if (EMAIL_OK.test(e)) { if (!valid.includes(e)) valid.push(e); } else invalid.push(raw);
  }
  return { valid, invalid };
}

const FIELD_RULES = [
  [/cardi|heart/i, 'Cardiology'], [/neuro(?!psych)|stroke/i, 'Neurology'], [/onco|cancer|hemato/i, 'Oncology'],
  [/pedia|paediat|neonat/i, 'Pediatrics'], [/ophthal|optha|ophtha|eye|retina|cataract/i, 'Ophthalmology'],
  [/ortho/i, 'Orthopedics'], [/derma/i, 'Dermatology'], [/anesth|anaesth/i, 'Anesthesiology'], [/radio/i, 'Radiology'],
  [/psych/i, 'Psychiatry'], [/ob[\s-]?gyn|obstet|gyne/i, 'Obstetrics and Gynecology'], [/\bent\b|otolaryn|otorhino/i, 'Otolaryngology (ENT)'],
  [/uro/i, 'Urology'], [/gastro/i, 'Gastroenterology'], [/pulmo/i, 'Pulmonology'], [/nephro/i, 'Nephrology'], [/endocrin/i, 'Endocrinology'],
  [/emergency|\ber\b/i, 'Emergency Medicine'], [/patho/i, 'Pathology'], [/surg/i, 'Surgery'], [/internal|\bim\b|medicine/i, 'Internal Medicine'],
  [/family/i, 'Family Medicine'], [/rehab|physiatr/i, 'Rehabilitation Medicine'],
];

/** Broad field used for the search filters, derived from the free-text specialization. */
export function fieldFromSpecialization(spec) {
  const s = String(spec || '');
  for (const [re, field] of FIELD_RULES) if (re.test(s)) return field;
  return '';
}

export const normKey = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

export function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Person key used to match the same person across sheets: first word of first name + last name + batch. */
export const personKey = (last, first, batch) => `${normKey(last)}|${normKey(clean(first).split(' ')[0])}|${normKey(batch)}`;
