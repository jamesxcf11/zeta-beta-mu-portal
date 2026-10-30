const { json, requiredEnv, authenticate, isOfficer } = require('./_lib/auth');
const { sendEmail, approvedEmail, rejectedEmail } = require('./_lib/mailer');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const ACTIONS = { approve: 'active', reject: 'rejected' };

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

  const status = ACTIONS[body.action];
  const memberId = Number(body.memberId);
  if (!status || !Number.isInteger(memberId) || memberId <= 0) {
    return json(400, { error: 'action must be "approve" or "reject" and memberId a valid id' });
  }

  const { data: target, error: findError } = await supabase
    .from('members')
    .select('id, email, first_name, name, status, email_verified_at')
    .eq('id', memberId)
    .is('deleted_at', null)
    .single();
  if (findError || !target) return json(404, { error: 'Member not found' });
  if (target.id === caller.id) return json(403, { error: 'You cannot review your own account' });
  if (target.status !== 'pending') return json(409, { error: `Member is already "${target.status}"` });

  if (!target.email_verified_at) return json(409, { error: 'Applicant has not confirmed their email yet' });

  const { error: updateError } = await supabase.from('members').update({ status }).eq('id', memberId);
  if (updateError) return json(500, { error: 'Could not update member' });

  let emailSent = false;
  if (target.email) {
    const template = status === 'active' ? approvedEmail(target) : rejectedEmail(target);
    emailSent = (await sendEmail({ to: target.email, ...template })).sent;
  }

  return json(200, { status, emailSent });
};
