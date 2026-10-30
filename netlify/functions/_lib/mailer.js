/**
 * Transactional email via the Resend HTTP API.
 *
 * Env: RESEND_API_KEY, EMAIL_FROM (e.g. "Zeta Beta Mu <noreply@zetabetamu.com>"),
 * SITE_URL (optional; falls back to Netlify's URL). The key stays server-side.
 */

function env(name) {
  return String(process.env[name] || '').trim();
}

function isConfigured() {
  return !!(env('RESEND_API_KEY') && env('EMAIL_FROM'));
}

function siteUrl() {
  return (env('SITE_URL') || env('URL') || '').replace(/\/+$/, '');
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#1f3d2b;color:#ffffff;padding:20px 28px;font-size:20px;font-weight:bold;">Zeta Beta Mu</td></tr>
<tr><td style="padding:28px;color:#222222;font-size:15px;line-height:1.6;">
<h2 style="margin:0 0 16px;font-size:20px;">${esc(title)}</h2>${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

/** @returns {{ sent: boolean, skipped?: boolean, error?: string }} */
async function sendEmail({ to, subject, html, text }) {
  if (!isConfigured()) return { sent: false, skipped: true, error: 'Email is not configured' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env('EMAIL_FROM'), to: [to], subject, html, text }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Resend error', response.status, detail.slice(0, 300));
      return { sent: false, error: `Email provider returned ${response.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('Resend request failed', e && e.message);
    return { sent: false, error: 'Email request failed' };
  }
}

function approvedEmail(member) {
  const name = member.first_name || member.name || 'Brother';
  const loginUrl = siteUrl() ? `${siteUrl()}/login.html` : '';
  const link = loginUrl ? `<p><a href="${esc(loginUrl)}" style="display:inline-block;background:#1f3d2b;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;">Sign in to the portal</a></p>` : '';
  return {
    subject: 'Your Zeta Beta Mu portal account is approved',
    html: layout('Welcome to the portal', `<p>Hi ${esc(name)},</p><p>Your account has been approved. You can now sign in with your username and password.</p>${link}`),
    text: `Hi ${name},\n\nYour Zeta Beta Mu portal account has been approved. You can now sign in${loginUrl ? `: ${loginUrl}` : '.'}`,
  };
}

function rejectedEmail(member) {
  const name = member.first_name || member.name || 'there';
  return {
    subject: 'Update on your Zeta Beta Mu portal application',
    html: layout('Application update', `<p>Hi ${esc(name)},</p><p>We were unable to approve your portal application at this time. If you believe this is a mistake, please contact a chapter officer.</p>`),
    text: `Hi ${name},\n\nWe were unable to approve your Zeta Beta Mu portal application at this time. If you believe this is a mistake, please contact a chapter officer.`,
  };
}

function newApplicantEmail(applicant) {
  const name = [applicant.first_name, applicant.last_name].filter(Boolean).join(' ') || applicant.username || 'A new applicant';
  const adminUrl = siteUrl() ? `${siteUrl()}/admin.html` : '';
  const rows = [
    ['Name', name],
    ['Email', applicant.email],
    ['Graduation year', applicant.graduation_year],
    ['Hospital', applicant.hospital],
    ['Field', applicant.field_of_medicine],
  ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
  const link = adminUrl ? `<p><a href="${esc(adminUrl)}" style="display:inline-block;background:#1f3d2b;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;">Review in admin dashboard</a></p>` : '';
  return {
    subject: `New membership application: ${name}`,
    html: layout('New application awaiting review', `<p>${esc(name)} confirmed their email and is waiting for approval.</p><table>${rows}</table>${link}`),
    text: `${name} (${applicant.email}) confirmed their email and is waiting for approval.${adminUrl ? `

Review: ${adminUrl}` : ''}`,
  };
}

module.exports = { sendEmail, isConfigured, approvedEmail, rejectedEmail, newApplicantEmail };
