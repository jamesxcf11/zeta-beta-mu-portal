/**
 * Zeta Beta Mu Fraternity Portal
 * Authentication Module
 *
 * Handles login/signup functionality using Supabase Auth.
 * Falls back to mock authentication when Supabase is not configured
 * (e.g. during static prototype demo without a backend).
 */

const AuthModule = {
  // Session expiry: 24 hours in milliseconds
  SESSION_MAX_AGE_MS: 24 * 60 * 60 * 1000,

  // Rate limiting: max attempts before lockout (client-side only — see below)
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 5 * 60 * 1000, // 5 minutes
  // NOTE: Client-side rate limiting can be bypassed by clearing localStorage.
  // Supabase Auth enforces server-side rate limits on signInWithPassword
  // automatically. Configure in Supabase Dashboard → Authentication →
  // Rate Limits. Recommended settings:
  //   - Max requests per IP per minute: 10
  //   - Max requests per email per minute: 3
  // These server-side limits are the true security boundary; the
  // client-side limits above are a UX improvement only.

  // Mock user database — ONLY available on localhost for development.
  // In production (deployed to Netlify), Supabase Auth must be configured;
  // these plaintext credentials are never exposed to end users.
  mockUsers: (function() {
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '';
    if (!isLocal) return [];
    return [
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
        avatar: 'image/placeholders/avatars/a11.jpg',
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
        avatar: 'image/placeholders/avatars/a5.jpg',
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
        avatar: 'image/placeholders/avatars/a3.jpg',
        verified: true
      }
    ];
  })(),

  /**
   * Check if Supabase is configured and available
   */
  hasSupabase() {
    return typeof db !== 'undefined' && db && db.auth &&
           SUPABASE_URL && !SUPABASE_URL.includes('YOUR_PROJECT');
  },

  /**
   * Initialize authentication module
   */
  init() {
    this.setupLoginForm();
    this.setupSignupForm();
    this.checkAuthState();
    this.enforceSessionExpiry();
  },

  /**
   * Enforce session expiry — if the zbm-session blob is older than
   * SESSION_MAX_AGE_MS, clear it and redirect to login.
   */
  enforceSessionExpiry() {
    const raw = localStorage.getItem('zbm-session');
    if (!raw) return;
    try {
      const session = JSON.parse(raw);
      if (session.loginTime) {
        const age = Date.now() - new Date(session.loginTime).getTime();
        if (age > this.SESSION_MAX_AGE_MS) {
          this.logout();
          return;
        }
      }
    } catch (e) {
      // Corrupted session — clear it
      localStorage.removeItem('zbm-session');
      localStorage.removeItem('zbm-remember');
    }
  },

  /**
   * Check if the user is currently locked out due to too many failed attempts.
   * @returns {boolean}
   */
  isLockedOut() {
    const lockoutStr = localStorage.getItem('zbm-lockout');
    if (!lockoutStr) return false;
    const lockoutTime = parseInt(lockoutStr, 10);
    if (isNaN(lockoutTime)) return false;
    if (Date.now() - lockoutTime < this.LOCKOUT_DURATION_MS) return true;
    // Lockout expired — reset
    localStorage.removeItem('zbm-lockout');
    localStorage.removeItem('zbm-login-attempts');
    return false;
  },

  /**
   * Record a failed login attempt. After MAX_LOGIN_ATTEMPTS, set lockout.
   */
  recordFailedAttempt() {
    let attempts = parseInt(localStorage.getItem('zbm-login-attempts') || '0', 10);
    attempts++;
    localStorage.setItem('zbm-login-attempts', String(attempts));
    if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
      localStorage.setItem('zbm-lockout', String(Date.now()));
    }
  },

  /**
   * Reset failed attempt counter on successful login.
   */
  resetFailedAttempts() {
    localStorage.removeItem('zbm-login-attempts');
    localStorage.removeItem('zbm-lockout');
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

      // Rate limiting check
      if (this.isLockedOut()) {
        const remaining = Math.ceil((this.LOCKOUT_DURATION_MS - (Date.now() - parseInt(localStorage.getItem('zbm-lockout'), 10))) / 1000);
        this.showError(`Too many failed attempts. Please wait ${remaining} seconds before trying again.`);
        return;
      }

      this.setLoading(true);

      if (this.hasSupabase()) {
        // Supabase auth — look up email by username, then sign in
        const { data: member, error: lookupError } = await db
          .from('members')
          .select('email, status')
          .eq('username', username)
          .single();

        if (lookupError || !member) {
          this.recordFailedAttempt();
          const remaining = this.MAX_LOGIN_ATTEMPTS - parseInt(localStorage.getItem('zbm-login-attempts') || '0', 10);
          if (remaining > 0) {
            this.showError(`Invalid username or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
          } else {
            this.showError('Too many failed attempts. Account locked for 5 minutes.');
          }
          this.setLoading(false);
          return;
        }

        if (member.status === 'pending') {
          this.showError('Your account is pending verification. Please check your email.');
          this.setLoading(false);
          return;
        }

        const { data: authData, error: authError } = await db.auth
          .signInWithPassword({ email: member.email, password });

        if (authError) {
          this.recordFailedAttempt();
          const remaining = this.MAX_LOGIN_ATTEMPTS - parseInt(localStorage.getItem('zbm-login-attempts') || '0', 10);
          if (remaining > 0) {
            this.showError(`Invalid username or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
          } else {
            this.showError('Too many failed attempts. Account locked for 5 minutes.');
          }
          this.setLoading(false);
          return;
        }

        this.resetFailedAttempts();

        // Fetch full profile
        const { data: profile } = await db
          .from('members')
          .select('*')
          .eq('email', member.email)
          .single();

        if (profile) {
          this.loginSuccess(profile, rememberMe);
        } else {
          this.showError('Profile not found. Please contact admin.');
          this.setLoading(false);
        }
      } else {
        // Mock auth fallback
        await this.delay(1000);
        const user = this.authenticate(username, password);
        if (user) {
          this.resetFailedAttempts();
          this.loginSuccess(user, rememberMe);
        } else {
          this.recordFailedAttempt();
          const remaining = this.MAX_LOGIN_ATTEMPTS - parseInt(localStorage.getItem('zbm-login-attempts') || '0', 10);
          if (remaining > 0) {
            this.showError(`Invalid username or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
          } else {
            this.showError('Too many failed attempts. Account locked for 5 minutes.');
          }
          this.setLoading(false);
        }
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

      const isWizard = !!document.getElementById('first-name');
      let formData;

      if (isWizard) {
        const firstName = document.getElementById('first-name').value.trim();
        const middleName = document.getElementById('middle-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
        const hasContact = [
          document.getElementById('mobile'),
          document.getElementById('telephone'),
          document.getElementById('home-phone')
        ].some(el => el && el.value.trim());

        formData = {
          fullName,
          firstName,
          middleName,
          lastName,
          nickname: document.getElementById('nickname').value.trim(),
          birthday: document.getElementById('birthday').value,
          email: document.getElementById('email').value.trim(),
          username: document.getElementById('username').value.trim(),
          password: document.getElementById('password').value,
          confirmPassword: document.getElementById('confirm-password').value,
          graduationYear: document.getElementById('graduation-year').value,
          fieldOfMedicine: document.getElementById('field-of-medicine').value,
          specialization: document.getElementById('specialization').value.trim(),
          batch: document.getElementById('batch').value.trim(),
          mobile: document.getElementById('mobile').value.trim(),
          telephone: document.getElementById('telephone').value.trim(),
          homePhone: document.getElementById('home-phone').value.trim(),
          facebook: document.getElementById('facebook').value.trim(),
          instagram: document.getElementById('instagram').value.trim(),
          address: document.getElementById('address').value.trim(),
          hasContact,
          agreeTerms: document.getElementById('agree-terms')?.checked
        };
      } else {
        formData = {
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
      }

      // Validation
      const validationError = this.validateSignup(formData, isWizard);
      if (validationError) {
        this.showError(validationError);
        return;
      }

      this.setLoading(true);

      if (this.hasSupabase()) {
        // Supabase auth — create auth user then insert profile
        const { data: authData, error: authError } = await db.auth.signUp({
          email: formData.email,
          password: formData.password
        });

        if (authError) {
          this.showError(authError.message || 'Registration failed');
          this.setLoading(false);
          return;
        }

        const authId = authData.user?.id;

        // Insert member profile
        const memberRow = {
          username: formData.username,
          email: formData.email,
          password_hash: 'managed_by_supabase_auth',
          auth_id: authId,
          first_name: isWizard ? formData.firstName : formData.fullName.split(' ')[0],
          last_name: isWizard ? formData.lastName : formData.fullName.split(' ').slice(1).join(' '),
          middle_name: isWizard ? formData.middleName : null,
          nickname: isWizard ? formData.nickname : null,
          birthday: isWizard ? formData.birthday : null,
          graduation_year: parseInt(formData.graduationYear),
          hospital: isWizard ? (formData.address || 'Not provided') : formData.hospital,
          field_of_medicine: isWizard ? formData.fieldOfMedicine : formData.field,
          specialization: isWizard ? formData.specialization : null,
          batch: isWizard ? formData.batch : null,
          mobile: isWizard ? formData.mobile : null,
          telephone: isWizard ? formData.telephone : null,
          home_phone: isWizard ? formData.homePhone : null,
          facebook: isWizard ? formData.facebook : null,
          instagram: isWizard ? formData.instagram : null,
          address: isWizard ? formData.address : null,
          role: 'member',
          status: 'pending',
          avatar_url: `image/placeholders/avatars/a${[10, 13, 14, 20, 25][Math.floor(Math.random() * 5)]}.jpg`
        };

        const { error: insertError } = await db.from('members').insert(memberRow);

        if (insertError) {
          this.showError('Profile creation failed: ' + insertError.message);
          this.setLoading(false);
          return;
        }
      } else {
        // Mock fallback
        await this.delay(1500);

        if (this.mockUsers.find(u => u.username === formData.username)) {
          this.showError('Username already exists');
          this.setLoading(false);
          return;
        }

        const newUser = {
          id: this.mockUsers.length + 1,
          username: formData.username,
          password: formData.password,
          name: formData.fullName,
          email: formData.email,
          graduationYear: parseInt(formData.graduationYear),
          hospital: isWizard ? (formData.address || 'Not provided') : formData.hospital,
          field: isWizard ? formData.fieldOfMedicine : formData.field,
          role: 'member',
          avatar: `image/placeholders/avatars/a${[10, 13, 14, 20, 25][this.mockUsers.length % 5]}.jpg`,
          verified: false,
          nickname: formData.nickname,
          birthday: formData.birthday,
          specialization: formData.specialization,
          batch: formData.batch,
          mobile: formData.mobile,
          telephone: formData.telephone,
          homePhone: formData.homePhone,
          facebook: formData.facebook,
          instagram: formData.instagram,
          address: formData.address
        };

        this.mockUsers.push(newUser);
      }

      // Use custom success screen if present
      const successScreen = document.getElementById('success-screen');
      const successEmail = document.getElementById('success-email');
      if (successScreen && successEmail) {
        successEmail.textContent = formData.email;
        signupForm.classList.add('hidden');
        successScreen.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
      }

      this.showSuccess(
        'Registration submitted! Your account is pending admin verification. You will be notified via email once approved.',
        () => {
          window.location.href = 'index.html';
        }
      );
    });
  },

  /**
   * Validate signup form data
   * @param {Object} data - Form data
   * @param {boolean} isWizard - Whether the new wizard form is being used
   * @returns {string|null} Error message or null if valid
   */
  validateSignup(data, isWizard = false) {
    if (isWizard) {
      if (!data.firstName || !data.lastName || !data.nickname || !data.birthday || !data.email || !data.username || !data.password) {
        return 'Please fill in all required fields';
      }
      if (!data.graduationYear || !data.fieldOfMedicine || !data.batch) {
        return 'Please fill in all required medical background fields';
      }
      if (!data.hasContact) {
        return 'Please provide at least one contact number';
      }
    } else {
      if (!data.fullName || !data.email || !data.username || !data.password) {
        return 'Please fill in all required fields';
      }
    }

    if (data.password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(data.password) || !/[a-z]/.test(data.password) || !/[0-9]/.test(data.password)) {
      return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
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
   * Authenticate user (mock fallback only)
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
   * @param {Object} user - User object (from Supabase or mock)
   * @param {boolean} rememberMe - Remember me flag
   */
  loginSuccess(user, rememberMe) {
    // Normalize field names: Supabase uses snake_case, mock uses camelCase
    const name = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ');
    const session = {
      id: user.id,
      username: user.username,
      name: name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || user.avatar_url,
      graduationYear: user.graduationYear || user.graduation_year,
      hospital: user.hospital,
      field: user.field || user.field_of_medicine,
      loginTime: new Date().toISOString()
    };

    // Store in localStorage (kept for compatibility with existing UI code)
    localStorage.setItem('zbm-session', JSON.stringify(session));
    
    if (rememberMe) {
      localStorage.setItem('zbm-remember', 'true');
    }

    this.showSuccess('Welcome back, ' + name.split(' ')[1] + '!');

    // Set flag so home.html shows the welcome modal
    localStorage.setItem('zbm-show-welcome', 'true');

    // Redirect after short delay
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 800);
  },

  /**
   * Check authentication state
   */
  async checkAuthState() {
    const isAuthPage = document.body.classList.contains('auth-page');

    if (this.hasSupabase()) {
      // Check Supabase session
      const { data: { session } } = await db.auth.getSession();
      if (session && isAuthPage) {
        // Already logged in via Supabase — restore local session if missing
        if (!localStorage.getItem('zbm-session')) {
          const { data: profile } = await db
            .from('members')
            .select('*')
            .eq('email', session.user.email)
            .single();
          if (profile) {
            const localSession = {
              id: profile.id,
              username: profile.username,
              name: profile.name,
              email: profile.email,
              role: profile.role,
              avatar: profile.avatar_url,
              graduationYear: profile.graduation_year,
              hospital: profile.hospital,
              field: profile.field_of_medicine,
              loginTime: new Date().toISOString()
            };
            localStorage.setItem('zbm-session', JSON.stringify(localSession));
          }
        }
        window.location.href = 'home.html';
        return;
      }
    } else {
      // Mock fallback
      const session = localStorage.getItem('zbm-session');
      if (session && isAuthPage) {
        window.location.href = 'home.html';
      }
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
      errorEl.classList.remove('hidden');
      errorEl.style.display = 'block';
      errorEl.style.color = '';
      
      // Shake animation
      const card = errorEl.closest('.auth-card') || errorEl.closest('.bg-\\[var\\(--login-glass-dark\\)\\]');
      card?.classList.add('shake');
      setTimeout(() => {
        card?.classList.remove('shake');
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
      errorEl.classList.remove('hidden');
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
  async logout() {
    if (this.hasSupabase()) {
      await db.auth.signOut();
    }
    localStorage.removeItem('zbm-session');
    localStorage.removeItem('zbm-remember');
    localStorage.removeItem('zbm-show-welcome');
    this.resetFailedAttempts();
    window.location.href = 'index.html';
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
  },

  /**
   * Check if current user is an officer or admin
   * @returns {boolean}
   */
  isOfficer() {
    const user = this.getCurrentUser();
    return user && (user.role === 'admin' || user.role === 'officer');
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  AuthModule.init();
});

// Expose globally
window.AuthModule = AuthModule;
