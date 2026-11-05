/**
 * Zeta Beta Mu Fraternity Portal
 * Directory Module - Alumni / Medical Directory Search
 *
 * Reads the `alumni` roster (falls back to portal `members`, then mock data),
 * supports searching every listed field, and gives admins/officers controls
 * to add, edit, remove and bulk-import alumni through /api/admin-alumni.
 */

const DirectoryModule = {
  // Mock member database (fallback when Supabase is not configured)
  mockMembers: [
    { id: 1, name: 'Dr. James Anderson', year: 1995, hospital: 'St. Luke\'s Medical Center', field: 'Cardiology', avatar: 'image/placeholders/avatars/a11.jpg' },
    { id: 2, name: 'Dr. Sarah Mitchell', year: 2008, hospital: 'Mount Sinai Hospital', field: 'Neurology', avatar: 'image/placeholders/avatars/a5.jpg' },
    { id: 3, name: 'Dr. Michael Chen', year: 2012, hospital: 'Johns Hopkins Medicine', field: 'Oncology', avatar: 'image/placeholders/avatars/a3.jpg' },
    { id: 4, name: 'Dr. Emily Roberts', year: 2015, hospital: 'Children\'s Hospital', field: 'Pediatrics', avatar: 'image/placeholders/avatars/a9.jpg' },
    { id: 5, name: 'Dr. Robert Kim', year: 2002, hospital: 'Mayo Clinic', field: 'Surgery', avatar: 'image/placeholders/avatars/a8.jpg' },
    { id: 6, name: 'Dr. Lisa Wang', year: 2010, hospital: 'Cleveland Clinic', field: 'Cardiology', avatar: 'image/placeholders/avatars/a10.jpg' },
    { id: 7, name: 'Dr. David Martinez', year: 2018, hospital: 'UCLA Medical Center', field: 'Orthopedics', avatar: 'image/placeholders/avatars/a12.jpg' },
    { id: 8, name: 'Dr. Jennifer Adams', year: 2005, hospital: 'NYU Langone Health', field: 'Dermatology', avatar: 'image/placeholders/avatars/a6.jpg' },
    { id: 9, name: 'Dr. William Turner', year: 1998, hospital: 'Stanford Health Care', field: 'Psychiatry', avatar: 'image/placeholders/avatars/a13.jpg' },
    { id: 10, name: 'Dr. Amanda Foster', year: 2011, hospital: 'Mass General Brigham', field: 'Internal Medicine', avatar: 'image/placeholders/avatars/a7.jpg' },
    { id: 11, name: 'Dr. Christopher Lee', year: 2007, hospital: 'Cedars-Sinai', field: 'Emergency Medicine', avatar: 'image/placeholders/avatars/a14.jpg' },
    { id: 12, name: 'Dr. Michelle Park', year: 2014, hospital: 'UCSF Medical Center', field: 'Radiology', avatar: 'image/placeholders/avatars/a15.jpg' }
  ],

  // Active directory data (alumni rows, or members/mock as a fallback)
  members: [],
  source: 'mock',

  currentFilter: 'All',
  searchQuery: '',

  ALUMNI_COLUMNS: 'id, full_name, nickname, batch, graduation_year, hospital, field_of_medicine, specialization, email, mobile, telephone, address, facebook, instagram, avatar_url',

  // Editable alumni fields: [column, label, wide?]
  FORM_FIELDS: [
    ['full_name', 'Full Name *'], ['nickname', 'Nickname'],
    ['batch', 'Batch'], ['graduation_year', 'Graduation Year'],
    ['hospital', 'Hospital'], ['field_of_medicine', 'Field of Medicine'],
    ['specialization', 'Specialization'], ['email', 'Email'],
    ['mobile', 'Mobile / Contact Number'], ['telephone', 'Telephone'],
    ['facebook', 'Facebook'], ['instagram', 'Instagram'],
    ['address', 'Address', true]
  ],

  // CSV header keywords -> alumni column (first unused matching header wins)
  CSV_COLUMNS: [
    ['full_name', ['full name', 'name']],
    ['nickname', ['nickname', 'nick']],
    ['graduation_year', ['graduation', 'year', 'class of']],
    ['batch', ['batch']],
    ['hospital', ['hospital', 'institution', 'affiliation']],
    ['field_of_medicine', ['field', 'medicine']],
    ['specialization', ['special']],
    ['email', ['email', 'e-mail']],
    ['telephone', ['telephone', 'landline', 'tel']],
    ['mobile', ['mobile', 'contact', 'cell', 'phone']],
    ['address', ['address']],
    ['facebook', ['facebook']],
    ['instagram', ['instagram']]
  ],

  hasSupabase() {
    return typeof db !== 'undefined' && db &&
           typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem('zbm-session') || 'null');
    } catch (e) {
      return null;
    }
  },

  /** UI-only check; the API enforces officer access server-side. */
  isOfficer() {
    const s = this.getSession();
    return !!s && (s.role === 'admin' || s.role === 'officer');
  },

  async init() {
    await this.loadMembers();
    this.renderMembers();
    this.setupEventListeners();
  },

  async loadAlumni() {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('alumni')
        .select(this.ALUMNI_COLUMNS)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + 999);
      if (error) return null;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return rows.map(a => ({
      id: a.id,
      source: 'alumni',
      name: a.full_name,
      nickname: a.nickname,
      batch: a.batch,
      year: a.graduation_year,
      hospital: a.hospital,
      field: a.field_of_medicine || a.specialization,
      fieldOfMedicine: a.field_of_medicine,
      specialization: a.specialization,
      email: a.email,
      mobile: a.mobile,
      telephone: a.telephone,
      address: a.address,
      facebook: a.facebook,
      instagram: a.instagram,
      avatar: a.avatar_url
    }));
  },

  async loadMembers() {
    if (this.hasSupabase()) {
      const alumni = await this.loadAlumni();
      if (alumni && alumni.length) {
        this.members = alumni;
        this.source = 'alumni';
        return;
      }

      const { data, error } = await db
        .from('members')
        .select('id, name, graduation_year, hospital, field_of_medicine, avatar_url')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (!error && data) {
        this.members = data.map(m => ({
          id: m.id,
          source: 'members',
          name: m.name,
          year: m.graduation_year,
          hospital: m.hospital,
          field: m.field_of_medicine,
          avatar: m.avatar_url
        }));
        this.source = 'members';
        return;
      }
    }
    this.members = this.mockMembers.map(m => ({ ...m, source: 'mock' }));
    this.source = 'mock';
  },

  renderMembers() {
    const grid = document.getElementById('directory-grid');
    if (!grid) return;

    const filtered = this.getFilteredMembers();
    if (filtered.length === 0) {
      grid.innerHTML = this.getEmptyStateHTML();
      return;
    }
    grid.innerHTML = filtered.map(member => this.createMemberCardHTML(member)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  searchText(m) {
    return [m.name, m.nickname, m.batch, m.year, m.hospital, m.field, m.specialization,
      m.fieldOfMedicine, m.email, m.mobile, m.telephone].filter(v => v !== null && v !== undefined).join(' ').toLowerCase();
  },

  getFilteredMembers() {
    const query = this.searchQuery.trim().toLowerCase();
    const terms = query ? query.split(/\s+/) : [];
    return this.members.filter(member => {
      const matchesFilter = this.currentFilter === 'All' ||
        [member.field, member.fieldOfMedicine, member.specialization].some(f => f === this.currentFilter);
      if (!matchesFilter) return false;
      if (!terms.length) return true;
      const text = this.searchText(member);
      return terms.every(t => text.includes(t));
    });
  },

  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  initials(name) {
    const words = String(name || '').replace(/^dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
    return ((words[0] || '?')[0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  },

  avatarFor(member) {
    if (member.avatar) return member.avatar;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#064e3b"/><text x="48" y="58" font-family="Georgia,serif" font-size="34" fill="#d4af37" text-anchor="middle">${this.escapeHTML(this.initials(member.name))}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  },

  createMemberCardHTML(member) {
    const e = this.escapeHTML.bind(this);
    const standing = member.year ? `Class of ${member.year}` : (member.batch ? `Batch ${member.batch}` : '');
    return `
      <article class="glass-card member-card" data-member-id="${e(member.id)}" data-source="${e(member.source)}">
        <img src="${e(this.avatarFor(member))}" alt="${e(member.name)}" class="member-avatar">
        <h3 class="member-name">${e(member.name)}</h3>
        ${member.nickname ? `<p class="member-year">&ldquo;${e(member.nickname)}&rdquo;</p>` : ''}
        ${standing ? `
        <p class="member-year flex items-center justify-center gap-1">
          <i data-lucide="graduation-cap" class="w-3 h-3"></i>
          ${e(standing)}
        </p>` : ''}
        ${member.hospital ? `
        <p class="member-hospital flex items-center justify-center gap-1">
          <i data-lucide="building-2" class="w-3 h-3"></i>
          ${e(member.hospital)}
        </p>` : ''}
        ${member.field ? `<span class="member-field">${e(member.field)}</span>` : ''}
        ${member.source === 'alumni' && this.isOfficer() ? `
        <div class="mt-3">
          <button type="button" class="btn btn-glass btn-sm" data-action="edit-alumnus" data-id="${e(member.id)}">
            <i data-lucide="pencil" class="w-4 h-4"></i> Edit
          </button>
        </div>` : ''}
      </article>
    `;
  },

  getEmptyStateHTML() {
    return `
      <div class="empty-state col-span-full">
        <div class="empty-icon">
          <i data-lucide="search-x" class="w-10 h-10"></i>
        </div>
        <h3 class="empty-title">No members found</h3>
        <p class="empty-text">Try adjusting your search or filter criteria to find members.</p>
      </div>
    `;
  },

  setupEventListeners() {
    if (this.listenersBound) return;
    this.listenersBound = true;

    const searchInput = document.getElementById('directory-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderMembers();
      });
    }

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.textContent.trim();
        this.renderMembers();
      });
    });

    document.addEventListener('click', (e) => {
      const edit = e.target.closest('[data-action="edit-alumnus"]');
      if (edit) {
        const alumnus = this.members.find(m => m.source === 'alumni' && String(m.id) === edit.dataset.id);
        if (alumnus) this.openForm(alumnus);
        return;
      }
      const card = e.target.closest('.member-card');
      if (card) this.showMemberDetails(card.dataset.memberId, card.dataset.source);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  // ==========================================================================
  // MODALS
  // ==========================================================================

  openModal(innerHtml) {
    this.closeModal();
    const modal = document.createElement('div');
    modal.id = 'alumni-modal';
    modal.className = 'vault-modal';
    modal.innerHTML = `
      <div class="vault-modal-backdrop" data-modal-close></div>
      <div class="vault-modal-card glass-heavy" role="dialog" aria-modal="true">
        <button type="button" class="vault-modal-close" data-modal-close aria-label="Close"><i data-lucide="x" class="w-5 h-5"></i></button>
        ${innerHtml}
      </div>`;
    modal.addEventListener('click', (e) => { if (e.target.closest('[data-modal-close]')) this.closeModal(); });
    document.body.appendChild(modal);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return modal;
  },

  closeModal() {
    document.getElementById('alumni-modal')?.remove();
  },

  async showMemberDetails(memberId, source) {
    const member = this.members.find(m => String(m.id) === String(memberId) && (!source || m.source === source));
    if (!member) return;

    let profile = { ...member };

    if (member.source === 'members' && this.hasSupabase()) {
      const { data } = await db.from('members').select('*').eq('id', memberId).single();
      if (data) {
        profile = {
          ...profile,
          email: data.email,
          mobile: data.phone || data.mobile,
          bio: data.bio
        };
      }
    }

    const e = this.escapeHTML.bind(this);
    const rows = [
      ['Nickname', profile.nickname], ['Batch', profile.batch], ['Class of', profile.year],
      ['Hospital', profile.hospital], ['Field', profile.fieldOfMedicine || profile.field],
      ['Specialization', profile.specialization], ['Email', profile.email],
      ['Mobile', profile.mobile], ['Telephone', profile.telephone], ['Address', profile.address],
      ['Facebook', profile.facebook], ['Instagram', profile.instagram]
    ].filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');

    const officerActions = member.source === 'alumni' && this.isOfficer() ? `
      <div class="vault-modal-actions">
        <button type="button" class="btn btn-glass" data-action="delete-alumnus">Remove</button>
        <button type="button" class="btn btn-gold" data-action="edit-from-detail">Edit</button>
      </div>` : '';

    const modal = this.openModal(`
      <div class="text-center mb-4">
        <img src="${e(this.avatarFor(profile))}" alt="" class="member-avatar" style="margin:0 auto 0.75rem">
        <h3 class="vault-modal-title" style="justify-content:center">${e(profile.name)}</h3>
      </div>
      <dl class="pending-details-grid" id="alumni-detail">
        ${rows.map(([k, v]) => `<div><span class="pending-detail-label">${e(k)}</span><span class="pending-detail-value">${e(v)}</span></div>`).join('')}
        ${profile.bio ? `<div style="grid-column:1/-1"><span class="pending-detail-label">About</span><span class="pending-detail-value">${e(profile.bio)}</span></div>` : ''}
      </dl>
      ${rows.length ? '' : '<p class="landing-muted-text text-center">No further details on file.</p>'}
      ${officerActions}`);

    modal.querySelector('[data-action="edit-from-detail"]')?.addEventListener('click', () => this.openForm(member));
    modal.querySelector('[data-action="delete-alumnus"]')?.addEventListener('click', () => this.deleteAlumnus(member));
  },

  openForm(alumnus) {
    const e = this.escapeHTML.bind(this);
    const value = (col) => {
      if (!alumnus) return '';
      const map = { full_name: alumnus.name, graduation_year: alumnus.year, field_of_medicine: alumnus.fieldOfMedicine };
      return col in map ? map[col] : alumnus[col];
    };
    const fields = this.FORM_FIELDS.map(([col, label, wide]) => `
      <div${wide ? ' style="grid-column:1/-1"' : ''}>
        <label class="form-label" for="al-${col}">${e(label)}</label>
        ${col === 'address'
          ? `<textarea id="al-${col}" name="${col}" class="glass-input w-full" rows="2">${e(value(col))}</textarea>`
          : `<input id="al-${col}" name="${col}" class="glass-input w-full" ${col === 'graduation_year' ? 'type="number" min="1900" max="2100"' : col === 'email' ? 'type="email"' : ''} value="${e(value(col))}">`}
      </div>`).join('');

    const modal = this.openModal(`
      <h3 class="vault-modal-title">${alumnus ? 'Edit Alumnus' : 'Add Alumnus'}</h3>
      <form id="alumni-form" novalidate>
        <div class="form-grid-2">${fields}</div>
        <div class="vault-modal-actions">
          <button type="button" class="btn btn-glass" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-gold">${alumnus ? 'Save Changes' : 'Add Alumnus'}</button>
        </div>
      </form>`);

    modal.querySelector('#alumni-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      this.submitForm(ev.target, alumnus);
    });
  },

  async submitForm(form, alumnus) {
    const record = {};
    this.FORM_FIELDS.forEach(([col]) => { record[col] = (form.elements[col].value || '').trim(); });
    if (!record.full_name) { this.notify('Full name is required'); return; }

    const result = await this.callApi(alumnus
      ? { action: 'update', id: alumnus.id, alumnus: record }
      : { action: 'create', alumnus: record });
    if (result.error) { this.notify(result.error); return; }

    this.closeModal();
    await this.refresh();
    this.notify(alumnus ? 'Alumnus updated' : 'Alumnus added');
  },

  async deleteAlumnus(member) {
    if (!confirm(`Remove ${member.name} from the directory?`)) return;
    const result = await this.callApi({ action: 'delete', id: member.id });
    if (result.error) { this.notify(result.error); return; }
    this.closeModal();
    await this.refresh();
    this.notify('Alumnus removed');
  },

  async refresh() {
    await this.loadMembers();
    this.renderMembers();
  },

  // ==========================================================================
  // CSV IMPORT
  // ==========================================================================

  parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(v => v.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some(v => v.trim() !== '')) rows.push(row);
    return rows;
  },

  /** Map a header row to { alumniColumn: columnIndex }. */
  mapCsvHeader(headerRow) {
    const header = headerRow.map(h => h.trim().toLowerCase());
    const used = new Set();
    const map = {};
    this.CSV_COLUMNS.forEach(([col, keywords]) => {
      let idx = header.findIndex((h, i) => !used.has(i) && keywords.includes(h));
      if (idx === -1) idx = header.findIndex((h, i) => !used.has(i) && keywords.some(k => h.includes(k)));
      if (idx !== -1) { map[col] = idx; used.add(idx); }
    });
    return map;
  },

  csvToAlumni(rows) {
    const map = this.mapCsvHeader(rows[0]);
    if (map.full_name === undefined) return null;
    return rows.slice(1).map(r => {
      const rec = {};
      Object.entries(map).forEach(([col, idx]) => { rec[col] = (r[idx] || '').trim(); });
      if (!rec.graduation_year && /^(19|20)\d{2}$/.test(rec.batch || '')) rec.graduation_year = rec.batch;
      return rec;
    }).filter(r => r.full_name);
  },

  async handleImport() {
    const file = document.getElementById('import-file-input')?.files?.[0];
    if (!file) { this.notify('Please select a file first'); return; }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.notify(`"${file.name}" \u2014 please save the spreadsheet as .csv (Excel: File > Save As > CSV) and try again`);
      return;
    }

    const rows = this.parseCSV(await file.text());
    if (rows.length < 2) { this.notify(`"${file.name}" has no rows to import`); return; }
    const records = this.csvToAlumni(rows);
    if (!records) { this.notify(`"${file.name}" \u2014 couldn't find a name column in the header row`); return; }
    if (!records.length) { this.notify(`"${file.name}" \u2014 no valid rows found`); return; }

    const confirmed = confirm(`Import ${records.length} alumni from "${file.name}"?`);
    if (!confirmed) return;

    const result = await this.callApi({ action: 'import', rows: records });
    if (result.error) { this.notify(result.error); return; }

    if (typeof closeImportModal === 'function') closeImportModal();
    await this.refresh();
    const skipped = result.skipped && result.skipped.length ? ` (${result.skipped.length} skipped)` : '';
    this.notify(`Imported ${result.imported} alumni${skipped}`);
  },

  // ==========================================================================
  // API
  // ==========================================================================

  async callApi(body) {
    try {
      const { data } = await db.auth.getSession();
      const token = data && data.session ? data.session.access_token : null;
      if (!token) return { error: 'Your session has expired. Please sign in again.' };
      const response = await fetch('/api/admin-alumni', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return { error: payload.error || 'Request failed' };
      return payload;
    } catch (err) {
      return { error: 'Request failed' };
    }
  },

  notify(msg) {
    let toast = document.getElementById('directory-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'directory-toast';
      toast.className = 'memorial-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
  }
};

// Re-init on bfcache restore (browser back/forward)
window.addEventListener('zbm-bfcache-restore', () => {
  DirectoryModule.init();
});

// Expose globally
window.DirectoryModule = DirectoryModule;
