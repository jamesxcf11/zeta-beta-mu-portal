/**
 * Zeta Beta Mu Fraternity Portal
 * Directory Module - Medical Directory Search
 * 
 * Handles searchable member directory with filtering by
 * name, hospital, and medical specialty.
 */

const DirectoryModule = {
  // Mock member database
  members: [
    { id: 1, name: 'Dr. James Anderson', year: 1995, hospital: 'St. Luke\'s Medical Center', field: 'Cardiology', avatar: 'https://i.pravatar.cc/150?img=11' },
    { id: 2, name: 'Dr. Sarah Mitchell', year: 2008, hospital: 'Mount Sinai Hospital', field: 'Neurology', avatar: 'https://i.pravatar.cc/150?img=5' },
    { id: 3, name: 'Dr. Michael Chen', year: 2012, hospital: 'Johns Hopkins Medicine', field: 'Oncology', avatar: 'https://i.pravatar.cc/150?img=3' },
    { id: 4, name: 'Dr. Emily Roberts', year: 2015, hospital: 'Children\'s Hospital', field: 'Pediatrics', avatar: 'https://i.pravatar.cc/150?img=9' },
    { id: 5, name: 'Dr. Robert Kim', year: 2002, hospital: 'Mayo Clinic', field: 'Surgery', avatar: 'https://i.pravatar.cc/150?img=8' },
    { id: 6, name: 'Dr. Lisa Wang', year: 2010, hospital: 'Cleveland Clinic', field: 'Cardiology', avatar: 'https://i.pravatar.cc/150?img=10' },
    { id: 7, name: 'Dr. David Martinez', year: 2018, hospital: 'UCLA Medical Center', field: 'Orthopedics', avatar: 'https://i.pravatar.cc/150?img=12' },
    { id: 8, name: 'Dr. Jennifer Adams', year: 2005, hospital: 'NYU Langone Health', field: 'Dermatology', avatar: 'https://i.pravatar.cc/150?img=6' },
    { id: 9, name: 'Dr. William Turner', year: 1998, hospital: 'Stanford Health Care', field: 'Psychiatry', avatar: 'https://i.pravatar.cc/150?img=13' },
    { id: 10, name: 'Dr. Amanda Foster', year: 2011, hospital: 'Mass General Brigham', field: 'Internal Medicine', avatar: 'https://i.pravatar.cc/150?img=7' },
    { id: 11, name: 'Dr. Christopher Lee', year: 2007, hospital: 'Cedars-Sinai', field: 'Emergency Medicine', avatar: 'https://i.pravatar.cc/150?img=14' },
    { id: 12, name: 'Dr. Michelle Park', year: 2014, hospital: 'UCSF Medical Center', field: 'Radiology', avatar: 'https://i.pravatar.cc/150?img=15' }
  ],

  currentFilter: 'All',
  searchQuery: '',

  /**
   * Initialize directory module
   */
  init() {
    this.renderMembers();
    this.setupEventListeners();
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
  createMemberCardHTML(member) {
    return `
      <article class="glass-card member-card" data-member-id="${member.id}">
        <img src="${member.avatar}" alt="${member.name}" class="member-avatar">
        <h3 class="member-name">${member.name}</h3>
        <p class="member-year flex items-center justify-center gap-1">
          <i data-lucide="graduation-cap" class="w-3 h-3"></i>
          Class of ${member.year}
        </p>
        <p class="member-hospital flex items-center justify-center gap-1">
          <i data-lucide="building-2" class="w-3 h-3"></i>
          ${member.hospital}
        </p>
        <span class="member-field">${member.field}</span>
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
        // Update active state
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');

        // Update filter
        this.currentFilter = e.target.textContent;
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
  showMemberDetails(memberId) {
    const member = this.members.find(m => m.id === memberId);
    if (!member) return;

    // For demo, show alert with member info
    // In production, this would open a modal
    alert(`Contact ${member.name}\n\nHospital: ${member.hospital}\nField: ${member.field}\nClass of: ${member.year}`);
  }
};

// Expose globally
window.DirectoryModule = DirectoryModule;
