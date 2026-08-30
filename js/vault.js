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

  // Albums loaded from Supabase; empty until loadVaultItems() populates it
  albums: [],

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

  // Uploads awaiting officer review (in-memory only until cloud storage exists)
  pendingUploads: [],

  // Staged files for upload modal (with object URLs for preview)
  stagedFiles: [],
  stagedPreviews: [],

  // Album mode: 'new' or 'existing'
  albumMode: 'new',

  // Upload in progress flag
  uploadInProgress: false,

  // Current step: 1 = form, 2 = review
  currentStep: 1,

  // Cached review data (filled when user clicks Review)
  reviewData: null,

  // Category mapping between DB enum and display names
  CATEGORY_MAP: {
    'mission': 'Charity Mission',
    'charity_mission': 'Charity Mission',
    'gala': 'Annual Gala',
    'annual_gala': 'Annual Gala',
    'induction': 'Induction',
    'founders_day': 'Founders Day',
    'research': 'Research',
    'conference': 'Conference',
    'reunion': 'Reunion',
    'graduation': 'Graduation',
    'other': 'Other'
  },

  // Reverse mapping: display name → DB enum value
  CATEGORY_TO_ENUM: {
    'Charity Mission': 'charity_mission',
    'Annual Gala': 'annual_gala',
    'Induction': 'induction',
    'Founders Day': 'founders_day',
    'Research': 'research',
    'Conference': 'conference',
    'Reunion': 'reunion',
    'Graduation': 'graduation',
    'Other': 'other'
  },

  CATEGORY_META: {
    'Charity Mission': { icon: 'heart-handshake', color: '#ef4444' },
    'Annual Gala': { icon: 'party-popper', color: '#f59e0b' },
    'Induction': { icon: 'award', color: '#10b981' },
    'Founders Day': { icon: 'crown', color: '#f97316' },
    'Research': { icon: 'microscope', color: '#14b8a6' },
    'Conference': { icon: 'mic', color: '#3b82f6' },
    'Reunion': { icon: 'users', color: '#a855f7' },
    'Graduation': { icon: 'graduation-cap', color: '#d4af37' },
    'Other': { icon: 'folder', color: '#6b7280' }
  },

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
   * Check if Supabase is configured
   */
  hasSupabase() {
    return typeof db !== 'undefined' && db &&
           typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');
  },

  /**
   * Initialize vault module
   */
  async init() {
    this.applyRoleGating();
    if (this.hasSupabase()) {
      await this.loadVaultItems();
      await this.loadPendingUploads();
    }
    this.renderFilters();
    this.populateUploadCategories();
    this.renderAlbumGrid();
    this.renderWeeklyHighlights();
    this.renderPendingApprovals();
    this.setupEventListeners();
    this.setupUploadModalListeners();
    this.renderStats();
  },

  /**
   * Load vault items from Supabase and group into albums
   */
  async loadVaultItems() {
    const { data, error } = await db
      .from('vault_items')
      .select('id, album_id, year, title, caption, media_url, thumbnail_url, file_key, thumb_key, category, event_date, location, is_featured, is_public')
      .eq('approval_status', 'approved')
      .is('deleted_at', null)
      .order('year', { ascending: false })
      .order('id', { ascending: true });

    if (error) {
      console.error('vault: loadVaultItems error', error);
      return;
    }
    if (!data || data.length === 0) {
      this.albums = [];
      return;
    }

    // Group items by album_id
    const albumMap = {};
    data.forEach(item => {
      const albumId = item.album_id || `album-${item.year}-${item.title}`;
      if (!albumMap[albumId]) {
        const displayCategory = this.CATEGORY_MAP[item.category] || 'Other';
        const meta = this.CATEGORY_META[displayCategory] || this.CATEGORY_META['Other'];
        const dateStr = item.event_date
          ? new Date(item.event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : String(item.year);
        albumMap[albumId] = {
          id: albumId,
          title: item.title,
          description: item.caption || '',
          date: dateStr,
          location: item.location || 'Unknown',
          coverImage: item.thumbnail_url || item.media_url,
          category: displayCategory,
          categoryIcon: meta.icon,
          categoryColor: meta.color,
          isPublic: item.is_public,
          photos: []
        };
      }
      albumMap[albumId].photos.push({
        src: item.media_url,
        thumb: item.thumbnail_url || item.media_url,
        caption: item.caption || '',
        fileKey: item.file_key,
        thumbKey: item.thumb_key
      });
    });

    this.albums = Object.values(albumMap);
  },

  /**
   * Load pending vault uploads from Supabase for officer review
   */
  async loadPendingUploads() {
    const { data, error } = await db
      .from('vault_items')
      .select('id, album_id, title, category, event_date, location, is_public, created_at, uploaded_by, file_key, thumb_key')
      .eq('approval_status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) return;

    // Group by album_id to count files per submission
    const albumMap = {};
    data.forEach(item => {
      const albumId = item.album_id || `album-${item.id}`;
      if (!albumMap[albumId]) {
        albumMap[albumId] = {
          id: item.id,
          albumId,
          albumName: item.title,
          date: item.event_date || '',
          location: item.location || '',
          visibility: item.is_public ? 'public' : 'private',
          category: this.CATEGORY_MAP[item.category] || 'Other',
          fileCount: 1,
          submittedBy: 'Member #' + item.uploaded_by,
          submittedAt: item.created_at,
          r2Keys: [item.file_key, item.thumb_key].filter(Boolean)
        };
      } else {
        albumMap[albumId].fileCount++;
        albumMap[albumId].id = item.id;
        if (item.file_key) albumMap[albumId].r2Keys.push(item.file_key);
        if (item.thumb_key) albumMap[albumId].r2Keys.push(item.thumb_key);
      }
    });

    this.pendingUploads = Object.values(albumMap);
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
   * Setup event listeners for the upload modal (file input, drag-drop, radio buttons)
   */
  setupUploadModalListeners() {
    const fileInput = document.getElementById('vault-file-input');
    const dropzone = document.getElementById('vault-dropzone');
    const radios = document.querySelectorAll('input[name="album-mode"]');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        this.handleFileSelect(Array.from(e.target.files || []));
        e.target.value = '';
      });
    }

    if (dropzone) {
      const emptyP = dropzone.querySelector('#vault-dropzone-empty p');
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
        if (emptyP) emptyP.textContent = 'Drop to upload';
      });
      dropzone.addEventListener('dragleave', (e) => {
        if (e.target === dropzone) {
          dropzone.classList.remove('drag-active');
          if (emptyP) emptyP.textContent = 'Drag & drop or click to browse';
        }
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
        if (emptyP) emptyP.textContent = 'Drag & drop or click to browse';
        this.handleFileSelect(Array.from(e.dataTransfer.files || []));
      });
    }

    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.setAlbumMode(e.target.value);
      });
    });
  },

  /**
   * Handle files selected via input or drag-drop.
   * Validates each file, adds valid ones to stagedFiles, shows errors for invalid.
   */
  handleFileSelect(files) {
    const errors = [];
    const validFiles = [];

    for (const file of files) {
      const validationError = typeof MediaUpload !== 'undefined'
        ? MediaUpload.validate(file)
        : this._validateFile(file);
      if (validationError) {
        errors.push(validationError);
      } else {
        validFiles.push(file);
      }
    }

    for (const file of validFiles) {
      const url = URL.createObjectURL(file);
      this.stagedFiles.push(file);
      this.stagedPreviews.push({ file, url });
    }

    this.renderDropzonePreviews();
    this.renderDropzoneErrors(errors);
    this.updateSubmitButton();
  },

  /**
   * Fallback file validation when MediaUpload is not available
   */
  _validateFile(file) {
    if (!file) return 'No file selected';
    const accepted = ['image/jpeg', 'image/png', 'image/webp'];
    if (!accepted.includes(file.type)) {
      return `"${file.name}" is not a supported image (JPG, PNG or WebP)`;
    }
    if (file.size > 10 * 1024 * 1024) {
      return `"${file.name}" is larger than 10MB`;
    }
    if (file.size === 0) {
      return `"${file.name}" is empty`;
    }
    return null;
  },

  /**
   * Render thumbnail previews for staged files inside the dropzone
   */
  renderDropzonePreviews() {
    const emptyEl = document.getElementById('vault-dropzone-empty');
    const previewsEl = document.getElementById('vault-dropzone-previews');
    const fileCountEl = document.getElementById('vault-dropzone-filecount');
    if (!emptyEl || !previewsEl) return;

    if (this.stagedPreviews.length === 0) {
      emptyEl.style.display = '';
      previewsEl.style.display = 'none';
      previewsEl.innerHTML = '';
      if (fileCountEl) fileCountEl.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    previewsEl.style.display = 'grid';

    const e = (s) => this.escapeHTML(s);
    const fmtSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    };

    previewsEl.innerHTML = this.stagedPreviews.map((p, i) => {
      const isImage = p.file.type.startsWith('image/');
      const thumb = isImage
        ? `<img src="${p.url}" alt="${e(p.file.name)}" class="vault-dropzone-thumb-img">`
        : `<div class="vault-dropzone-thumb-icon"><i data-lucide="file" class="w-6 h-6"></i></div>`;
      return `
        <div class="vault-dropzone-thumb">
          ${thumb}
          <span class="vault-dropzone-thumb-size">${fmtSize(p.file.size)}</span>
          <button class="vault-dropzone-thumb-remove" onclick="event.stopPropagation(); VaultModule.removeStagedFile(${i})" title="Remove">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
          <span class="vault-dropzone-thumb-name">${e(p.file.name)}</span>
        </div>
      `;
    }).join('');

    // Show file count badge
    if (fileCountEl) {
      const totalSize = this.stagedFiles.reduce((sum, f) => sum + f.size, 0);
      fileCountEl.style.display = 'flex';
      fileCountEl.innerHTML = `<i data-lucide="files" class="w-4 h-4"></i> ${this.stagedFiles.length} file${this.stagedFiles.length === 1 ? '' : 's'} selected (${fmtSize(totalSize)})`;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Render inline error messages below the dropzone
   */
  renderDropzoneErrors(errors) {
    const el = document.getElementById('vault-dropzone-errors');
    if (!el) return;
    if (!errors || errors.length === 0) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = errors.map(msg =>
      `<div class="vault-dropzone-error-item"><i data-lucide="alert-circle" class="w-4 h-4"></i> ${this.escapeHTML(msg)}</div>`
    ).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Remove a staged file by index, revoke its object URL
   */
  removeStagedFile(index) {
    if (index < 0 || index >= this.stagedPreviews.length) return;
    URL.revokeObjectURL(this.stagedPreviews[index].url);
    this.stagedFiles.splice(index, 1);
    this.stagedPreviews.splice(index, 1);
    this.renderDropzonePreviews();
    this.updateSubmitButton();
  },

  /**
   * Clear all staged files and revoke object URLs
   */
  clearStagedFiles() {
    this.stagedPreviews.forEach(p => URL.revokeObjectURL(p.url));
    this.stagedFiles = [];
    this.stagedPreviews = [];
    this.renderDropzonePreviews();
    this.renderDropzoneErrors([]);
    this.updateSubmitButton();
  },

  /**
   * Enable/disable the submit button based on staged files count
   */
  updateSubmitButton() {
    const btn = document.getElementById('vault-submit-btn');
    if (!btn) return;
    btn.disabled = this.stagedFiles.length === 0 || this.uploadInProgress;
  },

  /**
   * Switch to step 2 (review) — validates form and renders review card
   */
  reviewUpload() {
    const nameInput = document.getElementById('upload-album-name');
    const existingSelect = document.getElementById('upload-existing-album');
    const dateInput = document.getElementById('upload-date');
    const locationInput = document.getElementById('upload-location');
    const visibilitySelect = document.getElementById('upload-visibility');
    const categorySelect = document.getElementById('upload-category');

    let albumName, existingAlbumId;
    if (this.albumMode === 'existing') {
      existingAlbumId = existingSelect?.value || '';
      if (!existingAlbumId) {
        this.showToast('Please select an existing album to add to');
        return;
      }
      const album = this.albums.find(a => a.id === existingAlbumId);
      albumName = album ? album.title : '';
    } else {
      albumName = nameInput?.value.trim();
      if (!albumName) {
        this.showToast('Please enter an album/event name');
        return;
      }
    }

    if (this.stagedFiles.length === 0) {
      this.showToast('Please select at least one image to upload');
      return;
    }

    const categoryValue = categorySelect?.value || this.CATEGORIES[0];
    const visibility = visibilitySelect?.value || 'private';
    const dateValue = dateInput?.value || '';
    const locationValue = locationInput?.value.trim() || '';

    this.reviewData = { albumName, existingAlbumId, categoryValue, visibility, dateValue, locationValue };
    this.renderReviewStep();
    this.goToStep2();
  },

  /**
   * Render the review card content
   */
  renderReviewStep() {
    const container = document.getElementById('vault-review-content');
    if (!container || !this.reviewData) return;

    const e = (s) => this.escapeHTML(s);
    const fmtSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    };

    const r = this.reviewData;
    const totalSize = this.stagedFiles.reduce((sum, f) => sum + f.size, 0);
    const dateDisplay = r.dateValue ? new Date(r.dateValue).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not specified';

    const fileThumbs = this.stagedPreviews.map(p => {
      const isImage = p.file.type.startsWith('image/');
      const img = isImage
        ? `<img src="${p.url}" alt="${e(p.file.name)}">`
        : `<div class="vault-dropzone-thumb-icon"><i data-lucide="file" class="w-5 h-5"></i></div>`;
      return `
        <div class="vault-review-file">
          ${img}
          <div class="vault-review-file-info">${e(p.file.name)} &middot; ${fmtSize(p.file.size)}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="vault-review-card">
        <div class="vault-review-section">
          <div class="vault-review-label">Album</div>
          <div class="vault-review-value">${e(r.albumName)}</div>
        </div>
        <div class="vault-review-grid">
          <div class="vault-review-section">
            <div class="vault-review-label">Category</div>
            <div class="vault-review-value">${e(r.categoryValue)}</div>
          </div>
          <div class="vault-review-section">
            <div class="vault-review-label">Visibility</div>
            <div class="vault-review-value">${r.visibility === 'public' ? 'Public' : 'Members only'}</div>
          </div>
          <div class="vault-review-section">
            <div class="vault-review-label">Date</div>
            <div class="vault-review-value">${e(dateDisplay)}</div>
          </div>
          <div class="vault-review-section">
            <div class="vault-review-label">Location</div>
            <div class="vault-review-value">${r.locationValue ? e(r.locationValue) : 'Not specified'}</div>
          </div>
        </div>
        <div class="vault-review-section">
          <div class="vault-review-label">Files (${this.stagedFiles.length} &middot; ${fmtSize(totalSize)})</div>
          <div class="vault-review-files">${fileThumbs}</div>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Navigate to step 2
   */
  goToStep2() {
    this.currentStep = 2;
    document.getElementById('vault-upload-step-1').style.display = 'none';
    document.getElementById('vault-upload-step-2').style.display = '';
    document.getElementById('vault-submit-btn').style.display = 'none';
    document.getElementById('vault-confirm-btn').style.display = '';
    document.getElementById('vault-back-btn').style.display = '';
    document.getElementById('vault-cancel-btn').style.display = 'none';
    document.getElementById('vault-step-1-dot').classList.remove('active');
    document.getElementById('vault-step-2-dot').classList.add('active');
    document.getElementById('vault-step-line').classList.add('active');
    const titleText = document.getElementById('vault-modal-title-text');
    if (titleText) titleText.textContent = 'Review & Confirm';
    const subText = document.getElementById('vault-modal-sub-text');
    if (subText) subText.textContent = 'Check the details below, then confirm to upload.';
  },

  /**
   * Navigate back to step 1
   */
  backToStep1() {
    this.currentStep = 1;
    document.getElementById('vault-upload-step-1').style.display = '';
    document.getElementById('vault-upload-step-2').style.display = 'none';
    document.getElementById('vault-submit-btn').style.display = '';
    document.getElementById('vault-confirm-btn').style.display = 'none';
    document.getElementById('vault-back-btn').style.display = 'none';
    document.getElementById('vault-cancel-btn').style.display = '';
    document.getElementById('vault-step-1-dot').classList.add('active');
    document.getElementById('vault-step-2-dot').classList.remove('active');
    document.getElementById('vault-step-line').classList.remove('active');
    const titleText = document.getElementById('vault-modal-title-text');
    if (titleText) titleText.textContent = 'Upload to the Vault';
    const subText = document.getElementById('vault-modal-sub-text');
    if (subText) subText.textContent = 'Submit photos. Officers will review before they go live.';
    // Hide progress if visible
    const progressWrap = document.getElementById('vault-upload-progress-wrap');
    if (progressWrap) progressWrap.style.display = 'none';
  },

  /**
   * Switch album mode between 'new' (text input) and 'existing' (select)
   */
  setAlbumMode(mode) {
    this.albumMode = mode;
    const newGroup = document.getElementById('upload-album-new-group');
    const existingGroup = document.getElementById('upload-album-existing-group');
    const nameInput = document.getElementById('upload-album-name');
    const existingSelect = document.getElementById('upload-existing-album');

    if (mode === 'existing') {
      if (newGroup) newGroup.style.display = 'none';
      if (existingGroup) existingGroup.style.display = '';
      if (nameInput) nameInput.value = '';
      this.populateExistingAlbums();
    } else {
      if (newGroup) newGroup.style.display = '';
      if (existingGroup) existingGroup.style.display = 'none';
      if (existingSelect) existingSelect.value = '';
    }
  },

  /**
   * Populate the existing-album select from real album data
   */
  populateExistingAlbums() {
    const select = document.getElementById('upload-existing-album');
    if (!select) return;

    if (this.albums.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No albums yet — create a new one instead</option>';
      select.disabled = true;
      return;
    }

    select.disabled = false;
    select.innerHTML = '<option value="" disabled selected>Select an album…</option>' +
      this.albums.map(a => `<option value="${this.escapeHTML(a.id)}">${this.escapeHTML(a.title)}</option>`).join('');
  },

  /**
   * Render the Weekly Highlights section from real data
   */
  renderWeeklyHighlights() {
    const container = document.getElementById('vault-highlights');
    if (!container) return;

    if (this.albums.length === 0) {
      container.innerHTML = `
        <div class="vault-highlights-header">
          <h3 class="vault-highlights-title">
            <i data-lucide="sparkles" class="w-5 h-5"></i>
            Weekly Highlights
          </h3>
          <span class="vault-highlights-note">Top photos this week, ranked by reactions &amp; comments</span>
        </div>
        <div class="vault-empty-state vault-highlights-empty">
          <i data-lucide="sparkles" class="w-12 h-12 text-[#d4af37] opacity-40"></i>
          <p class="text-sm opacity-70 mt-3">No highlights yet this week — be the first to upload and react to a photo.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const e = (s) => this.escapeHTML(s);
    const allPhotos = [];
    this.albums.forEach(album => {
      album.photos.forEach((photo, idx) => {
        allPhotos.push({
          photo,
          album,
          index: idx,
          likes: album.likes != null ? album.likes : 0,
          comments: album.comments != null ? album.comments : 0
        });
      });
    });

    allPhotos.sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments));
    const top = allPhotos.slice(0, 4);

    if (top.length === 0) {
      container.innerHTML = '';
      return;
    }

    const cards = top.map(item => {
      const thumbUrl = this.thumb(item.photo);
      const img = thumbUrl
        ? `<img src="${e(thumbUrl)}" alt="${e(item.photo.caption || item.album.title)}" class="vault-highlight-thumb-img" loading="lazy">`
        : `<div class="vault-highlight-thumb-icon"><i data-lucide="image" class="w-6 h-6"></i></div>`;
      return `
        <div class="vault-highlight-card" onclick="VaultModule.openAlbum('${e(item.album.id)}')">
          <div class="vault-highlight-thumb">${img}</div>
          <div class="vault-highlight-stats">
            <span><i data-lucide="heart" class="w-3 h-3"></i> ${item.likes}</span>
            <span><i data-lucide="message-circle" class="w-3 h-3"></i> ${item.comments}</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="vault-highlights-header">
        <h3 class="vault-highlights-title">
          <i data-lucide="sparkles" class="w-5 h-5"></i>
          Weekly Highlights
        </h3>
        <span class="vault-highlights-note">Top photos this week, ranked by reactions &amp; comments</span>
      </div>
      <div class="vault-highlights-row">${cards}</div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Reusable empty-state HTML builder
   */
  renderEmptyState(icon, title, message, ctaText, ctaOnclick) {
    const cta = ctaText && ctaOnclick
      ? `<button class="btn btn-gold btn-sm mt-4" onclick="${ctaOnclick}"><i data-lucide="upload" class="w-4 h-4"></i> ${this.escapeHTML(ctaText)}</button>`
      : '';
    return `
      <div class="vault-empty-state">
        <i data-lucide="${this.escapeHTML(icon)}" class="w-16 h-16 text-[#d4af37] opacity-50"></i>
        <h3 class="text-xl font-semibold mt-4">${this.escapeHTML(title)}</h3>
        <p class="text-sm opacity-70 mt-2">${this.escapeHTML(message)}</p>
        ${cta}
      </div>
    `;
  },

  /**
   * Hide officer-only controls unless the session role is admin (UI-level gate)
   */
  applyRoleGating() {
    let isOfficer = false;
    try {
      const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      isOfficer = !!session && (session.role === 'admin' || session.role === 'officer');
    } catch (e) { /* no session */ }
    if (!isOfficer) {
      const btn = document.getElementById('officer-view-btn');
      if (btn) btn.style.display = 'none';
    }
  },

  /**
   * Resolve a thumbnail URL for grid/cover usage (full-size stays for lightbox).
   * R2 photos carry a dedicated thumbnail_url; legacy paths fall back to src.
   */
  thumb(photo) {
    if (!photo) return '';
    if (typeof photo === 'string') return photo;
    return photo.thumb || photo.src || '';
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
      if (this.albums.length === 0) {
        gallery.innerHTML = this.renderEmptyState(
          'image-off',
          'No Albums Yet',
          'Be the first to create an album and preserve a moment in fraternity history.',
          'Upload Photos',
          "VaultModule.openUploadModal()"
        );
      } else if (this.selectedCategory !== 'all') {
        gallery.innerHTML = this.renderEmptyState(
          'folder-search',
          'No Albums in This Category',
          `No albums found in "${this.selectedCategory}". Try a different category or upload a new photo.`,
          'Upload Photos',
          "VaultModule.openUploadModal()"
        );
      } else {
        gallery.innerHTML = this.renderEmptyState(
          'image-off',
          'No Albums Found',
          'Try adjusting your filters or search query.',
          null, null
        );
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    gallery.innerHTML = filteredAlbums.map(album => {
      const e = (s) => this.escapeHTML(s);
      const isPublic = album.isPublic === true;
      const likes = album.likes != null ? album.likes : 0;
      const comments = album.comments != null ? album.comments : 0;
      const visBadge = isPublic
        ? `<span class="album-visibility album-visibility-public"><i data-lucide="globe" class="w-3 h-3"></i> Public</span>`
        : `<span class="album-visibility album-visibility-private"><i data-lucide="lock" class="w-3 h-3"></i> Members</span>`;
      const officerToggle = this.officerView
        ? `<button class="album-vis-toggle" onclick="VaultModule.toggleAlbumVisibility('${e(album.id)}', event)" title="Officer: toggle public viewing">
             <i data-lucide="${isPublic ? 'eye' : 'eye-off'}" class="w-3 h-3"></i>
             ${isPublic ? 'Set Private' : 'Make Public'}
           </button>`
        : '';
      return `
      <div class="album-card glass-card" onclick="VaultModule.openAlbum('${e(album.id)}')">
        <div class="album-cover">
          <img src="${e(this.thumb(album.coverImage))}" alt="${e(album.title)}" class="album-cover-image" loading="lazy" decoding="async">
          <div class="album-cover-badges">${visBadge}</div>
          <div class="album-overlay">
            <div class="album-photo-count">
              <i data-lucide="images" class="w-5 h-5"></i>
              <span>${album.photos.length} photos</span>
            </div>
          </div>
        </div>
        <div class="album-info">
          <div class="album-category" style="color: ${e(album.categoryColor)}">
            <i data-lucide="${e(album.categoryIcon)}" class="w-4 h-4"></i>
            <span>${e(album.category)}</span>
          </div>
          <h3 class="album-title">${e(album.title)}</h3>
          <div class="album-meta">
            <span class="album-date">
              <i data-lucide="calendar" class="w-3 h-3"></i>
              ${e(album.date)}
            </span>
            <span class="album-location">
              <i data-lucide="map-pin" class="w-3 h-3"></i>
              ${e(album.location)}
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
   * Toggle an album's public/private visibility (officer-only).
   * Persists to Supabase when configured; otherwise stays local-only
   * so this is a drop-in shell for when the cloud backend is connected.
   */
  async toggleAlbumVisibility(albumId, event) {
    if (event) event.stopPropagation();
    const album = this.albums.find(a => a.id === albumId);
    if (!album) return;

    const newVisibility = !album.isPublic;

    if (this.hasSupabase()) {
      const { error } = await db.from('vault_items')
        .update({ is_public: newVisibility })
        .eq('album_id', albumId);
      if (error) {
        this.showToast('Failed to update visibility');
        return;
      }
    }

    album.isPublic = newVisibility;
    this.renderAlbumGrid();
    this.showToast(`Album is now ${newVisibility ? 'public' : 'members only'}`);
  },

  /**
   * Submit the upload modal's form as a pending item for officer review.
   * Uploads files to Supabase Storage and inserts rows into vault_items
   * with approval_status = 'pending'. Falls back to in-memory mock for local dev.
   */
  /**
   * Confirm upload from step 2 — shows progress bar and delegates to submitUploadForApproval
   */
  async confirmUpload() {
    const confirmBtn = document.getElementById('vault-confirm-btn');
    const confirmLabel = document.getElementById('vault-confirm-label');
    const progressWrap = document.getElementById('vault-upload-progress-wrap');
    const progressBar = document.getElementById('vault-upload-progress-bar');
    const progressText = document.getElementById('vault-upload-progress-text');

    if (confirmBtn) confirmBtn.disabled = true;
    if (confirmLabel) confirmLabel.textContent = 'Uploading…';
    if (progressWrap) progressWrap.style.display = '';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Starting…';

    // Simulate progress updates during upload
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + 5, 90);
      if (progressBar) progressBar.style.width = progress + '%';
    }, 200);

    try {
      await this.submitUploadForApproval();
      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.textContent = 'Done!';
    } catch (err) {
      if (progressText) progressText.textContent = 'Upload failed';
    } finally {
      clearInterval(progressInterval);
      if (confirmBtn) confirmBtn.disabled = false;
      if (confirmLabel) confirmLabel.textContent = 'Confirm & Upload';
    }
  },

  async submitUploadForApproval() {
    const nameInput = document.getElementById('upload-album-name');
    const existingSelect = document.getElementById('upload-existing-album');
    const dateInput = document.getElementById('upload-date');
    const locationInput = document.getElementById('upload-location');
    const visibilitySelect = document.getElementById('upload-visibility');
    const categorySelect = document.getElementById('upload-category');
    const submitLabel = document.getElementById('vault-submit-label');

    // Determine album name/id based on mode
    let albumName, existingAlbumId;
    if (this.albumMode === 'existing') {
      existingAlbumId = existingSelect?.value || '';
      if (!existingAlbumId) {
        this.showToast('Please select an existing album to add to');
        return;
      }
      const album = this.albums.find(a => a.id === existingAlbumId);
      albumName = album ? album.title : '';
    } else {
      albumName = nameInput?.value.trim();
      if (!albumName) {
        this.showToast('Please enter an album/event name before submitting');
        return;
      }
    }

    if (this.stagedFiles.length === 0) {
      this.showToast('Please select at least one image to upload');
      return;
    }

    let memberId = null;
    try {
      const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      if (session?.id) memberId = session.id;
    } catch (e) { /* no session */ }

    const files = this.stagedFiles;
    const categoryValue = categorySelect?.value || this.CATEGORIES[0];
    const visibility = visibilitySelect?.value || 'private';
    const dateValue = dateInput?.value || '';
    const locationValue = locationInput?.value.trim() || '';

    // Show upload progress
    this.uploadInProgress = true;
    this.updateSubmitButton();
    if (submitLabel) submitLabel.textContent = 'Uploading…';

    const albumId = existingAlbumId || `album-${Date.now()}`;
    const year = dateValue ? new Date(dateValue).getFullYear() : new Date().getFullYear();
    const categoryEnum = this.CATEGORY_TO_ENUM[categoryValue] || 'other';
    const isPublic = visibility === 'public';

    // R2 upload path (production)
    if (this.hasSupabase() && memberId && typeof MediaUpload !== 'undefined' && MediaUpload.isConfigured()) {
      let uploaded = 0;
      const errors = [];
      const progressText = document.getElementById('vault-upload-progress-text');
      for (const file of files) {
        try {
          if (progressText) progressText.textContent = `Uploading ${uploaded + 1}/${files.length}: ${file.name}`;
          const { full, thumb } = await MediaUpload.upload(file, 'vault', {
            albumId,
            withThumbnail: true,
            onProgress: (stage) => {
              if (progressText) progressText.textContent = stage === 'compressing'
                ? `Processing ${uploaded + 1}/${files.length}: ${file.name}`
                : `Uploading ${uploaded + 1}/${files.length}: ${file.name}`;
            },
          });

          const { error: insertError } = await db.from('vault_items').insert({
            album_id: albumId,
            year: year,
            title: albumName,
            caption: '',
            media_url: full.publicUrl,
            thumbnail_url: thumb ? thumb.publicUrl : full.publicUrl,
            file_key: full.fileKey,
            thumb_key: thumb ? thumb.fileKey : null,
            item_type: 'photo',
            category: categoryEnum,
            event_date: dateValue || null,
            location: locationValue || null,
            uploaded_by: memberId,
            is_public: isPublic,
            approval_status: 'pending'
          });

          if (insertError) {
            errors.push(`${file.name}: ${insertError.message}`);
          } else {
            uploaded++;
          }
        } catch (err) {
          errors.push(`${file.name}: ${err.message || 'Upload failed'}`);
        }
      }

      this.uploadInProgress = false;
      this.updateSubmitButton();
      if (submitLabel) submitLabel.textContent = 'Submit for Approval';

      if (errors.length > 0 && uploaded === 0) {
        this.renderDropzoneErrors(errors);
        this.showToast('Upload failed — see errors below');
        return;
      }

      await this.loadPendingUploads();
      this.closeUploadModal();
      if (errors.length > 0) {
        this.showToast(`${uploaded} image${uploaded === 1 ? '' : 's'} submitted; ${errors.length} failed`);
      } else {
        this.showToast(`${uploaded} image${uploaded === 1 ? '' : 's'} submitted for officer approval`);
      }
    } else if (this.hasSupabase() && memberId) {
      // Supabase configured but R2 not available (local dev / Playwright)
      let uploaded = 0;
      const errors = [];

      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          errors.push(`"${file.name}" is not an image`);
          continue;
        }
        const { error: insertError } = await db.from('vault_items').insert({
          album_id: albumId,
          year: year,
          title: albumName,
          caption: '',
          media_url: '',
          thumbnail_url: '',
          item_type: 'photo',
          category: categoryEnum,
          event_date: dateValue || null,
          location: locationValue || null,
          uploaded_by: memberId,
          is_public: isPublic,
          approval_status: 'pending'
        });
        if (insertError) {
          errors.push(`${file.name}: ${insertError.message}`);
        } else {
          uploaded++;
        }
      }

      this.uploadInProgress = false;
      this.updateSubmitButton();
      if (submitLabel) submitLabel.textContent = 'Submit for Approval';

      if (errors.length > 0 && uploaded === 0) {
        this.renderDropzoneErrors(errors);
        this.showToast('Upload failed — see errors below');
        return;
      }

      await this.loadPendingUploads();
      this.closeUploadModal();
      this.showToast('Upload submitted for officer approval (R2 not configured)');
    } else {
      // No Supabase — in-memory mock for local dev
      this.pendingUploads.push({
        id: 'pending-' + Date.now(),
        albumName,
        date: dateValue,
        location: locationValue,
        visibility,
        category: categoryValue,
        fileCount: files.length,
        submittedBy: 'Local dev',
        submittedAt: new Date()
      });

      this.uploadInProgress = false;
      this.updateSubmitButton();
      if (submitLabel) submitLabel.textContent = 'Submit for Approval';

      this.renderPendingApprovals();
      this.closeUploadModal();
      this.showToast('Upload submitted for officer approval');
    }
  },

  /**
   * Render the officer approval panel's pending uploads list
   */
  renderPendingApprovals() {
    const list = document.getElementById('pending-approvals-list');
    if (!list) return;

    if (this.pendingUploads.length === 0) {
      list.innerHTML = '<p class="vault-approval-empty">No pending uploads awaiting review.</p>';
    } else {
      list.innerHTML = this.pendingUploads.map(item => {
        const e = (s) => this.escapeHTML(s);
        return `
        <div class="vault-approval-item" data-pending-id="${item.id}">
          <div class="vault-approval-thumb"><i data-lucide="image" class="w-5 h-5"></i></div>
          <div class="vault-approval-info">
            <strong>${e(item.albumName)} (${item.fileCount} file${item.fileCount === 1 ? '' : 's'})</strong>
            <span>Submitted by ${e(item.submittedBy)} &bull; ${e(item.category)}${item.date ? ' &bull; ' + e(item.date) : ''}${item.location ? ' &bull; ' + e(item.location) : ''}</span>
          </div>
          <div class="vault-approval-controls">
            <button class="btn btn-gold btn-sm" onclick="VaultModule.approvePendingUpload('${e(item.id)}')"><i data-lucide="check" class="w-4 h-4"></i> Approve</button>
            <button class="btn btn-glass btn-sm" onclick="VaultModule.rejectPendingUpload('${e(item.id)}')"><i data-lucide="x" class="w-4 h-4"></i> Reject</button>
          </div>
        </div>
      `;
      }).join('');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Approve a pending upload. Sets approval_status to 'approved' in Supabase
   * so the items become visible in the public gallery.
   */
  async approvePendingUpload(id) {
    const numId = Number(id);
    const idx = this.pendingUploads.findIndex(p => p.id === numId || p.id === id || p.albumId === id || p.albumId === String(id));
    if (idx === -1) {
      this.showToast('Could not find that pending upload');
      return;
    }
    const item = this.pendingUploads[idx];

    if (this.hasSupabase() && item.albumId) {
      const { error, count } = await db.from('vault_items')
        .update({ approval_status: 'approved' })
        .eq('album_id', item.albumId)
        .eq('approval_status', 'pending');
      if (error) { this.showToast('Failed to approve upload: ' + error.message); return; }
    }

    this.pendingUploads.splice(idx, 1);
    this.renderPendingApprovals();
    await this.loadVaultItems();
    this.renderFilters();
    this.renderAlbumGrid();
    this.renderWeeklyHighlights();
    this.renderStats();
    this.showToast(`"${item.albumName}" approved and published to the Vault`);
  },

  /**
   * Reject a pending upload (destructive — confirms first).
   * Sets approval_status to 'rejected' in Supabase.
   */
  async rejectPendingUpload(id) {
    const numId = Number(id);
    const idx = this.pendingUploads.findIndex(p => p.id === numId || p.id === id || p.albumId === id || p.albumId === String(id));
    if (idx === -1) {
      this.showToast('Could not find that pending upload');
      return;
    }
    if (!confirm('Reject this upload? The submission will be discarded and files deleted from storage.')) return;
    const item = this.pendingUploads[idx];

    if (this.hasSupabase() && item.albumId) {
      const { error } = await db.from('vault_items')
        .update({ approval_status: 'rejected' })
        .eq('album_id', item.albumId)
        .eq('approval_status', 'pending');
      if (error) { this.showToast('Failed to reject upload'); return; }

      // Clean up R2 objects so rejected media doesn't consume storage
      if (item.r2Keys && item.r2Keys.length > 0 && typeof MediaUpload !== 'undefined' && MediaUpload.isConfigured()) {
        try {
          await MediaUpload.deleteKeys(item.r2Keys);
        } catch (err) {
          console.error('vault: R2 cleanup failed for rejected upload', err);
        }
      }
    }

    this.pendingUploads.splice(idx, 1);
    this.renderPendingApprovals();
    this.renderStats();
    this.showToast(`"${item.albumName}" rejected`);
  },

  /**
   * Lightweight toast (vault.html doesn't load feed.js, so this is
   * self-contained rather than depending on FeedModule.showToast)
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #C9A048;
      color: #0F281E;
      padding: 12px 24px;
      border-radius: 8px;
      backdrop-filter: blur(10px);
      z-index: 1000;
      animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * Open the upload modal — reset state and populate album select
   */
  openUploadModal() {
    this.clearStagedFiles();
    this.setAlbumMode('new');
    const newRadio = document.querySelector('input[name="album-mode"][value="new"]');
    if (newRadio) newRadio.checked = true;
    const nameInput = document.getElementById('upload-album-name');
    if (nameInput) nameInput.value = '';
    const dateInput = document.getElementById('upload-date');
    if (dateInput) dateInput.value = '';
    const locationInput = document.getElementById('upload-location');
    if (locationInput) locationInput.value = '';
    this.backToStep1();
    this.reviewData = null;
    const modal = document.getElementById('vault-upload-modal');
    if (modal) modal.classList.remove('hidden');
  },

  closeUploadModal() {
    this.clearStagedFiles();
    this.backToStep1();
    this.reviewData = null;
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

    const e = (s) => this.escapeHTML(s);
    const related = this.albums
      .filter(a => a.id !== this.currentAlbum.id && a.category === this.currentAlbum.category)
      .slice(0, 3);

    let html = `
      <nav class="vault-breadcrumb">
        <a href="#" onclick="VaultModule.closeAlbum(); return false;">Vault</a>
        <span class="vault-breadcrumb-sep">/</span>
        <a href="#" onclick="VaultModule.filterByCategory('${e(this.currentAlbum.category)}'); VaultModule.closeAlbum(); return false;">${e(this.currentAlbum.category)}</a>
        <span class="vault-breadcrumb-sep">/</span>
        <span class="vault-breadcrumb-current">${e(this.currentAlbum.title)}</span>
      </nav>
      <div class="album-hero-card album-hero-clickable" onclick="VaultModule.closeAlbum()">
        <div class="album-hero-badge" style="color: ${e(this.currentAlbum.categoryColor)}">
          <i data-lucide="${e(this.currentAlbum.categoryIcon)}" class="w-4 h-4"></i>
          ${e(this.currentAlbum.category)}
        </div>
        <h1 class="album-hero-title">${e(this.currentAlbum.title)}</h1>
        <p class="album-hero-desc">${e(this.currentAlbum.description)}</p>
        <div class="album-hero-info">
          ${this.currentAlbum.date ? `<span><i data-lucide="calendar" class="w-4 h-4"></i> ${e(this.currentAlbum.date)}</span>` : ''}
          ${this.currentAlbum.location ? `<span><i data-lucide="map-pin" class="w-4 h-4"></i> ${e(this.currentAlbum.location)}</span>` : ''}
          <span><i data-lucide="images" class="w-4 h-4"></i> ${this.currentAlbum.photos.length} photos</span>
        </div>
      </div>

      <div class="album-grid-container">
        ${this.currentAlbum.photos.map((photo, index) => `
          <div class="album-grid-item" onclick="VaultModule.openLightbox(${index})">
            <img src="${e(this.thumb(photo))}" alt="${e(photo.caption)}" class="album-grid-img" loading="lazy" decoding="async">
            <div class="album-grid-overlay">
              <i data-lucide="maximize-2" class="w-6 h-6"></i>
            </div>
            <div class="album-grid-label">${e(photo.caption)}</div>
          </div>
        `).join('')}
      </div>

      ${related.length > 0 ? `
        <div class="vault-related">
          <h3 class="vault-related-title">More from ${e(this.currentAlbum.category)}</h3>
          <div class="vault-related-row">
            ${related.map(a => `
              <div class="vault-related-card glass-card" onclick="VaultModule.openAlbum('${e(a.id)}')">
                <img src="${e(this.thumb(a.coverImage))}" alt="${e(a.title)}" loading="lazy" decoding="async">
                <div class="vault-related-info">
                  <span class="vault-related-name">${e(a.title)}</span>
                  <span class="vault-related-date">${e(a.date)}</span>
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
    
    const e = (s) => this.escapeHTML(s);
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
          <img src="${e(photo.src)}" alt="${e(photo.caption)}" class="vault-lightbox-image">
        </div>
        
        <div class="vault-lightbox-info">
          <div class="vault-lightbox-header">
            <h3 class="vault-lightbox-title">${e(this.currentAlbum.title)}</h3>
            <span class="vault-lightbox-counter">${this.currentPhotoIndex + 1} / ${this.currentAlbum.photos.length}</span>
          </div>
          <p class="vault-lightbox-caption">${e(photo.caption)}</p>
          <div class="vault-lightbox-meta">
            <span><i data-lucide="calendar" class="w-4 h-4"></i> ${e(this.currentAlbum.date)}</span>
            <span><i data-lucide="map-pin" class="w-4 h-4"></i> ${e(this.currentAlbum.location)}</span>
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

    if (allPhotos.length === 0) {
      const gallery = document.getElementById('vault-gallery');
      if (gallery) {
        gallery.innerHTML = this.renderEmptyState(
          'image-off',
          'No Photos Yet',
          'There are no photos in the vault yet. Be the first to upload!',
          'Upload Photos',
          "VaultModule.openUploadModal()"
        );
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
      return;
    }

    // Derive date range from real data
    const years = this.availableYears();
    const dateRange = years.length > 0
      ? (years.length === 1 ? years[0] : `${years[years.length - 1]}-${years[0]}`)
      : '';

    // Derive location summary from real data
    const locations = [...new Set(this.albums.map(a => a.location).filter(l => l && l !== 'Unknown'))];
    const locationSummary = locations.length === 0
      ? ''
      : locations.length === 1
        ? locations[0]
        : 'Various Locations';

    // Create a virtual "All Photos" album
    this.currentAlbum = {
      id: 'all-photos',
      title: 'All Photos',
      description: 'Complete photo archive from all albums across the years',
      date: dateRange,
      location: locationSummary,
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

// Re-init on bfcache restore (browser back/forward)
window.addEventListener('zbm-bfcache-restore', () => {
  VaultModule.init();
});

// Expose globally
window.VaultModule = VaultModule;
