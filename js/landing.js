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
      location: 'Rural Health Clinic',
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
      coverImage: 'https://picsum.photos/600/400?random=301',
      photoCount: 3,
      photos: [
        'https://picsum.photos/600/400?random=301',
        'https://picsum.photos/600/400?random=302',
        'https://picsum.photos/600/400?random=303'
      ]
    },
    {
      id: 7,
      title: 'White Coat Ceremony',
      category: 'Induction',
      year: 2023,
      location: 'University Chapel',
      coverImage: 'https://picsum.photos/600/400?random=304',
      photoCount: 4,
      photos: [
        'https://picsum.photos/600/400?random=304',
        'https://picsum.photos/600/400?random=305',
        'https://picsum.photos/600/400?random=306',
        'https://picsum.photos/600/400?random=307'
      ]
    },
    {
      id: 8,
      title: 'Community Health Fair',
      category: 'Community Service',
      year: 2023,
      location: 'Community Center',
      coverImage: 'https://picsum.photos/600/400?random=308',
      photoCount: 3,
      photos: [
        'https://picsum.photos/600/400?random=308',
        'https://picsum.photos/600/400?random=309',
        'https://picsum.photos/600/400?random=310'
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
      coverImage: 'https://picsum.photos/600/400?random=401',
      photoCount: 4,
      photos: [
        'https://picsum.photos/600/400?random=401',
        'https://picsum.photos/600/400?random=402',
        'https://picsum.photos/600/400?random=403',
        'https://picsum.photos/600/400?random=404'
      ]
    }
  ],

  // Lightbox state
  lightboxOpen: false,
  currentAlbum: null,
  currentPhotoIndex: 0,

  // Gallery expansion state
  showArchive: false,

  /**
   * Initialize landing page
   */
  init() {
    this.setupStickyNavbar();
    this.renderPublicGallery();
    this.setupAboutAnimations();
  },

  /**
   * Setup sticky navbar that appears after scrolling past the hero
   */
  setupStickyNavbar() {
    const navbar = document.getElementById('landing-navbar');
    const hero = document.getElementById('landing-hero');
    if (!navbar || !hero) return;

    let lastScrollY = 0;
    let ticking = false;

    const updateNavbar = () => {
      const heroBottom = hero.offsetTop + hero.offsetHeight - 100;
      const scrollY = window.scrollY;

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
   * Render the public gallery grid (album panels)
   */
  renderPublicGallery() {
    const container = document.getElementById('public-gallery');
    if (!container) return;

    // Render main albums
    let html = this.albums.map((album, index) => `
      <div class="landing-gallery-card glass-card" onclick="LandingModule.openAlbum(${index})" style="cursor: pointer;">
        <div class="landing-gallery-image-wrapper">
          <img src="${album.coverImage}" alt="${album.title}" loading="lazy">
          <div class="landing-gallery-overlay">
            <span class="landing-gallery-category">${album.category}</span>
          </div>
          <div class="album-photo-count">
            <i data-lucide="images" class="w-4 h-4"></i>
            <span>${album.photoCount} photos</span>
          </div>
        </div>
        <div class="landing-gallery-info">
          <h3>${album.title}</h3>
          <p>
            <i data-lucide="map-pin" class="w-3 h-3"></i>
            ${album.location} &middot; ${album.year}
          </p>
        </div>
      </div>
    `).join('');

    // Add archive albums if expanded
    if (this.showArchive) {
      html += this.archiveAlbums.map((album, index) => `
        <div class="landing-gallery-card glass-card archive-album" onclick="LandingModule.openArchiveAlbum(${index})" style="cursor: pointer;">
          <div class="landing-gallery-image-wrapper">
            <img src="${album.coverImage}" alt="${album.title}" loading="lazy">
            <div class="landing-gallery-overlay">
              <span class="landing-gallery-category">${album.category}</span>
            </div>
            <div class="album-photo-count">
              <i data-lucide="images" class="w-4 h-4"></i>
              <span>${album.photoCount} photos</span>
            </div>
          </div>
          <div class="landing-gallery-info">
            <h3>${album.title}</h3>
            <p>
              <i data-lucide="map-pin" class="w-3 h-3"></i>
              ${album.location} &middot; ${album.year}
            </p>
          </div>
        </div>
      `).join('');
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
          <img src="${currentPhoto}" alt="${this.currentAlbum.title}" class="vault-lightbox-image">
        </div>
        
        <div class="vault-lightbox-info">
          <div class="vault-lightbox-header">
            <span class="vault-lightbox-category" style="color: #d4af37">
              <i data-lucide="folder" class="w-4 h-4"></i>
              ${this.currentAlbum.category}
            </span>
            <span class="vault-lightbox-counter">${this.currentPhotoIndex + 1} / ${this.currentAlbum.photos.length}</span>
          </div>
          
          <h2 class="vault-lightbox-title">${this.currentAlbum.title}</h2>
          <p class="vault-lightbox-description">A glimpse into the rich history and traditions of the Zeta Beta Mu Fraternity.</p>
          
          <div class="vault-lightbox-meta">
            <div class="vault-lightbox-meta-item">
              <i data-lucide="calendar" class="w-4 h-4"></i>
              <span>${this.currentAlbum.year}</span>
            </div>
            <div class="vault-lightbox-meta-item">
              <i data-lucide="map-pin" class="w-4 h-4"></i>
              <span>${this.currentAlbum.location}</span>
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

// Expose globally
window.LandingModule = LandingModule;
