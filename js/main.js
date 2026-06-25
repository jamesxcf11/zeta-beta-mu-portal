/**
 * Zeta Beta Mu Fraternity Portal
 * Main JavaScript Module - SPA Router & Core Functionality
 * 
 * This module handles:
 * - Screen routing and navigation between SPA views
 * - Dark/Light theme toggle with localStorage persistence
 * - Mobile hamburger menu functionality
 * - Smooth scroll navigation
 * - Back to top button
 * - Newsletter subscription
 * - Parallax effects and animations
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const CONFIG = {
  themeStorageKey: 'zbm-theme-preference',
  sessionStorageKey: 'zbm-session',
  defaultScreen: 'feed',
  animationDuration: 300,
  scrollThreshold: 300
};

// Screen definitions for SPA routing
const SCREENS = {
  feed: { id: 'feed', title: 'Social Feed', icon: 'home' },
  directory: { id: 'directory', title: 'Medical Directory', icon: 'users' },
  traditions: { id: 'traditions', title: 'Traditions Library', icon: 'book-open' },
  vault: { id: 'vault', title: 'Historical Vault', icon: 'archive' },
  memoriam: { id: 'memoriam', title: 'In Memoriam', icon: 'candle' }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Debounce function to limit how often a function can fire
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Smooth scroll to element
 * @param {string} target - Selector or element to scroll to
 * @param {number} offset - Offset from top (px)
 */
function smoothScrollTo(target, offset = 80) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (element) {
    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - offset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
}

/**
 * Format date to readable string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

/**
 * Check if element is in viewport
 * @param {Element} element - Element to check
 * @param {number} threshold - Visibility threshold (0-1)
 * @returns {boolean}
 */
function isInViewport(element, threshold = 0.1) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top <= (window.innerHeight || document.documentElement.clientHeight) * (1 - threshold) &&
    rect.bottom >= 0
  );
}

// ============================================
// THEME MANAGEMENT
// ============================================

const ThemeManager = {
  /**
   * Initialize theme from localStorage or system preference
   */
  init() {
    const savedTheme = localStorage.getItem(CONFIG.themeStorageKey);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else if (systemPrefersDark) {
      this.setTheme('dark');
    } else {
      this.setTheme('light');
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(CONFIG.themeStorageKey)) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });

    // Setup toggle click handler
    this.setupToggleHandler();
    
    // Setup scroll behavior for toggle
    this.setupScrollBehavior();
  },

  /**
   * Set theme (dark or light)
   * @param {string} theme - Theme name
   */
  setTheme(theme) {
    const body = document.body;
    
    if (theme === 'dark') {
      body.classList.add('dark-theme');
      body.classList.remove('light-theme');
    } else {
      body.classList.add('light-theme');
      body.classList.remove('dark-theme');
    }
    
    // Update toggle icons if toggle exists
    this.updateToggleIcons(theme);
  },

  /**
   * Update toggle icon visibility
   * @param {string} theme - Current theme
   */
  updateToggleIcons(theme) {
    const toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;

    const moonIcon = toggle.querySelector('.theme-icon-moon');
    const sunIcon = toggle.querySelector('.theme-icon-sun');
    
    if (moonIcon && sunIcon) {
      if (theme === 'dark') {
        moonIcon.style.opacity = '0';
        moonIcon.style.transform = 'scale(0.5)';
        sunIcon.style.opacity = '1';
        sunIcon.style.transform = 'scale(1)';
      } else {
        moonIcon.style.opacity = '1';
        moonIcon.style.transform = 'scale(1)';
        sunIcon.style.opacity = '0';
        sunIcon.style.transform = 'scale(0.5)';
      }
    }
  },

  /**
   * Toggle between dark and light themes
   */
  toggle() {
    const isDark = document.body.classList.contains('dark-theme');
    const newTheme = isDark ? 'light' : 'dark';
    this.setTheme(newTheme);
    localStorage.setItem(CONFIG.themeStorageKey, newTheme);
    
    // Re-initialize Lucide icons for the toggle
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Setup toggle click handler
   */
  setupToggleHandler() {
    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        this.toggle();
      });
      
      // Keyboard accessibility
      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggle();
        }
      });
    }
  },

  /**
   * Setup scroll behavior for toggle
   */
  setupScrollBehavior() {
    const toggleContainer = document.querySelector('.theme-toggle-container');
    if (!toggleContainer) return;

    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', debounce(() => {
      const currentScrollY = window.scrollY;
      
      // Add scrolled class when scrolled down
      if (currentScrollY > 100) {
        toggleContainer.classList.add('scrolled');
      } else {
        toggleContainer.classList.remove('scrolled');
      }
      
      lastScrollY = currentScrollY;
    }, 50));
  }
};

