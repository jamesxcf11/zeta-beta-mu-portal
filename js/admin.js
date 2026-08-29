/**
 * Zeta Beta Mu Fraternity Portal
 * Admin Module - Dashboard Management
 * 
 * Handles admin dashboard functionality including:
 * - Member management
 * - Post moderation
 * - Content upload
 * - Statistics display
 */

const AdminModule = {
  // Statistics (loaded from Supabase)
  stats: {
    totalMembers: 0,
    pendingVerifications: 0,
    totalPosts: 0,
    upcomingEvents: 0
  },

  // Pending verifications (loaded from Supabase)
  pendingMembers: [],

  // Managed members (loaded from Supabase)
  managedMembers: [],

  // Moderation reports (loaded from Supabase)
  reports: { posts: [], comments: [] },

  // Member table state
  memberSearch: '',
  memberPage: 1,
  memberPageSize: 10,

  /**
   * Check if Supabase is configured
   */
  hasSupabase() {
    return typeof db !== 'undefined' && db &&
           typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');
  },

  /**
   * Get current logged-in member id from session (for FK fields)
   */
  currentMemberId() {
    try {
      const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      return session && session.id ? session.id : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Initialize admin module
   */
  async init() {
    this.checkAdminAccess();
    if (this.hasSupabase()) {
      await this.loadStats();
      await this.loadPendingMembers();
      await this.loadManagedMembers();
      await this.loadReports();
    }
    this.renderStats();
    this.renderPendingMembers();
    this.renderMemberTable();
    this.renderReports();
    this.setupEventListeners();

    // Deep-link support: e.g. admin.html#members opens straight to that tab
    const hashTab = (window.location.hash || '').replace('#', '');
    if (['overview', 'members', 'content', 'moderation'].includes(hashTab)) {
      this.switchTab(hashTab);
    }
  },

  /**
   * Load statistics from Supabase
   */
  async loadStats() {
    const [members, pending, posts, events] = await Promise.all([
      db.from('members').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
      db.from('members').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
      db.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'published').is('deleted_at', null),
      db.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published')
    ]);

    this.stats = {
      totalMembers: members.count || 0,
      pendingVerifications: pending.count || 0,
      totalPosts: posts.count || 0,
      upcomingEvents: events.count || 0
    };
  },

  /**
   * Load pending members from Supabase
   */
  async loadPendingMembers() {
    const { data, error } = await db
      .from('members')
      .select('id, name, email, username, first_name, last_name, middle_name, nickname, birthday, graduation_year, hospital, field_of_medicine, specialization, batch, mobile, telephone, home_phone, facebook, instagram, address, avatar_url, created_at')
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) return;

    this.pendingMembers = data.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      username: m.username,
      firstName: m.first_name,
      lastName: m.last_name,
      middleName: m.middle_name,
      nickname: m.nickname,
      birthday: m.birthday,
      year: m.graduation_year,
      hospital: m.hospital,
      field: m.field_of_medicine,
      specialization: m.specialization,
      batch: m.batch,
      mobile: m.mobile,
      telephone: m.telephone,
      homePhone: m.home_phone,
      facebook: m.facebook,
      instagram: m.instagram,
      address: m.address,
      avatar: m.avatar_url,
      submitted: m.created_at
    }));
  },

  /**
   * Load managed members from Supabase
   */
  async loadManagedMembers() {
    const { data, error } = await db
      .from('members')
      .select('id, name, email, role, status, created_at')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error || !data) return;

    this.managedMembers = data.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      status: m.status,
      joined: m.created_at
    }));
  },

  /**
   * Check if user has admin access.
   * NOTE: this is a client-side UX gate only (defense-in-depth), NOT a
   * security boundary — a user can bypass this by editing localStorage or
   * calling the Supabase REST API directly. The real authorization check
   * MUST live in Supabase Row Level Security policies (see
   * sql/rls-policies-hardened.sql), since the anon/authenticated Postgres
   * role — not this in-memory session object — is what Supabase actually
   * enforces server-side.
   */
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  checkAdminAccess() {
    let session = null;
    try {
      session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
    } catch (e) { /* invalid session */ }

    if (!session) {
      window.location.replace('login.html');
      return;
    }
    if (session.role !== 'admin' && session.role !== 'officer') {
      window.location.replace('home.html');
    }
  },

  /**
   * Render statistics cards
   */
  renderStats() {
    const statsContainer = document.getElementById('admin-stats');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
      <div class="glass-card stat-card">
        <div class="stat-icon members">
          <i data-lucide="users"></i>
        </div>
        <div class="stat-content">
          <h3>${this.stats.totalMembers}</h3>
          <p>Total Members</p>
        </div>
      </div>
      
      <div class="glass-card stat-card">
        <div class="stat-icon pending">
          <i data-lucide="user-plus"></i>
        </div>
        <div class="stat-content">
          <h3>${this.stats.pendingVerifications}</h3>
          <p>Pending Verifications</p>
        </div>
      </div>
      
      <div class="glass-card stat-card">
        <div class="stat-icon posts">
          <i data-lucide="file-text"></i>
        </div>
        <div class="stat-content">
          <h3>${this.stats.totalPosts}</h3>
          <p>Total Posts</p>
        </div>
      </div>
      
      <div class="glass-card stat-card">
        <div class="stat-icon events">
          <i data-lucide="calendar"></i>
        </div>
        <div class="stat-content">
          <h3>${this.stats.upcomingEvents}</h3>
          <p>Upcoming Events</p>
        </div>
      </div>
    `;
  },

  /**
   * Render pending verifications
   */
  renderPendingMembers() {
    const container = document.getElementById('pending-members');
    const badge = document.getElementById('pending-count');
    if (badge) badge.textContent = `${this.pendingMembers.length} pending`;
    if (!container) return;

    if (this.pendingMembers.length === 0) {
      container.innerHTML = '<p class="admin-card-desc text-center py-4">No pending verifications</p>';
      return;
    }

    container.innerHTML = this.pendingMembers.map(member => {
      const e = (s) => this.escapeHTML(s);
      const safeAvatar = member.avatar ? e(member.avatar) : null;
      const safeName = e(member.name);
      const safeNickname = e(member.nickname);
      const safeHospital = e(member.hospital);
      const safeField = e(member.field);
      const safeYear = e(member.year);
      const safeEmail = e(member.email);
      const safeUsername = e(member.username);
      const safeBirthday = e(member.birthday);
      const safeSpecialization = e(member.specialization);
      const safeBatch = e(member.batch);
      const safeMobile = e(member.mobile);
      const safeTelephone = e(member.telephone);
      const safeHomePhone = e(member.homePhone);
      const safeAddress = e(member.address);
      const safeFacebook = e(member.facebook);
      const safeInstagram = e(member.instagram);
      return `
      <div class="pending-card" data-pending-id="${member.id}">
        <div class="widget-item" onclick="AdminModule.togglePendingDetails(${member.id})" style="cursor:pointer">
          <div class="widget-icon">
            ${safeAvatar ? `<img src="${safeAvatar}" alt="" class="w-8 h-8 rounded-full object-cover">` : '<i data-lucide="user" class="w-4 h-4"></i>'}
          </div>
          <div class="widget-content flex-1">
            <div class="widget-label">${safeName}${safeNickname ? ' (“' + safeNickname + '”) ' : ''}</div>
            <div class="widget-sublabel">${safeHospital} • ${safeField}${safeYear ? ' • Class of ' + safeYear : ''}</div>
          </div>
          <div class="flex gap-2" onclick="event.stopPropagation()">
            <button class="btn btn-emerald btn-sm" onclick="AdminModule.approveMember(${member.id})" title="Approve">
              <i data-lucide="check" class="w-4 h-4"></i>
            </button>
            <button class="btn btn-glass btn-sm" onclick="AdminModule.rejectMember(${member.id})" title="Reject">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        <div class="pending-details" id="pending-details-${member.id}" style="display:none">
          <div class="pending-details-grid">
            <div><span class="pending-detail-label">Email</span><span class="pending-detail-value">${safeEmail || '—'}</span></div>
            <div><span class="pending-detail-label">Username</span><span class="pending-detail-value">${safeUsername || '—'}</span></div>
            <div><span class="pending-detail-label">Birthday</span><span class="pending-detail-value">${safeBirthday || '—'}</span></div>
            <div><span class="pending-detail-label">Graduation Year</span><span class="pending-detail-value">${safeYear || '—'}</span></div>
            <div><span class="pending-detail-label">Field of Medicine</span><span class="pending-detail-value">${safeField || '—'}</span></div>
            <div><span class="pending-detail-label">Specialization</span><span class="pending-detail-value">${safeSpecialization || '—'}</span></div>
            <div><span class="pending-detail-label">Batch</span><span class="pending-detail-value">${safeBatch || '—'}</span></div>
            <div><span class="pending-detail-label">Hospital</span><span class="pending-detail-value">${safeHospital || '—'}</span></div>
            <div><span class="pending-detail-label">Mobile</span><span class="pending-detail-value">${safeMobile || '—'}</span></div>
            <div><span class="pending-detail-label">Telephone</span><span class="pending-detail-value">${safeTelephone || '—'}</span></div>
            <div><span class="pending-detail-label">Home Phone</span><span class="pending-detail-value">${safeHomePhone || '—'}</span></div>
            <div><span class="pending-detail-label">Address</span><span class="pending-detail-value">${safeAddress || '—'}</span></div>
            <div><span class="pending-detail-label">Facebook</span><span class="pending-detail-value">${safeFacebook ? `<a href="${safeFacebook}" target="_blank" rel="noopener" class="text-[#d4af37] hover:underline">${safeFacebook}</a>` : '—'}</span></div>
            <div><span class="pending-detail-label">Instagram</span><span class="pending-detail-value">${safeInstagram ? `<a href="${safeInstagram}" target="_blank" rel="noopener" class="text-[#d4af37] hover:underline">${safeInstagram}</a>` : '—'}</span></div>
            <div><span class="pending-detail-label">Submitted</span><span class="pending-detail-value">${member.submitted ? new Date(member.submitted).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—'}</span></div>
          </div>
        </div>
      </div>
    `;
    }).join('');
  },

  /**
   * Toggle the details panel for a pending member
   * @param {number} memberId - Member ID
   */
  togglePendingDetails(memberId) {
    const panel = document.getElementById(`pending-details-${memberId}`);
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  },

  /**
   * Render member management table
   */
  renderMemberTable() {
    const tbody = document.getElementById('members-table-body');
    if (!tbody) return;

    const filtered = this.getFilteredMembers();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.memberPageSize));
    if (this.memberPage > totalPages) this.memberPage = totalPages;
    const start = (this.memberPage - 1) * this.memberPageSize;
    const pageItems = filtered.slice(start, start + this.memberPageSize);

    if (pageItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 admin-card-desc">No members found</td></tr>';
      this.renderPagination(filtered.length, start, 0, totalPages);
      return;
    }

    tbody.innerHTML = pageItems.map(member => {
      const e = (s) => this.escapeHTML(s);
      const safeName = e(member.name);
      const safeEmail = e(member.email);
      const safeRole = e(member.role);
      const safeStatus = e(member.status);
      const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);
      return `
      <tr data-member-id="${member.id}">
        <td data-label="Member">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8941f] flex items-center justify-center text-[#064e3b] font-semibold text-sm">
              ${e(initials)}
            </div>
            <span>${safeName}</span>
          </div>
        </td>
        <td data-label="Email">${safeEmail}</td>
        <td data-label="Role" class="capitalize">${safeRole}</td>
        <td data-label="Status">
          <span class="status-badge ${safeStatus}">${safeStatus}</span>
        </td>
        <td data-label="Joined">${new Date(member.joined).toLocaleDateString()}</td>
        <td data-label="Actions">
          <div class="flex gap-2">
            <button class="icon-btn" onclick="AdminModule.editMember(${member.id})" title="Edit">
              <i data-lucide="edit" class="w-4 h-4"></i>
            </button>
            <button class="icon-btn" onclick="AdminModule.toggleMemberStatus(${member.id})" title="Toggle Status">
              <i data-lucide="power" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join('');

    this.renderPagination(filtered.length, start, pageItems.length, totalPages);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Filter members by the current search query
   */
  getFilteredMembers() {
    if (!this.memberSearch) return this.managedMembers;
    const q = this.memberSearch;
    return this.managedMembers.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q)
    );
  },

  /**
   * Update pagination text + button states
   */
  renderPagination(total, start, count, totalPages) {
    const text = document.getElementById('member-count-text');
    if (text) {
      const from = total === 0 ? 0 : start + 1;
      const to = start + count;
      text.textContent = `Showing ${from}-${to} of ${total} members`;
    }
    const prev = document.getElementById('member-prev');
    const next = document.getElementById('member-next');
    if (total === 0) {
      if (prev) prev.style.display = 'none';
      if (next) next.style.display = 'none';
    } else {
      if (prev) { prev.style.display = ''; prev.disabled = this.memberPage <= 1; }
      if (next) { next.style.display = ''; next.disabled = this.memberPage >= totalPages; }
    }
  },

  /**
   * Approve a pending member
   * @param {number} memberId - Member ID
   */
  async approveMember(memberId) {
    const index = this.pendingMembers.findIndex(m => m.id === memberId);
    if (index === -1) return;

    const member = this.pendingMembers[index];

    if (this.hasSupabase()) {
      const { error } = await db.from('members')
        .update({ status: 'active' })
        .eq('id', memberId);
      if (error) { this.showToast('Failed to approve member', 'error'); return; }
    }

    this.pendingMembers.splice(index, 1);
    this.stats.pendingVerifications--;
    this.stats.totalMembers++;

    this.renderStats();
    this.renderPendingMembers();
    this.showToast(`${member.name} has been approved!`, 'success');
  },

  /**
   * Reject a pending member
   * @param {number} memberId - Member ID
   */
  async rejectMember(memberId) {
    const index = this.pendingMembers.findIndex(m => m.id === memberId);
    if (index === -1) return;

    const member = this.pendingMembers[index];

    if (this.hasSupabase()) {
      const { error } = await db.from('members')
        .update({ status: 'rejected' })
        .eq('id', memberId);
      if (error) { this.showToast('Failed to reject member', 'error'); return; }
    }

    this.pendingMembers.splice(index, 1);
    this.stats.pendingVerifications--;

    this.renderStats();
    this.renderPendingMembers();
    this.showToast(`Application from ${member.name} has been rejected.`, 'info');
  },

  /**
   * Edit member (mock)
   * @param {number} memberId - Member ID
   */
  editMember(memberId) {
    const member = this.managedMembers.find(m => m.id === memberId);
    if (!member) return;
    this.openEditMemberModal(member);
  },

  /**
   * Toggle member status
   * @param {number} memberId - Member ID
   */
  async toggleMemberStatus(memberId) {
    const member = this.managedMembers.find(m => m.id === memberId);
    if (!member) return;

    const newStatus = member.status === 'active' ? 'suspended' : 'active';

    if (!confirm(`${newStatus === 'suspended' ? 'Suspend' : 'Reactivate'} ${member.name}'s account?`)) return;

    if (this.hasSupabase()) {
      const { error } = await db.from('members')
        .update({ status: newStatus })
        .eq('id', memberId);
      if (error) { this.showToast('Failed to update status', 'error'); return; }
    }

    member.status = newStatus;
    this.renderMemberTable();
    this.showToast(`${member.name} is now ${member.status}.`, 'info');
  },

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type
   */
  showToast(message, type = 'info') {
    // Reuse FeedModule toast if available
    if (typeof FeedModule !== 'undefined' && FeedModule.showToast) {
      FeedModule.showToast(message, type);
    } else {
      alert(message);
    }
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const link = e.target.closest('.admin-tab');
        const tabName = (link || e.target).dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Member search
    const search = document.getElementById('member-search');
    if (search) {
      search.addEventListener('input', (e) => {
        this.memberSearch = e.target.value.trim().toLowerCase();
        this.memberPage = 1;
        this.renderMemberTable();
      });
    }

    // Add member
    const addBtn = document.getElementById('add-member-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddMemberModal());

    // Pagination
    const prev = document.getElementById('member-prev');
    const next = document.getElementById('member-next');
    if (prev) prev.addEventListener('click', () => {
      if (this.memberPage > 1) { this.memberPage--; this.renderMemberTable(); }
    });
    if (next) next.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(this.getFilteredMembers().length / this.memberPageSize));
      if (this.memberPage < totalPages) { this.memberPage++; this.renderMemberTable(); }
    });

    // Magazine upload form
    const magForm = document.getElementById('upload-form');
    if (magForm) {
      magForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleMagazineUpload(magForm); });
    }

    // Vault upload form
    const vaultForm = document.getElementById('vault-upload-form');
    if (vaultForm) {
      vaultForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleVaultUpload(vaultForm); });
    }

    // Drop zone interactions
    this.setupDropZone('magazine-drop-zone', 'magazine-cover-url');
    this.setupDropZone('vault-drop-zone', 'vault-media-url');
  },

  /**
   * Setup drag-drop zone visual interactions
   * @param {string} zoneId - Drop zone element ID
   * @param {string} urlInputId - Associated URL input to populate with object URL
   */
  setupDropZone(zoneId, urlInputId) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const input = document.getElementById(urlInputId);
        if (input) input.value = url;
        this.showToast(`File "${file.name}" attached. URL field auto-filled.`, 'success');
      }
    });
    zone.addEventListener('click', () => {
      this.showToast('File picker coming soon. Paste a URL in the field below for now.', 'info');
    });
  },

  /**
   * Switch admin tab
   * @param {string} tabName - Tab name
   */
  switchTab(tabName) {
    document.querySelectorAll('.admin-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const targetPanel = document.getElementById(`panel-${tabName}`);
    if (targetPanel) {
      targetPanel.classList.remove('hidden');
    }

    // Sync sidebar active state (also when triggered by quick actions)
    document.querySelectorAll('.admin-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
  },

  // ==========================================================================
  // MODAL HELPERS
  // ==========================================================================

  /**
   * Build and show a generic admin modal with a form
   */
  buildModal(title, bodyHtml, submitLabel, onSubmit) {
    this.closeModal();
    const overlay = document.createElement('div');
    overlay.id = 'admin-modal';
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML = `
      <div class="admin-modal glass-card">
        <div class="admin-modal-header">
          <h3>${title}</h3>
          <button type="button" class="icon-btn" id="admin-modal-close"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
        <form id="admin-modal-form" class="admin-modal-body">
          ${bodyHtml}
          <div class="admin-modal-footer">
            <button type="button" class="btn btn-glass btn-sm" id="admin-modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-gold btn-sm">${submitLabel}</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#admin-modal-close').addEventListener('click', () => this.closeModal());
    overlay.querySelector('#admin-modal-cancel').addEventListener('click', () => this.closeModal());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeModal(); });
    overlay.querySelector('#admin-modal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      onSubmit(e.target);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeModal() {
    const existing = document.getElementById('admin-modal');
    if (existing) existing.remove();
  },

  // ==========================================================================
  // ADD / EDIT MEMBER
  // ==========================================================================

  openAddMemberModal() {
    const years = [];
    for (let y = 2026; y >= 1971; y--) years.push(y);
    const body = `
      <div class="form-grid-2">
        <div><label class="form-label">First Name *</label><input id="am-first" class="glass-input w-full" required></div>
        <div><label class="form-label">Last Name *</label><input id="am-last" class="glass-input w-full" required></div>
      </div>
      <div><label class="form-label">Email *</label><input id="am-email" type="email" class="glass-input w-full" required></div>
      <div><label class="form-label">Username *</label><input id="am-username" class="glass-input w-full" required></div>
      <div><label class="form-label">Temporary Password *</label><input id="am-password" type="text" class="glass-input w-full" value="ZBM-temp-1234" required></div>
      <div class="form-grid-2">
        <div><label class="form-label">Graduation Year</label><select id="am-year" class="glass-input w-full">${years.map(y => `<option>${y}</option>`).join('')}</select></div>
        <div><label class="form-label">Field of Medicine</label><input id="am-field" class="glass-input w-full" value="General Medicine"></div>
      </div>
      <div><label class="form-label">Hospital</label><input id="am-hospital" class="glass-input w-full" value="Not provided"></div>
      <div class="form-grid-2">
        <div><label class="form-label">Role</label><select id="am-role" class="glass-input w-full"><option value="member">Member</option><option value="moderator">Moderator</option><option value="officer">Officer</option><option value="alumni">Alumni</option><option value="admin">Admin</option></select></div>
        <div><label class="form-label">Status</label><select id="am-status" class="glass-input w-full"><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></div>
      </div>
    `;
    this.buildModal('Add Member', body, 'Create Member', (form) => this.submitAddMember(form));
  },

  async submitAddMember(form) {
    const get = (id) => (document.getElementById(id)?.value || '').trim();
    const first = get('am-first');
    const last = get('am-last');
    const email = get('am-email');
    const username = get('am-username');
    const password = get('am-password');
    const year = parseInt(get('am-year'));
    const field = get('am-field') || 'General Medicine';
    const hospital = get('am-hospital') || 'Not provided';
    const role = document.getElementById('am-role').value;
    const status = document.getElementById('am-status').value;

    if (!first || !last || !email || !username || !password) {
      this.showToast('Please fill in all required fields', 'error');
      return;
    }

    if (this.hasSupabase()) {
      const { error: authError } = await db.auth.signUp({ email, password });
      if (authError) { this.showToast('Auth error: ' + authError.message, 'error'); return; }

      const { error: insertError } = await db.from('members').insert({
        username, email,
        password_hash: 'managed_by_supabase_auth',
        first_name: first, last_name: last,
        graduation_year: year || 2000,
        hospital, field_of_medicine: field,
        role, status,
        avatar_url: `image/placeholders/avatars/a${[10, 13, 14, 20, 25][Math.floor(Math.random() * 5)]}.jpg`
      });
      if (insertError) { this.showToast('Insert failed: ' + insertError.message, 'error'); return; }

      await this.loadManagedMembers();
      await this.loadStats();
      this.renderStats();
    } else {
      const newId = Math.max(0, ...this.managedMembers.map(m => m.id)) + 1;
      this.managedMembers.push({ id: newId, name: `${first} ${last}`, email, role, status, joined: new Date().toISOString() });
    }

    this.renderMemberTable();
    this.closeModal();
    this.showToast(`${first} ${last} has been added.`, 'success');
  },

  openEditMemberModal(member) {
    const roleOpt = (v, l) => `<option value="${v}" ${member.role === v ? 'selected' : ''}>${l}</option>`;
    const statOpt = (v, l) => `<option value="${v}" ${member.status === v ? 'selected' : ''}>${l}</option>`;
    const body = `
      <div><label class="form-label">Name</label><input id="em-name" class="glass-input w-full" value="${this.escapeHTML(member.name) || ''}"></div>
      <div><label class="form-label">Email</label><input id="em-email" type="email" class="glass-input w-full" value="${this.escapeHTML(member.email) || ''}"></div>
      <div class="form-grid-2">
        <div><label class="form-label">Role</label><select id="em-role" class="glass-input w-full">${roleOpt('member', 'Member')}${roleOpt('moderator', 'Moderator')}${roleOpt('officer', 'Officer')}${roleOpt('alumni', 'Alumni')}${roleOpt('admin', 'Admin')}</select></div>
        <div><label class="form-label">Status</label><select id="em-status" class="glass-input w-full">${statOpt('active', 'Active')}${statOpt('pending', 'Pending')}${statOpt('suspended', 'Suspended')}${statOpt('inactive', 'Inactive')}</select></div>
      </div>
    `;
    this.buildModal(`Edit ${member.name}`, body, 'Save Changes', () => this.submitEditMember(member.id));
  },

  async submitEditMember(memberId) {
    const name = document.getElementById('em-name').value.trim();
    const email = document.getElementById('em-email').value.trim();
    const role = document.getElementById('em-role').value;
    const status = document.getElementById('em-status').value;
    const member = this.managedMembers.find(m => m.id === memberId);
    if (!member) return;

    if (this.hasSupabase()) {
      const parts = name.split(' ').filter(Boolean);
      const update = {
        first_name: parts[0] || member.name,
        last_name: parts.slice(1).join(' ') || parts[0] || '',
        email, role, status
      };
      const { error } = await db.from('members').update(update).eq('id', memberId);
      if (error) { this.showToast('Update failed: ' + error.message, 'error'); return; }
    }

    member.name = name;
    member.email = email;
    member.role = role;
    member.status = status;
    this.renderMemberTable();
    this.closeModal();
    this.showToast('Member updated.', 'success');
  },

  // ==========================================================================
  // CONTENT UPLOAD (metadata + cloud URLs)
  // ==========================================================================

  async handleMagazineUpload(form) {
    const year = parseInt(document.getElementById('magazine-year').value);
    const title = document.getElementById('magazine-title').value.trim();
    const cover = document.getElementById('magazine-cover-url').value.trim();
    const pdf = document.getElementById('magazine-pdf-url').value.trim();

    if (!year || !title || !cover || !pdf) {
      this.showToast('Please fill in year, title, cover URL and PDF URL', 'error');
      return;
    }

    if (this.hasSupabase()) {
      const { error } = await db.from('magazines').insert({
        year, title,
        cover_image_url: cover,
        pdf_url: pdf,
        editor_id: this.currentMemberId(),
        is_published: true
      });
      if (error) { this.showToast('Upload failed: ' + error.message, 'error'); return; }
    }

    form.reset();
    this.showToast('Magazine added successfully!', 'success');
  },

  async handleVaultUpload(form) {
    const year = parseInt(document.getElementById('vault-year').value);
    const category = document.getElementById('vault-category').value;
    const title = document.getElementById('vault-title').value.trim();
    const caption = document.getElementById('vault-caption').value.trim();
    const media = document.getElementById('vault-media-url').value.trim();

    if (!year || !category || !title || !media) {
      this.showToast('Please fill in year, category, title and media URL', 'error');
      return;
    }

    if (this.hasSupabase()) {
      const uploadedBy = this.currentMemberId();
      if (!uploadedBy) { this.showToast('You must be logged in to upload.', 'error'); return; }
      const { error } = await db.from('vault_items').insert({
        year, category, title, caption,
        media_url: media,
        uploaded_by: uploadedBy
      });
      if (error) { this.showToast('Upload failed: ' + error.message, 'error'); return; }
    }

    form.reset();
    this.showToast('Vault item added successfully!', 'success');
  },

  // ==========================================================================
  // MODERATION
  // ==========================================================================

  async loadReports() {
    const { data, error } = await db
      .from('moderation_reports')
      .select('id, reporter_id, content_type, content_id, reason, description, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data) return;

    // Resolve reporter names/avatars
    const reporterIds = [...new Set(data.map(r => r.reporter_id).filter(Boolean))];
    const reporterMap = {};
    if (reporterIds.length) {
      const { data: reporters } = await db.from('members').select('id, name, avatar_url').in('id', reporterIds);
      (reporters || []).forEach(m => { reporterMap[m.id] = m; });
    }

    // Resolve content previews
    const postIds = data.filter(r => r.content_type === 'post').map(r => r.content_id);
    const commentIds = data.filter(r => r.content_type === 'comment').map(r => r.content_id);
    const contentMap = { post: {}, comment: {} };
    if (postIds.length) {
      const { data: posts } = await db.from('posts').select('id, content').in('id', postIds);
      (posts || []).forEach(p => { contentMap.post[p.id] = p.content; });
    }
    if (commentIds.length) {
      const { data: comments } = await db.from('comments').select('id, content').in('id', commentIds);
      (comments || []).forEach(c => { contentMap.comment[c.id] = c.content; });
    }

    const mapReport = (r) => ({
      id: r.id,
      contentType: r.content_type,
      contentId: r.content_id,
      reason: r.reason,
      description: r.description,
      createdAt: r.created_at,
      reporter: reporterMap[r.reporter_id]?.name || 'Unknown',
      avatar: reporterMap[r.reporter_id]?.avatar_url || 'image/placeholders/avatars/a20.jpg',
      preview: (contentMap[r.content_type] && contentMap[r.content_type][r.content_id]) || '(content unavailable)'
    });

    this.reports.posts = data.filter(r => r.content_type === 'post').map(mapReport);
    this.reports.comments = data.filter(r => r.content_type === 'comment').map(mapReport);
  },

  renderReports() {
    this.renderReportList('reported-posts', this.reports.posts, 'post', 'reported-posts-count');
    this.renderReportList('flagged-comments', this.reports.comments, 'comment', 'flagged-comments-count');
  },

  renderReportList(containerId, items, type, countId) {
    const container = document.getElementById(containerId);
    const countEl = document.getElementById(countId);
    if (countEl) countEl.textContent = `(${items.length} pending)`;
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `<p class="admin-card-desc text-center py-4">No ${type === 'post' ? 'reported posts' : 'flagged comments'}</p>`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const removeLabel = type === 'post' ? 'Remove Post' : 'Remove Comment';
    const typeBadge = type === 'post' ? 'post' : 'comment';
    const typeIcon = type === 'post' ? 'file-text' : 'message-square';
    container.innerHTML = items.map(r => {
      const e = (s) => this.escapeHTML(s);
      return `
      <div class="glass moderation-report-card ${type === 'comment' ? 'comment-type' : ''} p-4 rounded-lg flex items-start justify-between" data-report-id="${r.id}">
        <div class="flex gap-3">
          <img src="${e(r.avatar)}" alt="User" class="w-10 h-10 rounded-full">
          <div>
            <p class="text-sm font-medium admin-card-title">Reported by ${e(r.reporter)}</p>
            <div class="moderation-report-meta">
              <span class="moderation-type-badge ${typeBadge}">
                <i data-lucide="${typeIcon}" class="w-3 h-3"></i>
                ${typeBadge}
              </span>
              <span class="moderation-timestamp">${r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
            </div>
            <p class="text-xs admin-card-desc mt-1">Reason: ${e(r.reason)}${r.description ? ' — ' + e(r.description) : ''}</p>
            <p class="text-sm admin-card-body mt-2 italic">"${e((r.preview || '').slice(0, 140))}"</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-glass btn-sm flex items-center gap-1" onclick="AdminModule.dismissReport(${r.id})">
            <i data-lucide="x-circle" class="w-4 h-4"></i>
            Dismiss
          </button>
          <button class="btn btn-emerald btn-sm flex items-center gap-1" onclick="AdminModule.removeReportedContent(${r.id})">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            ${removeLabel}
          </button>
        </div>
      </div>
    `;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  async dismissReport(reportId) {
    if (this.hasSupabase()) {
      const { error } = await db.from('moderation_reports')
        .update({ status: 'dismissed', resolved_by: this.currentMemberId(), resolved_at: new Date().toISOString() })
        .eq('id', reportId);
      if (error) { this.showToast('Failed to dismiss report', 'error'); return; }
    }
    this.removeReportFromState(reportId);
    this.renderReports();
    this.showToast('Report dismissed.', 'info');
  },

  async removeReportedContent(reportId) {
    const report = [...this.reports.posts, ...this.reports.comments].find(r => r.id === reportId);
    if (!report) return;

    if (!confirm(`Remove this reported ${report.contentType}? This cannot be undone.`)) return;

    if (this.hasSupabase()) {
      const table = report.contentType === 'post' ? 'posts' : 'comments';
      const { error: cErr } = await db.from(table)
        .update({ status: 'removed', deleted_at: new Date().toISOString() })
        .eq('id', report.contentId);
      if (cErr) { this.showToast('Failed to remove content', 'error'); return; }

      const { error: rErr } = await db.from('moderation_reports')
        .update({ status: 'resolved', resolved_by: this.currentMemberId(), resolved_at: new Date().toISOString() })
        .eq('id', reportId);
      if (rErr) { this.showToast('Content removed but report not updated', 'error'); }
    }
    this.removeReportFromState(reportId);
    this.renderReports();
    this.showToast(`${report.contentType === 'post' ? 'Post' : 'Comment'} removed.`, 'success');
  },

  removeReportFromState(reportId) {
    this.reports.posts = this.reports.posts.filter(r => r.id !== reportId);
    this.reports.comments = this.reports.comments.filter(r => r.id !== reportId);
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.admin-page')) {
    AdminModule.init();
  }
});

// Re-init on bfcache restore (browser back/forward)
window.addEventListener('zbm-bfcache-restore', () => {
  if (document.querySelector('.admin-page')) {
    AdminModule.init();
  }
});

// Expose globally
window.AdminModule = AdminModule;
