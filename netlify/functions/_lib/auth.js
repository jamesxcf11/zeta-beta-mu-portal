/**
 * Shared server-side authorization helpers for Netlify Functions.
 *
 * The browser sends the Supabase access token (from db.auth.signInWithPassword,
 * see js/auth.js) as `Authorization: Bearer <jwt>`. We verify it with the
 * service-role key and then resolve the caller's `members` row via
 * `members.auth_id`, which js/auth.js populates on signup.
 *
 * IMPORTANT: the localStorage `zbm-session` blob is NOT trusted here. It is a
 * UI convenience object that any user can edit. Only the verified JWT counts.
 */

const { createClient } = require('@supabase/supabase-js');

const OFFICER_ROLES = ['admin', 'officer'];

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function requiredEnv(names) {
  const missing = names.filter((n) => !process.env[n]);
  return missing;
}

function adminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function bearerToken(headers = {}) {
  // Netlify lowercases header names, but be defensive.
  const raw = headers.authorization || headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1] : null;
}

/**
 * Verify the caller and load their member record.
 * @returns {{ error: object } | { member: object, supabase: object }}
 */
async function authenticate(event) {
  const token = bearerToken(event.headers);
  if (!token) {
    return { error: json(401, { error: 'Missing Authorization bearer token' }) };
  }

  const supabase = adminClient();

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData || !userData.user) {
    return { error: json(401, { error: 'Invalid or expired session' }) };
  }

  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, role, status, deleted_at')
    .eq('auth_id', userData.user.id)
    .is('deleted_at', null)
    .single();

  if (memberError || !member) {
    // Most likely cause: the account was created by sql/seed-data.sql, which
    // does not populate auth_id and has no matching auth.users row.
    return {
      error: json(403, {
        error: 'No member profile linked to this account',
        hint: 'Accounts from seed-data.sql have no auth_id. Register through the signup flow.',
      }),
    };
  }

  if (member.status !== 'active') {
    return {
      error: json(403, { error: `Account status is "${member.status}", not active` }),
    };
  }

  return { member, supabase };
}

function isOfficer(member) {
  return OFFICER_ROLES.includes(member.role);
}

module.exports = {
  json,
  requiredEnv,
  adminClient,
  authenticate,
  isOfficer,
  OFFICER_ROLES,
};
