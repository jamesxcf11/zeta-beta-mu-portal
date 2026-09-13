/**
 * POST /api/delete-object
 *
 * Officer-only cleanup of R2 objects. Used when a vault submission is rejected
 * so refused media stops consuming storage — previously rejected uploads set
 * approval_status = 'rejected' and left the files behind forever.
 *
 * Request body: { keys: string[] }
 * Response:     { deleted: number }
 */

const { json, requiredEnv, authenticate, isOfficer } = require('./_lib/auth');
const r2 = require('./_lib/r2');

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];

const MAX_KEYS_PER_CALL = 100;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const missingEnv = requiredEnv(REQUIRED_ENV);
  if (missingEnv.length > 0) {
    console.error('delete-object: missing env vars', missingEnv);
    return json(500, { error: 'Storage is not configured' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body must be valid JSON' });
  }

  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (keys.length === 0) {
    return json(400, { error: 'keys must be a non-empty array' });
  }
  if (keys.length > MAX_KEYS_PER_CALL) {
    return json(400, { error: `At most ${MAX_KEYS_PER_CALL} keys per request` });
  }

  const auth = await authenticate(event);
  if (auth.error) return auth.error;

  if (!isOfficer(auth.member)) {
    const ownProfilePrefix = `profiles/${auth.member.id}/`;
    if (keys.some((key) => typeof key !== 'string' || !key.startsWith(ownProfilePrefix))) {
      return json(403, { error: 'Members may only delete their own profile photos' });
    }
  }

  const rejected = keys.filter((k) => !r2.isManagedKey(k));
  if (rejected.length > 0) {
    return json(400, { error: 'One or more keys are not valid managed keys', rejected });
  }

  try {
    const result = await r2.deleteKeys(keys);
    return json(200, result);
  } catch (err) {
    console.error('delete-object: delete failed', err);
    return json(502, { error: 'Could not delete objects' });
  }
};
