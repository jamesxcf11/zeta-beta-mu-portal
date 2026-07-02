/**
 * Zeta Beta Mu Fraternity Portal
 * Album-Based Vault Module - Clean & Organized Photo Gallery
 */

const VaultModule = {
  // Officer-defined category list (fixed taxonomy; maps to a future
  // categories table maintained by officers, not free-form member tags)
  CATEGORIES: [
    'Charity Mission',
    'Annual Gala',
    'Induction',
    'Founders Day',
    'Research'
  ],

  // Sample vault images from the folder
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

  // Photo Albums
  albums: [
    {
      id: 'villa-maria-2025',
      isPublic: true,
      title: 'Annual Gift Giving 2025: Villa Maria Integrated School',
      description: 'ZBM fraternity members bringing joy and educational supplies to students at Villa Maria Integrated School. A heartwarming day of giving back to the community.',
      date: 'December 15, 2025',
      location: 'Villa Maria Integrated School',
      coverImage: 'sample vault/012ec369-ea52-42fc-912a-d1ef7504950a.jpg',
      category: 'Charity Mission',
      categoryIcon: 'heart-handshake',
      categoryColor: '#ef4444',
      photos: [
        { src: 'sample vault/012ec369-ea52-42fc-912a-d1ef7504950a.jpg', caption: 'Fraternity members arriving with gifts and supplies' },
        { src: 'sample vault/10cd9e8d-2106-42c5-996a-ba7b590fe852.jpg', caption: 'Distributing school supplies to eager students' },
        { src: 'sample vault/21f815ad-4772-4ed3-b327-9aa23fee294e.jpg', caption: 'Group photo with Villa Maria students and faculty' },
        { src: 'sample vault/28da8bc3-b009-46b1-a938-ff815d169cc3.jpg', caption: 'Interactive activities and games with the children' },
        { src: 'sample vault/2eaf4706-2fdd-47ba-ae98-a07b479269e6.jpg', caption: 'Setting up the donation station' },
        { src: 'sample vault/2f8a6a33-7bd4-4672-9cdf-3cd4449d616e.jpg', caption: 'Students receiving new backpacks' },
        { src: 'sample vault/47db4c7e-009a-4261-a8e2-d7a2f6f4eb55.jpg', caption: 'Reading session with the younger students' },
        { src: 'sample vault/5349e504-5814-469a-aac3-cd15565c51a8.jpg', caption: 'Fraternity brothers with school principal' },
        { src: 'sample vault/542a8380-fae7-4ae4-9372-3bd5c0c42c7f.jpg', caption: 'Organizing donated books for the library' },
        { src: 'sample vault/6525a973-34cf-40e0-b1e0-417e675d8d41.jpg', caption: 'Sports equipment distribution' },
        { src: 'sample vault/66ac2a3f-ed7a-44cc-9d5e-0db23b1b86d4.jpg', caption: 'Art supplies handover ceremony' },
        { src: 'sample vault/75e230e1-8c53-4397-ba14-b2606780ce41.jpg', caption: 'Students showcasing their new materials' },
        { src: 'sample vault/8ecbf87d-4371-4e5d-8f92-4976f4500daf.jpg', caption: 'Brotherhood members teaching basic first aid' },
        { src: 'sample vault/ac6376cd-926d-4cde-881b-8038f5c14a65.jpg', caption: 'Lunch break with the students' },
        { src: 'sample vault/be8869ff-3988-42f8-a3b4-8eff81a42ba2.jpg', caption: 'Musical performance by ZBM members' },
        { src: 'sample vault/c50e3c67-1e97-4271-a61e-5ca8cb63eaac.jpg', caption: 'Thank you ceremony from the students' },
        { src: 'sample vault/cc5273a3-24ce-414a-82dc-d54406d977bf.jpg', caption: 'Final group photo with all participants' },
        { src: 'sample vault/ceb34cb3-f492-4828-bfe2-628662bfad4f.jpg', caption: 'Packing up after a successful event' },
        { src: 'sample vault/e680bf91-375b-40e2-854f-096cb9170daf.jpg', caption: 'Students waving goodbye' },
        { src: 'sample vault/e74af5dd-cea2-40c6-a1f4-c7c00ad8d01f.jpg', caption: 'Commemorative plaque presentation' }
      ]
    },
    {
      id: 'annual-gala-2024',
      title: 'Annual Fraternity Gala 2024',
      description: 'A prestigious evening celebrating excellence in medicine with distinguished alumni, guest speakers, and awards ceremony.',
      date: 'November 20, 2024',
      location: 'The Grand Hotel Ballroom',
      coverImage: 'image/placeholders/photos/u-1511795409834-ef04bbd61622.jpg',
      category: 'Annual Gala',
      categoryIcon: 'party-popper',
      categoryColor: '#f59e0b',
      photos: [
        { src: 'image/placeholders/photos/u-1511795409834-ef04bbd61622.jpg', caption: 'Grand ballroom setup with elegant decorations' },
        { src: 'image/placeholders/photos/u-1519167758481-83f29da8c2b0.jpg', caption: 'Guests arriving at the red carpet entrance' },
        { src: 'image/placeholders/photos/u-1464366400600-7168b8af9bc3.jpg', caption: 'Opening remarks by the fraternity president' },
        { src: 'image/placeholders/photos/u-1478145046317-39f10e56b5e9.jpg', caption: 'Award presentation to distinguished alumni' },
        { src: 'image/placeholders/photos/u-1530103862676-de8c9debad1d.jpg', caption: 'Keynote speaker addressing the audience' },
        { src: 'image/placeholders/photos/u-1505236858219-8359eb29e329.jpg', caption: 'Formal dinner service' },
        { src: 'image/placeholders/photos/u-1519225421980-715cb0215aed.jpg', caption: 'Live orchestra performance' },
        { src: 'image/placeholders/photos/u-1492684223066-81342ee5ff30.jpg', caption: 'Dancing and celebration' }
      ]
    },
    {
      id: 'medical-mission-2024',
      title: 'Rural Medical Mission 2024',
      description: 'Providing essential healthcare services to underserved communities in remote areas, embodying our commitment to service.',
      date: 'August 10-12, 2024',
      location: 'Barangay San Isidro, Batangas',
      coverImage: 'image/placeholders/photos/u-1576091160399-112ba8d25d1d.jpg',
      category: 'Charity Mission',
      categoryIcon: 'heart-handshake',
      categoryColor: '#ef4444',
      photos: [
        { src: 'image/placeholders/photos/u-1576091160399-112ba8d25d1d.jpg', caption: 'Medical team setting up the clinic' },
        { src: 'image/placeholders/photos/u-1584982751601-97dcc096659c.jpg', caption: 'Free consultation and check-ups' },
        { src: 'image/placeholders/photos/u-1631815588090-d4bfec5b1ccb.jpg', caption: 'Distributing free medicines' },
        { src: 'image/placeholders/photos/u-1579684385127-1ef15d508118.jpg', caption: 'Dental services for children' },
        { src: 'image/placeholders/photos/u-1582750433449-648ed127bb54.jpg', caption: 'Health education seminar' },
        { src: 'image/placeholders/photos/u-1516549655169-df83a0774514.jpg', caption: 'Team photo with community members' }
      ]
    },
    {
      id: 'induction-ceremony-2024',
      title: 'New Member Induction Ceremony 2024',
      description: 'The sacred tradition of welcoming new brothers into the fraternity, complete with the oath and ceremonial regalia.',
      date: 'March 15, 2024',
      location: 'University Great Hall',
      coverImage: 'image/placeholders/photos/u-1523050854058-8df90110c9f1.jpg',
      category: 'Induction',
      categoryIcon: 'award',
      categoryColor: '#10b981',
      photos: [
        { src: 'image/placeholders/photos/u-1523050854058-8df90110c9f1.jpg', caption: 'Inductees taking the fraternity oath' },
        { src: 'image/placeholders/photos/u-1517486808906-6ca8b3f04846.jpg', caption: 'Ceremonial candle lighting' },
        { src: 'image/placeholders/photos/u-1541339907198-e08756dedf3f.jpg', caption: 'Presentation of fraternity pins' },
        { src: 'image/placeholders/photos/u-1524178232363-1fb2b075b655.jpg', caption: 'Senior members welcoming new brothers' },
        { src: 'image/placeholders/photos/u-1529070538774-1843cb3265df.jpg', caption: 'Group photo of the new batch' }
      ]
    },
    {
      id: 'founders-day-2023',
      title: 'Founders Day Commemoration 2023',
      description: 'Paying tribute to the visionary founders who established our fraternity in 1971, celebrating 52 years of brotherhood.',
      date: 'October 8, 2023',
      location: 'Fraternity Memorial Garden',
      coverImage: 'image/placeholders/photos/u-1511578314322-379afb476865.jpg',
      category: 'Founders Day',
      categoryIcon: 'crown',
      categoryColor: '#f97316',
      photos: [
        { src: 'image/placeholders/photos/u-1511578314322-379afb476865.jpg', caption: 'Wreath laying ceremony at founders monument' },
        { src: 'image/placeholders/photos/u-1475721027785-f74eccf877e2.jpg', caption: 'Historical photo exhibition' },
        { src: 'image/placeholders/photos/u-1556761175-4b46a572b786.jpg', caption: 'Founding members sharing stories' },
        { src: 'image/placeholders/photos/u-1515187029135-18ee286d815b.jpg', caption: 'Memorial service and prayer' },
        { src: 'image/placeholders/photos/u-1522071820081-009f0129c71c.jpg', caption: 'All generations of members together' }
      ]
    },
    {
      id: 'research-symposium-2023',
      title: 'Medical Research Symposium 2023',
      description: 'Presenting groundbreaking research findings and innovations in medical science to peers and mentors.',
      date: 'June 22, 2023',
      location: 'Medical School Auditorium',
      coverImage: 'image/placeholders/photos/u-1576091160550-2173dba999ef.jpg',
      category: 'Research',
      categoryIcon: 'microscope',
      categoryColor: '#14b8a6',
      photos: [
        { src: 'image/placeholders/photos/u-1576091160550-2173dba999ef.jpg', caption: 'Research presentation on stage' },
        { src: 'image/placeholders/photos/u-1532094349884-543bc11b234d.jpg', caption: 'Poster session and networking' },
        { src: 'image/placeholders/photos/u-1581093458791-9d42e1e4b8f3.jpg', caption: 'Panel discussion with experts' },
        { src: 'image/placeholders/photos/u-1582560475093-ba66accbc424.jpg', caption: 'Laboratory demonstrations' },
        { src: 'image/placeholders/photos/u-1581594549595-35f6edc7b762.jpg', caption: 'Award ceremony for best research' }
      ]
    }
  ],

  // State
  currentAlbum: null,
  currentPhotoIndex: 0,
  lightboxOpen: false,
  searchQuery: '',
  selectedCategory: 'all',
  selectedYear: 'all',
  sortBy: 'newest',
  yearDropdownOpen: false,
  officerView: false,  // Officer-only public/private controls (UI mock)

  /**
   * Initialize vault module
   */
  init() {
    this.applyRoleGating();
    this.renderFilters();
    this.populateUploadCategories();
    this.renderAlbumGrid();
    this.setupEventListeners();
    this.renderStats();
  },

  /**
   * Fill the upload modal's category select from the officer-defined list
   */
  populateUploadCategories() {
    const select = document.getElementById('upload-category');
    if (!select) return;
    select.innerHTML = this.CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  /**
   * Hide officer-only controls unless the session role is admin (UI-level gate)
   */
  applyRoleGating() {
    let isAdmin = false;
    try {
      const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      isAdmin = !!session && session.role === 'admin';
    } catch (e) { /* no session */ }
    if (!isAdmin) {
      const btn = document.getElementById('officer-view-btn');
      if (btn) btn.style.display = 'none';
    }
  },

  /**
   * Resolve a thumbnail URL for grid/cover usage (full-size stays for lightbox).
   * Local vault files map to the pre-generated thumbs folder; Unsplash URLs
   * get a smaller width parameter. Maps 1:1 to future R2 thumb keys.
   */
  thumb(src) {
    if (!src) return src;
    if (src.startsWith('sample vault/') && !src.includes('/thumbs/')) {
      return src.replace('sample vault/', 'sample vault/thumbs/');
    }
    if (src.startsWith('image/placeholders/photos/') && !src.includes('/thumbs/')) {
      return src.replace('image/placeholders/photos/', 'image/placeholders/photos/thumbs/');
    }
    return src.replace(/w=\d+/, 'w=400').replace(/h=\d+/, 'h=300');
  },

  /**
   * Approximate timestamp for an album (for sorting). Handles dates like
   * 'August 10-12, 2024' by falling back to month + year.
   */
  albumTime(album) {
    const direct = Date.parse(album.date);
    if (!isNaN(direct)) return direct;
    const month = (album.date.match(/^([A-Za-z]+)/) || [])[1];
    const year = (album.date.match(/(\d{4})/) || [])[1];
    if (month && year) {
      const t = Date.parse(`${month} 1, ${year}`);
      if (!isNaN(t)) return t;
    }
    return year ? Date.parse(`Jan 1, ${year}`) : 0;
  },

  /**
   * Years present in album data (descending), derived instead of hard-coded
   */
  availableYears() {
    const years = new Set();
    this.albums.forEach(a => {
      const y = (a.date.match(/(\d{4})/) || [])[1];
      if (y) years.add(y);
    });
    return [...years].sort((a, b) => b - a);
  },

  /**
   * Render category chips (with counts) and sort control
   */
  renderFilters() {
    const container = document.getElementById('vault-filters');
    if (!container) return;

    const counts = {};
    this.albums.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });

    const chips = [
      `<button class="filter-chip ${this.selectedCategory === 'all' ? 'active' : ''}" onclick="VaultModule.filterByCategory('all')">All <span class="chip-count">${this.albums.length}</span></button>`,
      ...this.CATEGORIES.map(cat =>
        `<button class="filter-chip ${this.selectedCategory === cat ? 'active' : ''}" onclick="VaultModule.filterByCategory('${cat.replace(/'/g, "\\'")}')">${cat} <span class="chip-count">${counts[cat] || 0}</span></button>`
      )
    ].join('');

    container.innerHTML = `
      <div class="vault-filter-chips">${chips}</div>
      <div class="vault-sort">
        <label for="vault-sort-select" class="vault-sort-label">Sort</label>
        <select id="vault-sort-select" class="glass-input vault-sort-select" onchange="VaultModule.setSort(this.value)">
          <option value="newest" ${this.sortBy === 'newest' ? 'selected' : ''}>Newest first</option>
          <option value="oldest" ${this.sortBy === 'oldest' ? 'selected' : ''}>Oldest first</option>
          <option value="photos" ${this.sortBy === 'photos' ? 'selected' : ''}>Most photos</option>
        </select>
      </div>
    `;
  },

  filterByCategory(category) {
    this.selectedCategory = category;
    this.renderFilters();
    this.renderAlbumGrid();
  },

  setSort(value) {
    this.sortBy = value;
    this.renderAlbumGrid();
  },

  /**
   * Render album grid
   */
  renderAlbumGrid() {
    const gallery = document.getElementById('vault-gallery');
    if (!gallery) return;

    let filteredAlbums = this.albums;

    // Apply year filter
    if (this.selectedYear !== 'all') {
      filteredAlbums = filteredAlbums.filter(album => 
        album.date.includes(this.selectedYear)
      );
    }

    // Apply category filter
    if (this.selectedCategory !== 'all') {
      filteredAlbums = filteredAlbums.filter(album => 
        album.category.toLowerCase() === this.selectedCategory.toLowerCase()
      );
    }

    // Apply search filter (title, description, location, category, captions, tags)
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filteredAlbums = filteredAlbums.filter(album =>
        album.title.toLowerCase().includes(query) ||
        album.description.toLowerCase().includes(query) ||
        album.location.toLowerCase().includes(query) ||
        album.category.toLowerCase().includes(query) ||
        (album.tags || []).some(t => t.toLowerCase().includes(query)) ||
        album.photos.some(p => (p.caption || '').toLowerCase().includes(query))
      );
    }

    // Apply sort
    filteredAlbums = [...filteredAlbums].sort((a, b) => {
      if (this.sortBy === 'oldest') return this.albumTime(a) - this.albumTime(b);
      if (this.sortBy === 'photos') return b.photos.length - a.photos.length;
      return this.albumTime(b) - this.albumTime(a);
    });

    if (filteredAlbums.length === 0) {
      gallery.innerHTML = `
        <div class="vault-empty-state">
          <i data-lucide="image-off" class="w-16 h-16 text-[#d4af37] opacity-50"></i>
          <h3 class="text-xl font-semibold mt-4">No albums found</h3>
          <p class="text-sm opacity-70 mt-2">Try adjusting your filters or search query</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    gallery.innerHTML = filteredAlbums.map(album => {
      const isPublic = album.isPublic === true;
      const likes = album.likes != null ? album.likes : album.photos.length * 7;
      const comments = album.comments != null ? album.comments : album.photos.length * 2;
      const visBadge = isPublic
        ? `<span class="album-visibility album-visibility-public"><i data-lucide="globe" class="w-3 h-3"></i> Public</span>`
        : `<span class="album-visibility album-visibility-private"><i data-lucide="lock" class="w-3 h-3"></i> Members</span>`;
      const officerToggle = this.officerView
        ? `<button class="album-vis-toggle" onclick="VaultModule.toggleAlbumVisibility('${album.id}', event)" title="Officer: toggle public viewing">
             <i data-lucide="${isPublic ? 'eye' : 'eye-off'}" class="w-3 h-3"></i>
             ${isPublic ? 'Set Private' : 'Make Public'}
           </button>`
        : '';
      return `
      <div class="album-card glass-card" onclick="VaultModule.openAlbum('${album.id}')">
        <div class="album-cover">
          <img src="${this.thumb(album.coverImage)}" alt="${album.title}" class="album-cover-image" loading="lazy" decoding="async">
          <div class="album-cover-badges">${visBadge}</div>
          <div class="album-overlay">
            <div class="album-photo-count">
              <i data-lucide="images" class="w-5 h-5"></i>
              <span>${album.photos.length} photos</span>
            </div>
          </div>
        </div>
        <div class="album-info">
          <div class="album-category" style="color: ${album.categoryColor}">
            <i data-lucide="${album.categoryIcon}" class="w-4 h-4"></i>
            <span>${album.category}</span>
          </div>
          <h3 class="album-title">${album.title}</h3>
          <div class="album-meta">
            <span class="album-date">
              <i data-lucide="calendar" class="w-3 h-3"></i>
              ${album.date}
            </span>
            <span class="album-location">
              <i data-lucide="map-pin" class="w-3 h-3"></i>
              ${album.location}
            </span>
          </div>
          <div class="album-engagement">
            <span><i data-lucide="heart" class="w-3 h-3"></i> ${likes}</span>
            <span><i data-lucide="message-circle" class="w-3 h-3"></i> ${comments}</span>
            ${officerToggle}
          </div>
        </div>
      </div>
    `;
    }).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Toggle officer view (shows per-album public/private controls) - UI mock
   */
  toggleOfficerView() {
    this.officerView = !this.officerView;
    const btn = document.getElementById('officer-view-btn');
    if (btn) btn.classList.toggle('active', this.officerView);
    const panel = document.getElementById('officer-approval-panel');
    if (panel) panel.style.display = this.officerView ? 'block' : 'none';
    this.renderAlbumGrid();
  },

  /**
   * Toggle an album's public/private visibility (officer-only) - UI mock
   */
  toggleAlbumVisibility(albumId, event) {
    if (event) event.stopPropagation();
    const album = this.albums.find(a => a.id === albumId);
    if (!album) return;
    album.isPublic = !album.isPublic;
    this.renderAlbumGrid();
  },

  /**
   * Open the upload modal (UI mock)
   */
  openUploadModal() {
    const modal = document.getElementById('vault-upload-modal');
    if (modal) modal.classList.remove('hidden');
  },

  closeUploadModal() {
    const modal = document.getElementById('vault-upload-modal');
    if (modal) modal.classList.add('hidden');
  },

  /**
   * Open album view
   */
  openAlbum(albumId) {
    const album = this.albums.find(a => a.id === albumId);
    if (!album) return;

    this.currentAlbum = album;
    this.renderAlbumView();
  },

  /**
   * Render album view
   */
  renderAlbumView() {
    const gallery = document.getElementById('vault-gallery');
    if (!gallery || !this.currentAlbum) return;

    const related = this.albums
      .filter(a => a.id !== this.currentAlbum.id && a.category === this.currentAlbum.category)
      .slice(0, 3);

    let html = `
      <nav class="vault-breadcrumb">
        <a href="#" onclick="VaultModule.closeAlbum(); return false;">Vault</a>
        <span class="vault-breadcrumb-sep">/</span>
        <a href="#" onclick="VaultModule.filterByCategory('${this.currentAlbum.category.replace(/'/g, "\\'")}'); VaultModule.closeAlbum(); return false;">${this.currentAlbum.category}</a>
        <span class="vault-breadcrumb-sep">/</span>
        <span class="vault-breadcrumb-current">${this.currentAlbum.title}</span>
      </nav>
      <div class="album-hero-card album-hero-clickable" onclick="VaultModule.closeAlbum()">
        <div class="album-hero-badge" style="color: ${this.currentAlbum.categoryColor}">
          <i data-lucide="${this.currentAlbum.categoryIcon}" class="w-4 h-4"></i>
          ${this.currentAlbum.category}
        </div>
        <h1 class="album-hero-title">${this.currentAlbum.title}</h1>
        <p class="album-hero-desc">${this.currentAlbum.description}</p>
        <div class="album-hero-info">
          <span><i data-lucide="calendar" class="w-4 h-4"></i> ${this.currentAlbum.date}</span>
          <span><i data-lucide="map-pin" class="w-4 h-4"></i> ${this.currentAlbum.location}</span>
          <span><i data-lucide="images" class="w-4 h-4"></i> ${this.currentAlbum.photos.length} photos</span>
        </div>
      </div>

      <div class="album-grid-container">
        ${this.currentAlbum.photos.map((photo, index) => `
          <div class="album-grid-item" onclick="VaultModule.openLightbox(${index})">
            <img src="${this.thumb(photo.src)}" alt="${photo.caption}" class="album-grid-img" loading="lazy" decoding="async">
            <div class="album-grid-overlay">
              <i data-lucide="maximize-2" class="w-6 h-6"></i>
            </div>
            <div class="album-grid-label">${photo.caption}</div>
          </div>
        `).join('')}
      </div>

      ${related.length > 0 ? `
        <div class="vault-related">
          <h3 class="vault-related-title">More from ${this.currentAlbum.category}</h3>
          <div class="vault-related-row">
            ${related.map(a => `
              <div class="vault-related-card glass-card" onclick="VaultModule.openAlbum('${a.id}')">
                <img src="${this.thumb(a.coverImage)}" alt="${a.title}" loading="lazy" decoding="async">
                <div class="vault-related-info">
                  <span class="vault-related-name">${a.title}</span>
                  <span class="vault-related-date">${a.date}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    gallery.innerHTML = html;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Close album view
   */
  closeAlbum() {
    this.currentAlbum = null;
    this.renderAlbumGrid();
  },

  /**
   * Open lightbox
   */
  openLightbox(index) {
    if (!this.currentAlbum) return;
    
    this.currentPhotoIndex = index;
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
    if (!this.currentAlbum) return;
    
    const newIndex = this.currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < this.currentAlbum.photos.length) {
      this.currentPhotoIndex = newIndex;
      this.renderLightbox();
    }
  },

  /**
   * Render lightbox
   */
  renderLightbox() {
    if (!this.currentAlbum) return;
    
    const photo = this.currentAlbum.photos[this.currentPhotoIndex];
    
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
      
      ${this.currentPhotoIndex > 0 ? `
        <button class="vault-lightbox-nav prev" onclick="VaultModule.navigateLightbox(-1)">
          <i data-lucide="chevron-left" class="w-8 h-8"></i>
        </button>
      ` : ''}
      
      ${this.currentPhotoIndex < this.currentAlbum.photos.length - 1 ? `
        <button class="vault-lightbox-nav next" onclick="VaultModule.navigateLightbox(1)">
          <i data-lucide="chevron-right" class="w-8 h-8"></i>
        </button>
      ` : ''}
      
      <div class="vault-lightbox-content">
        <div class="vault-lightbox-image-wrapper">
          <img src="${photo.src}" alt="${photo.caption}" class="vault-lightbox-image">
        </div>
        
        <div class="vault-lightbox-info">
          <div class="vault-lightbox-header">
            <h3 class="vault-lightbox-title">${this.currentAlbum.title}</h3>
            <span class="vault-lightbox-counter">${this.currentPhotoIndex + 1} / ${this.currentAlbum.photos.length}</span>
          </div>
          <p class="vault-lightbox-caption">${photo.caption}</p>
          <div class="vault-lightbox-meta">
            <span><i data-lucide="calendar" class="w-4 h-4"></i> ${this.currentAlbum.date}</span>
            <span><i data-lucide="map-pin" class="w-4 h-4"></i> ${this.currentAlbum.location}</span>
          </div>
        </div>
      </div>
    `;

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
   * Render statistics
   */
  renderStats() {
    const statsContainer = document.getElementById('vault-stats');
    if (!statsContainer) return;

    const totalPhotos = this.albums.reduce((sum, album) => sum + album.photos.length, 0);

    statsContainer.innerHTML = `
      <div class="vault-stat vault-stat-clickable" onclick="VaultModule.closeAlbum()">
        <i data-lucide="folder" class="w-6 h-6 text-[#d4af37]"></i>
        <div>
          <span class="vault-stat-value">${this.albums.length}</span>
          <span class="vault-stat-label">Albums</span>
        </div>
      </div>
      <div class="vault-stat vault-stat-clickable" onclick="VaultModule.showAllPhotos()">
        <i data-lucide="images" class="w-6 h-6 text-[#d4af37]"></i>
        <div>
          <span class="vault-stat-value">${totalPhotos}</span>
          <span class="vault-stat-label">Show All Photos</span>
        </div>
      </div>
      <div class="yd-wrapper">
        <button class="yd-trigger" onclick="VaultModule.toggleYearDropdown(event)">
          <i data-lucide="calendar" class="w-6 h-6 text-[#d4af37]"></i>
          <div>
            <span class="vault-stat-value">${this.selectedYear === 'all' ? (() => { const ys = this.availableYears(); return ys.length ? ys[ys.length - 1] + '-' + ys[0] : 'All'; })() : this.selectedYear}</span>
            <span class="vault-stat-label">Year Filter</span>
          </div>
          <i data-lucide="chevron-down" class="w-4 h-4 yd-chevron ${this.yearDropdownOpen ? 'yd-chevron-open' : ''}"></i>
        </button>
        <div class="yd-menu ${this.yearDropdownOpen ? 'yd-menu-open' : ''}">
          <button class="yd-item ${this.selectedYear === 'all' ? 'yd-item-active' : ''}" onclick="VaultModule.filterByYear('all');" style="--i:0">
            <i data-lucide="layers" class="w-4 h-4"></i> All Years
          </button>
          ${this.availableYears().map((year, i) => `
            <button class="yd-item ${this.selectedYear === year ? 'yd-item-active' : ''}" onclick="VaultModule.filterByYear('${year}');" style="--i:${i + 1}">
              <i data-lucide="calendar" class="w-4 h-4"></i> ${year}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Show all photos from all albums
   */
  showAllPhotos() {
    // Collect all photos from all albums
    const allPhotos = [];
    this.albums.forEach(album => {
      album.photos.forEach(photo => {
        allPhotos.push({
          ...photo,
          albumTitle: album.title,
          albumDate: album.date
        });
      });
    });

    // Create a virtual "All Photos" album
    this.currentAlbum = {
      id: 'all-photos',
      title: 'All Photos',
      description: 'Complete photo archive from all albums across the years',
      date: '2023-2025',
      location: 'Various Locations',
      category: 'Archive',
      categoryIcon: 'images',
      categoryColor: '#d4af37',
      photos: allPhotos
    };

    this.renderAlbumView();
  },

  /**
   * Filter albums by year
   */
  filterByYear(year) {
    this.selectedYear = year;
    this.yearDropdownOpen = false;
    
    // Hide dropdown
    const dropdown = document.getElementById('year-dropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
    }

    // Re-render stats and albums
    this.renderStats();
    this.renderAlbumGrid();
  },

  /**
   * Toggle year dropdown
   */
  toggleYearDropdown(event) {
    event.stopPropagation();
    this.yearDropdownOpen = !this.yearDropdownOpen;
    const menu = document.querySelector('.yd-menu');
    const chevron = document.querySelector('.yd-chevron');
    if (menu) menu.classList.toggle('yd-menu-open', this.yearDropdownOpen);
    if (chevron) chevron.classList.toggle('yd-chevron-open', this.yearDropdownOpen);
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const searchInput = document.getElementById('vault-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderAlbumGrid();
      });
    }

    // Close year dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.yd-wrapper') && this.yearDropdownOpen) {
        this.yearDropdownOpen = false;
        const menu = document.querySelector('.yd-menu');
        const chevron = document.querySelector('.yd-chevron');
        if (menu) menu.classList.remove('yd-menu-open');
        if (chevron) chevron.classList.remove('yd-chevron-open');
      }
    });
  }
};

// Expose globally
window.VaultModule = VaultModule;
