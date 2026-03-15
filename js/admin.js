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
  // Mock statistics
  stats: {
    totalMembers: 247,
    pendingVerifications: 12,
    totalPosts: 1847,
    upcomingEvents: 5
  },

  // Mock pending members
  pendingMembers: [
    { id: 101, name: 'Dr. Alex Thompson', email: 'alex@hospital.com', year: 2019, hospital: 'Northwestern Medicine', field: 'Cardiology', submitted: '2026-03-10' },
    { id: 102, name: 'Dr. Maria Garcia', email: 'maria@clinic.com', year: 2020, hospital: 'Rush University Medical', field: 'Pediatrics', submitted: '2026-03-11' },
    { id: 103, name: 'Dr. Kevin Liu', email: 'kevin@health.org', year: 2018, hospital: 'Cleveland Clinic', field: 'Surgery', submitted: '2026-03-12' }
  ],

  // Mock members for management
  managedMembers: [
    { id: 1, name: 'Dr. James Anderson', email: 'james@zetabetamu.com', role: 'admin', status: 'active', joined: '1995-06-15' },
    { id: 2, name: 'Dr. Sarah Mitchell', email: 'sarah@zetabetamu.com', role: 'member', status: 'active', joined: '2008-06-20' },
    { id: 3, name: 'Dr. Michael Chen', email: 'michael@zetabetamu.com', role: 'member', status: 'active', joined: '2012-06-18' },
    { id: 4, name: 'Dr. John Doe', email: 'john@zetabetamu.com', role: 'member', status: 'suspended', joined: '2015-06-22' }
  ],

  /**
   * Initialize admin module
   */
  init() {
    this.checkAdminAccess();
    this.renderStats();
    this.renderPendingMembers();
    this.renderMemberTable();
    this.setupEventListeners();
  },

  /**
   * Check if user has admin access
   */
  checkAdminAccess() {
    // In production, this would verify admin status
    // For demo, we'll allow access but show a notice
    const session = localStorage.getItem('zbm-session');
    if (!session) {
      // Not logged in - redirect to login
      // window.location.href = 'login.html';
      console.log('Admin access: No session found');
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
    if (!container) return;

    if (this.pendingMembers.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-center py-4">No pending verifications</p>';
      return;
    }

    container.innerHTML = this.pendingMembers.map(member => `
      <div class="widget-item" data-pending-id="${member.id}">
        <div class="widget-icon">
          <i data-lucide="user" class="w-4 h-4"></i>
        </div>
        <div class="widget-content">
          <div class="widget-label">${member.name}</div>
          <div class="widget-sublabel">${member.hospital} • ${member.field}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-emerald btn-sm" onclick="AdminModule.approveMember(${member.id})" title="Approve">
            <i data-lucide="check" class="w-4 h-4"></i>
          </button>
          <button class="btn btn-glass btn-sm" onclick="AdminModule.rejectMember(${member.id})" title="Reject">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `).join('');
  },

  /**
   * Render member management table
   */
  renderMemberTable() {
    const tbody = document.getElementById('members-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.managedMembers.map(member => `
      <tr data-member-id="${member.id}">
        <td>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8941f] flex items-center justify-center text-[#064e3b] font-semibold text-sm">
              ${member.name.split(' ').map(n => n[0]).join('')}
            </div>
            <span>${member.name}</span>
          </div>
        </td>
        <td>${member.email}</td>
        <td class="capitalize">${member.role}</td>
        <td>
          <span class="status-badge ${member.status}">${member.status}</span>
        </td>
        <td>${new Date(member.joined).toLocaleDateString()}</td>
        <td>
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
    `).join('');
  },

  /**
   * Approve a pending member
   * @param {number} memberId - Member ID
   */
  approveMember(memberId) {
    const index = this.pendingMembers.findIndex(m => m.id === memberId);
    if (index === -1) return;

    const member = this.pendingMembers[index];
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
  rejectMember(memberId) {
    const index = this.pendingMembers.findIndex(m => m.id === memberId);
    if (index === -1) return;

    const member = this.pendingMembers[index];
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

    alert(`Edit Member: ${member.name}\n\nIn production, this would open an edit modal.`);
  },

  /**
   * Toggle member status
   * @param {number} memberId - Member ID
   */
  toggleMemberStatus(memberId) {
    const member = this.managedMembers.find(m => m.id === memberId);
    if (!member) return;

    member.status = member.status === 'active' ? 'suspended' : 'active';
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
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Content upload form
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
      uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.showToast('Content uploaded successfully!', 'success');
        uploadForm.reset();
      });
    }
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
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.admin-page')) {
    AdminModule.init();
  }
});

// Expose globally
window.AdminModule = AdminModule;
