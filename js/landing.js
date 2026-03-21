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
  // Public gallery photo data (curated subset for public viewing)
  publicPhotos: [
    {
      title: 'Annual Fraternity Gala Dinner',
      category: 'Annual Gala',
      year: 2025,
      location: 'The Grand Hotel Ballroom',
      image: 'https://picsum.photos/600/400?random=201'
    },
    {
      title: 'New Member Induction Ceremony',
      category: 'Induction',
      year: 2024,
      location: 'University Great Hall',
      image: 'https://picsum.photos/600/400?random=202'
    },
    {
      title: 'Medical Research Symposium',
      category: 'Conference',
      year: 2025,
      location: 'Medical School Auditorium',
      image: 'https://picsum.photos/600/400?random=203'
    },
    {
      title: 'Alumni Reunion Weekend',
      category: 'Reunion',
      year: 2024,
      location: 'Fraternity House & Campus',
      image: 'https://picsum.photos/600/400?random=204'
    },
    {
      title: 'Charity Medical Mission',
      category: 'Charity',
      year: 2023,
      location: 'Rural Health Clinic',
      image: 'https://picsum.photos/600/400?random=205'
    },
    {
      title: 'Founders Day Commemoration',
      category: 'Founders Day',
      year: 2025,
      location: 'Fraternity Memorial Garden',
      image: 'https://picsum.photos/600/400?random=206'
    },
    {
      title: 'White Coat Ceremony',
      category: 'Induction',
      year: 2024,
      location: 'University Chapel',
      image: 'https://picsum.photos/600/400?random=207'
    },
    {
      title: 'Community Health Fair',
      category: 'Charity',
      year: 2023,
      location: 'Community Center',
      image: 'https://picsum.photos/600/400?random=208'
    }
  ],

  /**
   * Initialize landing page
   */
  init() {
    this.setupStickyNavbar();
    this.setupMobileMenu();
    this.renderPublicGallery();
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

      if (scrollY > heroBottom) {
        navbar.classList.add('visible');
      } else {
        navbar.classList.remove('visible');
      }

      // Hide on fast scroll down, show on scroll up
      if (scrollY > heroBottom) {
        if (scrollY > lastScrollY && scrollY - lastScrollY > 10) {
          navbar.classList.add('hidden-up');
        } else {
          navbar.classList.remove('hidden-up');
        }
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
   * Setup mobile menu toggle for navbar
   */
  setupMobileMenu() {
    const toggle = document.getElementById('landing-mobile-toggle');
    const menu = document.getElementById('landing-mobile-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.contains('open');
      if (isOpen) {
        menu.classList.remove('open');
        toggle.innerHTML = '<i data-lucide="menu" class="w-6 h-6"></i>';
      } else {
        menu.classList.add('open');
        toggle.innerHTML = '<i data-lucide="x" class="w-6 h-6"></i>';
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    // Close menu when clicking a link
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
        toggle.innerHTML = '<i data-lucide="menu" class="w-6 h-6"></i>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    });
  },

  /**
   * Render the public gallery grid
   */
  renderPublicGallery() {
    const container = document.getElementById('public-gallery');
    if (!container) return;

    container.innerHTML = this.publicPhotos.map(photo => `
      <div class="landing-gallery-card glass-card">
        <div class="landing-gallery-image-wrapper">
          <img src="${photo.image}" alt="${photo.title}" loading="lazy">
          <div class="landing-gallery-overlay">
            <span class="landing-gallery-category">${photo.category}</span>
          </div>
        </div>
        <div class="landing-gallery-info">
          <h3>${photo.title}</h3>
          <p>
            <i data-lucide="map-pin" class="w-3 h-3"></i>
            ${photo.location} &middot; ${photo.year}
          </p>
        </div>
      </div>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  LandingModule.init();
});

// Expose globally
window.LandingModule = LandingModule;
