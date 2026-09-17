/**
 * Zeta Beta Mu Fraternity Portal
 * Memorial Module - Dynamic Tribute Profile Page
 *
 * Loads a departed brother's profile from a URL id parameter,
 * renders the tribute wall and photo/video gallery, and provides
 * placeholder composer/upload actions that surface "coming soon" toasts.
 */

const MemorialModule = {
  // Departed brothers registry (mirrors memoriam.html cards)
  brothers: [
    {
      id: 1,
      name: 'Dr. Roberto M. Santos',
      dates: '1945 - 2023',
      specialty: 'Cardiology',
      years: 'Batch 1971 • 52 years of service',
      bio: 'A founding member whose compassion and expertise touched countless lives. His legacy of excellence in cardiac care continues to inspire generations of Zeta Beta Mu brothers.',
      photo: 'image/placeholders/avatars/a33.jpg'
    },
    {
      id: 2,
      name: 'Dr. Antonio L. Cruz',
      dates: '1948 - 2022',
      specialty: 'Neurosurgery',
      years: 'Batch 1973 • 49 years of service',
      bio: 'A brilliant surgeon and mentor who dedicated his life to advancing neurosurgical techniques and training the next generation.',
      photo: 'image/placeholders/avatars/a12.jpg'
    },
    {
      id: 3,
      name: 'Dr. Manuel P. Reyes',
      dates: '1950 - 2021',
      specialty: 'Pediatrics',
      years: 'Batch 1975 • 46 years of service',
      bio: 'His gentle spirit and unwavering commitment to children\'s health made him beloved by patients and colleagues alike.',
      photo: 'image/placeholders/avatars/a68.jpg'
    },
    {
      id: 4,
      name: 'Dr. Francisco J. Mendoza',
      dates: '1952 - 2020',
      specialty: 'Internal Medicine',
      years: 'Batch 1977 • 43 years of service',
      bio: 'A pillar of our community whose wisdom and kindness left an indelible mark on all who knew him.',
      photo: 'image/placeholders/avatars/a52.jpg'
    },
    {
      id: 5,
      name: 'Dr. Eduardo S. Garcia',
      dates: '1947 - 2019',
      specialty: 'Orthopedic Surgery',
      years: 'Batch 1972 • 47 years of service',
      bio: 'A skilled surgeon whose innovative techniques and dedication to patient care set new standards in orthopedics.',
      photo: 'image/placeholders/avatars/a60.jpg'
    },
    {
      id: 6,
      name: 'Dr. Vicente R. Aquino',
      dates: '1949 - 2018',
      specialty: 'Oncology',
      years: 'Batch 1974 • 44 years of service',
      bio: 'His compassionate approach to cancer care and groundbreaking research brought hope to countless patients and families.',
      photo: 'image/placeholders/avatars/a15.jpg'
    }
  ],

  // Mock tributes for display / placeholder UI
  tributes: [
    {
      id: 101,
      author: { name: 'Dr. Sarah Mitchell', avatar: 'image/placeholders/avatars/a5.jpg', batch: 'Batch 2008' },
      content: 'Sir, your mentorship shaped the doctor I am today. Rest well, brother.',
      time: '2 days ago',
      likes: 32,
      comments: [
        { author: 'Dr. James Anderson', text: 'Beautifully said.' }
      ]
    },
    {
      id: 102,
      author: { name: 'Dr. Michael Chen', avatar: 'image/placeholders/avatars/a3.jpg', batch: 'Batch 2003' },
      content: 'A true giant in medicine and an even better brother. You will be missed.',
      time: '5 days ago',
      likes: 48,
      comments: []
    },
    {
      id: 103,
      author: { name: 'Dr. Emily Roberts', avatar: 'image/placeholders/avatars/a9.jpg', batch: 'Batch 2010' },
      content: 'Forever grateful for the wisdom you shared with all of us.',
      time: '1 week ago',
      likes: 21,
      comments: []
    }
  ],

  // Media attached to tributes this session. Feeds the Photos & Videos
  // gallery (local-only until a memorial media table/bucket exists).
  gallery: [],

  // Composer draft: text is preserved across wall re-renders, attachment
  // holds the staged file preview until the tribute is posted.
  composerState: { text: '', attachment: null },

  MAX_ATTACHMENT_BYTES: 25 * 1024 * 1024,

  // Lightbox state for the gallery
  lightboxIndex: -1,

  currentBrother: null,

  // Tributes the current visitor has already liked (prevents double-likes
  // in this session; not persisted across reloads until backend exists)
  likedTributeIds: new Set(),

  /**
   * Check if Supabase is configured (mirrors the pattern used by other
   * modules, kept here as a ready-made shell for when a `memorial_tributes`
   * table exists — it does not exist in sql/schema-postgres.sql yet).
   */
  hasSupabase() {
    return typeof db !== 'undefined' && db &&
           typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');
  },

  /**
   * Initialize the memorial page
   */
  init() {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'), 10);
    this.currentBrother = this.brothers.find(b => b.id === id) || this.brothers[0];

    this.renderHero();
    this.renderTributeWall();
    this.renderGallery();
    this.setupEventListeners();
  },

  /**
   * Render the memorial hero section
   */
  renderHero() {
    const brother = this.currentBrother;
    const hero = document.querySelector('.memorial-hero');
    if (!hero) return;

    const safeName = this.escapeHTML(brother.name);
    const safePhoto = this.escapeHTML(brother.photo);
    const safeSpecialty = this.escapeHTML(brother.specialty);
    const safeYears = this.escapeHTML(brother.years);
    const safeBio = this.escapeHTML(brother.bio);
    hero.innerHTML = `
      <div class="memorial-candle">
        <i data-lucide="flame" class="w-7 h-7"></i>
      </div>
      <img src="${safePhoto}" alt="${safeName}" class="memorial-portrait" loading="lazy" decoding="async">
      <h1 class="memorial-name">${safeName}</h1>
      <p class="memorial-dates">${this.escapeHTML(brother.dates).replace('-', '—')}</p>
      <p class="memorial-meta">${safeSpecialty} &bull; ${safeYears}</p>
      <p class="memorial-bio">${safeBio}</p>
    `;

    document.title = `${brother.name} | In Memoriam | Zeta Beta Mu Fraternity`;
  },

  /**
   * Render the tribute wall with composer and mock tributes
   */
  renderTributeWall() {
    const container = document.getElementById('tribute-wall');
    if (!container) return;

    const tributesHTML = this.tributes.map(t => this.createTributeHTML(t)).join('');
    const attachment = this.composerState.attachment;
    const attachmentHTML = attachment ? `
      <div id="tribute-attachment-preview" class="memorial-attachment-preview">
        ${this.createMediaHTML(attachment, false)}
        <button class="composer-image-remove" type="button" data-action="remove-attachment" aria-label="Remove attachment">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="memorial-composer glass-card">
        <textarea id="tribute-input" class="composer-input" placeholder="Share a message or tribute for our brother...">${this.escapeHTML(this.composerState.text)}</textarea>
        ${attachmentHTML}
        <div class="memorial-composer-actions">
          <div class="flex gap-2">
            <button class="composer-btn" type="button" data-action="upload-photo">
              <i data-lucide="image" class="w-4 h-4"></i> Photo
            </button>
            <button class="composer-btn" type="button" data-action="upload-video">
              <i data-lucide="video" class="w-4 h-4"></i> Video
            </button>
            <input type="file" id="tribute-photo-input" class="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" data-kind="photo">
            <input type="file" id="tribute-video-input" class="sr-only" accept="video/mp4,video/webm,video/quicktime" data-kind="video">
          </div>
          <button id="post-tribute-btn" class="btn btn-gold" type="button" data-action="post-tribute">
            <i data-lucide="send" class="w-4 h-4"></i> Post Tribute
          </button>
        </div>
      </div>
      ${tributesHTML}
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Create HTML for a single tribute
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

  createTributeHTML(tribute) {
    const safeAuthorName = this.escapeHTML(tribute.author.name);
    const safeAuthorAvatar = this.escapeHTML(tribute.author.avatar);
    const safeAuthorBatch = this.escapeHTML(tribute.author.batch);
    const safeTime = this.escapeHTML(tribute.time);
    const safeContent = this.escapeHTML(tribute.content);
    const commentsHTML = tribute.comments.map(c => `
      <div class="memorial-comment">
        <span class="memorial-comment-author">${this.escapeHTML(c.author)}</span>
        <span class="memorial-comment-text">${this.escapeHTML(c.text)}</span>
      </div>
    `).join('');

    return `
      <article class="memorial-tribute glass-card">
        <div class="memorial-tribute-head">
          <img src="${safeAuthorAvatar}" alt="" class="memorial-tribute-avatar" loading="lazy" decoding="async">
          <div>
            <div class="memorial-tribute-author">${safeAuthorName}</div>
            <div class="memorial-tribute-time">${safeAuthorBatch} &bull; ${safeTime}</div>
          </div>
        </div>
        ${safeContent ? `<p class="memorial-tribute-text">${safeContent}</p>` : ''}
        ${tribute.media ? `<div class="memorial-tribute-media">${this.createMediaHTML(tribute.media, true)}</div>` : ''}
        <div class="memorial-tribute-actions">
          <button class="reaction-btn ${this.likedTributeIds.has(tribute.id) ? 'liked' : ''}" type="button" data-action="like-tribute" data-id="${tribute.id}">
            <i data-lucide="heart" class="w-4 h-4"></i> <span>${tribute.likes}</span>
          </button>
          <button class="reaction-btn" type="button" data-action="comment-tribute" data-id="${tribute.id}">
            <i data-lucide="message-circle" class="w-4 h-4"></i> <span>Comment</span>
          </button>
        </div>
        ${commentsHTML ? `<div class="memorial-comment-list">${commentsHTML}</div>` : ''}
      </article>
    `;
  },

  /**
   * Post a new tribute to the wall.
   * TODO(cloud): once a `memorial_tributes` table exists, replace the
   * local push below with:
   *   await db.from('memorial_tributes').insert({
   *     memorial_id: this.currentBrother.id, member_id: session.id, content: text
   *   });
   */
  postTribute() {
    const input = document.getElementById('tribute-input');
    const text = (input ? input.value : this.composerState.text).trim();
    const media = this.composerState.attachment;
    if (!text && !media) {
      this.showToast('Please write something or attach a photo before posting');
      return;
    }

    let author = { name: 'Brother', avatar: 'image/placeholders/avatars/a11.jpg', batch: '' };
    try {
      const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      if (session) {
        author = {
          name: session.name || 'Brother',
          avatar: session.avatar || 'image/placeholders/avatars/a11.jpg',
          batch: session.graduationYear ? `Batch ${session.graduationYear}` : ''
        };
      }
    } catch (e) { /* no session */ }

    const tribute = {
      id: Date.now(),
      author,
      content: text,
      media,
      time: 'Just now',
      likes: 0,
      comments: []
    };
    this.tributes.unshift(tribute);
    if (media) {
      this.gallery.unshift({ ...media, tributeId: tribute.id, caption: text, author: author.name });
    }

    this.composerState = { text: '', attachment: null };
    this.renderTributeWall();
    this.renderGallery();
    this.showToast('Tribute posted');
  },

  /**
   * Media helpers (photo/video attachments)
   */
  createMediaHTML(media, lazy) {
    const url = this.escapeHTML(media.url);
    const name = this.escapeHTML(media.name || '');
    if (media.kind === 'video') {
      return `<video src="${url}" controls preload="metadata" playsinline aria-label="${name}"></video>`;
    }
    return `<img src="${url}" alt="${name}"${lazy ? ' loading="lazy" decoding="async"' : ''}>`;
  },

  validateAttachment(file, kind) {
    if (!file) return 'No file selected';
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (kind === 'photo' && !isImage) return `"${file.name}" is not a supported image`;
    if (kind === 'video' && !isVideo) return `"${file.name}" is not a supported video`;
    if (file.size === 0) return `"${file.name}" is empty`;
    if (file.size > this.MAX_ATTACHMENT_BYTES) {
      return `"${file.name}" is larger than ${Math.round(this.MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB`;
    }
    return null;
  },

  selectAttachment(file, kind) {
    const error = this.validateAttachment(file, kind);
    if (error) {
      this.showToast(error);
      return;
    }
    this.clearAttachment();
    this.composerState.attachment = {
      kind,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size
    };
    this.renderTributeWall();
    this.showToast(kind === 'video' ? 'Video attached' : 'Photo attached');
  },

  clearAttachment() {
    const current = this.composerState.attachment;
    if (current && current.url.startsWith('blob:') && !this.gallery.some(g => g.url === current.url)) {
      URL.revokeObjectURL(current.url);
    }
    this.composerState.attachment = null;
  },

  removeAttachment() {
    this.clearAttachment();
    this.renderTributeWall();
  },

  /**
   * Like/unlike a tribute (local-only until backend exists — see TODO in postTribute)
   */
  toggleLikeTribute(id) {
    const tribute = this.tributes.find(t => t.id === id);
    if (!tribute) return;

    if (this.likedTributeIds.has(id)) {
      this.likedTributeIds.delete(id);
      tribute.likes = Math.max(0, tribute.likes - 1);
    } else {
      this.likedTributeIds.add(id);
      tribute.likes++;
    }

    this.renderTributeWall();
  },

  /**
   * Add a comment to a tribute (local-only until backend exists — see TODO in postTribute)
   */
  addTributeComment(id) {
    const tribute = this.tributes.find(t => t.id === id);
    if (!tribute) return;

    const text = prompt('Add a comment:');
    if (!text || !text.trim()) return;

    let authorName = 'Brother';
    try {
      const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      if (session?.name) authorName = session.name;
    } catch (e) { /* no session */ }

    tribute.comments.push({ author: authorName, text: text.trim() });
    this.renderTributeWall();
  },

  /**
   * Render the photo/video gallery
   */
  renderGallery() {
    const container = document.getElementById('memorial-gallery');
    if (!container) return;

    if (this.gallery.length === 0) {
      container.innerHTML = `
        <div id="memorial-gallery-empty" class="memorial-gallery-empty">
          <i data-lucide="images" class="w-6 h-6"></i>
          <span>No photos or videos yet. Attach one to your tribute to share a memory.</span>
        </div>
      `;
    } else {
      container.innerHTML = this.gallery.map((item, index) => `
        <button class="memorial-gallery-item" type="button" data-index="${index}" aria-label="Open ${this.escapeHTML(item.name || 'memory')}">
          ${item.kind === 'video'
            ? `<video src="${this.escapeHTML(item.url)}" muted preload="metadata" playsinline></video><span class="memorial-gallery-play"><i data-lucide="play" class="w-5 h-5"></i></span>`
            : `<img src="${this.escapeHTML(item.url)}" alt="${this.escapeHTML(item.name || '')}" loading="lazy" decoding="async">`}
        </button>
      `).join('');
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Gallery lightbox
   */
  openLightbox(index) {
    if (index < 0 || index >= this.gallery.length) return;
    this.lightboxIndex = index;
    this.renderLightbox();
    document.body.style.overflow = 'hidden';
  },

  closeLightbox() {
    this.lightboxIndex = -1;
    const lightbox = document.getElementById('memorial-lightbox');
    if (lightbox) lightbox.remove();
    document.body.style.overflow = '';
  },

  navigateLightbox(direction) {
    const next = this.lightboxIndex + direction;
    if (next < 0 || next >= this.gallery.length) return;
    this.lightboxIndex = next;
    this.renderLightbox();
  },

  renderLightbox() {
    const item = this.gallery[this.lightboxIndex];
    if (!item) return;

    let lightbox = document.getElementById('memorial-lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'memorial-lightbox';
      lightbox.className = 'vault-lightbox active';
      document.body.appendChild(lightbox);
    }

    const total = this.gallery.length;
    lightbox.innerHTML = `
      <div class="vault-lightbox-backdrop" data-lightbox="close"></div>
      <button class="vault-lightbox-close" type="button" data-lightbox="close" aria-label="Close">
        <i data-lucide="x" class="w-6 h-6"></i>
      </button>
      ${this.lightboxIndex > 0 ? `
        <button class="vault-lightbox-nav prev" type="button" data-lightbox="prev" aria-label="Previous">
          <i data-lucide="chevron-left" class="w-8 h-8"></i>
        </button>` : ''}
      ${this.lightboxIndex < total - 1 ? `
        <button class="vault-lightbox-nav next" type="button" data-lightbox="next" aria-label="Next">
          <i data-lucide="chevron-right" class="w-8 h-8"></i>
        </button>` : ''}
      <div class="vault-lightbox-content">
        <div class="vault-lightbox-image-wrapper">
          ${item.kind === 'video'
            ? `<video src="${this.escapeHTML(item.url)}" class="vault-lightbox-image" controls autoplay playsinline></video>`
            : `<img src="${this.escapeHTML(item.url)}" alt="${this.escapeHTML(item.name || '')}" class="vault-lightbox-image">`}
        </div>
        <div class="vault-lightbox-info">
          <div class="vault-lightbox-header">
            <h3 class="vault-lightbox-title">${this.escapeHTML(this.currentBrother.name)}</h3>
            <span class="vault-lightbox-counter">${this.lightboxIndex + 1} / ${total}</span>
          </div>
          ${item.caption ? `<p class="vault-lightbox-caption">${this.escapeHTML(item.caption)}</p>` : ''}
          <div class="vault-lightbox-meta">
            <span><i data-lucide="user" class="w-4 h-4"></i> Shared by ${this.escapeHTML(item.author || 'Brother')}</span>
          </div>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Setup composer, upload, like, comment, and gallery interactions.
   * Everything is delegated so handlers survive innerHTML re-renders.
   */
  setupEventListeners() {
    if (this.listenersBound) return;
    this.listenersBound = true;

    const wall = document.getElementById('tribute-wall');
    if (wall) {
      wall.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        const id = parseInt(button.dataset.id, 10);

        if (action === 'upload-photo') document.getElementById('tribute-photo-input')?.click();
        else if (action === 'upload-video') document.getElementById('tribute-video-input')?.click();
        else if (action === 'remove-attachment') this.removeAttachment();
        else if (action === 'post-tribute') this.postTribute();
        else if (action === 'like-tribute') this.toggleLikeTribute(id);
        else if (action === 'comment-tribute') this.addTributeComment(id);
      });

      wall.addEventListener('change', (e) => {
        const input = e.target.closest('input[type="file"][data-kind]');
        if (!input) return;
        const file = input.files && input.files[0];
        input.value = '';
        if (file) this.selectAttachment(file, input.dataset.kind);
      });

      wall.addEventListener('input', (e) => {
        if (e.target.id === 'tribute-input') this.composerState.text = e.target.value;
      });
    }

    const gallery = document.getElementById('memorial-gallery');
    if (gallery) {
      gallery.addEventListener('click', (e) => {
        const item = e.target.closest('.memorial-gallery-item');
        if (item) this.openLightbox(parseInt(item.dataset.index, 10));
      });
    }

    document.addEventListener('click', (e) => {
      const control = e.target.closest('#memorial-lightbox [data-lightbox]');
      if (!control) return;
      const action = control.dataset.lightbox;
      if (action === 'close') this.closeLightbox();
      else if (action === 'prev') this.navigateLightbox(-1);
      else if (action === 'next') this.navigateLightbox(1);
    });

    document.addEventListener('keydown', (e) => {
      if (this.lightboxIndex < 0) return;
      if (e.key === 'Escape') this.closeLightbox();
      else if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
      else if (e.key === 'ArrowRight') this.navigateLightbox(1);
    });
  },

  /**
   * Show a temporary toast message
   */
  showToast(message) {
    let toast = document.getElementById('memorial-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'memorial-toast';
      toast.className = 'memorial-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MemorialModule.init());
} else {
  MemorialModule.init();
}

// Re-init on bfcache restore (browser back/forward)
window.addEventListener('zbm-bfcache-restore', () => {
  MemorialModule.init();
});

// Expose globally for debugging / external hooks
window.MemorialModule = MemorialModule;
