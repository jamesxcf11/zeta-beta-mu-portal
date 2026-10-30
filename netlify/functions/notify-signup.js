const { json, requiredEnv, adminClient } = require('./_lib/auth');
const { sendEmail, newApplicantEmail } = require('./_lib/mailer');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

function bearer(headers = {}) {
  const match = /^Bearer\s+(.+)$/i.exec((headers.authorization || headers.Authorization || '').trim());
  return match ? match[1] : null;
}

/**
 * Called by under-review.html after the applicant clicks the email link.
 * Pending members cannot use `authenticate()` (it requires status=active), so
 * the JWT is verified directly. Sends the admin alert exactly once, and only
 * if the applicant's email is confirmed.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (requiredEnv(REQUIRED_ENV).length > 0) return json(500, { error: 'Notification service is not configured' });

  const token = bearer(event.headers);
  if (!token) return json(401, { error: 'Missing Authorization bearer token' });

  const supabase = adminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData && userData.user;
  if (userError || !user) return json(401, { error: 'Invalid or expired session' });
  if (!user.email_confirmed_at) return json(403, { error: 'Email is not confirmed' });

  const { data: member } = await supabase
    .from('members')
    .select('id, username, email, first_name, last_name, graduation_year, hospital, field_of_medicine, status, admin_notified_at')
    .eq('auth_id', user.id)
    .is('deleted_at', null)
    .single();
  if (!member) return json(404, { error: 'No application found for this account' });
  if (member.status !== 'pending' || member.admin_notified_at) return json(200, { notified: false });

  const { data: claimed } = await supabase
    .from('members')
    .update({ admin_notified_at: new Date().toISOString() })
    .eq('id', member.id)
    .is('admin_notified_at', null)
    .select('id');
  if (!claimed || !claimed.length) return json(200, { notified: false });

  const { data: admins } = await supabase
    .from('members')
    .select('email')
    .eq('role', 'admin')
    .eq('status', 'active')
    .is('deleted_at', null);

  const template = newApplicantEmail(member);
  const results = await Promise.all((admins || []).filter((a) => a.email).map((a) => sendEmail({ to: a.email, ...template })));
  const sent = results.some((r) => r.sent);

  if (!sent) await supabase.from('members').update({ admin_notified_at: null }).eq('id', member.id);
  return json(200, { notified: sent });
};
