/**
 * Zeta Beta Mu Fraternity Portal
 * Directory Module - Medical Directory Search
 * 
 * Handles searchable member directory with filtering by
 * name, hospital, and medical specialty.
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

  // Active member data (loaded from Supabase or mock)
  members: [],

  currentFilter: 'All',
  searchQuery: '',

  /**
   * Check if Supabase is configured
   */
  hasSupabase() {
    return typeof db !== 'undefined' && db &&
           typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');
  },

  /**
   * Initialize directory module
   */
  async init() {
    await this.loadMembers();
    this.renderMembers();
    this.setupEventListeners();
  },

  /**
   * Load members from Supabase or fall back to mock data
   */
  async loadMembers() {
    if (this.hasSupabase()) {
      const { data, error } = await db
        .from('members')
        .select('id, name, graduation_year, hospital, field_of_medicine, avatar_url')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (!error && data) {
        this.members = data.map(m => ({
          id: m.id,
          name: m.name,
          year: m.graduation_year,
          hospital: m.hospital,
          field: m.field_of_medicine,
          avatar: m.avatar_url
        }));
        return;
      }
    }
    // Fallback to mock
    this.members = [...this.mockMembers];
  },

  /**
   * Render member cards
   */
  renderMembers() {
    const grid = document.getElementById('directory-grid');
    if (!grid) return;

    const filtered = this.getFilteredMembers();

    if (filtered.length === 0) {
      grid.innerHTML = this.getEmptyStateHTML();
      return;
    }

    grid.innerHTML = filtered.map(member => this.createMemberCardHTML(member)).join('');
  },

  /**
   * Get filtered members based on current filter and search
   * @returns {Array} Filtered members
   */
  getFilteredMembers() {
    return this.members.filter(member => {
      // Apply specialty filter
      const matchesFilter = this.currentFilter === 'All' || member.field === this.currentFilter;
      
      // Apply search query
      const query = this.searchQuery.toLowerCase();
      const matchesSearch = !query || 
        member.name.toLowerCase().includes(query) ||
        member.hospital.toLowerCase().includes(query) ||
        member.field.toLowerCase().includes(query) ||
        member.year.toString().includes(query);

      return matchesFilter && matchesSearch;
    });
  },

  /**
   * Create HTML for member card
   * @param {Object} member - Member data
   * @returns {string} HTML string
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

  createMemberCardHTML(member) {
    const safeName = this.escapeHTML(member.name);
    const safeHospital = this.escapeHTML(member.hospital);
    const safeField = this.escapeHTML(member.field);
    const safeAvatar = this.escapeHTML(member.avatar);
    return `
      <article class="glass-card member-card" data-member-id="${member.id}">
        <img src="${safeAvatar}" alt="${safeName}" class="member-avatar">
        <h3 class="member-name">${safeName}</h3>
        <p class="member-year flex items-center justify-center gap-1">
          <i data-lucide="graduation-cap" class="w-3 h-3"></i>
          Class of ${this.escapeHTML(member.year)}
        </p>
        <p class="member-hospital flex items-center justify-center gap-1">
          <i data-lucide="building-2" class="w-3 h-3"></i>
          ${safeHospital}
        </p>
        <span class="member-field">${safeField}</span>
      </article>
    `;
  },

  /**
   * Get empty state HTML
   * @returns {string} HTML string
   */
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

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('directory-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderMembers();
      });
    }

    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const btn = e.currentTarget;

        // Update active state
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');

        // Update filter (trim to strip whitespace around the icon)
        this.currentFilter = btn.textContent.trim();
        this.renderMembers();
      });
    });

    // Member card click
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.member-card');
      if (card) {
        const memberId = parseInt(card.dataset.memberId);
        this.showMemberDetails(memberId);
      }
    });
  },

  /**
   * Show member details modal (mock)
   * @param {number} memberId - Member ID
   */
  async showMemberDetails(memberId) {
    const member = this.members.find(m => m.id === memberId);
    if (!member) return;

    let profile = member;

    // Fetch full profile from Supabase if available
    if (this.hasSupabase()) {
      const { data } = await db
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single();
      if (data) {
        profile = {
          name: data.name,
          hospital: data.hospital,
          field: data.field_of_medicine,
          year: data.graduation_year,
          email: data.email,
          phone: data.phone || data.mobile,
          bio: data.bio
        };
      }
    }

    alert(`Contact ${profile.name}\n\nHospital: ${profile.hospital}\nField: ${profile.field}\nClass of: ${profile.year}${profile.email ? '\nEmail: ' + profile.email : ''}${profile.phone ? '\nPhone: ' + profile.phone : ''}`);
  }
};

// Re-init on bfcache restore (browser back/forward)
window.addEventListener('zbm-bfcache-restore', () => {
  DirectoryModule.init();
});

// Expose globally
window.DirectoryModule = DirectoryModule;
