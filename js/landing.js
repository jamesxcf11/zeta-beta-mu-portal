/**
 * Zeta Beta Mu Fraternity Portal
 * Landing Page Module
 * 
 * Handles the public landing page interactivity:
 * - Sticky navbar show/hide on scroll
 * - Mobile menu toggle
 * - Public vault gallery rendering
 */

const LandingModule = {
  // Photo albums (like Facebook albums - each album contains multiple photos)
  albums: [
    {
      id: 1,
      title: 'Annual Fraternity Gala 2025',
      category: 'Annual Gala',
      year: 2025,
      location: 'The Grand Hotel Ballroom',
      tags: ['sociability', 'yearender', 'gala', 'party'],
      coverImage: 'sample vault/012ec369-ea52-42fc-912a-d1ef7504950a.jpg',
      photoCount: 5,
      photos: [
        'sample vault/012ec369-ea52-42fc-912a-d1ef7504950a.jpg',
        'sample vault/10cd9e8d-2106-42c5-996a-ba7b590fe852.jpg',
        'sample vault/21f815ad-4772-4ed3-b327-9aa23fee294e.jpg',
        'sample vault/28da8bc3-b009-46b1-a938-ff815d169cc3.jpg',
        'sample vault/2eaf4706-2fdd-47ba-ae98-a07b479269e6.jpg'
      ]
    },
    {
      id: 2,
      title: 'New Member Induction Ceremony',
      category: 'Induction',
      year: 2024,
      location: 'University Great Hall',
      tags: ['induction', 'brotherhood'],
      coverImage: 'sample vault/2f8a6a33-7bd4-4672-9cdf-3cd4449d616e.jpg',
      photoCount: 4,
      photos: [
        'sample vault/2f8a6a33-7bd4-4672-9cdf-3cd4449d616e.jpg',
        'sample vault/47db4c7e-009a-4261-a8e2-d7a2f6f4eb55.jpg',
        'sample vault/5349e504-5814-469a-aac3-cd15565c51a8.jpg',
        'sample vault/542a8380-fae7-4ae4-9372-3bd5c0c42c7f.jpg'
      ]
    },
    {
      id: 3,
      title: 'Medical Research Symposium',
      category: 'Conference',
      year: 2025,
      location: 'Medical School Auditorium',
      tags: ['scholarship', 'revalida', 'ple', 'board', 'research', 'conference'],
      coverImage: 'sample vault/6525a973-34cf-40e0-b1e0-417e675d8d41.jpg',
      photoCount: 3,
      photos: [
        'sample vault/6525a973-34cf-40e0-b1e0-417e675d8d41.jpg',
        'sample vault/66ac2a3f-ed7a-44cc-9d5e-0db23b1b86d4.jpg',
        'sample vault/75e230e1-8c53-4397-ba14-b2606780ce41.jpg'
      ]
    },
    {
      id: 4,
      title: 'Alumni Reunion Weekend',
      category: 'Reunion',
      year: 2024,
      location: 'Fraternity House & Campus',
      tags: ['sociability', 'backtoschool', 'hangout', 'reunion'],
      coverImage: 'sample vault/8ecbf87d-4371-4e5d-8f92-4976f4500daf.jpg',
      photoCount: 4,
      photos: [
        'sample vault/8ecbf87d-4371-4e5d-8f92-4976f4500daf.jpg',
        'sample vault/ac6376cd-926d-4cde-881b-8038f5c14a65.jpg',
        'sample vault/be8869ff-3988-42f8-a3b4-8eff81a42ba2.jpg',
        'sample vault/c50e3c67-1e97-4271-a61e-5ca8cb63eaac.jpg'
      ]
    },
    {
      id: 5,
      title: 'Charity Medical Mission',
      category: 'Charity',
      year: 2023,
      location: 'Porac, Pampanga',
      tags: ['service', 'porac', 'villamaria', 'mission', 'outreach', 'charity'],
      coverImage: 'sample vault/cc5273a3-24ce-414a-82dc-d54406d977bf.jpg',
      photoCount: 4,
      photos: [
        'sample vault/cc5273a3-24ce-414a-82dc-d54406d977bf.jpg',
        'sample vault/ceb34cb3-f492-4828-bfe2-628662bfad4f.jpg',
        'sample vault/e680bf91-375b-40e2-854f-096cb9170daf.jpg',
        'sample vault/e74af5dd-cea2-40c6-a1f4-c7c00ad8d01f.jpg'
      ]
    },
    {
      id: 6,
      title: 'Founders Day Celebration',
      category: 'Founders Day',
      year: 2024,
      location: 'Fraternity Memorial Garden',
      tags: ['founders', 'tradition'],
      coverImage: 'sample vault/47db4c7e-009a-4261-a8e2-d7a2f6f4eb55.jpg',
      photoCount: 3,
      photos: [
        'sample vault/47db4c7e-009a-4261-a8e2-d7a2f6f4eb55.jpg',
        'sample vault/75e230e1-8c53-4397-ba14-b2606780ce41.jpg',
        'sample vault/e74af5dd-cea2-40c6-a1f4-c7c00ad8d01f.jpg'
      ]
    },
    {
      id: 7,
      title: 'White Coat Ceremony',
      category: 'Induction',
      year: 2023,
      location: 'University Chapel',
      tags: ['scholarship', 'induction'],
      coverImage: 'sample vault/ac6376cd-926d-4cde-881b-8038f5c14a65.jpg',
      photoCount: 4,
      photos: [
        'sample vault/ac6376cd-926d-4cde-881b-8038f5c14a65.jpg',
        'sample vault/be8869ff-3988-42f8-a3b4-8eff81a42ba2.jpg',
        'sample vault/c50e3c67-1e97-4271-a61e-5ca8cb63eaac.jpg',
        'sample vault/e680bf91-375b-40e2-854f-096cb9170daf.jpg'
      ]
    },
    {
      id: 8,
      title: 'Community Health Fair',
      category: 'Community Service',
      year: 2023,
      location: 'Porac, Pampanga',
      tags: ['service', 'porac', 'villamaria', 'outreach'],
      coverImage: 'sample vault/ceb34cb3-f492-4828-bfe2-628662bfad4f.jpg',
      photoCount: 3,
      photos: [
        'sample vault/66ac2a3f-ed7a-44cc-9d5e-0db23b1b86d4.jpg',
        'sample vault/ceb34cb3-f492-4828-bfe2-628662bfad4f.jpg',
        'sample vault/10cd9e8d-2106-42c5-996a-ba7b590fe852.jpg'
      ]
    }
  ],

  // Archive albums (older albums shown after clicking "See More")
  archiveAlbums: [
    {
      id: 9,
      title: 'Legacy Gala 2020',
      category: 'Annual Gala',
      year: 2020,
      location: 'Grand Ballroom',
      coverImage: 'sample vault/5349e504-5814-469a-aac3-cd15565c51a8.jpg',
      photoCount: 4,
      photos: [
        'sample vault/5349e504-5814-469a-aac3-cd15565c51a8.jpg',
        'sample vault/542a8380-fae7-4ae4-9372-3bd5c0c42c7f.jpg',
        'sample vault/28da8bc3-b009-46b1-a938-ff815d169cc3.jpg',
        'sample vault/2eaf4706-2fdd-47ba-ae98-a07b479269e6.jpg'
      ]
    }
  ],

  // Lightbox state
  lightboxOpen: false,
  currentAlbum: null,
  currentPhotoIndex: 0,

  // Gallery expansion state
  showArchive: false,
  pillarViewerExpanded: false,
  pillarViewerPhotos: [],
  aboutVaultAlbums: [],
  aboutVaultSelectedYear: 'all',
  aboutVaultShowAll: false,

  /**
   * Initialize landing page
   */
  init() {
    this.setupStickyNavbar();
    this.setupNavDropdown();
    this.renderPublicGallery();
    this.initPillarVaultViewer();
    this.initAboutVaultGallery();
    this.setupAboutAnimations();
    this.setupScrollReveal();
  },

  /**
   * Initialize the About Us page "Through the Years" Vault Gallery.
   * Pulls approved public albums/photos from Supabase (editable by officers/admins)
   * or falls back to curated historical albums sorted by year.
   */
  async initAboutVaultGallery() {
    const galleryEl = document.getElementById('about-vault-gallery');
    if (!galleryEl) return;

    // Seed with curated albums across the years first for instant rendering
    const baseAlbums = [...this.albums, ...this.archiveAlbums]
      .map(a => ({ ...a }))
      .sort((a, b) => (b.year || 0) - (a.year || 0));

    this.aboutVaultAlbums = baseAlbums;
    this.renderAboutVaultYears();
    this.renderAboutVaultGallery();

    // Query live approved public vault_items from Supabase so officer/admin edits reflect automatically
    const hasSupabase = typeof db !== 'undefined' && db &&
      typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');

    if (hasSupabase) {
      try {
        const { data, error } = await db
          .from('vault_items')
          .select('id, album_id, year, title, caption, media_url, thumbnail_url, category, location, is_public')
          .eq('approval_status', 'approved')
          .eq('is_public', true)
          .is('deleted_at', null)
          .order('year', { ascending: true })
          .order('id', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const albumMap = {};
          data.forEach(item => {
            if (!item.media_url) return;
            const key = item.album_id || `album-${item.year}-${item.title}`;
            if (!albumMap[key]) {
              albumMap[key] = {
                id: key,
                title: item.title || `Fraternity Archive ${item.year}`,
                category: item.category || 'Archive',
                year: item.year || 1971,
                location: item.location || 'University of Santo Tomas',
                coverImage: item.thumbnail_url || item.media_url,
                photoCount: 0,
                photos: []
              };
            }
            albumMap[key].photos.push(item.media_url);
            albumMap[key].photoCount = albumMap[key].photos.length;
          });
          const liveAlbums = Object.values(albumMap).sort((a, b) => (b.year || 0) - (a.year || 0));
          if (liveAlbums.length > 0) {
            this.aboutVaultAlbums = liveAlbums;
            this.renderAboutVaultYears();
            this.renderAboutVaultGallery();
          }
        }
      } catch (err) {
        // Keep baseAlbums fallback
      }
    }
  },

  renderAboutVaultYears() {
    const yearsEl = document.getElementById('about-vault-years');
    if (!yearsEl) return;

    const years = [...new Set(this.aboutVaultAlbums.map(a => a.year).filter(Boolean))].sort((a, b) => b - a);
    const e = (s) => this.escapeHTML(s);

    const selected = this.aboutVaultSelectedYear;
    const isAll = selected === 'all';
    const open = !!this.aboutVaultYearMenuOpen;
    const option = (value, label, count) => {
      const active = String(selected) === String(value);
      return `<button type="button" role="option" aria-selected="${active}" class="about-vault-year-option ${active ? 'active' : ''}" onclick="LandingModule.filterAboutVaultByYear('${e(value)}')"><span>${label}</span><span class="about-vault-year-count">${count}</span></button>`;
    };

    yearsEl.innerHTML = `
      <div class="about-vault-dropdown ${open ? 'open' : ''}">
        <button type="button" class="about-vault-year-chip about-vault-year-trigger ${isAll ? '' : 'active'}" aria-haspopup="listbox" aria-expanded="${open}" onclick="LandingModule.toggleAboutVaultYearMenu(event)">
          <i data-lucide="calendar" class="w-4 h-4"></i>
          <span>${isAll ? 'All Years' : e(selected)}</span>
          <i data-lucide="chevron-down" class="w-4 h-4 about-vault-chevron"></i>
        </button>
        <div class="about-vault-year-menu" role="listbox" aria-label="Filter albums by year">
          ${option('all', 'All Years', this.aboutVaultAlbums.length)}
          ${years.map(y => option(y, e(y), this.aboutVaultAlbums.filter(a => a.year === y).length)).join('')}
        </div>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  toggleAboutVaultYearMenu(event) {
    if (event) event.stopPropagation();
    this.aboutVaultYearMenuOpen = !this.aboutVaultYearMenuOpen;
    if (!this.aboutVaultYearMenuBound) {
      this.aboutVaultYearMenuBound = true;
      const close = () => {
        if (!this.aboutVaultYearMenuOpen) return;
        this.aboutVaultYearMenuOpen = false;
        this.renderAboutVaultYears();
      };
      document.addEventListener('click', (ev) => {
        if (!ev.target.closest('.about-vault-dropdown')) close();
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') close();
      });
    }
    this.renderAboutVaultYears();
  },

  filterAboutVaultByYear(year) {
    this.aboutVaultSelectedYear = year;
    this.aboutVaultShowAll = false;
    this.aboutVaultYearMenuOpen = false;
    this.renderAboutVaultYears();
    this.renderAboutVaultGallery();
  },

  toggleAboutVaultShowAll() {
    this.aboutVaultShowAll = !this.aboutVaultShowAll;
    this.renderAboutVaultGallery();
  },

  openAboutVaultAlbum(albumIdx) {
    const filtered = this.getFilteredAboutVaultAlbums();
    const album = filtered[albumIdx];
    if (!album) return;
    this.currentAlbum = album;
    this.currentPhotoIndex = 0;
    this.lightboxOpen = true;
    this.isInitialOpen = true;
    this.renderLightbox();
    document.body.style.overflow = 'hidden';
  },

  getFilteredAboutVaultAlbums() {
    if (this.aboutVaultSelectedYear === 'all') {
      return this.aboutVaultAlbums;
    }
    return this.aboutVaultAlbums.filter(a => String(a.year) === String(this.aboutVaultSelectedYear));
  },

  renderAboutVaultGallery() {
    const container = document.getElementById('about-vault-gallery');
    if (!container) return;

    const filtered = this.getFilteredAboutVaultAlbums();
    const limit = 8;
    const visible = this.aboutVaultShowAll ? filtered : filtered.slice(0, limit);
    const e = (s) => this.escapeHTML(s);

    let html = visible.map((album, idx) => `
      <div class="landing-gallery-card glass-card" onclick="LandingModule.openAboutVaultAlbum(${idx})" style="cursor: pointer;">
        <div class="landing-gallery-image-wrapper">
          <img src="${e(album.coverImage)}" alt="${e(album.title)}" loading="lazy">
          <div class="landing-gallery-overlay">
            <span class="landing-gallery-category">${e(album.year)} &middot; ${e(album.category)}</span>
          </div>
          <div class="album-photo-count">
            <i data-lucide="images" class="w-4 h-4"></i>
            <span>${album.photoCount} photos</span>
          </div>
        </div>
        <div class="landing-gallery-info">
          <h3>${e(album.title)}</h3>
          <p>
            <i data-lucide="map-pin" class="w-3 h-3"></i>
            ${e(album.location)} &middot; ${e(album.year)}
          </p>
        </div>
      </div>
    `).join('');

    if (filtered.length > limit) {
      html += `
        <div class="gallery-see-more-wrapper">
          <button class="btn btn-outline-gold gallery-see-more-btn" onclick="LandingModule.toggleAboutVaultShowAll()">
            <i data-lucide="${this.aboutVaultShowAll ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4"></i>
            <span>${this.aboutVaultShowAll ? 'Show Less' : `See More (${filtered.length - limit} more)`}</span>
          </button>
        </div>
      `;
    }

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Initialize the Embedded Vault Viewer on dedicated Pillar pages.
   * Dynamically filters public approved vault items by the page's
   * data-vault-tags and caps initial display at data-vault-limit (default 6).
   */
  async initPillarVaultViewer() {
    const container = document.querySelector('[data-vault-viewer]');
    if (!container) return;

    const rawTags = container.getAttribute('data-vault-tags') || '';
    const targetTags = rawTags
      .split(/[\s,]+/)
      .map(t => t.trim().replace(/^#+/, '').toLowerCase())
      .filter(Boolean);
    const limit = parseInt(container.getAttribute('data-vault-limit') || '6', 10) || 6;
    const pillarName = container.getAttribute('data-vault-pillar') || 'Pillar';

    // Collect existing static fallback photos already rendered in the container
    const fallbackImgs = Array.from(container.querySelectorAll('img')).map(img => ({
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt') || `${pillarName} photo`,
      title: `${pillarName.charAt(0).toUpperCase() + pillarName.slice(1)} Archive`,
      year: 2025,
      location: 'University of Santo Tomas',
      tags: targetTags.slice(0, 2)
    })).filter(p => p.src);

    // Render initial fallback photos immediately (no async flash)
    this.pillarViewerPhotos = fallbackImgs;
    this.pillarViewerLimit = limit;
    this.pillarViewerTitle = `${pillarName.charAt(0).toUpperCase() + pillarName.slice(1)} Vault`;
    this.renderPillarVaultViewer();

    let matchedPhotos = [];

    // Query live public approved vault_items when Supabase is configured
    const hasSupabase = typeof db !== 'undefined' && db &&
      typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');

    if (hasSupabase && targetTags.length > 0) {
      try {
        const { data, error } = await db
          .from('vault_items')
          .select('id, year, title, caption, media_url, thumbnail_url, category, location, is_public')
          .eq('approval_status', 'approved')
          .eq('is_public', true)
          .is('deleted_at', null)
          .order('year', { ascending: false })
          .limit(48);

        if (!error && Array.isArray(data) && data.length > 0) {
          data.forEach(item => {
            const captionTags = ((item.caption || '').match(/#([a-zA-Z0-9_-]+)/g) || [])
              .map(t => t.replace(/^#+/, '').toLowerCase());
            const hay = `${item.title || ''} ${item.caption || ''} ${item.category || ''} ${item.location || ''}`.toLowerCase();
            const isMatch = targetTags.some(tag =>
              captionTags.includes(tag) || hay.includes(tag)
            );
            if (isMatch && item.media_url) {
              matchedPhotos.push({
                src: item.media_url,
                thumb: item.thumbnail_url || item.media_url,
                alt: item.title || `${pillarName} photo`,
                title: item.title || `${pillarName} Archive`,
                year: item.year || '',
                location: item.location || 'UST',
                tags: captionTags.length ? captionTags : targetTags.slice(0, 2)
              });
            }
          });
        }
      } catch (err) {
        // Keep initial fallback photos
      }
    }

    if (matchedPhotos.length > 0) {
      this.pillarViewerPhotos = matchedPhotos;
      this.renderPillarVaultViewer();
    }
  },

  /**
   * Render the Embedded Pillar Vault Viewer with max-photo limit (6 per page) and lightbox click
   */
  renderPillarVaultViewer() {
    const container = document.querySelector('[data-vault-viewer]');
    if (!container || !this.pillarViewerPhotos.length) return;

    const limit = this.pillarViewerLimit || 6;
    const visiblePhotos = this.pillarViewerExpanded
      ? this.pillarViewerPhotos
      : this.pillarViewerPhotos.slice(0, limit);
    const e = (s) => this.escapeHTML(s);

    let html = visiblePhotos.map((photo, index) => `
      <div class="glass-card overflow-hidden pillar-vault-card" onclick="LandingModule.openPillarPhoto(${index})">
        <img src="${e(photo.thumb || photo.src)}" alt="${e(photo.alt)}" class="w-full h-56 object-cover" loading="lazy">
      </div>
    `).join('');

    if (this.pillarViewerPhotos.length > limit) {
      html += `
        <div class="gallery-see-more-wrapper">
          <button class="btn btn-outline-gold gallery-see-more-btn" onclick="LandingModule.togglePillarVaultViewer()">
            <i data-lucide="${this.pillarViewerExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4"></i>
            <span>${this.pillarViewerExpanded ? 'Show Less' : `See More (${this.pillarViewerPhotos.length - limit} more)`}</span>
          </button>
        </div>
      `;
    }

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  togglePillarVaultViewer() {
    this.pillarViewerExpanded = !this.pillarViewerExpanded;
    this.renderPillarVaultViewer();
  },

  openPillarPhoto(photoIndex) {
    if (!this.pillarViewerPhotos || !this.pillarViewerPhotos.length) return;
    const first = this.pillarViewerPhotos[photoIndex] || this.pillarViewerPhotos[0];
    this.currentAlbum = {
      title: first.title || this.pillarViewerTitle || 'From the Vault',
      category: this.pillarViewerTitle || 'Vault',
      year: first.year || 2025,
      location: first.location || 'University of Santo Tomas',
      photos: this.pillarViewerPhotos.map(p => p.src)
    };
    this.currentPhotoIndex = photoIndex;
    this.lightboxOpen = true;
    this.isInitialOpen = true;
    this.renderLightbox();
    document.body.style.overflow = 'hidden';
  },

  /**
   * Click-to-toggle for the "Pillars" nav dropdown (in addition to hover),
   * so it also works on touch devices without a real hover state.
   */
  setupNavDropdown() {
    const dropdown = document.querySelector('.landing-navbar-dropdown');
    if (!dropdown) return;

    const trigger = dropdown.querySelector('.landing-navbar-dropdown-trigger');
    const menu = dropdown.querySelector('.landing-navbar-dropdown-menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', (e) => {
      // Only intercept on touch/coarse-pointer devices; desktop mouse users
      // can just click through to the Pillars hub page.
      if (window.matchMedia('(hover: hover)').matches) return;
      e.preventDefault();
      menu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  },

  /**
   * Setup sticky navbar that appears after scrolling past the hero
   */
  setupStickyNavbar() {
    const navbar = document.getElementById('landing-navbar');
    const hero = document.querySelector('.landing-hero');
    if (!navbar || !hero) return;

    let lastScrollY = 0;
    let ticking = false;

    const updateNavbar = () => {
      const heroBottom = hero.offsetTop + hero.offsetHeight - 80;
      const scrollY = window.scrollY;

      // Toggle hero overlay state for transparent dark nav
      navbar.classList.toggle('navbar-over-hero', scrollY < heroBottom);
      navbar.classList.toggle('navbar-scrolled', scrollY > 40);

      // Hide on fast scroll down past hero, show on scroll up
      if (scrollY > heroBottom) {
        if (scrollY > lastScrollY && scrollY - lastScrollY > 10) {
          navbar.classList.add('hidden-up');
        } else {
          navbar.classList.remove('hidden-up');
        }
      } else {
        navbar.classList.remove('hidden-up');
      }

      lastScrollY = scrollY;
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateNavbar);
        ticking = true;
      }
    });

    // Initial call to set state
    updateNavbar();
  },

  /**
   * Setup scroll animations for About Us section
   */
  setupAboutAnimations() {
    const aboutSection = document.querySelector('.landing-section-about');
    if (!aboutSection) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          aboutSection.classList.add('about-animate-in');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    observer.observe(aboutSection);
  },

  /**
   * Escape HTML special characters to prevent XSS
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

  /**
   * Reveal sections/cards on scroll
   */
  setupScrollReveal() {
    const targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(el => observer.observe(el));
  },

  /**
   * Render the public gallery grid (album panels)
   */
  renderPublicGallery() {
    const container = document.getElementById('public-gallery');
    if (!container) return;

    // Render main albums
    let html = this.albums.map((album, index) => {
      const e = (s) => this.escapeHTML(s);
      return `
      <div class="landing-gallery-card glass-card" onclick="LandingModule.openAlbum(${index})" style="cursor: pointer;">
        <div class="landing-gallery-image-wrapper">
          <img src="${e(album.coverImage)}" alt="${e(album.title)}" loading="lazy">
          <div class="landing-gallery-overlay">
            <span class="landing-gallery-category">${e(album.category)}</span>
          </div>
          <div class="album-photo-count">
            <i data-lucide="images" class="w-4 h-4"></i>
            <span>${album.photoCount} photos</span>
          </div>
        </div>
        <div class="landing-gallery-info">
          <h3>${e(album.title)}</h3>
          <p>
            <i data-lucide="map-pin" class="w-3 h-3"></i>
            ${e(album.location)} &middot; ${e(album.year)}
          </p>
        </div>
      </div>
    `;
    }).join('');

    // Add archive albums if expanded
    if (this.showArchive) {
      html += this.archiveAlbums.map((album, index) => {
        const e = (s) => this.escapeHTML(s);
        return `
        <div class="landing-gallery-card glass-card archive-album" onclick="LandingModule.openArchiveAlbum(${index})" style="cursor: pointer;">
          <div class="landing-gallery-image-wrapper">
            <img src="${e(album.coverImage)}" alt="${e(album.title)}" loading="lazy">
            <div class="landing-gallery-overlay">
              <span class="landing-gallery-category">${e(album.category)}</span>
            </div>
            <div class="album-photo-count">
              <i data-lucide="images" class="w-4 h-4"></i>
              <span>${album.photoCount} photos</span>
            </div>
          </div>
          <div class="landing-gallery-info">
            <h3>${e(album.title)}</h3>
            <p>
              <i data-lucide="map-pin" class="w-3 h-3"></i>
              ${e(album.location)} &middot; ${e(album.year)}
            </p>
          </div>
        </div>
      `;
      }).join('');
    }

    // Add See More / Show Less button
    html += `
      <div class="gallery-see-more-wrapper">
        <button class="btn btn-outline-gold gallery-see-more-btn" onclick="LandingModule.toggleArchive()">
          <i data-lucide="${this.showArchive ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4"></i>
          <span>${this.showArchive ? 'Show Less' : 'See More'}</span>
        </button>
      </div>
    `;

    container.innerHTML = html;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Toggle archive albums visibility
   */
  toggleArchive() {
    this.showArchive = !this.showArchive;
    this.renderPublicGallery();
  },

  /**
   * Open archive album
   */
  openArchiveAlbum(archiveIndex) {
    this.currentAlbum = this.archiveAlbums[archiveIndex];
    this.currentPhotoIndex = 0;
    this.lightboxOpen = true;
    this.isInitialOpen = true;
    this.renderLightbox();
    document.body.style.overflow = 'hidden';
  },

  /**
   * Open album (like clicking a Facebook album)
   */
  openAlbum(albumIndex) {
    this.currentAlbum = this.albums[albumIndex];
    this.currentPhotoIndex = 0;
    this.lightboxOpen = true;
    this.isInitialOpen = true;
    this.renderLightbox();
    document.body.style.overflow = 'hidden';
  },

  /**
   * Close lightbox
   */
  closeLightbox() {
    this.lightboxOpen = false;
    const lightbox = document.getElementById('landing-lightbox');
    if (lightbox) {
      lightbox.classList.remove('active');
      setTimeout(() => lightbox.remove(), 300);
    }
    document.body.style.overflow = '';
  },

  /**
   * Navigate within album photos
   */
  navigateLightbox(direction) {
    if (!this.currentAlbum) return;
    
    const newIndex = this.currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < this.currentAlbum.photos.length) {
      this.currentPhotoIndex = newIndex;
      this.isInitialOpen = false;
      
      // Remove initial-open class immediately before updating
      const lightbox = document.getElementById('landing-lightbox');
      if (lightbox) {
        lightbox.classList.remove('initial-open');
      }
      
      this.renderLightbox();
    }
  },

  /**
   * Render lightbox modal (showing photos from selected album)
   */
  renderLightbox() {
    if (!this.currentAlbum) return;

    const currentPhoto = this.currentAlbum.photos[this.currentPhotoIndex];
    if (!currentPhoto) return;

    let lightbox = document.getElementById('landing-lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'landing-lightbox';
      lightbox.className = 'vault-lightbox';
      document.body.appendChild(lightbox);
    }

    // Add initial-open class only on first open, not on navigation
    if (this.isInitialOpen) {
      lightbox.classList.remove('initial-open');
      void lightbox.offsetWidth;
      lightbox.classList.add('initial-open');
    }

    lightbox.innerHTML = `
      <div class="vault-lightbox-backdrop" onclick="LandingModule.closeLightbox()"></div>
      
      <button class="vault-lightbox-close" onclick="LandingModule.closeLightbox()">
        <i data-lucide="x" class="w-6 h-6"></i>
      </button>
      
      ${this.currentPhotoIndex > 0 ? `
        <button class="vault-lightbox-nav prev" onclick="LandingModule.navigateLightbox(-1)">
          <i data-lucide="chevron-left" class="w-8 h-8"></i>
        </button>
      ` : ''}
      
      ${this.currentPhotoIndex < this.currentAlbum.photos.length - 1 ? `
        <button class="vault-lightbox-nav next" onclick="LandingModule.navigateLightbox(1)">
          <i data-lucide="chevron-right" class="w-8 h-8"></i>
        </button>
      ` : ''}
      
      <div class="vault-lightbox-content">
        <div class="vault-lightbox-image-wrapper">
          <img src="${this.escapeHTML(currentPhoto)}" alt="${this.escapeHTML(this.currentAlbum.title)}" class="vault-lightbox-image">
        </div>
        
        <div class="vault-lightbox-info">
          <div class="vault-lightbox-header">
            <span class="vault-lightbox-category" style="color: #d4af37">
              <i data-lucide="folder" class="w-4 h-4"></i>
              ${this.escapeHTML(this.currentAlbum.category)}
            </span>
            <span class="vault-lightbox-counter">${this.currentPhotoIndex + 1} / ${this.currentAlbum.photos.length}</span>
          </div>
          
          <h2 class="vault-lightbox-title">${this.escapeHTML(this.currentAlbum.title)}</h2>
          <p class="vault-lightbox-description">A glimpse into the rich history and traditions of the Zeta Beta Mu Fraternity.</p>
          
          <div class="vault-lightbox-meta">
            <div class="vault-lightbox-meta-item">
              <i data-lucide="calendar" class="w-4 h-4"></i>
              <span>${this.escapeHTML(this.currentAlbum.year)}</span>
            </div>
            <div class="vault-lightbox-meta-item">
              <i data-lucide="map-pin" class="w-4 h-4"></i>
              <span>${this.escapeHTML(this.currentAlbum.location)}</span>
            </div>
          </div>
          
          <div class="vault-lightbox-actions">
            <a href="signup.html" class="btn btn-gold">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
              Join to See More
            </a>
          </div>
        </div>
      </div>
    `;

    // Show lightbox with animation
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
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  LandingModule.init();
});

// Re-init on bfcache restore (browser back/forward)
window.addEventListener('zbm-bfcache-restore', () => {
  LandingModule.init();
});

// Expose globally
window.LandingModule = LandingModule;
