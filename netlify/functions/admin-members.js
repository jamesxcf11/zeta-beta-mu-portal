const { json, requiredEnv, authenticate, isOfficer } = require('./_lib/auth');
const { sendEmail, approvedEmail } = require('./_lib/mailer');
const crypto = require('crypto');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const ROLES = ['member', 'moderator', 'officer', 'alumni', 'admin'];
const STATUSES = ['active', 'pending', 'suspended', 'inactive'];
const OFFICER_GRANTABLE = ['member', 'moderator', 'alumni'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v, max = 255) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function baseUrl(event) {
  const configured = String(process.env.SITE_URL || process.env.URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const h = event.headers || {};
  return String(h.origin || h.Origin || '').replace(/\/+$/, '');
}

// Admins manage everyone. Officers may only grant low roles and may not touch
// admin/officer accounts. Nobody may change their own role or status.
function canGrant(caller, role) {
  return caller.role === 'admin' || OFFICER_GRANTABLE.includes(role);
}
function canManage(caller, target) {
  if (target.id === caller.id) return false;
  return caller.role === 'admin' || OFFICER_GRANTABLE.includes(target.role);
}

async function createMember(event, caller, supabase, body) {
  const first = str(body.firstName, 100);
  const last = str(body.lastName, 100);
  const email = str(body.email).toLowerCase();
  const username = str(body.username, 50);
  const role = ROLES.includes(body.role) ? body.role : 'member';
  const status = STATUSES.includes(body.status) ? body.status : 'active';
  const year = parseInt(body.graduationYear, 10);

  if (!first || !last || !username || !EMAIL_RE.test(email)) {
    return json(400, { error: 'First name, last name, username and a valid email are required' });
  }
  if (!canGrant(caller, role)) return json(403, { error: 'Only admins can grant that role' });

  const [byName, byEmail] = await Promise.all([
    supabase.from('members').select('id').eq('username', username).limit(1),
    supabase.from('members').select('id').ilike('email', email.replace(/[\\%_]/g, '\\$&')).limit(1),
  ]);
  if ((byName.data && byName.data.length) || (byEmail.data && byEmail.data.length)) {
    return json(409, { error: 'Username or email is already in use' });
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomBytes(24).toString('base64url'),
    email_confirm: true,
  });
  if (createError || !created || !created.user) {
    return json(400, { error: createError && createError.message ? createError.message : 'Could not create account' });
  }

  const { error: insertError } = await supabase.from('members').insert({
    username, email,
    password_hash: 'managed_by_supabase_auth',
    auth_id: created.user.id,
    first_name: first, last_name: last,
    graduation_year: Number.isFinite(year) ? year : 2000,
    hospital: str(body.hospital) || 'Not provided',
    field_of_medicine: str(body.field) || 'General Medicine',
    role, status,
    email_verified_at: new Date().toISOString(),
    avatar_url: `image/placeholders/avatars/a${[10, 13, 14, 20, 25][Math.floor(Math.random() * 5)]}.jpg`,
  });
  if (insertError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return json(500, { error: 'Could not create member profile' });
  }

  // The member sets their own password through the standard reset link.
  const redirectTo = baseUrl(event) ? `${baseUrl(event)}/reset-password.html` : undefined;
  const { error: mailError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return json(200, { ok: true, inviteSent: !mailError });
}

async function loadTarget(supabase, id) {
  const { data } = await supabase
    .from('members')
    .select('id, email, first_name, name, role, status, auth_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  return data || null;
}

async function updateMember(caller, supabase, body) {
  const target = await loadTarget(supabase, Number(body.memberId));
  if (!target) return json(404, { error: 'Member not found' });
  if (!canManage(caller, target)) return json(403, { error: 'You cannot modify this member' });

  const update = {};
  const name = str(body.name, 200);
  if (name) {
    const parts = name.split(/\s+/);
    update.first_name = parts[0];
    update.last_name = parts.slice(1).join(' ') || parts[0];
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return json(400, { error: 'Invalid role' });
    if (!canGrant(caller, body.role)) return json(403, { error: 'Only admins can grant that role' });
    update.role = body.role;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return json(400, { error: 'Invalid status' });
    update.status = body.status;
  }
  if (body.email !== undefined) {
    const email = str(body.email).toLowerCase();
    if (!EMAIL_RE.test(email)) return json(400, { error: 'Invalid email address' });
    if (email !== (target.email || '').toLowerCase()) {
      if (target.auth_id) {
        const { error: authError } = await supabase.auth.admin.updateUserById(target.auth_id, { email, email_confirm: true });
        if (authError) return json(400, { error: authError.message || 'Could not update sign-in email' });
      }
      update.email = email;
    }
  }
  if (!Object.keys(update).length) return json(400, { error: 'No changes provided' });

  const { error } = await supabase.from('members').update(update).eq('id', target.id);
  if (error) return json(500, { error: 'Could not update member' });

  let emailSent = false;
  if (target.status === 'pending' && update.status === 'active') {
    emailSent = (await sendEmail({ to: update.email || target.email, ...approvedEmail(target) })).sent;
  }
  return json(200, { ok: true, emailSent });
}

async function setStatus(caller, supabase, body) {
  const status = body.status;
  if (status !== 'active' && status !== 'suspended') return json(400, { error: 'status must be "active" or "suspended"' });
  const target = await loadTarget(supabase, Number(body.memberId));
  if (!target) return json(404, { error: 'Member not found' });
  if (!canManage(caller, target)) return json(403, { error: 'You cannot modify this member' });
  if (target.status === 'pending') return json(409, { error: 'Approve or reject pending members instead' });

  const { error } = await supabase.from('members').update({ status }).eq('id', target.id);
  if (error) return json(500, { error: 'Could not update status' });
  return json(200, { ok: true });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (requiredEnv(REQUIRED_ENV).length > 0) return json(500, { error: 'Member service is not configured' });

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
    case 'create': return createMember(event, caller, supabase, body);
    case 'update': return updateMember(caller, supabase, body);
    case 'set-status': return setStatus(caller, supabase, body);
    default: return json(400, { error: 'Unknown action' });
  }
};
