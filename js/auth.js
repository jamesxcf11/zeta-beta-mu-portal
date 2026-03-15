/**
 * Zeta Beta Mu Fraternity Portal
 * Authentication Module
 * 
 * Handles login/signup functionality with mock authentication
 * for frontend demonstration purposes.
 */

const AuthModule = {
  // Mock user database for demonstration
  mockUsers: [
    {
      id: 1,
      username: 'admin',
      password: 'admin123',
      name: 'Dr. James Anderson',
      email: 'james@zetabetamu.com',
      graduationYear: 1995,
      hospital: 'St. Luke\'s Medical Center',
      field: 'Cardiology',
      role: 'admin',
      avatar: 'https://i.pravatar.cc/150?img=11',
      verified: true
    },
    {
      id: 2,
      username: 'doctor1',
      password: 'pass123',
      name: 'Dr. Sarah Mitchell',
      email: 'sarah@zetabetamu.com',
      graduationYear: 2008,
      hospital: 'Mount Sinai Hospital',
      field: 'Neurology',
      role: 'member',
      avatar: 'https://i.pravatar.cc/150?img=5',
      verified: true
    },
    {
      id: 3,
      username: 'doctor2',
      password: 'pass123',
      name: 'Dr. Michael Chen',
      email: 'michael@zetabetamu.com',
      graduationYear: 2012,
      hospital: 'Johns Hopkins Medicine',
      field: 'Oncology',
      role: 'member',
      avatar: 'https://i.pravatar.cc/150?img=3',
      verified: true
    }
  ],

  /**
   * Initialize authentication module
   */
  init() {
    this.setupLoginForm();
    this.setupSignupForm();
    this.checkAuthState();
  },

  /**
   * Setup login form handler
   */
  setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const rememberMe = document.getElementById('remember-me')?.checked;

      if (!username || !password) {
        this.showError('Please enter both username and password');
        return;
      }

      // Simulate API call delay
      this.setLoading(true);
      
      await this.delay(1000);

      const user = this.authenticate(username, password);

      if (user) {
        this.loginSuccess(user, rememberMe);
      } else {
        this.showError('Invalid username or password');
        this.setLoading(false);
      }
    });
  },

  /**
   * Setup signup form handler
   */
  setupSignupForm() {
    const signupForm = document.getElementById('signup-form');
    if (!signupForm) return;

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        fullName: document.getElementById('full-name').value.trim(),
        email: document.getElementById('email').value.trim(),
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirm-password').value,
        graduationYear: document.getElementById('graduation-year').value,
        hospital: document.getElementById('hospital').value.trim(),
        field: document.getElementById('field').value,
        agreeTerms: document.getElementById('agree-terms')?.checked
      };

      // Validation
      const validationError = this.validateSignup(formData);
      if (validationError) {
        this.showError(validationError);
        return;
      }

      // Simulate API call
      this.setLoading(true);
      await this.delay(1500);

      // Check if username exists
      if (this.mockUsers.find(u => u.username === formData.username)) {
        this.showError('Username already exists');
        this.setLoading(false);
        return;
      }

      // Create new user (pending verification)
      const newUser = {
        id: this.mockUsers.length + 1,
        username: formData.username,
        password: formData.password,
        name: formData.fullName,
        email: formData.email,
        graduationYear: parseInt(formData.graduationYear),
        hospital: formData.hospital,
        field: formData.field,
        role: 'member',
        avatar: `https://i.pravatar.cc/150?img=${this.mockUsers.length + 10}`,
        verified: false
      };

      this.mockUsers.push(newUser);
      
      this.showSuccess(
        'Registration submitted! Your account is pending admin verification. You will be notified via email once approved.',
        () => {
          window.location.href = 'login.html';
        }
      );
    });
  },

  /**
   * Validate signup form data
   * @param {Object} data - Form data
   * @returns {string|null} Error message or null if valid
   */
  validateSignup(data) {
    if (!data.fullName || !data.email || !data.username || !data.password) {
      return 'Please fill in all required fields';
    }

    if (data.password.length < 6) {
      return 'Password must be at least 6 characters';
    }

    if (data.password !== data.confirmPassword) {
      return 'Passwords do not match';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return 'Please enter a valid email address';
    }

    if (!data.agreeTerms) {
      return 'You must agree to the terms and conditions';
    }

    return null;
  },

  /**
   * Authenticate user
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Object|null} User object or null
   */
  authenticate(username, password) {
    const user = this.mockUsers.find(
      u => u.username === username && u.password === password
    );
    
    if (user && !user.verified) {
      this.showError('Your account is pending verification. Please check your email.');
      return null;
    }
    
    return user || null;
  },

  /**
   * Handle successful login
   * @param {Object} user - User object
   * @param {boolean} rememberMe - Remember me flag
   */
  loginSuccess(user, rememberMe) {
    // Create session
    const session = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      loginTime: new Date().toISOString()
    };

    // Store in localStorage
    localStorage.setItem('zbm-session', JSON.stringify(session));
    
    if (rememberMe) {
      localStorage.setItem('zbm-remember', 'true');
    }

    this.showSuccess('Welcome back, ' + user.name.split(' ')[1] + '!');

    // Redirect after short delay
    setTimeout(() => {
      window.location.href = 'welcome.html';
    }, 800);
  },

  /**
   * Check authentication state
   */
  checkAuthState() {
    // If on login/signup page and already logged in, redirect to portal
    const session = localStorage.getItem('zbm-session');
    const isAuthPage = document.body.classList.contains('auth-page');

    if (session && isAuthPage) {
      window.location.href = 'welcome.html';
    }
  },

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      
      // Shake animation
      errorEl.closest('.auth-card')?.classList.add('shake');
      setTimeout(() => {
        errorEl.closest('.auth-card')?.classList.remove('shake');
      }, 500);
    } else {
      alert(message);
    }
  },

  /**
   * Show success message
   * @param {string} message - Success message
   * @param {Function} callback - Optional callback after showing
   */
  showSuccess(message, callback) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      errorEl.style.color = 'var(--emerald-400)';
    }

    if (callback) {
      setTimeout(callback, 2000);
    }
  },

  /**
   * Set loading state on form
   * @param {boolean} loading - Loading state
   */
  setLoading(loading) {
    const submitBtn = document.querySelector('button[type="submit"]');
    const inputs = document.querySelectorAll('input');

    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.innerHTML = loading 
        ? '<span class="loading-spinner"></span> Please wait...'
        : submitBtn.dataset.originalText || 'Login';
    }

    inputs.forEach(input => {
      input.disabled = loading;
    });
  },

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Logout current user
   */
  logout() {
    localStorage.removeItem('zbm-session');
    localStorage.removeItem('zbm-remember');
    window.location.href = 'login.html';
  },

  /**
   * Get current user from session
   * @returns {Object|null}
   */
  getCurrentUser() {
    const session = localStorage.getItem('zbm-session');
    return session ? JSON.parse(session) : null;
  },

  /**
   * Check if user is logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.getCurrentUser() !== null;
  },

  /**
   * Check if current user is admin
   * @returns {boolean}
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  AuthModule.init();
});

// Expose globally
window.AuthModule = AuthModule;
