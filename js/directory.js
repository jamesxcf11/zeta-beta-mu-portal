/**
 * Zeta Beta Mu Fraternity Portal
 * Directory Module - Alumni / Medical Directory Search
 *
 * Nothing is loaded or shown until a member searches (Search button or Enter,
 * at least 2 characters). Searches run on the server (/api/directory-search),
 * so the full directory never reaches the browser. Officers/admins also get
 * controls to add, edit, remove and bulk-import alumni (/api/admin-alumni).
 */

const DirectoryModule = {
  MIN_QUERY: 2,

  results: [],
  total: 0,
  nextOffset: null,
  lastQuery: '',
  searched: false,
  loading: false,
  searchToken: 0,
  currentFilter: 'All',

  // Editable alumni fields: [column, label, wide?]
  FORM_FIELDS: [
    ['full_name', 'Full Name *'], ['nickname', 'Nickname'],
    ['batch', 'Batch'], ['semester', 'Semester'],
    ['hospital', 'Hospital'], ['field_of_medicine', 'Field of Medicine'],
    ['specialization', 'Specialization'], ['email', 'Email'],
    ['other_emails', 'Other Emails'], ['mobile', 'Mobile / Contact Number'],
    ['telephone', 'Telephone'], ['birthday', 'Birthday (YYYY-MM-DD)'],
    ['intl_location', 'Location (if abroad)'], ['member_no', 'Roster No.'],
    ['awards', 'Awards'], ['facebook', 'Facebook'], ['instagram', 'Instagram'],
    ['address', 'Address', true], ['schedule', 'Clinic Schedule', true]
  ],

  // Form column -> property on a search result
  FIELD_PROP: {
    full_name: 'name', field_of_medicine: 'field', other_emails: 'otherEmails',
    member_no: 'memberNo', intl_location: 'location'
  },

  // CSV header keywords -> alumni column (first unused matching header wins)
  CSV_COLUMNS: [
    ['full_name', ['full name', 'name']],
    ['last_name', ['last name', 'last_name', 'surname']],
    ['first_name', ['first name', 'first_name']],
    ['middle_name', ['middle name', 'middle_name']],
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
    ['instagram', ['instagram']],
    ['semester', ['semester']],
    ['member_no', ['member_no', 'member no', 'member #', 'roster no']],
    ['awards', ['award']],
    ['is_deceased', ['deceased']],
    ['is_retired', ['retired']],
    ['birthday', ['birthday', 'birthdate', 'birth']],
    ['other_emails', ['other_email', 'other email', 'alt email']],
    ['intl_location', ['intl_location', 'location', 'intl']],
    ['schedule', ['schedule']]
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

  init() {
    this.setupEventListeners();
    this.render();
  },

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  async search(query, { append = false } = {}) {
    const q = String(query || '').trim();
    if (q.length < this.MIN_QUERY) {
      this.searched = false;
      this.results = [];
      this.total = 0;
      this.nextOffset = null;
      this.render(`Type at least ${this.MIN_QUERY} characters, then press Search.`);
      return;
    }

    const token = ++this.searchToken;
    this.loading = true;
    this.lastQuery = q;
    if (!append) { this.results = []; this.nextOffset = null; }
    this.render();

    const payload = await this.callApi({
      q,
      specialty: this.currentFilter === 'All' ? undefined : this.currentFilter,
      offset: append ? (this.nextOffset || 0) : 0
    }, '/api/directory-search');
    if (token !== this.searchToken) return;

    this.loading = false;
    this.searched = true;
    if (payload.error) {
      this.render(payload.error);
      return;
    }
    this.results = append ? this.results.concat(payload.results || []) : (payload.results || []);
    this.total = payload.total || 0;
    this.nextOffset = payload.nextOffset;
    this.render();
  },

  rerun() {
    return this.searched ? this.search(this.lastQuery) : Promise.resolve();
  },

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  render(message) {
    const grid = document.getElementById('directory-grid');
    if (!grid) return;

    if (message) {
      grid.innerHTML = this.getEmptyStateHTML('alert-circle', 'Search the directory', message);
    } else if (this.loading && !this.results.length) {
      grid.innerHTML = this.getEmptyStateHTML('loader', 'Searching\u2026', 'Looking through the directory.');
    } else if (!this.searched) {
      grid.innerHTML = this.getEmptyStateHTML('search', 'Search the directory',
        'Enter a name, nickname, batch, hospital or specialty and press Search. Results appear only after you search.');
    } else if (!this.results.length) {
      grid.innerHTML = this.getEmptyStateHTML('search-x', 'No members found', 'Try a different spelling, or fewer words.');
    } else {
      grid.innerHTML = this.results.map(member => this.createMemberCardHTML(member)).join('');
    }

    const countEl = document.getElementById('directory-count-text');
    if (countEl) {
      const text = this.searched && !message
        ? `${this.total} ${this.total === 1 ? 'result' : 'results'} for \u201c${this.lastQuery}\u201d`
        : 'Search to see members';
      countEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline-block mr-1 align-middle"></i> ';
      countEl.append(document.createTextNode(text));
    }

    const more = document.getElementById('directory-more');
    if (more) {
      const hasMore = this.nextOffset !== null && this.nextOffset !== undefined && !message;
      more.style.display = hasMore ? '' : 'none';
      more.disabled = this.loading;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
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

  hospitalSummary(hospital) {
    const parts = String(hospital || '').split(';').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return '';
    return parts.length > 1 ? `${parts[0]} +${parts.length - 1} more` : parts[0];
  },

  createMemberCardHTML(member) {
    const e = this.escapeHTML.bind(this);
    const hospital = this.hospitalSummary(member.hospital);
    const field = member.field || '';
    return `
      <article class="glass-card member-card" data-member-id="${e(member.id)}">
        <img src="${e(this.avatarFor(member))}" alt="${e(member.name)}" class="member-avatar" loading="lazy">
        <h3 class="member-name">${e(member.name)}</h3>
        ${member.nickname ? `<p class="member-year">&ldquo;${e(member.nickname)}&rdquo;</p>` : ''}
        ${member.batch ? `
        <p class="member-year flex items-center justify-center gap-1">
          <i data-lucide="graduation-cap" class="w-3 h-3"></i>
          ${e(member.batch)}
        </p>` : ''}
        ${hospital ? `
        <p class="member-hospital flex items-center justify-center gap-1">
          <i data-lucide="building-2" class="w-3 h-3"></i>
          ${e(hospital)}
        </p>` : ''}
        ${field ? `<span class="member-field">${e(field)}</span>` : ''}
        ${member.deceased ? '<span class="member-field">In Memoriam</span>' : ''}
        ${this.isOfficer() ? `
        <div class="mt-3">
          <button type="button" class="btn btn-glass btn-sm" data-action="edit-alumnus" data-id="${e(member.id)}">
            <i data-lucide="pencil" class="w-4 h-4"></i> Edit
          </button>
        </div>` : ''}
      </article>
    `;
  },

  getEmptyStateHTML(icon, title, text) {
    const e = this.escapeHTML.bind(this);
    return `
      <div class="empty-state col-span-full">
        <div class="empty-icon">
          <i data-lucide="${e(icon)}" class="w-10 h-10"></i>
        </div>
        <h3 class="empty-title">${e(title)}</h3>
        <p class="empty-text">${e(text)}</p>
      </div>
    `;
  },

  setupEventListeners() {
    if (this.listenersBound) return;
    this.listenersBound = true;

    const form = document.getElementById('directory-search-form');
    const input = document.getElementById('directory-search');
    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.search(input.value);
      });
    }

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.textContent.trim();
        this.rerun();
      });
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('#directory-more')) {
        if (!this.loading && this.nextOffset !== null) this.search(this.lastQuery, { append: true });
        return;
      }
      const edit = e.target.closest('[data-action="edit-alumnus"]');
      if (edit) {
        const alumnus = this.results.find(m => String(m.id) === edit.dataset.id);
        if (alumnus) this.openForm(alumnus);
        return;
      }
      const card = e.target.closest('.member-card');
      if (card) this.showMemberDetails(card.dataset.memberId);
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

  showMemberDetails(memberId) {
    const member = this.results.find(m => String(m.id) === String(memberId));
    if (!member) return;

    const e = this.escapeHTML.bind(this);
    const status = member.deceased ? 'Deceased' : (member.retired ? 'Retired' : '');
    const rows = [
      ['Nickname', member.nickname], ['Batch', member.batch], ['Semester', member.semester],
      ['Roster No.', member.memberNo], ['Awards', member.awards], ['Status', status],
      ['Hospital', member.hospital], ['Field', member.field], ['Specialization', member.specialization],
      ['Clinic Schedule', member.schedule], ['Location', member.location], ['Birthday', member.birthday],
      ['Email', member.email], ['Other Emails', member.otherEmails], ['Mobile', member.mobile],
      ['Telephone', member.telephone], ['Address', member.address],
      ['Facebook', member.facebook], ['Instagram', member.instagram]
    ].filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');

    const officerActions = this.isOfficer() ? `
      <div class="vault-modal-actions">
        <button type="button" class="btn btn-glass" data-action="delete-alumnus">Remove</button>
        <button type="button" class="btn btn-gold" data-action="edit-from-detail">Edit</button>
      </div>` : '';

    const modal = this.openModal(`
      <div class="text-center mb-4">
        <img src="${e(this.avatarFor(member))}" alt="" class="member-avatar" style="margin:0 auto 0.75rem">
        <h3 class="vault-modal-title" style="justify-content:center">${e(member.name)}</h3>
      </div>
      <dl class="pending-details-grid" id="alumni-detail">
        ${rows.map(([k, v]) => `<div><span class="pending-detail-label">${e(k)}</span><span class="pending-detail-value" style="white-space:pre-line">${e(v)}</span></div>`).join('')}
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
      const v = alumnus[this.FIELD_PROP[col] || col];
      return v === null || v === undefined ? '' : v;
    };
    const fields = this.FORM_FIELDS.map(([col, label, wide]) => `
      <div${wide ? ' style="grid-column:1/-1"' : ''}>
        <label class="form-label" for="al-${col}">${e(label)}</label>
        ${wide
          ? `<textarea id="al-${col}" name="${col}" class="glass-input w-full" rows="2">${e(value(col))}</textarea>`
          : `<input id="al-${col}" name="${col}" class="glass-input w-full" ${col === 'email' ? 'type="email"' : ''} value="${e(value(col))}">`}
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
    await this.rerun();
    this.notify(alumnus ? 'Alumnus updated' : 'Alumnus added');
  },

  async deleteAlumnus(member) {
    if (!confirm(`Remove ${member.name} from the directory?`)) return;
    const result = await this.callApi({ action: 'delete', id: member.id });
    if (result.error) { this.notify(result.error); return; }
    this.closeModal();
    await this.rerun();
    this.notify('Alumnus removed');
  },

  async refresh() {
    await this.rerun();
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
    const counts = result.created !== undefined ? `${result.created} added, ${result.updated} updated` : `${result.imported} imported`;
    this.notify(`Import complete: ${counts}${skipped}`);
  },

  // ==========================================================================
  // API
  // ==========================================================================

  async callApi(body, endpoint = '/api/admin-alumni') {
    try {
      const { data } = await db.auth.getSession();
      const token = data && data.session ? data.session.access_token : null;
      if (!token) return { error: 'Your session has expired. Please sign in again.' };
      const response = await fetch(endpoint, {
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
