const ProfileModule = {
  profile: null,
  selectedPhoto: null,
  previewUrl: null,
  fields: [
    'firstName', 'middleName', 'lastName', 'nickname', 'birthday', 'batch',
    'graduationYear', 'hospital', 'field', 'specialization', 'medicalLicense',
    'bio', 'mobile', 'phone', 'telephone', 'homePhone', 'facebook', 'instagram', 'address'
  ],

  async init() {
    this.setupForm();
    this.setupProfileMenu();
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
    const response = await fetch('/api/profile', {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) this.expireSession();
    if (!response.ok) throw new Error(payload.error || 'Could not load your profile');
    return payload.profile;
  },

  expireSession() {
    localStorage.removeItem('zbm-session');
    localStorage.removeItem('zbm-remember');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
  },

  async load() {
    try {
      this.profile = await this.request('GET');
      this.syncSession(this.profile);
      this.render(this.profile);
      document.getElementById('profile-loading').classList.add('hidden');
      document.getElementById('profile-form').classList.remove('hidden');
    } catch (error) {
      document.getElementById('profile-loading').classList.add('hidden');
      const errorEl = document.getElementById('profile-error');
      errorEl.textContent = error.message;
      errorEl.classList.remove('hidden');
    }
  },

  render(profile) {
    this.fields.forEach((key) => {
      const input = document.getElementById(`profile-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
      if (input) input.value = profile[key] || '';
    });
    document.getElementById('profile-username').value = profile.username || '';
    document.getElementById('profile-email').value = profile.email || '';
    document.getElementById('profile-name-heading').textContent = profile.name || 'Member';
    document.getElementById('profile-professional-line').textContent = [profile.field, profile.hospital, profile.graduationYear ? `Class of ${profile.graduationYear}` : ''].filter(Boolean).join(' · ');
    document.getElementById('profile-role-badge').textContent = profile.role === 'admin' ? 'Administrator' : profile.role === 'officer' ? 'Officer' : 'Member';
    document.getElementById('profile-status-badge').textContent = profile.status || 'Active';
    const avatar = profile.avatarUrl || 'image/placeholders/avatars/a11.jpg';
    document.getElementById('profile-avatar-preview').src = avatar;
    this.updateBioCount();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  setupForm() {
    const form = document.getElementById('profile-form');
    const photoInput = document.getElementById('profile-photo');
    document.getElementById('profile-birthday').max = new Date().toISOString().slice(0, 10);
    document.getElementById('profile-bio').addEventListener('input', () => this.updateBioCount());
    photoInput.addEventListener('change', () => this.selectPhoto(photoInput.files[0]));
    document.getElementById('profile-reset').addEventListener('click', () => this.reset());
    form.addEventListener('submit', (event) => this.save(event));
  },

  selectPhoto(file) {
    if (!file) return;
    const invalid = MediaUpload.validate(file);
    if (invalid) {
      this.showMessage(invalid, true);
      document.getElementById('profile-photo').value = '';
      return;
    }
    this.selectedPhoto = file;
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
    document.getElementById('profile-avatar-preview').src = this.previewUrl;
    this.showMessage('Photo selected. It will be compressed and uploaded when you save.');
  },

  payload() {
    return this.fields.reduce((values, key) => {
      const id = `profile-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      values[key] = document.getElementById(id).value.trim();
      return values;
    }, {});
  },

  async save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const saveButton = document.getElementById('profile-save');
    const saveLabel = saveButton.querySelector('span');
    let uploadedKey = null;
    saveButton.disabled = true;
    saveLabel.textContent = this.selectedPhoto ? 'Preparing photo…' : 'Saving…';
    this.showMessage('');

    try {
      const body = this.payload();
      if (this.selectedPhoto) {
        const result = await MediaUpload.upload(this.selectedPhoto, 'profile', {
          withThumbnail: false,
          onProgress: (stage) => {
            saveLabel.textContent = stage === 'compressing' ? 'Optimizing photo…' : stage === 'uploading' ? 'Uploading photo…' : 'Saving…';
          },
        });
        body.avatarUrl = result.full.publicUrl;
        body.avatarKey = result.full.fileKey;
        uploadedKey = result.full.fileKey;
      }
      const updated = await this.request('PATCH', body);
      this.profile = updated;
      this.syncSession(updated);
      this.clearSelectedPhoto();
      this.render(updated);
      this.showMessage('Your profile has been updated.');
    } catch (error) {
      if (uploadedKey) {
        try { await MediaUpload.deleteKeys([uploadedKey]); } catch (cleanupError) {}
      }
      this.showMessage(error.message, true);
    } finally {
      saveButton.disabled = false;
      saveLabel.textContent = 'Save profile';
    }
  },

  syncSession(profile) {
    let session = {};
    try { session = JSON.parse(localStorage.getItem('zbm-session') || '{}'); } catch (e) { session = {}; }
    const updated = {
      ...session,
      id: profile.id,
      username: profile.username,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      avatar: profile.avatarUrl,
      graduationYear: profile.graduationYear,
      hospital: profile.hospital,
      field: profile.field,
    };
    localStorage.setItem('zbm-session', JSON.stringify(updated));
    AuthHelper.updateUI();
  },

  reset() {
    if (!this.profile) return;
    this.clearSelectedPhoto();
    this.render(this.profile);
    this.showMessage('Changes discarded.');
  },

  clearSelectedPhoto() {
    this.selectedPhoto = null;
    document.getElementById('profile-photo').value = '';
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
  },

  updateBioCount() {
    document.getElementById('profile-bio-count').textContent = document.getElementById('profile-bio').value.length;
  },

  showMessage(message, isError = false) {
    const element = document.getElementById('profile-message');
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('profile-state-error', isError);
    element.classList.toggle('profile-state-success', !!message && !isError);
  },

  setupProfileMenu() {
    const card = document.getElementById('user-card');
    const dropdown = document.getElementById('profile-dropdown');
    const logout = document.getElementById('profile-logout');
    const toggle = () => {
      const open = dropdown.classList.toggle('open');
      dropdown.setAttribute('aria-hidden', String(!open));
      card.setAttribute('aria-expanded', String(open));
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
    document.addEventListener('click', (event) => {
      if (!card.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('open');
        dropdown.setAttribute('aria-hidden', 'true');
        card.setAttribute('aria-expanded', 'false');
      }
    });
    logout.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out?')) AuthHelper.logout();
    });
  },
};

document.addEventListener('DOMContentLoaded', () => ProfileModule.init());
window.ProfileModule = ProfileModule;