// ============================================
// NAVIGATION & MOBILE MENU
// ============================================

const Navigation = {
  /**
   * Initialize navigation functionality
   */
  init() {
    this.setupMobileMenu();
    this.setupSmoothScroll();
    this.setupActiveLinks();
  },

  /**
   * Setup mobile hamburger menu
   */
  setupMobileMenu() {
    const hamburger = document.getElementById('hamburger-menu');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if (!hamburger || !sidebar) return;

    hamburger.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('sidebar-open');
      
      if (isOpen) {
        this.closeMobileMenu(sidebar, overlay, hamburger);
      } else {
        this.openMobileMenu(sidebar, overlay, hamburger);
      }
    });

    // Close menu when clicking overlay
    if (overlay) {
      overlay.addEventListener('click', () => {
        this.closeMobileMenu(sidebar, overlay, hamburger);
      });
    }

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('sidebar-open')) {
        this.closeMobileMenu(sidebar, overlay, hamburger);
      }
    });
  },

  openMobileMenu(sidebar, overlay, hamburger) {
    sidebar.classList.add('sidebar-open');
    if (overlay) overlay.classList.add('overlay-active');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  },

  closeMobileMenu(sidebar, overlay, hamburger) {
    sidebar.classList.remove('sidebar-open');
    if (overlay) overlay.classList.remove('overlay-active');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  },

  /**
   * Setup smooth scroll for anchor links
   */
  setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#') return;
        
        e.preventDefault();
        smoothScrollTo(href);
        
        // Close mobile menu if open
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
          const hamburger = document.getElementById('hamburger-menu');
          const overlay = document.getElementById('mobile-overlay');
          this.closeMobileMenu(sidebar, overlay, hamburger);
        }
      });
    });
  },

  /**
   * Update active state on navigation links
   */
  setupActiveLinks() {
    const currentHash = window.location.hash || '#' + CONFIG.defaultScreen;
    
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentHash) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
};

// ============================================
// SPA ROUTER
// ============================================

const Router = {
  currentScreen: null,

  /**
   * Initialize router
   */
  init() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.routeFromHash();
    });

    // Initial route
    this.routeFromHash();
  },

  /**
   * Route based on current URL hash
   */
  routeFromHash() {
    const hash = window.location.hash.slice(1) || CONFIG.defaultScreen;
    this.navigateTo(hash, false);
  },

  /**
   * Navigate to a screen
   * @param {string} screenId - Screen ID to navigate to
   * @param {boolean} pushState - Whether to update browser history
   */
  navigateTo(screenId, pushState = true) {
    // Validate screen exists
    if (!SCREENS[screenId]) {
      console.warn(`Screen "${screenId}" not found, redirecting to default`);
      screenId = CONFIG.defaultScreen;
    }

    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('screen-active');
    });

    // Show target screen
    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
      targetScreen.classList.add('screen-active');
      
      // Trigger screen-specific initialization
      this.onScreenLoad(screenId);
    }

    // Update navigation
    this.updateNavigation(screenId);

    // Update page title
    const screen = SCREENS[screenId];
    document.title = `${screen.title} | Zeta Beta Mu Fraternity`;

    // Update browser history
    if (pushState) {
      window.history.pushState({ screen: screenId }, '', `#${screenId}`);
    }

    this.currentScreen = screenId;
    
    // Scroll to top of content
    smoothScrollTo('#main-content', 0);
  },

  /**
   * Update navigation active states
   * @param {string} screenId - Current screen ID
   */
  updateNavigation(screenId) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${screenId}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  },

  /**
   * Called when a screen is loaded
   * @param {string} screenId - Screen that was loaded
   */
  onScreenLoad(screenId) {
    // Trigger screen-specific module initialization
    switch(screenId) {
      case 'feed':
        if (typeof FeedModule !== 'undefined') FeedModule.init();
        break;
      case 'directory':
        if (typeof DirectoryModule !== 'undefined') DirectoryModule.init();
        break;
      case 'traditions':
        if (typeof TraditionsModule !== 'undefined') TraditionsModule.init();
        break;
      case 'vault':
        if (typeof VaultModule !== 'undefined') VaultModule.init();
        break;
    }
  }
};

