/**
 * POST /api/admin-alumni
 *
 * Officer/admin-only management of the alumni roster (`alumni` table, see
 * sql/migrations/007-alumni.sql). The table has no client write policies, so
 * this function (service role) is the only write path.
 *
 * Body: { action: 'create' | 'update' | 'delete' | 'import', ... }
 */

const { json, requiredEnv, authenticate, isOfficer } = require('./_lib/auth');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const MAX_IMPORT_ROWS = 2000;
const CHUNK = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEXT_FIELDS = {
  full_name: 255, nickname: 100, batch: 50, hospital: 2000, field_of_medicine: 100,
  last_name: 100, first_name: 100, middle_name: 100, intl_location: 100, schedule: 2000,
  specialization: 2000, email: 255, mobile: 255, telephone: 255, address: 2000,
  facebook: 255, instagram: 255, avatar_url: 500, semester: 100, awards: 255, other_emails: 500,
};

function clean(input) {
  const out = {};
  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    if (input[key] === undefined) continue;
    const v = typeof input[key] === 'string' || typeof input[key] === 'number' ? String(input[key]).trim().slice(0, max) : '';
    out[key] = v || null;
  }
  if (input.graduation_year !== undefined) {
    const y = parseInt(input.graduation_year, 10);
    out.graduation_year = y >= 1900 && y <= 2100 ? y : null;
  }
  if (input.member_no !== undefined) {
    const n = parseInt(input.member_no, 10);
    out.member_no = n > 0 && n < 100000 ? n : null;
  }
  for (const flag of ['is_deceased', 'is_retired']) {
    if (input[flag] !== undefined) out[flag] = input[flag] === true || /^(true|yes|1|y|\+)$/i.test(String(input[flag]).trim());
  }
  if (input.birthday !== undefined) {
    const b = String(input.birthday).trim();
    const t = /^\d{4}-\d{2}-\d{2}$/.test(b) ? Date.parse(`${b}T00:00:00Z`) : NaN;
    out.birthday = Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== b ? null : b;
  }
  return out;
}

function validate(record, { partial }) {
  if (!partial && !record.full_name) return 'Name is required';
  if (partial && 'full_name' in record && !record.full_name) return 'Name is required';
  if (record.email && !EMAIL_RE.test(record.email)) return 'Invalid email address';
  return null;
}

function matchKey(record) {
  return `${(record.full_name || '').trim().toLowerCase()}|${(record.batch || '').trim().toLowerCase()}`;
}

async function loadExisting(supabase) {
  const map = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('alumni')
      .select('id, full_name, batch')
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) return null;
    for (const row of data || []) if (!map.has(matchKey(row))) map.set(matchKey(row), row.id);
    if (!data || data.length < 1000) break;
  }
  return map;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (requiredEnv(REQUIRED_ENV).length > 0) return json(500, { error: 'Alumni service is not configured' });

  const auth = await authenticate(event);
  if (auth.error) return auth.error;
  const { member: caller, supabase } = auth;
  if (!isOfficer(caller)) return json(403, { error: 'Officer access required' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body must be valid JSON' });
  }

  switch (body.action) {
    case 'create': {
      const record = clean(body.alumnus || {});
      const problem = validate(record, { partial: false });
      if (problem) return json(400, { error: problem });
      const { data, error } = await supabase.from('alumni').insert(record).select('id').single();
      if (error) return json(500, { error: 'Could not add alumnus' });
      return json(200, { ok: true, id: data.id });
    }
    case 'update': {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return json(400, { error: 'id is required' });
      const record = clean(body.alumnus || {});
      if (!Object.keys(record).length) return json(400, { error: 'No changes provided' });
      const problem = validate(record, { partial: true });
      if (problem) return json(400, { error: problem });
      const { data, error } = await supabase.from('alumni').update(record).eq('id', id).is('deleted_at', null).select('id');
      if (error) return json(500, { error: 'Could not update alumnus' });
      if (!data || !data.length) return json(404, { error: 'Alumnus not found' });
      return json(200, { ok: true });
    }
    case 'delete': {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return json(400, { error: 'id is required' });
      const { data, error } = await supabase.from('alumni').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id');
      if (error) return json(500, { error: 'Could not remove alumnus' });
      if (!data || !data.length) return json(404, { error: 'Alumnus not found' });
      return json(200, { ok: true });
    }
    case 'import': {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!rows.length) return json(400, { error: 'No rows to import' });
      if (rows.length > MAX_IMPORT_ROWS) return json(400, { error: `At most ${MAX_IMPORT_ROWS} rows per import` });

      const valid = [];
      const skipped = [];
      rows.forEach((row, i) => {
        const record = clean(row && typeof row === 'object' ? row : {});
        const problem = validate(record, { partial: false });
        if (problem) skipped.push({ row: i + 1, reason: problem });
        else valid.push(record);
      });

      const existing = await loadExisting(supabase);
      if (!existing) return json(500, { error: 'Could not read the current alumni list' });

      // Re-importing an updated sheet updates people already on file (same
      // name + batch) instead of duplicating them. Blank cells never erase data.
      const toInsert = [];
      const toUpdate = new Map();
      for (const record of valid) {
        const key = matchKey(record);
        const id = existing.get(key);
        if (id === -1) {
          const pending = toInsert.find(r => matchKey(r) === key);
          Object.entries(record).forEach(([k, v]) => { if (v !== null && v !== '' && v !== false) pending[k] = v; });
        } else if (id) {
          const changes = Object.fromEntries(Object.entries(record).filter(([, v]) => v !== null && v !== '' && v !== false));
          toUpdate.set(id, { ...(toUpdate.get(id) || {}), ...changes });
        } else {
          existing.set(key, -1);
          toInsert.push(record);
        }
      }

      let created = 0;
      let updated = 0;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const { error } = await supabase.from('alumni').insert(toInsert.slice(i, i + CHUNK));
        if (error) return json(500, { error: 'Import failed part-way', created, updated, skipped });
        created += Math.min(CHUNK, toInsert.length - i);
      }
      const updates = [...toUpdate.entries()];
      for (let i = 0; i < updates.length; i += 25) {
        const results = await Promise.all(updates.slice(i, i + 25).map(([id, changes]) => supabase.from('alumni').update(changes).eq('id', id)));
        if (results.some(r => r.error)) return json(500, { error: 'Import failed part-way', created, updated, skipped });
        updated += results.length;
      }
      return json(200, { ok: true, imported: created + updated, created, updated, skipped });
    }
    default:
      return json(400, { error: 'Unknown action' });
  }
};
