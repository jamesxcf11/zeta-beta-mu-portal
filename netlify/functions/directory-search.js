/**
 * POST /api/directory-search
 *
 * Members search the alumni directory here instead of reading the table, so the
 * full list (and its contact details) never reaches the browser.
 *
 * Body: { q: string (min 2 chars), specialty?: string, offset?: number }
 *
 * Members receive limited profile fields; officers/admins also receive contact
 * details, birthday and schedule.
 */

const { json, requiredEnv, authenticate, isOfficer } = require('./_lib/auth');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const PAGE_SIZE = 25;
const MIN_QUERY = 2;
const MAX_QUERY = 80;
const MAX_TERMS = 6;
const MAX_OFFSET = 5000;
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60 * 1000;

const MEMBER_COLUMNS = 'id, full_name, nickname, batch, hospital, specialization, field_of_medicine, intl_location, avatar_url, is_deceased, is_retired';
const OFFICER_COLUMNS = `${MEMBER_COLUMNS}, last_name, first_name, middle_name, semester, member_no, awards, birthday, email, other_emails, mobile, telephone, address, facebook, instagram, schedule`;

const SPECIALTY_TERMS = {
  Cardiology: 'cardi', Neurology: 'neuro', Oncology: 'onco', Pediatrics: 'pedia', Surgery: 'surg',
};

const hits = new Map();

function rateLimited(memberId) {
  const now = Date.now();
  const recent = (hits.get(memberId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(memberId, recent);
  return recent.length > RATE_LIMIT;
}

/** Same normalisation as the alumni_build_search_text trigger. */
function normalise(text) {
  return String(text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[áàâäãå]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c');
}

function escapeLike(term) {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function toResult(row, officer) {
  const base = {
    id: row.id, name: row.full_name, nickname: row.nickname, batch: row.batch, hospital: row.hospital,
    specialization: row.specialization, field: row.field_of_medicine, location: row.intl_location,
    avatar: row.avatar_url, deceased: !!row.is_deceased, retired: !!row.is_retired,
  };
  if (!officer) return base;
  return {
    ...base, lastName: row.last_name, firstName: row.first_name, middleName: row.middle_name, semester: row.semester,
    memberNo: row.member_no, awards: row.awards, birthday: row.birthday, email: row.email, otherEmails: row.other_emails,
    mobile: row.mobile, telephone: row.telephone, address: row.address, facebook: row.facebook, instagram: row.instagram,
    schedule: row.schedule,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (requiredEnv(REQUIRED_ENV).length > 0) return json(500, { error: 'Directory service is not configured' });

  const auth = await authenticate(event);
  if (auth.error) return auth.error;
  const { member, supabase } = auth;
  if (rateLimited(member.id)) return json(429, { error: 'Too many searches. Please wait a moment and try again.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body must be valid JSON' });
  }

  const q = typeof body.q === 'string' ? body.q.trim().slice(0, MAX_QUERY) : '';
  if (q.length < MIN_QUERY) return json(400, { error: `Type at least ${MIN_QUERY} characters to search` });
  const offset = Math.min(Math.max(parseInt(body.offset, 10) || 0, 0), MAX_OFFSET);

  const terms = normalise(q).split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
  if (typeof body.specialty === 'string' && SPECIALTY_TERMS[body.specialty]) terms.push(SPECIALTY_TERMS[body.specialty]);

  const officer = isOfficer(member);
  let query = supabase
    .from('alumni')
    .select(officer ? OFFICER_COLUMNS : MEMBER_COLUMNS, { count: 'exact' })
    .is('deleted_at', null);
  for (const term of terms) query = query.ilike('search_text', `%${escapeLike(term)}%`);

  const { data, error, count } = await query
    .order('last_name', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) return json(500, { error: 'Search failed' });

  const total = typeof count === 'number' ? count : (data || []).length;
  return json(200, {
    ok: true,
    results: (data || []).map((row) => toResult(row, officer)),
    total,
    offset,
    nextOffset: offset + PAGE_SIZE < total ? offset + PAGE_SIZE : null,
    officer,
  });
};

exports.normalise = normalise;
