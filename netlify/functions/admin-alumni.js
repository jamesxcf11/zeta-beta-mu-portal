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
  full_name: 255, nickname: 100, batch: 50, hospital: 255, field_of_medicine: 100,
  specialization: 255, email: 255, mobile: 50, telephone: 50, address: 2000,
  facebook: 255, instagram: 255, avatar_url: 500,
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
  return out;
}

function validate(record, { partial }) {
  if (!partial && !record.full_name) return 'Name is required';
  if (partial && 'full_name' in record && !record.full_name) return 'Name is required';
  if (record.email && !EMAIL_RE.test(record.email)) return 'Invalid email address';
  return null;
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

      for (let i = 0; i < valid.length; i += CHUNK) {
        const { error } = await supabase.from('alumni').insert(valid.slice(i, i + CHUNK));
        if (error) return json(500, { error: 'Import failed part-way', imported: i, skipped });
      }
      return json(200, { ok: true, imported: valid.length, skipped });
    }
    default:
      return json(400, { error: 'Unknown action' });
  }
};
