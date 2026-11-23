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
  selectedTags: [],
  searchTimer: null,
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
   * Parse comma/space-separated tag input or caption hashtags into normalized lowercase tokens (without #)
   */
  parseTags(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return [...new Set(raw.map(t => String(t).trim().replace(/^#+/, '').toLowerCase()).filter(Boolean))];
    }
    return [...new Set(
      String(raw)
        .split(/[\s,]+/)
        .map(t => t.trim().replace(/^#+/, '').toLowerCase())
        .filter(Boolean)
    )];
  },

  /**
   * Extract #hashtags embedded inside a caption string
   */
  extractCaptionTags(caption) {
    if (!caption) return [];
    const matches = String(caption).match(/#([a-zA-Z0-9_-]+)/g) || [];
    return this.parseTags(matches);
  },

  /**
   * True for empty values and placeholder garbage like "none" / "null" / "n/a"
   */
  isBadValue(v) {
    return !v || /^(none|null|undefined|n\/a)$/i.test(String(v).trim());
  },

  displayTitle(title) {
    return this.isBadValue(title) ? 'Untitled album' : String(title).trim();
  },

  cleanLocation(loc) {
    return this.isBadValue(loc) || /^unknown$/i.test(String(loc).trim()) ? '' : String(loc).trim();
  },

  /**
   * Album title markup; muted when the stored title is missing/garbage
   */
  titleHtml(album) {
    const t = this.escapeHTML(album.title);
    return album.untitled ? `<span class="vault-untitled">${t}</span>` : t;
  },

  /**
   * Officer/admin session (UI gate; data access is enforced by RLS)
   */
  isOfficer() {
    try {
      const s = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      return !!s && (s.role === 'admin' || s.role === 'officer');
    } catch (e) { return false; }
  },

  /**
   * Remove #hashtags from a caption (legacy rows stored tags there)
   */
  stripCaptionTags(caption) {
    return String(caption || '').replace(/#[a-zA-Z0-9_-]+/g, '').replace(/\s{2,}/g, ' ').trim();
  },

  /**
   * Format a normalized tag token with a leading #
   */
  formatTag(tag) {
    const clean = String(tag || '').trim().replace(/^#+/, '');
    return clean ? `#${clean}` : '';
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
      if (this.isOfficer()) await this.loadPendingUploads();
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
    const cols = 'id, album_id, year, title, caption, media_url, thumbnail_url, file_key, thumb_key, category, event_date, location, is_featured, is_public';
    const run = (c) => db
      .from('vault_items')
      .select(c)
      .eq('approval_status', 'approved')
      .is('deleted_at', null)
      .order('year', { ascending: false })
      .order('id', { ascending: true });
    let { data, error } = await run(cols + ', tags');
    // Older databases without migration 004 have no tags column; fall back to caption hashtags
    if (error && error.code === '42703') ({ data, error } = await run(cols));

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
      const itemTags = this.parseTags([
        ...(Array.isArray(item.tags) ? item.tags : []),
        ...this.extractCaptionTags(item.caption)
      ]);
      if (!albumMap[albumId]) {
        const displayCategory = this.CATEGORY_MAP[item.category] || 'Other';
        const meta = this.CATEGORY_META[displayCategory] || this.CATEGORY_META['Other'];
        const dateStr = item.event_date
          ? new Date(item.event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : String(item.year);
        albumMap[albumId] = {
          id: albumId,
          title: this.displayTitle(item.title),
          rawTitle: item.title,
          untitled: this.isBadValue(item.title),
          description: this.stripCaptionTags(item.caption),
          date: dateStr,
          location: this.cleanLocation(item.location),
          coverImage: item.thumbnail_url || item.media_url,
          category: displayCategory,
          categoryIcon: meta.icon,
          categoryColor: meta.color,
          isPublic: item.is_public,
          eventDate: item.event_date || '',
          tags: itemTags,
          photos: []
        };
      } else if (itemTags.length > 0) {
        albumMap[albumId].tags = this.parseTags([...(albumMap[albumId].tags || []), ...itemTags]);
      }
      albumMap[albumId].photos.push({
        src: item.media_url,
        thumb: item.thumbnail_url || item.media_url,
        caption: this.stripCaptionTags(item.caption),
        tags: itemTags,
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
    const cols = 'id, album_id, title, category, caption, event_date, location, is_public, created_at, uploaded_by, file_key, thumb_key, media_url, thumbnail_url';
    const run = (c) => db
      .from('vault_items')
      .select(c)
      .eq('approval_status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    let { data, error } = await run(cols + ', tags');
    if (error && error.code === '42703') ({ data, error } = await run(cols));

    if (error || !data) return;

    // Group by album_id to count files per submission
    const albumMap = {};
    data.forEach(item => {
      const albumId = item.album_id || `album-${item.id}`;
      if (!albumMap[albumId]) {
        albumMap[albumId] = {
          id: item.id,
          albumId,
          albumName: this.displayTitle(item.title),
          date: item.event_date || '',
          location: item.location || '',
          visibility: item.is_public ? 'public' : 'private',
          category: this.CATEGORY_MAP[item.category] || 'Other',
          tags: this.parseTags([...(Array.isArray(item.tags) ? item.tags : []), ...this.extractCaptionTags(item.caption)]),
          fileCount: 1,
          submittedBy: 'Member #' + item.uploaded_by,
          submittedAt: item.created_at,
          r2Keys: [item.file_key, item.thumb_key].filter(Boolean),
          photos: [{
            id: item.id,
            mediaUrl: item.media_url || '',
            thumbUrl: item.thumbnail_url || item.media_url || '',
            fileKey: item.file_key || null,
            thumbKey: item.thumb_key || null
          }]
        };
      } else {
        albumMap[albumId].fileCount++;
        albumMap[albumId].id = item.id;
        albumMap[albumId].tags = this.parseTags([...albumMap[albumId].tags, ...(Array.isArray(item.tags) ? item.tags : []), ...this.extractCaptionTags(item.caption)]);
        if (item.file_key) albumMap[albumId].r2Keys.push(item.file_key);
        if (item.thumb_key) albumMap[albumId].r2Keys.push(item.thumb_key);
        albumMap[albumId].photos.push({
          id: item.id,
          mediaUrl: item.media_url || '',
          thumbUrl: item.thumbnail_url || item.media_url || '',
          fileKey: item.file_key || null,
          thumbKey: item.thumb_key || null
        });
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
   * Remove a staged file from the Review step (step 2) — keeps step 1 in sync.
   * If no files remain, sends user back to step 1.
   */
  removeReviewFile(index) {
    if (index < 0 || index >= this.stagedPreviews.length) return;
    URL.revokeObjectURL(this.stagedPreviews[index].url);
    this.stagedFiles.splice(index, 1);
    this.stagedPreviews.splice(index, 1);

    this.renderDropzonePreviews();
    this.updateSubmitButton();

    if (this.stagedFiles.length === 0) {
      this.showToast('No files left — add at least one photo to continue');
      this.backToStep1();
      return;
    }

    this.renderReviewStep();
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
    if (btn) btn.disabled = this.stagedFiles.length === 0 || this.uploadInProgress;
    const step2Dot = document.getElementById('vault-step-2-dot');
    if (step2Dot) step2Dot.disabled = this.stagedFiles.length === 0 || this.uploadInProgress;
  },

  setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(`${inputId}-error`);
    if (err) err.textContent = message || '';
    if (input) {
      input.classList.toggle('has-error', !!message);
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
  },

  /**
   * Validate album name + event date. Shows inline errors and returns the cleaned values.
   */
  validateUploadForm() {
    const existing = this.albumMode === 'existing';
    const dateValue = document.getElementById('upload-date')?.value || '';
    let albumName = '';
    let existingAlbumId = '';
    let nameError = '';
    let nameField = 'upload-album-name';

    if (existing) {
      nameField = 'upload-existing-album';
      existingAlbumId = document.getElementById('upload-existing-album')?.value || '';
      const album = this.albums.find(a => a.id === existingAlbumId);
      albumName = album ? (album.rawTitle || album.title) : '';
      if (!existingAlbumId) nameError = 'Select an album to add to.';
      else if (this.isBadValue(albumName)) nameError = 'That album has no valid title. Ask an officer to fix it first.';
    } else {
      albumName = (document.getElementById('upload-album-name')?.value || '').trim();
      if (!albumName) nameError = 'Album name is required.';
      else if (this.isBadValue(albumName)) nameError = 'Enter a real album name (not "none", "null" or "n/a").';
    }

    const dateError = !dateValue ? 'Event date is required.' : '';
    this.setFieldError('upload-album-name', existing ? '' : nameError);
    this.setFieldError('upload-existing-album', existing ? nameError : '');
    this.setFieldError('upload-date', dateError);

    const firstBad = nameError ? nameField : (dateError ? 'upload-date' : null);
    if (firstBad) document.getElementById(firstBad)?.focus();
    return { ok: !nameError && !dateError, albumName, existingAlbumId, dateValue };
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

    const v = this.validateUploadForm();
    if (!v.ok) return;
    const { albumName, existingAlbumId } = v;

    if (this.stagedFiles.length === 0) {
      this.showToast('Please select at least one image to upload');
      return;
    }

    const categoryValue = categorySelect?.value || this.CATEGORIES[0];
    const visibility = visibilitySelect?.value || 'private';
    const dateValue = dateInput?.value || '';
    const locationValue = locationInput?.value.trim() || '';
    const tagsInput = document.getElementById('upload-tags');
    const tags = this.parseTags(tagsInput?.value || '');

    this.reviewData = { albumName, existingAlbumId, categoryValue, visibility, dateValue, locationValue, tags };
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

    const fileThumbs = this.stagedPreviews.map((p, i) => {
      const isImage = p.file.type.startsWith('image/');
      const img = isImage
        ? `<img src="${p.url}" alt="${e(p.file.name)}">`
        : `<div class="vault-dropzone-thumb-icon"><i data-lucide="file" class="w-5 h-5"></i></div>`;
      return `
        <div class="vault-review-file">
          ${img}
          <button class="vault-review-file-remove" onclick="event.stopPropagation(); VaultModule.removeReviewFile(${i})" title="Remove" aria-label="Remove ${e(p.file.name)}">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
          <div class="vault-review-file-info">${e(p.file.name)} &middot; ${fmtSize(p.file.size)}</div>
        </div>
      `;
    }).join('');

    const tagsHtml = r.tags && r.tags.length > 0
      ? `<div class="vault-review-tags">${r.tags.map(t => `<span class="vault-tag-badge">${e(this.formatTag(t))}</span>`).join('')}</div>`
      : 'None';

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
          <div class="vault-review-label">Tags</div>
          <div class="vault-review-value">${tagsHtml}</div>
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
    document.getElementById('vault-step-2-dot').disabled = false;
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
    document.getElementById('vault-step-2-dot').disabled = this.stagedFiles.length === 0;
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

    // Only photos with at least one reaction or comment qualify
    const top = allPhotos
      .filter(p => p.likes + p.comments >= 1)
      .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
      .slice(0, 4);

    if (top.length === 0) {
      container.innerHTML = `
        <div class="vault-highlights-header">
          <h3 class="vault-highlights-title">
            <i data-lucide="sparkles" class="w-5 h-5"></i>
            Weekly Highlights
          </h3>
        </div>
        <p class="vault-highlights-empty-text">No highlights yet this week.</p>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
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

    const e = (s) => this.escapeHTML(s);
    const cats = [...this.CATEGORIES, ...Object.keys(counts).filter(c => !this.CATEGORIES.includes(c))];
    const chips = [
      `<button class="filter-chip ${this.selectedCategory === 'all' ? 'active' : ''}" onclick="VaultModule.filterByCategory('all')">All <span class="chip-count">${this.albums.length}</span></button>`,
      ...cats.map(cat =>
        `<button class="filter-chip ${this.selectedCategory === cat ? 'active' : ''} ${counts[cat] ? '' : 'is-empty'}" onclick="VaultModule.filterByCategory('${e(cat).replace(/&#039;/g, "\\'")}')">${e(cat)} <span class="chip-count">${counts[cat] || 0}</span></button>`
      )
    ].join('');

    const tagCounts = {};
    this.albums.forEach(a => (a.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const popular = Object.keys(tagCounts)
      .sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b))
      .slice(0, 12);
    for (const t of this.selectedTags) if (!popular.includes(t)) popular.unshift(t);
    const tagRow = popular.length
      ? `<div class="vault-tag-row" id="vault-tag-row">${popular.map(t =>
          `<button class="vault-tag-chip ${this.selectedTags.includes(t) ? 'active' : ''}" data-tag="${e(t)}" onclick="VaultModule.filterByTag('${e(t)}', event)">${e(this.formatTag(t))}${tagCounts[t] ? ` <span class="chip-count">${tagCounts[t]}</span>` : ''}</button>`
        ).join('')}</div>`
      : '';

    const filtered = this.getFilteredAlbums();
    const active = [];
    if (this.searchQuery.trim()) active.push({ label: `"${this.searchQuery.trim()}"`, fn: 'clearSearch()' });
    if (this.selectedCategory !== 'all') active.push({ label: this.selectedCategory, fn: "filterByCategory('all')" });
    if (this.selectedYear !== 'all') active.push({ label: this.selectedYear, fn: "filterByYear('all')" });
    this.selectedTags.forEach(t => active.push({ label: this.formatTag(t), fn: `filterByTag('${e(t)}')` }));
    const activeBar = `
      <div class="vault-results-bar" id="vault-results-bar">
        <span class="vault-results-count" id="vault-results-count">${filtered.length} album${filtered.length === 1 ? '' : 's'}</span>
        ${active.map(a => `<button class="vault-active-chip" onclick="VaultModule.${a.fn}">${e(a.label)} <i data-lucide="x" class="w-3 h-3"></i></button>`).join('')}
        ${active.length ? `<button class="vault-clear-filters" id="vault-clear-filters" onclick="VaultModule.clearAllFilters()">Clear all</button>` : ''}
      </div>`;

    container.innerHTML = `
      <div class="vault-filter-chips">${chips}</div>
      <div class="vault-sort">
        ${this.albums.length ? `<button class="btn btn-glass btn-sm vault-view-all" onclick="VaultModule.showAllPhotos()"><i data-lucide="images" class="w-4 h-4"></i> View all photos</button>` : ''}
        <label for="vault-sort-select" class="vault-sort-label">Sort</label>
        <select id="vault-sort-select" class="glass-input vault-sort-select" onchange="VaultModule.setSort(this.value)">
          <option value="newest" ${this.sortBy === 'newest' ? 'selected' : ''}>Newest first</option>
          <option value="oldest" ${this.sortBy === 'oldest' ? 'selected' : ''}>Oldest first</option>
          <option value="photos" ${this.sortBy === 'photos' ? 'selected' : ''}>Most photos</option>
        </select>
      </div>
      ${tagRow}
      ${activeBar}
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Albums matching the current year/category/tag/search filters, sorted
   */
  getFilteredAlbums() {
    let list = this.albums;

    if (this.selectedYear !== 'all') {
      list = list.filter(a => ((a.date.match(/(\d{4})/) || [])[1]) === String(this.selectedYear));
    }
    if (this.selectedCategory !== 'all') {
      list = list.filter(a => a.category.toLowerCase() === this.selectedCategory.toLowerCase());
    }
    if (this.selectedTags.length) {
      list = list.filter(a => this.selectedTags.every(t => (a.tags || []).includes(t)));
    }

    const terms = this.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length) {
      list = list.filter(a => terms.every(term => {
        if (term.startsWith('#')) {
          const tag = term.replace(/^#+/, '');
          return !tag || (a.tags || []).some(t => t.includes(tag));
        }
        return a.title.toLowerCase().includes(term) ||
          a.description.toLowerCase().includes(term) ||
          a.location.toLowerCase().includes(term) ||
          a.category.toLowerCase().includes(term) ||
          a.date.toLowerCase().includes(term) ||
          (a.tags || []).some(t => t.includes(term)) ||
          a.photos.some(p => (p.caption || '').toLowerCase().includes(term));
      }));
    }

    return [...list].sort((a, b) => {
      if (this.sortBy === 'oldest') return this.albumTime(a) - this.albumTime(b);
      if (this.sortBy === 'photos') return b.photos.length - a.photos.length;
      return this.albumTime(b) - this.albumTime(a);
    });
  },

  /**
   * Re-render everything that depends on filters. If an album is open,
   * leave it so the filtered results are actually visible.
   */
  applyFilters() {
    if (this.currentAlbum) {
      this.currentAlbum = null;
      this.closeLightbox();
    }
    this.renderFilters();
    this.renderStats();
    this.renderAlbumGrid();
  },

  filterByCategory(category) {
    this.selectedCategory = category;
    this.applyFilters();
  },

  filterByTag(tag, event) {
    if (event) event.stopPropagation();
    const clean = this.parseTags([tag])[0];
    if (!clean) return;
    const i = this.selectedTags.indexOf(clean);
    if (i === -1) this.selectedTags.push(clean); else this.selectedTags.splice(i, 1);
    this.applyFilters();
    const grid = document.getElementById('vault-filters');
    if (grid && event) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  onSearchInput(value) {
    this.searchQuery = value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilters(), 200);
  },

  clearSearch() {
    this.searchQuery = '';
    const input = document.getElementById('vault-search');
    if (input) input.value = '';
    this.applyFilters();
  },

  clearAllFilters() {
    this.selectedCategory = 'all';
    this.selectedYear = 'all';
    this.selectedTags = [];
    this.searchQuery = '';
    const input = document.getElementById('vault-search');
    if (input) input.value = '';
    this.applyFilters();
  },

  setSort(value) {
    this.sortBy = value;
    this.applyFilters();
  },

  /**
   * Render album grid
   */
  renderAlbumGrid() {
    const gallery = document.getElementById('vault-gallery');
    if (!gallery) return;

    // Restore highlights and filters when the grid is shown (not inside an album view)
    if (!this.currentAlbum) {
      const highlights = document.getElementById('vault-highlights');
      const filters = document.getElementById('vault-filters');
      if (highlights) highlights.style.display = '';
      if (filters) filters.style.display = '';
    }

    const filteredAlbums = this.getFilteredAlbums();
    const resultCount = document.getElementById('vault-results-count');
    if (resultCount) resultCount.textContent = `${filteredAlbums.length} album${filteredAlbums.length === 1 ? '' : 's'}`;

    if (filteredAlbums.length === 0) {
      if (this.albums.length === 0) {
        gallery.innerHTML = this.renderEmptyState(
          'image-off',
          'No Albums Yet',
          'Be the first to create an album and preserve a moment in fraternity history.',
          'Upload Photos',
          "VaultModule.openUploadModal()"
        );
      } else {
        gallery.innerHTML = this.renderEmptyState(
          'folder-search',
          'No Albums Found',
          'No albums match your search or filters. Try different keywords or clear the filters.',
          null, null
        ) + `<div class="vault-empty-clear"><button class="btn btn-glass btn-sm" onclick="VaultModule.clearAllFilters()">Clear all filters</button></div>`;
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
      const officerToggle = this.officerView && this.isOfficer()
        ? `<button class="vault-vis-switch ${isPublic ? 'is-on' : ''}" role="switch" aria-checked="${isPublic}" aria-label="Album visibility: ${isPublic ? 'Public' : 'Members only'}. Activate to change." onclick="VaultModule.toggleAlbumVisibility('${e(album.id)}', event)" title="Officer: change who can view this album">
             <span class="vault-vis-track"><span class="vault-vis-thumb"></span></span>
             <span class="vault-vis-text">${isPublic ? 'Public' : 'Members only'}</span>
           </button>`
        : '';
      const editBtn = this.officerView && this.isOfficer()
        ? `<button class="vault-edit-btn" onclick="VaultModule.openEditAlbum('${e(album.id)}', event)" aria-label="Edit details of ${e(album.title)}"><i data-lucide="pencil" class="w-3 h-3"></i> Edit</button>`
        : '';
      return `
      <div class="album-card glass-card" tabindex="0" aria-label="Open album ${e(album.title)}" onclick="VaultModule.openAlbum('${e(album.id)}')" onkeydown="if (event.target === this && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); VaultModule.openAlbum('${e(album.id)}'); }">
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
          <h3 class="album-title">${this.titleHtml(album)}</h3>
          <div class="album-meta">
            <span class="album-date">
              <i data-lucide="calendar" class="w-3 h-3"></i>
              ${e(album.date)}
            </span>
            ${album.location ? `<span class="album-location">
              <i data-lucide="map-pin" class="w-3 h-3"></i>
              ${e(album.location)}
            </span>` : ''}
            <span class="album-count">
              <i data-lucide="images" class="w-3 h-3"></i>
              ${album.photos.length} photo${album.photos.length === 1 ? '' : 's'}
            </span>
          </div>
          ${album.tags && album.tags.length > 0 ? `
            <div class="album-tags">
              ${album.tags.map(t => `<span class="vault-tag-badge" onclick="VaultModule.filterByTag('${e(t)}', event)">${e(this.formatTag(t))}</span>`).join('')}
            </div>
          ` : ''}
          <div class="album-engagement">
            <span><i data-lucide="heart" class="w-3 h-3"></i> ${likes}</span>
            <span><i data-lucide="message-circle" class="w-3 h-3"></i> ${comments}</span>
            ${editBtn}
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
    if (!this.isOfficer()) return;
    this.officerView = !this.officerView;
    const btn = document.getElementById('officer-view-btn');
    if (btn) btn.classList.toggle('active', this.officerView);
    const panel = document.getElementById('officer-approval-panel');
    if (panel) panel.style.display = this.officerView ? 'block' : 'none';
    this.renderAlbumGrid();
  },

  /**
   * Accessible confirm dialog (focus trap, Esc to cancel). Resolves true/false.
   */
  confirmDialog({ title, message, confirmLabel = 'Confirm' }) {
    return new Promise(resolve => {
      const prev = document.activeElement;
      const e = (s) => this.escapeHTML(s);
      const modal = document.createElement('div');
      modal.className = 'vault-modal vault-confirm';
      modal.setAttribute('role', 'alertdialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', title);
      modal.innerHTML = `
        <div class="vault-modal-backdrop" data-act="cancel"></div>
        <div class="vault-modal-card glass-heavy vault-confirm-card">
          <h3 class="vault-modal-title">${e(title)}</h3>
          <p class="vault-modal-sub">${e(message)}</p>
          <div class="vault-modal-actions">
            <button class="btn btn-glass btn-sm" data-act="cancel">Cancel</button>
            <button class="btn btn-gold btn-sm btn-gold-filled" data-act="ok">${e(confirmLabel)}</button>
          </div>
        </div>`;
      const done = (val) => {
        modal.remove();
        if (prev && prev.focus) prev.focus();
        resolve(val);
      };
      modal.addEventListener('click', (ev) => {
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (act) done(act === 'ok');
      });
      modal.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { ev.stopPropagation(); done(false); }
        if (ev.key === 'Tab') {
          const f = modal.querySelectorAll('button[data-act]');
          const first = f[0], last = f[f.length - 1];
          if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
          else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        }
      });
      document.body.appendChild(modal);
      modal.querySelector('[data-act="cancel"].btn').focus();
    });
  },

  /**
   * Officer-only: edit an album's title, date, location, category and tags
   * (applied to every photo in the album).
   */
  openEditAlbum(albumId, event) {
    if (event) event.stopPropagation();
    if (!this.isOfficer()) return;
    const album = this.albums.find(a => a.id === albumId);
    if (!album) return;

    const prev = document.activeElement;
    const e = (s) => this.escapeHTML(s);
    const enumVal = this.CATEGORY_TO_ENUM[album.category] || 'other';
    const modal = document.createElement('div');
    modal.className = 'vault-modal vault-confirm vault-edit';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Edit album details');
    modal.innerHTML = `
      <div class="vault-modal-backdrop" data-act="cancel"></div>
      <form class="vault-modal-card glass-heavy vault-edit-card" novalidate>
        <h3 class="vault-modal-title"><i data-lucide="pencil" class="w-5 h-5"></i> Edit album details</h3>
        <p class="vault-modal-sub">Changes apply to all ${album.photos.length} photo${album.photos.length === 1 ? '' : 's'} in this album.</p>
        <div class="form-group">
          <label class="form-label" for="edit-title">Album / Event Name <span class="form-required" aria-hidden="true">*</span></label>
          <input id="edit-title" class="glass-input" type="text" value="${album.untitled ? '' : e(album.rawTitle || album.title)}" required aria-required="true" aria-describedby="edit-title-error">
          <p class="form-error" id="edit-title-error" role="alert"></p>
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-date">Event Date <span class="form-required" aria-hidden="true">*</span></label>
          <input id="edit-date" class="glass-input" type="date" value="${e(album.eventDate)}" required aria-required="true" aria-describedby="edit-date-error">
          <p class="form-error" id="edit-date-error" role="alert"></p>
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-location">Location</label>
          <input id="edit-location" class="glass-input" type="text" value="${e(album.location)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-category">Category</label>
          <select id="edit-category" class="glass-input">
            ${Object.entries(this.CATEGORY_TO_ENUM).map(([label, val]) => `<option value="${val}" ${val === enumVal ? 'selected' : ''}>${e(label)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-tags">Tags / Hashtags</label>
          <input id="edit-tags" class="glass-input" type="text" value="${e((album.tags || []).map(t => this.formatTag(t)).join(', '))}" placeholder="e.g., #service, #porac">
        </div>
        <div class="vault-modal-actions">
          <button type="button" class="btn btn-glass btn-sm" data-act="cancel">Cancel</button>
          <button type="submit" class="btn btn-gold btn-sm btn-gold-filled" id="edit-save-btn">Save changes</button>
        </div>
      </form>`;

    const close = () => {
      modal.remove();
      document.body.style.overflow = '';
      if (prev && prev.focus && document.body.contains(prev)) prev.focus();
    };
    modal.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-act="cancel"]')) close();
    });
    modal.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); close(); return; }
      if (ev.key !== 'Tab') return;
      const f = [...modal.querySelectorAll('input, select, button:not([disabled])')].filter(el => el.offsetParent !== null);
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
    modal.querySelector('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const saved = await this.saveAlbumEdit(album, modal);
      if (saved) close();
    });

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    modal.querySelector('#edit-title').focus();
  },

  async saveAlbumEdit(album, modal) {
    const val = (id) => modal.querySelector('#' + id).value.trim();
    const title = val('edit-title');
    const date = val('edit-date');
    const titleError = !title ? 'Album name is required.' : (this.isBadValue(title) ? 'Enter a real album name (not "none", "null" or "n/a").' : '');
    const dateError = date ? '' : 'Event date is required.';
    this.setFieldError('edit-title', titleError);
    this.setFieldError('edit-date', dateError);
    if (titleError || dateError) {
      modal.querySelector(titleError ? '#edit-title' : '#edit-date').focus();
      return false;
    }

    const tags = this.parseTags(val('edit-tags'));
    const patch = {
      title,
      event_date: date,
      year: parseInt(date.slice(0, 4), 10),
      location: val('edit-location') || null,
      category: val('edit-category'),
      tags
    };

    const saveBtn = modal.querySelector('#edit-save-btn');
    saveBtn.disabled = true;
    if (this.hasSupabase()) {
      const run = (p) => db.from('vault_items').update(p).eq('album_id', album.id).select('id');
      let { data, error } = await run(patch);
      // Databases without migration 004 have no tags column
      if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        const { tags: _omit, ...rest } = patch;
        ({ data, error } = await run(rest));
      }
      if (error || (Array.isArray(data) && data.length === 0)) {
        saveBtn.disabled = false;
        this.showToast('Could not save changes' + (error ? ': ' + error.message : ' (no permission)'));
        return false;
      }
      await this.loadVaultItems();
    } else {
      Object.assign(album, { title: title, rawTitle: title, untitled: false, eventDate: date, location: patch.location || '', tags });
    }

    const reopen = this.currentAlbum && this.currentAlbum.id === album.id;
    this.renderFilters();
    this.renderStats();
    this.renderAlbumGrid();
    this.renderWeeklyHighlights();
    if (reopen) this.openAlbum(album.id);
    this.showToast('Album details updated');
    return true;
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

    if (!this.isOfficer()) return;
    const newVisibility = !album.isPublic;

    if (newVisibility) {
      const ok = await this.confirmDialog({
        title: 'Make this album public?',
        message: 'This will make this album visible to anyone with the link. Continue?',
        confirmLabel: 'Make public'
      });
      if (!ok) return;
    }

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

  /**
   * Insert a vault row; if the tags column doesn't exist yet (migration 004
   * not applied), retry with the hashtags kept in the caption instead.
   */
  async insertVaultItem(row) {
    const res = await db.from('vault_items').insert(row);
    if (res.error && res.error.code === 'PGRST204' || (res.error && /tags/.test(res.error.message || ''))) {
      const { tags, ...rest } = row;
      return db.from('vault_items').insert({ ...rest, caption: (tags || []).map(t => this.formatTag(t)).join(' ') });
    }
    return res;
  },

  async submitUploadForApproval() {
    const nameInput = document.getElementById('upload-album-name');
    const existingSelect = document.getElementById('upload-existing-album');
    const dateInput = document.getElementById('upload-date');
    const locationInput = document.getElementById('upload-location');
    const visibilitySelect = document.getElementById('upload-visibility');
    const categorySelect = document.getElementById('upload-category');
    const submitLabel = document.getElementById('vault-submit-label');

    const v = this.validateUploadForm();
    if (!v.ok) {
      this.backToStep1();
      return;
    }
    const { albumName, existingAlbumId } = v;

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
    const tagsInput = document.getElementById('upload-tags');
    const tags = this.parseTags(tagsInput?.value || '');

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

          const { error: insertError } = await this.insertVaultItem({
            album_id: albumId,
            year: year,
            title: albumName,
            caption: '',
            tags,
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
        const { error: insertError } = await this.insertVaultItem({
          album_id: albumId,
          year: year,
          title: albumName,
          caption: '',
          tags,
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
        tags,
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
   * Stable key for a pending submission (album_id when present, else row id)
   */
  pendingKey(item) {
    return String(item.albumId || item.id);
  },

  findPending(key) {
    return this.pendingUploads.find(p => this.pendingKey(p) === String(key) || String(p.id) === String(key));
  },

  queueSelected: new Set(),
  queueRejectKey: null,
  queueLastFocus: null,

  /**
   * Render the compact pending-approvals summary bar (officers only)
   */
  renderPendingApprovals() {
    const bar = document.getElementById('pending-approvals-list');
    if (!bar) return;
    if (!this.isOfficer()) {
      bar.innerHTML = '';
      return;
    }

    const n = this.pendingUploads.length;
    bar.innerHTML = `
      <div class="vault-approval-summary">
        <i data-lucide="clipboard-check" class="w-5 h-5"></i>
        <h3>Pending approvals <span class="vault-approval-count">${n}</span></h3>
      </div>
      <span class="vault-approval-note">${n === 0 ? 'No pending uploads awaiting review.' : 'Officers review uploads before they appear in the Vault'}</span>
      <button class="btn btn-gold btn-sm" id="vault-review-queue-btn" onclick="VaultModule.openQueue()" ${n === 0 ? 'disabled' : ''}>Review</button>
    `;

    const drawer = document.getElementById('vault-queue-drawer');
    if (drawer && !drawer.classList.contains('hidden')) this.renderQueue();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Open the approvals queue drawer (right-side panel; full-width sheet on mobile)
   */
  openQueue() {
    if (!this.isOfficer()) return;
    let drawer = document.getElementById('vault-queue-drawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'vault-queue-drawer';
      drawer.className = 'vault-modal vault-drawer hidden';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('aria-label', 'Pending approvals');
      drawer.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { ev.stopPropagation(); this.closeQueue(); return; }
        if (ev.key !== 'Tab') return;
        const f = [...drawer.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea, [href], [tabindex]:not([tabindex="-1"])')]
          .filter(el => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      });
      document.body.appendChild(drawer);
    }
    this.queueLastFocus = document.activeElement;
    this.queueSelected = new Set();
    this.queueRejectKey = null;
    this.renderQueue();
    drawer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    (drawer.querySelector('.vault-drawer-close') || drawer).focus();
  },

  closeQueue() {
    const drawer = document.getElementById('vault-queue-drawer');
    if (drawer) drawer.classList.add('hidden');
    document.body.style.overflow = '';
    this.queueRejectKey = null;
    if (this.queueLastFocus && this.queueLastFocus.focus) this.queueLastFocus.focus();
  },

  renderQueue() {
    const drawer = document.getElementById('vault-queue-drawer');
    if (!drawer) return;
    const e = (s) => this.escapeHTML(s);
    const items = this.pendingUploads;
    const keys = items.map(p => this.pendingKey(p));
    this.queueSelected = new Set([...this.queueSelected].filter(k => keys.includes(k)));
    const sel = this.queueSelected.size;
    const allChecked = items.length > 0 && sel === items.length;

    const rows = items.map(item => {
      const key = this.pendingKey(item);
      const first = item.photos && item.photos[0];
      const thumb = first && first.thumbUrl
        ? `<img src="${e(first.thumbUrl)}" alt="" class="vault-approval-thumb-img">`
        : `<i data-lucide="image" class="w-5 h-5"></i>`;
      const rejecting = this.queueRejectKey === key;
      return `
        <div class="vault-approval-item" data-pending-id="${e(key)}">
          <label class="vault-queue-check">
            <input type="checkbox" ${this.queueSelected.has(key) ? 'checked' : ''} onchange="VaultModule.toggleQueueItem('${e(key)}', this.checked)" aria-label="Select ${e(item.albumName)}">
          </label>
          <div class="vault-approval-thumb">${thumb}</div>
          <div class="vault-approval-info">
            <strong>${e(item.albumName)}</strong>
            <span>${item.fileCount} file${item.fileCount === 1 ? '' : 's'} &bull; ${e(item.submittedBy)} &bull; ${e(item.category)}${item.date ? ' &bull; ' + e(item.date) : ''}</span>
            ${item.tags && item.tags.length ? `<div class="album-tags">${item.tags.map(t => `<span class="vault-tag-badge">${e(this.formatTag(t))}</span>`).join('')}</div>` : ''}
          </div>
          <div class="vault-approval-controls">
            ${first ? `<button class="btn btn-glass btn-sm" onclick="VaultModule.previewPendingUpload('${e(key)}')"><i data-lucide="eye" class="w-4 h-4"></i> View</button>` : ''}
            <button class="btn btn-gold btn-sm btn-gold-filled" onclick="VaultModule.approvePendingUpload('${e(key)}')"><i data-lucide="check" class="w-4 h-4"></i> Approve</button>
            <button class="btn btn-glass btn-sm vault-btn-danger" onclick="VaultModule.rejectPendingUpload('${e(key)}')"><i data-lucide="x" class="w-4 h-4"></i> Reject</button>
          </div>
          ${rejecting ? `
            <div class="vault-reject-confirm" role="alertdialog" aria-label="Confirm reject">
              <p>Reject "${e(item.albumName)}"? The submission will be discarded and its files deleted from storage.</p>
              <label class="form-label" for="vault-reject-reason">Reason (optional)</label>
              <textarea id="vault-reject-reason" class="glass-input" rows="2" maxlength="300" placeholder="Shown to the uploader if we add notifications later"></textarea>
              <div class="vault-reject-actions">
                <button class="btn btn-glass btn-sm" onclick="VaultModule.cancelReject()">Cancel</button>
                <button class="btn btn-glass btn-sm vault-btn-danger-filled" onclick="VaultModule.confirmReject('${e(key)}')">Reject submission</button>
              </div>
            </div>` : ''}
        </div>`;
    }).join('');

    drawer.innerHTML = `
      <div class="vault-modal-backdrop" onclick="VaultModule.closeQueue()"></div>
      <div class="vault-modal-card glass-heavy vault-drawer-card">
        <div class="vault-modal-header">
          <div>
            <h3 class="vault-modal-title"><i data-lucide="clipboard-check" class="w-5 h-5"></i> Pending approvals (${items.length})</h3>
            <p class="vault-modal-sub">Review uploads before they appear in the Vault.</p>
          </div>
          <button class="vault-drawer-close vault-modal-close" onclick="VaultModule.closeQueue()" aria-label="Close approvals">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        ${items.length ? `
          <div class="vault-queue-toolbar">
            <label class="vault-queue-selectall"><input type="checkbox" ${allChecked ? 'checked' : ''} onchange="VaultModule.toggleQueueAll(this.checked)"> Select all</label>
            <div class="vault-queue-bulk">
              <button class="btn btn-gold btn-sm btn-gold-filled" ${sel ? '' : 'disabled'} onclick="VaultModule.approveSelected()">Approve selected (${sel})</button>
              <button class="btn btn-gold btn-sm" onclick="VaultModule.approveAll()">Approve all</button>
            </div>
          </div>
          <div class="vault-queue-list">${rows}</div>` : '<p class="vault-approval-empty">No pending uploads awaiting review.</p>'}
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  toggleQueueItem(key, checked) {
    if (checked) this.queueSelected.add(String(key)); else this.queueSelected.delete(String(key));
    this.renderQueue();
  },

  toggleQueueAll(checked) {
    this.queueSelected = checked ? new Set(this.pendingUploads.map(p => this.pendingKey(p))) : new Set();
    this.renderQueue();
  },

  approveSelected() {
    return this.approvePendingUploads([...this.queueSelected]);
  },

  approveAll() {
    return this.approvePendingUploads(this.pendingUploads.map(p => this.pendingKey(p)));
  },

  /**
   * Current pending preview state
   */
  currentPendingPreview: null,

  /**
   * Open a modal previewing all photos in a pending submission.
   * Officers can view full-size images and remove individual photos before approving.
   */
  previewPendingUpload(id) {
    const numId = Number(id);
    const item = this.pendingUploads.find(p => p.id === numId || p.id === id || p.albumId === id || p.albumId === String(id));
    if (!item) {
      this.showToast('Could not find that pending upload');
      return;
    }

    this.currentPendingPreview = item;
    this.renderPendingPreviewModal();
  },

  /**
   * Render the pending preview modal
   */
  renderPendingPreviewModal() {
    if (!this.currentPendingPreview) return;
    const item = this.currentPendingPreview;
    const e = (s) => this.escapeHTML(s);

    let modal = document.getElementById('vault-pending-preview-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'vault-pending-preview-modal';
      modal.className = 'vault-modal hidden';
      document.body.appendChild(modal);
    }

    const photosHtml = (item.photos || []).map((photo, index) => {
      const thumb = photo.thumbUrl
        ? `<img src="${e(photo.thumbUrl)}" alt="Photo ${index + 1}" class="vault-preview-thumb-img" loading="lazy">`
        : `<div class="vault-preview-thumb-icon"><i data-lucide="image" class="w-8 h-8"></i></div>`;
      return `
        <div class="vault-preview-photo">
          <div class="vault-preview-photo-thumb" onclick="VaultModule.openPendingLightbox(${index})">
            ${thumb}
            <div class="vault-preview-photo-overlay">
              <i data-lucide="maximize-2" class="w-5 h-5"></i>
            </div>
          </div>
          <button class="vault-preview-photo-remove" onclick="VaultModule.removePendingPhoto('${e(item.id)}', ${photo.id})" title="Remove this photo">
            <i data-lucide="trash-2" class="w-4 h-4"></i> Remove
          </button>
        </div>
      `;
    }).join('');

    const noPhotosHtml = (!item.photos || item.photos.length === 0)
      ? '<p class="vault-preview-empty">No photos available for preview. This submission may have been uploaded without R2 storage configured.</p>'
      : '';

    modal.innerHTML = `
      <div class="vault-modal-backdrop" onclick="VaultModule.closePendingPreview()"></div>
      <div class="vault-modal-card glass-heavy vault-pending-preview-content">
        <div class="vault-modal-header">
          <div>
            <h3 class="vault-modal-title"><i data-lucide="eye" class="w-5 h-5"></i> ${e(item.albumName)}</h3>
            <p class="vault-modal-sub">${e(item.submittedBy)} &bull; ${e(item.category)}${item.date ? ' &bull; ' + e(item.date) : ''}${item.location ? ' &bull; ' + e(item.location) : ''}</p>
          </div>
          <button class="vault-modal-close" onclick="VaultModule.closePendingPreview()">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="vault-preview-body">
          <div class="vault-preview-info-bar">
            <span><i data-lucide="images" class="w-4 h-4"></i> ${item.fileCount} photo${item.fileCount === 1 ? '' : 's'}</span>
            <span><i data-lucide="${item.visibility === 'public' ? 'globe' : 'lock'}" class="w-4 h-4"></i> ${item.visibility === 'public' ? 'Public' : 'Members only'}</span>
          </div>
          ${noPhotosHtml}
          <div class="vault-preview-grid">${photosHtml}</div>
        </div>
        <div class="vault-modal-actions">
          <button class="btn btn-glass btn-sm" onclick="VaultModule.closePendingPreview()">Close</button>
          <button class="btn btn-gold btn-sm" onclick="VaultModule.approvePendingUpload('${e(item.id)}'); VaultModule.closePendingPreview();">
            <i data-lucide="check" class="w-4 h-4"></i> Approve Remaining
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Close the pending preview modal
   */
  closePendingPreview() {
    this.currentPendingPreview = null;
    const modal = document.getElementById('vault-pending-preview-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  },

  /**
   * Open a lightbox for a photo in the current pending preview
   */
  openPendingLightbox(index) {
    if (!this.currentPendingPreview || !this.currentPendingPreview.photos) return;
    const photos = this.currentPendingPreview.photos;
    if (index < 0 || index >= photos.length) return;

    const photo = photos[index];
    const e = (s) => this.escapeHTML(s);

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
      ${index > 0 ? `
        <button class="vault-lightbox-nav prev" onclick="VaultModule.navigatePendingLightbox(${index}, -1)">
          <i data-lucide="chevron-left" class="w-8 h-8"></i>
        </button>
      ` : ''}
      ${index < photos.length - 1 ? `
        <button class="vault-lightbox-nav next" onclick="VaultModule.navigatePendingLightbox(${index}, 1)">
          <i data-lucide="chevron-right" class="w-8 h-8"></i>
        </button>
      ` : ''}
      <div class="vault-lightbox-content">
        <div class="vault-lightbox-image-wrapper">
          <img src="${e(photo.mediaUrl || photo.thumbUrl)}" alt="Photo ${index + 1}" class="vault-lightbox-image">
        </div>
        <div class="vault-lightbox-info">
          <div class="vault-lightbox-header">
            <h3 class="vault-lightbox-title">${e(this.currentPendingPreview.albumName)}</h3>
            <span class="vault-lightbox-counter">${index + 1} / ${photos.length}</span>
          </div>
        </div>
      </div>
    `;

    this.lightboxOpen = true;
    requestAnimationFrame(() => {
      lightbox.classList.add('active');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    const keyHandler = (ev) => {
      if (!this.lightboxOpen) {
        document.removeEventListener('keydown', keyHandler);
        return;
      }
      if (ev.key === 'Escape') this.closeLightbox();
      if (ev.key === 'ArrowLeft' && index > 0) this.navigatePendingLightbox(index, -1);
      if (ev.key === 'ArrowRight' && index < photos.length - 1) this.navigatePendingLightbox(index, 1);
    };
    document.addEventListener('keydown', keyHandler);
  },

  /**
   * Navigate within the pending preview lightbox
   */
  navigatePendingLightbox(currentIndex, direction) {
    if (!this.currentPendingPreview || !this.currentPendingPreview.photos) return;
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < this.currentPendingPreview.photos.length) {
      this.openPendingLightbox(newIndex);
    }
  },

  /**
   * Remove a single photo from a pending submission.
   * Soft-deletes the DB row and cleans up R2 objects.
   */
  async removePendingPhoto(pendingId, photoId) {
    if (!confirm('Remove this photo from the submission? This cannot be undone.')) return;

    const numPendingId = Number(pendingId);
    const item = this.pendingUploads.find(p => p.id === numPendingId || p.id === pendingId || p.albumId === pendingId || p.albumId === String(pendingId));
    if (!item || !item.photos) {
      this.showToast('Could not find that pending upload');
      return;
    }

    const photoIdx = item.photos.findIndex(p => p.id === photoId || p.id === Number(photoId));
    if (photoIdx === -1) {
      this.showToast('Could not find that photo');
      return;
    }

    const photo = item.photos[photoIdx];

    // Soft-delete the DB row
    if (this.hasSupabase()) {
      const { error } = await db.from('vault_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', photoId);
      if (error) {
        this.showToast('Failed to remove photo: ' + error.message);
        return;
      }

      // Clean up R2 objects
      const keys = [photo.fileKey, photo.thumbKey].filter(Boolean);
      if (keys.length > 0 && typeof MediaUpload !== 'undefined' && MediaUpload.isConfigured()) {
        try {
          await MediaUpload.deleteKeys(keys);
        } catch (err) {
          console.error('vault: R2 cleanup failed for removed photo', err);
        }
      }
    }

    // Update in-memory state
    item.photos.splice(photoIdx, 1);
    item.fileCount = item.photos.length;

    // Remove the photo's keys from r2Keys
    if (item.r2Keys) {
      item.r2Keys = item.r2Keys.filter(k => k !== photo.fileKey && k !== photo.thumbKey);
    }

    // If no photos remain, close preview and remove the pending item
    if (item.photos.length === 0) {
      const pendingIdx = this.pendingUploads.findIndex(p => p === item);
      if (pendingIdx !== -1) {
        this.pendingUploads.splice(pendingIdx, 1);
      }
      this.closePendingPreview();
      this.renderPendingApprovals();
      this.renderStats();
      this.showToast('All photos removed — submission deleted');
      return;
    }

    // Re-render the preview modal and approval list
    this.renderPendingPreviewModal();
    this.renderPendingApprovals();
    this.showToast('Photo removed from submission');
  },

  /**
   * Approve one pending submission (kept for the preview modal and row button)
   */
  approvePendingUpload(id) {
    return this.approvePendingUploads([id]);
  },

  /**
   * Approve several pending submissions in one request. Sets approval_status to
   * 'approved' in Supabase so the items become visible in the gallery.
   */
  async approvePendingUploads(keys) {
    if (!this.isOfficer()) return;
    const items = keys.map(k => this.findPending(k)).filter(Boolean);
    if (items.length === 0) {
      this.showToast('Could not find that pending upload');
      return;
    }

    const albumIds = items.map(i => i.albumId).filter(Boolean);
    if (this.hasSupabase() && albumIds.length) {
      const { error } = await db.from('vault_items')
        .update({ approval_status: 'approved' })
        .in('album_id', albumIds)
        .eq('approval_status', 'pending');
      if (error) { this.showToast('Failed to approve upload: ' + error.message); return; }
    }

    this.pendingUploads = this.pendingUploads.filter(p => !items.includes(p));
    this.queueSelected = new Set();
    this.closePendingPreview();
    await this.loadVaultItems();
    this.renderPendingApprovals();
    this.applyFilters();
    this.renderWeeklyHighlights();
    this.showToast(items.length === 1
      ? `"${items[0].albumName}" approved and published to the Vault`
      : `${items.length} submissions approved and published to the Vault`);
  },

  /**
   * Start the reject flow: shows an in-drawer confirmation with an optional reason.
   */
  rejectPendingUpload(id) {
    const item = this.findPending(id);
    if (!item) {
      this.showToast('Could not find that pending upload');
      return;
    }
    this.queueRejectKey = this.pendingKey(item);
    const drawer = document.getElementById('vault-queue-drawer');
    if (!drawer || drawer.classList.contains('hidden')) this.openQueue();
    this.queueRejectKey = this.pendingKey(item);
    this.renderQueue();
    document.getElementById('vault-reject-reason')?.focus();
  },

  cancelReject() {
    this.queueRejectKey = null;
    this.renderQueue();
  },

  /**
   * Reject a pending upload after confirmation. Sets approval_status to 'rejected'
   * (with an optional reason) and removes its files from storage.
   */
  async confirmReject(key) {
    if (!this.isOfficer()) return;
    const item = this.findPending(key);
    if (!item) return;
    const reason = (document.getElementById('vault-reject-reason')?.value || '').trim() || null;

    if (this.hasSupabase() && item.albumId) {
      const run = (patch) => db.from('vault_items')
        .update(patch)
        .eq('album_id', item.albumId)
        .eq('approval_status', 'pending');
      let { error } = await run({ approval_status: 'rejected', rejection_reason: reason });
      // Databases without migration 013 have no rejection_reason column
      if (error && (error.code === '42703' || error.code === 'PGRST204')) ({ error } = await run({ approval_status: 'rejected' }));
      if (error) { this.showToast('Failed to reject upload'); return; }

      if (item.r2Keys && item.r2Keys.length > 0 && typeof MediaUpload !== 'undefined' && MediaUpload.isConfigured()) {
        try {
          await MediaUpload.deleteKeys(item.r2Keys);
        } catch (err) {
          console.error('vault: R2 cleanup failed for rejected upload', err);
        }
      }
    }

    this.pendingUploads = this.pendingUploads.filter(p => p !== item);
    this.queueSelected.delete(String(key));
    this.queueRejectKey = null;
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
    const tagsInput = document.getElementById('upload-tags');
    if (tagsInput) tagsInput.value = '';
    ['upload-album-name', 'upload-existing-album', 'upload-date'].forEach(id => this.setFieldError(id, ''));
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

    // Hide highlights and filters so the album view is immediately visible
    const highlights = document.getElementById('vault-highlights');
    const filters = document.getElementById('vault-filters');
    if (highlights) highlights.style.display = 'none';
    if (filters) filters.style.display = 'none';

    this.renderAlbumView();

    // Scroll to the gallery so the user sees the opened album
    const gallery = document.getElementById('vault-gallery');
    if (gallery) gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <a href="#" onclick="VaultModule.filterByCategory('${e(this.currentAlbum.category)}'); return false;">${e(this.currentAlbum.category)}</a>
        <span class="vault-breadcrumb-sep">/</span>
        <span class="vault-breadcrumb-current">${this.titleHtml(this.currentAlbum)}</span>
      </nav>
      <div class="album-hero-card album-hero-clickable" onclick="VaultModule.closeAlbum()">
        <div class="album-hero-badge" style="color: ${e(this.currentAlbum.categoryColor)}">
          <i data-lucide="${e(this.currentAlbum.categoryIcon)}" class="w-4 h-4"></i>
          ${e(this.currentAlbum.category)}
        </div>
        <h1 class="album-hero-title">${this.titleHtml(this.currentAlbum)}</h1>
        <p class="album-hero-desc">${e(this.currentAlbum.description)}</p>
        ${this.isOfficer() && this.currentAlbum.id !== 'all-photos' ? `<button class="btn btn-glass btn-sm vault-hero-edit" onclick="VaultModule.openEditAlbum('${e(this.currentAlbum.id)}', event)"><i data-lucide="pencil" class="w-4 h-4"></i> Edit details</button>` : ''}
        <div class="album-hero-info">
          ${this.currentAlbum.date ? `<span><i data-lucide="calendar" class="w-4 h-4"></i> ${e(this.currentAlbum.date)}</span>` : ''}
          ${this.currentAlbum.location ? `<span><i data-lucide="map-pin" class="w-4 h-4"></i> ${e(this.currentAlbum.location)}</span>` : ''}
          <span><i data-lucide="images" class="w-4 h-4"></i> ${this.currentAlbum.photos.length} photos</span>
        </div>
        ${this.currentAlbum.tags && this.currentAlbum.tags.length ? `
          <div class="album-tags" onclick="event.stopPropagation()">
            ${this.currentAlbum.tags.map(t => `<span class="vault-tag-badge" onclick="VaultModule.filterByTag('${e(t)}', event)">${e(this.formatTag(t))}</span>`).join('')}
          </div>` : ''}
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
                  <span class="vault-related-name">${this.titleHtml(a)}</span>
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

    // Restore highlights and filters visibility
    const highlights = document.getElementById('vault-highlights');
    const filters = document.getElementById('vault-filters');
    if (highlights) highlights.style.display = '';
    if (filters) filters.style.display = '';

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
          ${(photo.tags && photo.tags.length ? photo.tags : (this.currentAlbum.tags || [])).length ? `
            <div class="album-tags">
              ${(photo.tags && photo.tags.length ? photo.tags : this.currentAlbum.tags).map(t => `<span class="vault-tag-badge" onclick="VaultModule.filterByTag('${e(t)}', event)">${e(this.formatTag(t))}</span>`).join('')}
            </div>` : ''}
          <div class="vault-lightbox-meta">
            <span><i data-lucide="calendar" class="w-4 h-4"></i> ${e(this.currentAlbum.date)}</span>
            ${this.currentAlbum.location ? `<span><i data-lucide="map-pin" class="w-4 h-4"></i> ${e(this.currentAlbum.location)}</span>` : ''}
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

    const years = this.availableYears();
    if (this.selectedYear !== 'all' && !years.includes(String(this.selectedYear))) this.selectedYear = 'all';

    // A year filter is only useful when albums span more than one year
    const yearControl = years.length > 1 ? `
      <div class="yd-wrapper">
        <button class="yd-trigger" onclick="VaultModule.toggleYearDropdown(event)" aria-haspopup="listbox" aria-expanded="${this.yearDropdownOpen}">
          <i data-lucide="calendar" class="w-6 h-6 text-[#d4af37]"></i>
          <div>
            <span class="vault-stat-value">${this.selectedYear === 'all' ? 'All years' : this.selectedYear}</span>
            <span class="vault-stat-label">Year Filter</span>
          </div>
          <i data-lucide="chevron-down" class="w-4 h-4 yd-chevron ${this.yearDropdownOpen ? 'yd-chevron-open' : ''}"></i>
        </button>
        <div class="yd-menu ${this.yearDropdownOpen ? 'yd-menu-open' : ''}">
          <button class="yd-item ${this.selectedYear === 'all' ? 'yd-item-active' : ''}" onclick="VaultModule.filterByYear('all');" style="--i:0">
            <i data-lucide="layers" class="w-4 h-4"></i> All years
          </button>
          ${years.map((year, i) => `
            <button class="yd-item ${this.selectedYear === year ? 'yd-item-active' : ''}" onclick="VaultModule.filterByYear('${year}');" style="--i:${i + 1}">
              <i data-lucide="calendar" class="w-4 h-4"></i> ${year}
            </button>
          `).join('')}
        </div>
      </div>` : '';

    statsContainer.innerHTML = `
      <div class="vault-stat">
        <i data-lucide="folder" class="w-6 h-6 text-[#d4af37]"></i>
        <div>
          <span class="vault-stat-value">${this.albums.length}</span>
          <span class="vault-stat-label">Albums</span>
        </div>
      </div>
      <div class="vault-stat">
        <i data-lucide="images" class="w-6 h-6 text-[#d4af37]"></i>
        <div>
          <span class="vault-stat-value">${totalPhotos}</span>
          <span class="vault-stat-label">Photos</span>
        </div>
      </div>
      ${yearControl}
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
    this.getFilteredAlbums().forEach(album => {
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
      tags: [],
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

    this.applyFilters();
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
      searchInput.addEventListener('input', (e) => this.onSearchInput(e.target.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { clearTimeout(this.searchTimer); this.applyFilters(); }
        if (e.key === 'Escape') this.clearSearch();
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
