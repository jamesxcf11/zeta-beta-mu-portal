/**
 * Zeta Beta Mu Fraternity Portal
 * Settings Module
 *
 * Backs settings.html. Notification and privacy preferences persist to
 * Supabase via the /api/settings Netlify function (members.preferences +
 * birthday_calendar). Appearance is device-local via ThemeManager, and the
 * password form talks to Supabase Auth directly.
 */
const SettingsModule = {
  settings: null,
  serverAvailable: true,

  async init() {
    this.setupTheme();
    this.setupPrefsForm();
    this.setupPasswordForm();
    this.setupSession();
    await this.load();
  },

  async accessToken() {
    if (typeof db === 'undefined' || !db || !db.auth) return null;
    const { data } = await db.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  },

  async request(method, body) {
    const token = await this.accessToken();
    if (!token) {
      this.expireSession();
      throw new Error('Your session has expired. Please sign in again.');
    }
    const response = await fetch('/api/settings', {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) this.expireSession();
    if (!response.ok) throw new Error(payload.error || 'Could not load your settings');
    return payload.settings;
  },

  expireSession() {
    localStorage.removeItem('zbm-session');
    localStorage.removeItem('zbm-remember');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
  },

  async load() {
    try {
      this.settings = await this.request('GET');
      this.render(this.settings);
    } catch (error) {
      this.serverAvailable = false;
      const errorEl = document.getElementById('settings-error');
      errorEl.textContent = error.message + ' — notification and privacy settings are unavailable.';
      errorEl.classList.remove('hidden');
      this.setPrefsDisabled(true);
    } finally {
      document.getElementById('settings-loading').classList.add('hidden');
      document.getElementById('settings-content').classList.remove('hidden');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  },

  render(settings) {
    document.getElementById('pref-reactions').checked = settings.notifications.reactions;
    document.getElementById('pref-comments').checked = settings.notifications.comments;
    document.getElementById('pref-announcements').checked = settings.notifications.announcements;
    document.getElementById('pref-show-on-calendar').checked = settings.privacy.showOnCalendar;
    document.getElementById('pref-show-age').checked = settings.privacy.showAge;

    const calendarToggle = document.getElementById('pref-show-on-calendar');
    const hint = document.getElementById('settings-birthday-hint');
    if (!settings.privacy.hasBirthday) {
      calendarToggle.checked = false;
      calendarToggle.disabled = true;
      hint.classList.remove('hidden');
    } else {
      calendarToggle.disabled = false;
      hint.classList.add('hidden');
    }
  },

  // ---------- Appearance (device-local) ----------

  setupTheme() {
    const current = (typeof ThemeManager !== 'undefined' && ThemeManager.getPreference)
      ? ThemeManager.getPreference()
      : (localStorage.getItem('zbm-theme-preference') || 'system');
    const radio = document.querySelector(`input[name="theme-preference"][value="${current}"]`);
    if (radio) radio.checked = true;

    document.querySelectorAll('input[name="theme-preference"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        if (typeof ThemeManager !== 'undefined' && ThemeManager.setPreference) {
          ThemeManager.setPreference(input.value);
        } else {
          if (input.value === 'system') localStorage.removeItem('zbm-theme-preference');
          else localStorage.setItem('zbm-theme-preference', input.value);
        }
        this.showMessage(`Theme set to ${input.value === 'system' ? 'match your device' : input.value}.`);
      });
    });
  },

  // ---------- Notifications + Privacy (server-backed) ----------

  setupPrefsForm() {
    document.getElementById('settings-prefs-form').addEventListener('submit', (event) => this.savePrefs(event));
  },

  prefsPayload() {
    return {
      notifications: {
        reactions: document.getElementById('pref-reactions').checked,
        comments: document.getElementById('pref-comments').checked,
        announcements: document.getElementById('pref-announcements').checked,
      },
      privacy: {
        showOnCalendar: document.getElementById('pref-show-on-calendar').checked,
        showAge: document.getElementById('pref-show-age').checked,
      },
    };
  },

  async savePrefs(event) {
    event.preventDefault();
    if (!this.serverAvailable) return;
    const saveButton = document.getElementById('settings-prefs-save');
    const saveLabel = saveButton.querySelector('span');
    saveButton.disabled = true;
    saveLabel.textContent = 'Saving…';
    this.showMessage('');

    try {
      this.settings = await this.request('PATCH', this.prefsPayload());
      this.render(this.settings);
      this.showMessage('Your preferences have been saved.');
    } catch (error) {
      this.showMessage(error.message, true);
    } finally {
      saveButton.disabled = false;
      saveLabel.textContent = 'Save preferences';
    }
  },

  setPrefsDisabled(disabled) {
    ['pref-reactions', 'pref-comments', 'pref-announcements', 'pref-show-on-calendar', 'pref-show-age']
      .forEach((id) => { document.getElementById(id).disabled = disabled; });
    document.getElementById('settings-prefs-save').disabled = disabled;
  },

  // ---------- Security ----------

  hasSupabase() {
    return typeof db !== 'undefined' && db && db.auth &&
           typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');
  },

  setupPasswordForm() {
    const form = document.getElementById('settings-password-form');
    const note = document.getElementById('settings-password-note');
    if (!this.hasSupabase()) {
      note.classList.remove('hidden');
      form.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
      return;
    }
    form.addEventListener('submit', (event) => this.changePassword(event));
  },

  async changePassword(event) {
    event.preventDefault();
    const current = document.getElementById('settings-current-password').value;
    const next = document.getElementById('settings-new-password').value;
    const confirm = document.getElementById('settings-confirm-password').value;
    const saveButton = document.getElementById('settings-password-save');
    const saveLabel = saveButton.querySelector('span');

    if (next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next)) {
      this.showMessage('New password must be at least 8 characters with one uppercase letter, one lowercase letter, and one number.', true);
      return;
    }
    if (next !== confirm) {
      this.showMessage('New passwords do not match.', true);
      return;
    }
    if (next === current) {
      this.showMessage('New password must be different from your current password.', true);
      return;
    }

    const session = (typeof AuthHelper !== 'undefined' && AuthHelper.getCurrentUser()) || {};
    if (!session.email) {
      this.showMessage('Could not determine your account email. Please sign in again.', true);
      return;
    }

    saveButton.disabled = true;
    saveLabel.textContent = 'Updating…';
    this.showMessage('');

    try {
      // Re-authenticate to prove the caller knows the current password.
      const { error: verifyError } = await db.auth.signInWithPassword({
        email: session.email,
        password: current,
      });
      if (verifyError) {
        this.showMessage('Current password is incorrect.', true);
        return;
      }

      const { error: updateError } = await db.auth.updateUser({ password: next });
      if (updateError) {
        this.showMessage(updateError.message || 'Could not update your password.', true);
        return;
      }

      event.target.reset();
      this.showMessage('Your password has been updated.');
    } catch (error) {
      this.showMessage(error.message || 'Could not update your password.', true);
    } finally {
      saveButton.disabled = false;
      saveLabel.textContent = 'Update password';
    }
  },

  // ---------- Session ----------

  setupSession() {
    const info = document.getElementById('settings-session-info');
    const session = (typeof AuthHelper !== 'undefined' && AuthHelper.getCurrentUser()) || null;
    if (session) {
      const parts = [`Signed in as ${session.name || session.email || 'a member'}`];
      if (session.loginTime) {
        const when = new Date(session.loginTime);
        if (!Number.isNaN(when.getTime())) parts.push(`since ${when.toLocaleString()}`);
      }
      info.textContent = parts.join(' ') + '.';
    }

    document.getElementById('settings-signout').addEventListener('click', () => {
      if (confirm('Are you sure you want to log out?') && typeof AuthHelper !== 'undefined') {
        AuthHelper.logout();
      }
    });
  },

  showMessage(message, isError = false) {
    const element = document.getElementById('settings-message');
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('profile-state-error', isError);
    element.classList.toggle('profile-state-success', !!message && !isError);
  },
};

document.addEventListener('DOMContentLoaded', () => SettingsModule.init());
window.SettingsModule = SettingsModule;
