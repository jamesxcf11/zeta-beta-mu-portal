/**
 * Zeta Beta Mu Fraternity Portal
 * Enhanced Vault Module - Historical Photo Gallery
 * 
 * A comprehensive photo gallery app with timeline, categories,
 * lightbox viewer, and detailed photo descriptions.
 */

const VaultModule = {
  // Configuration
  config: {
    startYear: 1971,
    endYear: 2026,
    itemsPerYear: { min: 3, max: 8 }
  },

  // Sample vault images
  sampleImages: [
    '012ec369-ea52-42fc-912a-d1ef7504950a.jpg',
    '10cd9e8d-2106-42c5-996a-ba7b590fe852.jpg',
    '21f815ad-4772-4ed3-b327-9aa23fee294e.jpg',
    '28da8bc3-b009-46b1-a938-ff815d169cc3.jpg',
    '2eaf4706-2fdd-47ba-ae98-a07b479269e6.jpg',
    '2f8a6a33-7bd4-4672-9cdf-3cd4449d616e.jpg',
    '47db4c7e-009a-4261-a8e2-d7a2f6f4eb55.jpg',
    '5349e504-5814-469a-aac3-cd15565c51a8.jpg',
    '542a8380-fae7-4ae4-9372-3bd5c0c42c7f.jpg',
    '6525a973-34cf-40e0-b1e0-417e675d8d41.jpg',
    '66ac2a3f-ed7a-44cc-9d5e-0db23b1b86d4.jpg',
    '75e230e1-8c53-4397-ba14-b2606780ce41.jpg',
    '8ecbf87d-4371-4e5d-8f92-4976f4500daf.jpg',
    'ac6376cd-926d-4cde-881b-8038f5c14a65.jpg',
    'be8869ff-3988-42f8-a3b4-8eff81a42ba2.jpg',
    'c50e3c67-1e97-4271-a61e-5ca8cb63eaac.jpg',
    'cc5273a3-24ce-414a-82dc-d54406d977bf.jpg',
    'ceb34cb3-f492-4828-bfe2-628662bfad4f.jpg',
    'e680bf91-375b-40e2-854f-096cb9170daf.jpg',
    'e74af5dd-cea2-40c6-a1f4-c7c00ad8d01f.jpg'
  ],

  // State
  years: [],
  galleryItems: {},
  currentYear: 2026,
  currentCategory: 'all',
  searchQuery: '',
  lightboxOpen: false,
  currentLightboxIndex: 0,
  filteredItems: [],

  // Categories with icons
  categories: {
    all: { name: 'All Items', icon: 'images', color: '#d4af37' },
    gala: { name: 'Annual Gala', icon: 'party-popper', color: '#f59e0b' },
    induction: { name: 'Induction', icon: 'award', color: '#10b981' },
    conference: { name: 'Conference', icon: 'presentation', color: '#3b82f6' },
    reunion: { name: 'Reunion', icon: 'users', color: '#8b5cf6' },
    mission: { name: 'Charity Mission', icon: 'heart-handshake', color: '#ef4444' },
    graduation: { name: 'Graduation', icon: 'graduation-cap', color: '#06b6d4' },
    founders: { name: 'Founders Day', icon: 'crown', color: '#f97316' },
    research: { name: 'Research', icon: 'microscope', color: '#14b8a6' }
  },

  // Detailed descriptions for photos
  photoTemplates: [
    {
      title: 'Annual Fraternity Gala Dinner',
      category: 'gala',
      description: 'A prestigious evening celebrating excellence in medicine with distinguished alumni and guest speakers.',
      location: 'The Grand Hotel Ballroom'
    },
    {
      title: 'New Member Induction Ceremony',
      category: 'induction',
      description: 'The sacred tradition of welcoming new brothers into the fraternity, complete with the oath and ceremonial regalia.',
      location: 'University Great Hall'
    },
    {
      title: 'Medical Research Symposium',
      category: 'research',
      description: 'Presenting groundbreaking research findings and innovations in medical science to peers and mentors.',
      location: 'Medical School Auditorium'
    },
    {
      title: 'Alumni Reunion Weekend',
      category: 'reunion',
      description: 'Reconnecting with fellow brothers across generations, sharing stories and professional achievements.',
      location: 'Fraternity House & Campus'
    },
    {
      title: 'Charity Medical Mission',
      category: 'mission',
      description: 'Providing essential healthcare services to underserved communities, embodying our commitment to service.',
      location: 'Rural Health Clinic'
    },
    {
      title: 'Graduation Celebration',
      category: 'graduation',
      description: 'Honoring the newest medical graduates as they embark on their professional journeys.',
      location: 'University Commencement Hall'
    },
    {
      title: 'Founders Day Commemoration',
      category: 'founders',
      description: 'Paying tribute to the visionary founders who established our fraternity in 1971.',
      location: 'Fraternity Memorial Garden'
    },
    {
      title: 'National Medical Conference',
      category: 'conference',
      description: 'Representing Zeta Beta Mu at prestigious national medical conferences and conventions.',
      location: 'Convention Center'
    },
    {
      title: 'Hospital Partnership Ceremony',
      category: 'research',
      description: 'Formalizing collaborative partnerships with leading medical institutions for research and training.',
      location: 'Memorial Hospital'
    },
    {
      title: 'Community Health Fair',
      category: 'mission',
      description: 'Free health screenings and medical education for the local community.',
      location: 'Community Center'
    },
    {
      title: 'White Coat Ceremony',
      category: 'induction',
      description: 'The symbolic beginning of a medical career, welcoming students to the profession.',
      location: 'University Chapel'
    },
    {
      title: 'Legacy Dinner',
      category: 'gala',
      description: 'An intimate gathering honoring senior members and their contributions to medicine.',
      location: 'Private Dining Room'
    }
  ],

  /**
   * Initialize vault data with enhanced metadata
   */
  initData() {
    // Generate years
    for (let year = this.config.startYear; year <= this.config.endYear; year++) {
      this.years.push(year);
    }

    // Generate gallery items with rich metadata
    this.years.forEach(year => {
      const itemCount = Math.floor(Math.random() * 
        (this.config.itemsPerYear.max - this.config.itemsPerYear.min + 1)) + 
        this.config.itemsPerYear.min;
      
      this.galleryItems[year] = [];

      for (let i = 0; i < itemCount; i++) {
        const templateIndex = (year + i) % this.photoTemplates.length;
        const template = this.photoTemplates[templateIndex];
        const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        
        // Use sample images for recent years, placeholders for older years
        const imageIndex = (year - this.config.startYear + i) % this.sampleImages.length;
        const useSampleImage = year >= 2020;
        const imagePath = useSampleImage 
          ? `sample vault/${this.sampleImages[imageIndex]}`
          : `https://picsum.photos/400/300?random=${year * 100 + i}`;
        const fullImagePath = useSampleImage
          ? `sample vault/${this.sampleImages[imageIndex]}`
          : `https://picsum.photos/1200/800?random=${year * 100 + i}`;

        this.galleryItems[year].push({
          id: `${year}-${i}`,
          year: year,
          title: template.title,
          category: template.category,
          description: template.description,
          location: template.location,
          date: `${year}-${month}-${day}`,
          formattedDate: this.formatDate(`${year}-${month}-${day}`),
          thumbnail: imagePath,
          fullImage: fullImagePath,
          photographer: this.getRandomPhotographer(),
          attendees: Math.floor(Math.random() * 200) + 20,
          featured: i === 0,
          tags: [template.category, year.toString(), 'archive']
        });
      }
    });

    // Initialize filtered items
    this.updateFilteredItems();
  },

  /**
   * Get random photographer name
   */
  getRandomPhotographer() {
    const photographers = [
      'Dr. James Anderson', 'Dr. Sarah Mitchell', 'Dr. Michael Chen',
      'Dr. Emily Roberts', 'Dr. Robert Kim', 'Dr. Lisa Wang',
      'Dr. David Martinez', 'Dr. Jennifer Patel', 'Dr. Thomas Wright',
      'Archive Photography Team', 'Professional Event Photographer'
    ];
    return photographers[Math.floor(Math.random() * photographers.length)];
  },

  /**
   * Format date string
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  /**
   * Initialize vault module
   */
  init() {
    this.initData();
    this.renderCategoryFilter();
    this.renderTimeline();
    this.renderGallery();
    this.setupEventListeners();
    this.renderStats();
  },

  /**
   * Update filtered items based on current filters
   */
  updateFilteredItems() {
    let items = this.galleryItems[this.currentYear] || [];
    
    // Apply category filter
    if (this.currentCategory !== 'all') {
      items = items.filter(item => item.category === this.currentCategory);
    }
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query)
      );
    }
    
    this.filteredItems = items;
  },

  /**
   * Render category filter pills
   */
  renderCategoryFilter() {
    const container = document.getElementById('vault-categories');
    if (!container) return;

    container.innerHTML = Object.entries(this.categories).map(([key, category]) => `
      <button 
        class="category-pill ${key === this.currentCategory ? 'active' : ''}"
        data-category="${key}"
        onclick="VaultModule.selectCategory('${key}')"
        style="${key === this.currentCategory ? `--pill-color: ${category.color}` : ''}"
      >
        <i data-lucide="${category.icon}" class="w-4 h-4"></i>
        <span>${category.name}</span>
        ${key !== 'all' ? `<span class="category-badge">${this.getCategoryCount(key)}</span>` : ''}
      </button>
    `).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Get count of items for a category in current year
   */
  getCategoryCount(category) {
    const items = this.galleryItems[this.currentYear] || [];
    return items.filter(item => item.category === category).length;
  },

  /**
   * Render enhanced year timeline
   */
  renderTimeline() {
    const timeline = document.getElementById('vault-timeline');
    if (!timeline) return;

    // Group years by decade for better navigation
    const decades = {};
    this.years.forEach(year => {
      const decade = Math.floor(year / 10) * 10;
      if (!decades[decade]) decades[decade] = [];
      decades[decade].push(year);
    });

    timeline.innerHTML = Object.entries(decades).map(([decade, years]) => `
      <div class="timeline-decade">
        <span class="decade-label">${decade}s</span>
        <div class="decade-years">
          ${years.map(year => `
            <button 
              class="year-pill ${year === this.currentYear ? 'active' : ''}" 
              data-year="${year}"
              onclick="VaultModule.selectYear(${year})"
              title="${year} (${this.galleryItems[year]?.length || 0} items)"
            >
              ${year}
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Scroll to active year
    setTimeout(() => {
      const activePill = timeline.querySelector('.year-pill.active');
      if (activePill) {
        activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 100);
  },

  /**
   * Render gallery grid with enhanced cards
   */
  renderGallery() {
    const gallery = document.getElementById('vault-gallery');
    const infoPanel = document.getElementById('vault-info');
    
    if (!gallery) return;

    if (this.filteredItems.length === 0) {
      gallery.innerHTML = this.getEmptyStateHTML();
      if (infoPanel) infoPanel.innerHTML = '';
      return;
    }

    // Render gallery grid
    gallery.innerHTML = this.filteredItems.map((item, index) => this.createGalleryCardHTML(item, index)).join('');

    // Render info panel with first item details
    if (infoPanel && this.filteredItems.length > 0) {
      this.renderInfoPanel(this.filteredItems[0]);
    }

    // Initialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Create enhanced gallery card HTML
   */
  createGalleryCardHTML(item, index) {
    const category = this.categories[item.category];
    
    return `
      <article 
        class="vault-card ${item.featured ? 'featured' : ''}" 
        data-item-id="${item.id}"
        data-index="${index}"
        onclick="VaultModule.openLightbox(${index})"
        onmouseenter="VaultModule.renderInfoPanel('${item.id}')"
      >
        <div class="vault-card-image-wrapper">
          <img src="${item.thumbnail}" alt="${item.title}" class="vault-card-image" loading="lazy">
          <div class="vault-card-overlay">
            <button class="vault-view-btn">
              <i data-lucide="maximize-2" class="w-5 h-5"></i>
              <span>View</span>
            </button>
          </div>
          ${item.featured ? `
            <span class="vault-featured-badge">
              <i data-lucide="star" class="w-3 h-3"></i>
              Featured
            </span>
          ` : ''}
        </div>
        <div class="vault-card-content">
          <div class="vault-card-meta">
            <span class="vault-card-category" style="color: ${category.color}">
              <i data-lucide="${category.icon}" class="w-3 h-3"></i>
              ${category.name}
            </span>
            <span class="vault-card-date">${item.formattedDate}</span>
          </div>
          <h3 class="vault-card-title">${item.title}</h3>
          <p class="vault-card-location">
            <i data-lucide="map-pin" class="w-3 h-3"></i>
            ${item.location}
          </p>
        </div>
      </article>
    `;
  },

  /**
   * Render info panel with item details
   */
  renderInfoPanel(itemOrId) {
    const panel = document.getElementById('vault-info');
    if (!panel) return;

    const item = typeof itemOrId === 'string' 
      ? this.filteredItems.find(i => i.id === itemOrId)
      : itemOrId;
    
    if (!item) return;

    const category = this.categories[item.category];

    panel.innerHTML = `
      <div class="vault-info-card">
        <div class="vault-info-header">
          <span class="vault-info-category" style="background: ${category.color}20; color: ${category.color}">
            <i data-lucide="${category.icon}" class="w-4 h-4"></i>
            ${category.name}
          </span>
          <span class="vault-info-year">${item.year}</span>
        </div>
        <h3 class="vault-info-title">${item.title}</h3>
        <p class="vault-info-description">${item.description}</p>
        
        <div class="vault-info-details">
          <div class="vault-info-row">
            <i data-lucide="calendar" class="w-4 h-4"></i>
            <span>${item.formattedDate}</span>
          </div>
          <div class="vault-info-row">
            <i data-lucide="map-pin" class="w-4 h-4"></i>
            <span>${item.location}</span>
          </div>
          <div class="vault-info-row">
            <i data-lucide="camera" class="w-4 h-4"></i>
            <span>Photo by ${item.photographer}</span>
          </div>
          <div class="vault-info-row">
            <i data-lucide="users" class="w-4 h-4"></i>
            <span>${item.attendees} attendees</span>
          </div>
        </div>

        <div class="vault-info-actions">
          <button class="btn btn-gold btn-sm" onclick="VaultModule.openLightboxById('${item.id}')">
            <i data-lucide="maximize-2" class="w-4 h-4"></i>
            View Full Size
          </button>
          <button class="btn btn-glass btn-sm" onclick="VaultModule.downloadPhoto('${item.id}')">
            <i data-lucide="download" class="w-4 h-4"></i>
            Download
          </button>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Render vault statistics
   */
  renderStats() {
    const statsContainer = document.getElementById('vault-stats');
    if (!statsContainer) return;

    const totalItems = Object.values(this.galleryItems).reduce((sum, items) => sum + items.length, 0);
    const yearItems = this.galleryItems[this.currentYear]?.length || 0;
    const filteredCount = this.filteredItems.length;

    statsContainer.innerHTML = `
      <div class="vault-stat">
        <span class="vault-stat-value">${this.currentYear}</span>
        <span class="vault-stat-label">Current Year</span>
      </div>
      <div class="vault-stat">
        <span class="vault-stat-value">${yearItems}</span>
        <span class="vault-stat-label">Items This Year</span>
      </div>
      <div class="vault-stat">
        <span class="vault-stat-value">${filteredCount}</span>
        <span class="vault-stat-label">Shown</span>
      </div>
      <div class="vault-stat">
        <span class="vault-stat-value">${totalItems}</span>
        <span class="vault-stat-label">Total Archive</span>
      </div>
    `;
  },

  /**
   * Get empty state HTML
   */
  getEmptyStateHTML() {
    return `
      <div class="vault-empty-state">
        <div class="vault-empty-icon">
          <i data-lucide="image-off" class="w-16 h-16"></i>
        </div>
        <h3 class="vault-empty-title">No items found</h3>
        <p class="vault-empty-text">
          ${this.currentCategory !== 'all' 
            ? `No ${this.categories[this.currentCategory].name} items for ${this.currentYear}.` 
            : `No photos available for ${this.currentYear}.`}
        </p>
        ${this.currentCategory !== 'all' ? `
          <button class="btn btn-glass mt-4" onclick="VaultModule.selectCategory('all')">
            <i data-lucide="x" class="w-4 h-4"></i>
            Clear Filter
          </button>
        ` : ''}
      </div>
    `;
  },

  /**
   * Select a category
   */
  selectCategory(category) {
    this.currentCategory = category;
    this.updateFilteredItems();
    this.renderCategoryFilter();
    this.renderGallery();
    this.renderStats();
  },

  /**
   * Select a year
   */
  selectYear(year) {
    this.currentYear = year;
    this.updateFilteredItems();
    this.renderTimeline();
    this.renderGallery();
    this.renderStats();
    
    // Update page title
    document.title = `Historical Vault ${year} | Zeta Beta Mu Fraternity`;
  },

  /**
   * Handle search input
   */
  handleSearch(query) {
    this.searchQuery = query;
    this.updateFilteredItems();
    this.renderGallery();
    this.renderStats();
  },

  /**
   * Open lightbox by item ID
   */
  openLightboxById(itemId) {
    const index = this.filteredItems.findIndex(item => item.id === itemId);
    if (index !== -1) {
      this.openLightbox(index);
    }
  },

  /**
   * Open lightbox viewer
   */
  openLightbox(index) {
    this.currentLightboxIndex = index;
    this.lightboxOpen = true;
    this.renderLightbox();
    document.body.style.overflow = 'hidden';
  },

  /**
   * Close lightbox
   */
  closeLightbox() {
    this.lightboxOpen = false;
    const lightbox = document.getElementById('vault-lightbox');
    if (lightbox) {
      lightbox.classList.remove('active');
      setTimeout(() => lightbox.remove(), 300);
    }
    document.body.style.overflow = '';
  },

  /**
   * Navigate lightbox
   */
  navigateLightbox(direction) {
    const newIndex = this.currentLightboxIndex + direction;
    if (newIndex >= 0 && newIndex < this.filteredItems.length) {
      this.currentLightboxIndex = newIndex;
      this.renderLightbox();
    }
  },

  /**
   * Render lightbox modal
   */
  renderLightbox() {
    const item = this.filteredItems[this.currentLightboxIndex];
    if (!item) return;

    const category = this.categories[item.category];
    
    let lightbox = document.getElementById('vault-lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'vault-lightbox';
      lightbox.className = 'vault-lightbox';
      document.body.appendChild(lightbox);
    }

    lightbox.innerHTML = `
      <div class="vault-lightbox-backdrop" onclick="VaultModule.closeLightbox()"></div>
      
      <button class="vault-lightbox-close" onclick="VaultModule.closeLightbox()">
        <i data-lucide="x" class="w-6 h-6"></i>
      </button>
      
      ${this.currentLightboxIndex > 0 ? `
        <button class="vault-lightbox-nav prev" onclick="VaultModule.navigateLightbox(-1)">
          <i data-lucide="chevron-left" class="w-8 h-8"></i>
        </button>
      ` : ''}
      
      ${this.currentLightboxIndex < this.filteredItems.length - 1 ? `
        <button class="vault-lightbox-nav next" onclick="VaultModule.navigateLightbox(1)">
          <i data-lucide="chevron-right" class="w-8 h-8"></i>
        </button>
      ` : ''}
      
      <div class="vault-lightbox-content">
        <div class="vault-lightbox-image-wrapper">
          <img src="${item.fullImage}" alt="${item.title}" class="vault-lightbox-image">
        </div>
        
        <div class="vault-lightbox-info">
          <div class="vault-lightbox-header">
            <span class="vault-lightbox-category" style="color: ${category.color}">
              <i data-lucide="${category.icon}" class="w-4 h-4"></i>
              ${category.name}
            </span>
            <span class="vault-lightbox-counter">${this.currentLightboxIndex + 1} / ${this.filteredItems.length}</span>
          </div>
          
          <h2 class="vault-lightbox-title">${item.title}</h2>
          <p class="vault-lightbox-description">${item.description}</p>
          
          <div class="vault-lightbox-meta">
            <div class="vault-lightbox-meta-item">
              <i data-lucide="calendar" class="w-4 h-4"></i>
              <span>${item.formattedDate}</span>
            </div>
            <div class="vault-lightbox-meta-item">
              <i data-lucide="map-pin" class="w-4 h-4"></i>
              <span>${item.location}</span>
            </div>
            <div class="vault-lightbox-meta-item">
              <i data-lucide="camera" class="w-4 h-4"></i>
              <span>${item.photographer}</span>
            </div>
            <div class="vault-lightbox-meta-item">
              <i data-lucide="users" class="w-4 h-4"></i>
              <span>${item.attendees} attendees</span>
            </div>
          </div>
          
          <div class="vault-lightbox-actions">
            <button class="btn btn-gold" onclick="VaultModule.downloadPhoto('${item.id}')">
              <i data-lucide="download" class="w-4 h-4"></i>
              Download Photo
            </button>
            <button class="btn btn-glass" onclick="VaultModule.sharePhoto('${item.id}')">
              <i data-lucide="share-2" class="w-4 h-4"></i>
              Share
            </button>
          </div>
        </div>
      </div>
    `;

    // Show lightbox
    requestAnimationFrame(() => {
      lightbox.classList.add('active');
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    });

    // Keyboard navigation
    const keyHandler = (e) => {
      if (!this.lightboxOpen) {
        document.removeEventListener('keydown', keyHandler);
        return;
      }
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
      if (e.key === 'ArrowRight') this.navigateLightbox(1);
    };
    document.addEventListener('keydown', keyHandler);
  },

  /**
   * Download photo (mock)
   */
  downloadPhoto(itemId) {
    const item = this.findItemById(itemId);
    if (!item) return;
    
    // Mock download
    const link = document.createElement('a');
    link.href = item.fullImage;
    link.download = `zbm-${item.year}-${item.id}.jpg`;
    link.target = '_blank';
    link.click();
    
    this.showToast('Download started', 'success');
  },

  /**
   * Share photo (mock)
   */
  sharePhoto(itemId) {
    const item = this.findItemById(itemId);
    if (!item) return;
    
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: `${item.title} - ${item.formattedDate}`,
        url: window.location.href
      });
    } else {
      // Copy to clipboard
      navigator.clipboard.writeText(`${item.title} - ${item.formattedDate}\n${window.location.href}`);
      this.showToast('Link copied to clipboard', 'success');
    }
  },

  /**
   * Find item by ID across all years
   */
  findItemById(itemId) {
    for (const year of this.years) {
      const item = this.galleryItems[year]?.find(i => i.id === itemId);
      if (item) return item;
    }
    return null;
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i data-lucide="${type === 'success' ? 'check-circle' : 'info'}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    setTimeout(() => {
      toast.style.animation = 'toast-out 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('vault-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }
  }
};

// Expose globally
window.VaultModule = VaultModule;