// ============================================
// BACK TO TOP BUTTON
// ============================================

const BackToTop = {
  button: null,

  init() {
    this.button = document.getElementById('back-to-top');
    if (!this.button) return;

    // Show/hide based on scroll position
    window.addEventListener('scroll', debounce(() => {
      this.toggleVisibility();
    }, 100));

    // Click handler
    this.button.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  },

  toggleVisibility() {
    if (window.pageYOffset > CONFIG.scrollThreshold) {
      this.button.classList.add('visible');
    } else {
      this.button.classList.remove('visible');
    }
  }
};

// ============================================
// NEWSLETTER FORM
// ============================================

const Newsletter = {
  init() {
    const form = document.getElementById('newsletter-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]').value;
      
      if (this.validateEmail(email)) {
        this.handleSuccess(form);
      } else {
        this.handleError(form, 'Please enter a valid email address');
      }
    });
  },

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  handleSuccess(form) {
    const button = form.querySelector('button');
    const originalText = button.textContent;
    
    button.textContent = 'Subscribed!';
    button.disabled = true;
    form.classList.add('success');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
      form.classList.remove('success');
      form.reset();
    }, 3000);
  },

  handleError(form, message) {
    const input = form.querySelector('input');
    input.classList.add('error');
    
    // Remove error after 3 seconds
    setTimeout(() => {
      input.classList.remove('error');
    }, 3000);
  }
};

// ============================================
// PARALLAX & ANIMATION EFFECTS
// ============================================

const Effects = {
  init() {
    this.setupParallax();
    this.setupScrollAnimations();
    this.setupHoverEffects();
  },

  /**
   * Setup parallax scrolling effects
   */
  setupParallax() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    
    if (parallaxElements.length === 0) return;

    window.addEventListener('scroll', debounce(() => {
      const scrolled = window.pageYOffset;
      
      parallaxElements.forEach(element => {
        const speed = parseFloat(element.dataset.parallax) || 0.5;
        const yPos = -(scrolled * speed);
        element.style.transform = `translate3d(0, ${yPos}px, 0)`;
      });
    }, 10));
  },

  /**
   * Setup scroll-triggered animations
   */
  setupScrollAnimations() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    
    if (animatedElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    animatedElements.forEach(element => {
      observer.observe(element);
    });
  },

  /**
   * Setup hover effects for cards and buttons
   */
  setupHoverEffects() {
    // Add ripple effect to buttons
    document.querySelectorAll('.btn-gold, .btn-emerald').forEach(button => {
      button.addEventListener('click', (e) => {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        button.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
      });
    });
  }
};

// ============================================
// AUTHENTICATION HELPERS
// ============================================

const AuthHelper = {
  /**
   * Check if user is logged in (mock)
   * @returns {boolean}
   */
  isLoggedIn() {
    return localStorage.getItem(CONFIG.sessionStorageKey) !== null;
  },

  /**
   * Get current user data (mock)
   * @returns {Object|null}
   */
  getCurrentUser() {
    const session = localStorage.getItem(CONFIG.sessionStorageKey);
    return session ? JSON.parse(session) : null;
  },

  /**
   * Mock logout
   */
  logout() {
    localStorage.removeItem(CONFIG.sessionStorageKey);
    window.location.href = 'index.html';
  },

  /**
   * Update UI with user info
   */
  updateUI() {
    const user = this.getCurrentUser();
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    
    if (user && userNameEl) {
      userNameEl.textContent = user.name || 'Brother';
    }
    
    if (user && userAvatarEl && user.avatar) {
      userAvatarEl.src = user.avatar;
    }
  }
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize all modules when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Initialize theme
  ThemeManager.init();

  // Initialize navigation
  Navigation.init();

  // Initialize router (SPA)
  if (document.querySelector('.screen')) {
    Router.init();
  }

  // Initialize back to top
  BackToTop.init();

  // Initialize newsletter
  Newsletter.init();

  // Initialize effects
  Effects.init();

  // Update auth UI
  AuthHelper.updateUI();

  // Theme toggle click handler
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      ThemeManager.toggle();
    });
  }

  // Logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      AuthHelper.logout();
    });
  }

  console.log('🎓 Zeta Beta Mu Portal initialized successfully');
});

// Expose modules globally for other scripts
window.ThemeManager = ThemeManager;
window.Router = Router;
window.AuthHelper = AuthHelper;
window.smoothScrollTo = smoothScrollTo;
window.formatDate = formatDate;
