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

  // Mock gallery items
  gallery: [
    { type: 'photo', icon: 'image' },
    { type: 'photo', icon: 'image' },
    { type: 'video', icon: 'play-circle' },
    { type: 'photo', icon: 'image' }
  ],

  currentBrother: null,

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

    hero.innerHTML = `
      <div class="memorial-candle">
        <i data-lucide="flame" class="w-7 h-7"></i>
      </div>
      <img src="${brother.photo}" alt="${brother.name}" class="memorial-portrait" loading="lazy" decoding="async">
      <h1 class="memorial-name">${brother.name}</h1>
      <p class="memorial-dates">${brother.dates.replace('-', '—')}</p>
      <p class="memorial-meta">${brother.specialty} &bull; ${brother.years}</p>
      <p class="memorial-bio">${brother.bio}</p>
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

    container.innerHTML = `
      <div class="memorial-composer glass-card">
        <textarea id="tribute-input" class="composer-input" placeholder="Share a message or tribute for our brother..."></textarea>
        <div class="memorial-composer-actions">
          <div class="flex gap-2">
            <button class="composer-btn" type="button" data-action="upload-photo">
              <i data-lucide="image" class="w-4 h-4"></i> Photo
            </button>
            <button class="composer-btn" type="button" data-action="upload-video">
              <i data-lucide="video" class="w-4 h-4"></i> Video
            </button>
          </div>
          <button id="post-tribute-btn" class="btn btn-gold" type="button">
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
  createTributeHTML(tribute) {
    const commentsHTML = tribute.comments.map(c => `
      <div class="memorial-comment">
        <span class="memorial-comment-author">${c.author}</span>
        <span class="memorial-comment-text">${c.text}</span>
      </div>
    `).join('');

    return `
      <article class="memorial-tribute glass-card">
        <div class="memorial-tribute-head">
          <img src="${tribute.author.avatar}" alt="" class="memorial-tribute-avatar" loading="lazy" decoding="async">
          <div>
            <div class="memorial-tribute-author">${tribute.author.name}</div>
            <div class="memorial-tribute-time">${tribute.author.batch} &bull; ${tribute.time}</div>
          </div>
        </div>
        <p class="memorial-tribute-text">${tribute.content}</p>
        <div class="memorial-tribute-actions">
          <button class="reaction-btn" type="button" data-action="like-tribute" data-id="${tribute.id}">
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
   * Render the photo/video gallery
   */
  renderGallery() {
    const container = document.getElementById('memorial-gallery');
    if (!container) return;

    container.innerHTML = this.gallery.map((item, index) => `
      <div class="memorial-gallery-item" data-index="${index}">
        <i data-lucide="${item.icon}" class="w-6 h-6"></i>
      </div>
    `).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Setup composer, upload, like, and comment interactions
   */
  setupEventListeners() {
    const wall = document.getElementById('tribute-wall');
    if (!wall) return;

    wall.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const action = button.dataset.action;

      if (action === 'upload-photo' || action === 'upload-video') {
        this.showToast('Upload functionality coming soon');
        return;
      }

      if (action === 'like-tribute') {
        this.showToast('Reaction saved locally — backend sync coming soon');
        return;
      }

      if (action === 'comment-tribute') {
        this.showToast('Comments will be enabled once the tribute backend is connected');
        return;
      }
    });

    const postBtn = document.getElementById('post-tribute-btn');
    const input = document.getElementById('tribute-input');

    if (postBtn && input) {
      postBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (!text) {
          this.showToast('Please write something before posting');
          return;
        }
        this.showToast('Tribute submitted — backend storage coming soon');
        input.value = '';
      });
    }

    const gallery = document.getElementById('memorial-gallery');
    if (gallery) {
      gallery.addEventListener('click', () => {
        this.showToast('Media gallery expansion coming soon');
      });
    }
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

// Expose globally for debugging / external hooks
window.MemorialModule = MemorialModule;
