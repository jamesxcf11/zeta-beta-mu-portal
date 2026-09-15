/**
 * POST /api/delete-object
 *
 * Authenticated cleanup of managed R2 objects. Members may remove their own
 * profile and post images; officers may additionally remove vault media when a
 * submission is rejected so refused files do not consume storage.
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

  const ownProfilePrefix = `profiles/${auth.member.id}/`;
  const ownPostPrefix = `posts/${auth.member.id}/`;
  const forbidden = keys.some((key) => {
    if (typeof key !== 'string') return true;
    if (key.startsWith(ownProfilePrefix) || key.startsWith(ownPostPrefix)) return false;
    return !isOfficer(auth.member) || !key.startsWith('vault/');
  });
  if (forbidden) {
    return json(403, { error: 'You may only delete your own profile or post images' });
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
