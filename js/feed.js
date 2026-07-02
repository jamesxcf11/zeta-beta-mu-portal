/**
 * Zeta Beta Mu Fraternity Portal
 * Feed Module - Instagram-like Social Media Feed Functionality
 * 
 * Handles post creation, display, reactions, comments, and composer
 * for the social feed screen with multiple reactions and image support.
 */

const FeedModule = {
  // Available Facebook-style reactions
  REACTIONS: [
    { type: 'like', icon: '👍', label: 'Like', color: '#3b82f6' },
    { type: 'love', icon: '❤️', label: 'Love', color: '#ef4444' },
    { type: 'celebrate', icon: '🎉', label: 'Celebrate', color: '#22c55e' },
    { type: 'support', icon: '🤝', label: 'Support', color: '#a855f7' },
    { type: 'insightful', icon: '💡', label: 'Insightful', color: '#d4af37' },
    { type: 'haha', icon: '😄', label: 'Haha', color: '#f59e0b' }
  ],

  // Mock posts data with multiple reactions
  posts: [
    {
      id: 1,
      author: {
        name: 'Dr. Sarah Mitchell',
        avatar: 'https://i.pravatar.cc/150?img=5',
        title: 'Neurologist at Mount Sinai'
      },
      content: 'Just published our latest research on neuroplasticity in stroke recovery. Excited to share these findings with our medical community! The study followed 200 patients over 18 months and shows remarkable improvement potential with targeted therapy protocols.',
      image: 'https://picsum.photos/800/400?random=1',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      reactions: {
        love: 8,
        celebrate: 12,
        insightful: 4,
        like: 0
      },
      userReaction: null,
      comments: [
        {
          id: 1,
          author: { name: 'Dr. Michael Chen', avatar: 'https://i.pravatar.cc/150?img=3' },
          content: 'Congratulations Dr. Mitchell! This is groundbreaking work.',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000)
        },
        {
          id: 2,
          author: { name: 'Dr. James Anderson', avatar: 'https://i.pravatar.cc/150?img=11' },
          content: 'Would love to discuss the methodology. Great job!',
          timestamp: new Date(Date.now() - 30 * 60 * 1000)
        }
      ],
      shares: 3,
      showComments: false
    },
    {
      id: 2,
      author: {
        name: 'Dr. Michael Chen',
        avatar: 'https://i.pravatar.cc/150?img=3',
        title: 'Oncologist at Johns Hopkins'
      },
      content: 'Honored to be speaking at the Annual Oncology Summit next month. Looking forward to reconnecting with fellow Zeta Beta Mu brothers at the event! Who else is attending?',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      reactions: {
        love: 15,
        celebrate: 20,
        insightful: 8,
        like: 2
      },
      userReaction: 'celebrate',
      comments: [
        {
          id: 3,
          author: { name: 'Dr. Emily Roberts', avatar: 'https://i.pravatar.cc/150?img=9' },
          content: 'I will be there! Let\'s grab coffee between sessions.',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000)
        }
      ],
      shares: 8,
      showComments: false
    },
    {
      id: 3,
      author: {
        name: 'Dr. James Anderson',
        avatar: 'https://i.pravatar.cc/150?img=11',
        title: 'Cardiologist at St. Luke\'s'
      },
      content: 'Reminder: The Annual Fraternity Gala Dinner is scheduled for March 25th at The Grand Hotel. Please RSVP by March 10th. This year\'s theme is "Honoring 50 Years of Excellence." Looking forward to seeing everyone there!',
      image: 'https://picsum.photos/800/400?random=2',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      reactions: {
        love: 45,
        celebrate: 60,
        insightful: 12,
        like: 10
      },
      userReaction: null,
      comments: [],
      shares: 32,
      showComments: false
    },
    {
      id: 4,
      author: {
        name: 'Dr. Emily Roberts',
        avatar: 'https://i.pravatar.cc/150?img=9',
        title: 'Pediatrician at Children\'s Hospital'
      },
      content: 'Congratulations to our newest inductees! Welcome to the brotherhood, Dr. Martinez, Dr. Patel, and Dr. Wong. Your dedication to medicine and service is truly inspiring. 🎓',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      reactions: {
        love: 30,
        celebrate: 45,
        insightful: 8,
        like: 6
      },
      userReaction: 'love',
      comments: [
        {
          id: 4,
          author: { name: 'Dr. Martinez', avatar: 'https://i.pravatar.cc/150?img=12' },
          content: 'Thank you so much! Honored to be part of this amazing fraternity.',
          timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000)
        }
      ],
      shares: 12,
      showComments: false
    },
    {
      id: 5,
      author: {
        name: 'Dr. Robert Kim',
        avatar: 'https://i.pravatar.cc/150?img=8',
        title: 'Surgeon at Mayo Clinic'
      },
      content: 'Sharing a case study from yesterday: 6-hour complex cardiac surgery on a 72-year-old patient. Successful outcome thanks to the incredible team at Mayo. Grateful for the expertise honed through years of practice and the support of mentors from Zeta Beta Mu.',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      reactions: {
        love: 56,
        celebrate: 40,
        insightful: 35,
        like: 25
      },
      userReaction: null,
      comments: [
        {
          id: 5,
          author: { name: 'Dr. James Anderson', avatar: 'https://i.pravatar.cc/150?img=11' },
          content: 'Excellent work, Dr. Kim! The patient is fortunate to have you.',
          timestamp: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000)
        },
        {
          id: 6,
          author: { name: 'Dr. Sarah Mitchell', avatar: 'https://i.pravatar.cc/150?img=5' },
          content: 'Proud of our brother! This is what excellence looks like.',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        }
      ],
      shares: 24,
      showComments: false
    }
  ],

  // Mock birthdays data (today, tomorrow, next)
  birthdays: [
    { name: 'Dr. Michael Chen', date: 'Today', avatar: 'https://i.pravatar.cc/150?img=3', year: 2008, isToday: true },
    { name: 'Dr. Sarah Johnson', date: 'Tomorrow', avatar: 'https://i.pravatar.cc/150?img=6', year: 2012, isToday: false },
    { name: 'Dr. Robert Kim', date: 'March 18', avatar: 'https://i.pravatar.cc/150?img=8', year: 2010, isToday: false }
  ],

  // Mock announcements data
  announcements: [
    {
      id: 1,
      title: 'Annual Gala 2026',
      date: 'March 25, 2026',
      content: 'Join us for our 50th anniversary celebration',
      icon: 'calendar'
    },
    {
      id: 2,
      title: 'New Member Induction',
      date: 'April 15, 2026',
      content: 'Ceremony for 12 new medical professionals',
      icon: 'award'
    },
    {
      id: 3,
      title: 'Medical Conference',
      date: 'May 10-12, 2026',
      content: 'Annual medical excellence conference',
      icon: 'heart-pulse'
    }
  ],

  // Composer state
  composerState: {
    text: '',
    image: null,
    imagePreview: null
  },

  // Incremental rendering state (matches a future paginated API)
  visibleCount: 5,
  PAGE_SIZE: 5,
  scrollObserver: null,

  /**
   * Initialize feed module
   */
  init() {
    this.renderPosts();
    this.renderBirthdays();
    this.renderAnnouncements();
    this.setupEventListeners();
  },

  /**
   * Render visible posts to the feed (chunked; more load on scroll)
   */
  renderPosts() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    const visible = this.posts.slice(0, this.visibleCount);
    const hasMore = this.posts.length > this.visibleCount;

    container.innerHTML = visible.map(post => this.createPostHTML(post)).join('')
      + (hasMore ? '<div id="feed-sentinel" class="feed-sentinel" aria-hidden="true"></div>' : '');

    this.observeSentinel();

    // Initialize icons for new content
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Load the next chunk when the sentinel scrolls into view
   */
  observeSentinel() {
    const sentinel = document.getElementById('feed-sentinel');
    if (this.scrollObserver) this.scrollObserver.disconnect();
    if (!sentinel || !('IntersectionObserver' in window)) return;

    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        this.visibleCount = Math.min(this.visibleCount + this.PAGE_SIZE, this.posts.length);
        this.renderPosts();
      }
    }, { rootMargin: '400px' });
    this.scrollObserver.observe(sentinel);
  },

  /**
   * Re-render a single post card in place (no full-feed re-render,
   * keeps scroll position and avoids re-decoding every image)
   */
  updatePost(postId) {
    const post = this.posts.find(p => p.id === postId);
    const card = document.querySelector(`article[data-post-id="${postId}"]`);
    if (!post || !card) {
      this.renderPosts();
      return;
    }
    card.outerHTML = this.createPostHTML(post);
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Create HTML for a single post
   */
  createPostHTML(post) {
    const timeAgo = this.getTimeAgo(post.timestamp);
    const totalReactions = Object.values(post.reactions).reduce((sum, count) => sum + count, 0);
    const reactionSummary = this.getReactionSummary(post.reactions);

    const current = this.REACTIONS.find(r => r.type === post.userReaction);
    const mainLabel = current ? current.label : 'Like';
    const mainIcon = current
      ? `<span class="reaction-emoji">${current.icon}</span>`
      : '<i data-lucide="heart" class="w-4 h-4"></i>';
    const picker = this.REACTIONS.map(r => `
      <button class="reaction-pick" title="${r.label}" onclick="FeedModule.toggleReaction(${post.id}, '${r.type}')">${r.icon}</button>
    `).join('');

    return `
      <article class="post-card" data-post-id="${post.id}">
        <div class="post-header">
          <img src="${post.author.avatar}" alt="${post.author.name}" class="post-avatar" loading="lazy" decoding="async" width="48" height="48">
          <div class="post-author-info">
            <div class="post-author-name">${post.author.name}</div>
            <div class="post-author-title">${post.author.title}</div>
          </div>
          <div class="post-timestamp">• ${timeAgo}</div>
        </div>
        
        <div class="post-content">${post.content}</div>
        
        ${post.image ? `<img src="${post.image}" alt="Post image" class="post-image" loading="lazy" decoding="async">` : ''}
        
        <div class="post-actions">
          <div class="post-reactions">
            <div class="reaction-trigger">
              <button class="reaction-btn ${post.userReaction ? 'liked reacted-' + post.userReaction : ''}" onclick="FeedModule.toggleReaction(${post.id}, '${post.userReaction || 'like'}')">
                ${mainIcon}
                <span>${mainLabel}</span>
              </button>
              <div class="reaction-picker">${picker}</div>
            </div>
            <button class="reaction-btn ${post.userReaction ? 'commented' : ''}" onclick="FeedModule.toggleComments(${post.id})">
              <i data-lucide="message-circle" class="w-4 h-4"></i>
              <span>Comment</span>
            </button>
            <button class="reaction-btn ${post.userReaction ? 'shared' : ''}" onclick="FeedModule.sharePost(${post.id})">
              <i data-lucide="share" class="w-4 h-4"></i>
              <span>Share</span>
            </button>
          </div>
        </div>
        
        ${totalReactions > 0 ? `
          <div class="post-stats">
            <div class="reaction-bar">
              ${reactionSummary}
            </div>
            <div>${totalReactions} ${totalReactions === 1 ? 'reaction' : 'reactions'} • ${post.comments.length} ${post.comments.length === 1 ? 'comment' : 'comments'}</div>
          </div>
        ` : ''}
        
        <div class="post-comments">
          ${post.comments.length > 0 ? `
            <div class="comments-toggle" onclick="FeedModule.toggleComments(${post.id})">
              ${post.showComments ? 'Hide' : 'View'} ${post.comments.length} ${post.comments.length === 1 ? 'comment' : 'comments'}
            </div>
            ${post.showComments ? post.comments.map(comment => this.createCommentHTML(comment)).join('') : ''}
          ` : ''}
          
          ${post.showComments ? `
            <div class="comment-input-wrapper">
              <img src="https://i.pravatar.cc/150?img=11" alt="You" class="comment-avatar">
              <input type="text" class="comment-input" placeholder="Add a comment..." onkeypress="FeedModule.handleCommentKeypress(event, ${post.id})">
            </div>
          ` : ''}
        </div>
      </article>
    `;
  },

  /**
   * Create HTML for a comment
   */
  createCommentHTML(comment) {
    const timeAgo = this.getTimeAgo(comment.timestamp);
    return `
      <div class="comment">
        <img src="${comment.author.avatar}" alt="${comment.author.name}" class="comment-avatar" loading="lazy" decoding="async" width="32" height="32">
        <div class="comment-content">
          <div class="comment-author">${comment.author.name}</div>
          <div class="comment-text">${comment.content}</div>
          <div class="comment-time">${timeAgo}</div>
        </div>
      </div>
    `;
  },

  /**
   * Get reaction summary HTML
   */
  getReactionSummary(reactions) {
    return this.REACTIONS
      .filter(r => reactions[r.type] > 0)
      .map(r => `
        <span class="reaction-option reaction-${r.type}" title="${reactions[r.type]} ${r.type === 'love' ? 'loves' : r.type + 's'}">
          ${r.icon}
        </span>
      `)
      .join('');
  },

  /**
   * Toggle reaction on post
   */
  toggleReaction(postId, reactionType) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    if (post.reactions[reactionType] === undefined) post.reactions[reactionType] = 0;

    // If user already reacted with this type, remove it
    if (post.userReaction === reactionType) {
      post.reactions[reactionType] = Math.max(0, post.reactions[reactionType] - 1);
      post.userReaction = null;
    } else {
      // Remove previous reaction if any
      if (post.userReaction && post.reactions[post.userReaction] !== undefined) {
        post.reactions[post.userReaction] = Math.max(0, post.reactions[post.userReaction] - 1);
      }
      // Add new reaction
      post.reactions[reactionType]++;
      post.userReaction = reactionType;
    }

    this.updatePost(postId);
  },

  /**
   * Toggle comments visibility
   */
  toggleComments(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    post.showComments = !post.showComments;
    this.updatePost(postId);
  },

  /**
   * Share post
   */
  sharePost(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    post.shares++;
    this.showToast('Post shared successfully!');
    this.updatePost(postId);
  },

  /**
   * Handle comment input keypress
   */
  handleCommentKeypress(event, postId) {
    if (event.key === 'Enter' && event.target.value.trim()) {
      this.addComment(postId, event.target.value.trim());
      event.target.value = '';
    }
  },

  /**
   * Add comment to post
   */
  addComment(postId, content) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    const newComment = {
      id: Date.now(),
      author: { 
        name: 'Dr. James Anderson', 
        avatar: 'https://i.pravatar.cc/150?img=11' 
      },
      content: content,
      timestamp: new Date()
    };

    post.comments.push(newComment);
    this.updatePost(postId);
  },

  /**
   * Render birthdays widget
   */
  renderBirthdays() {
    const container = document.getElementById('birthdays-list');
    if (!container) return;

    container.innerHTML = this.birthdays.map(birthday => this.createBirthdayHTML(birthday)).join('');
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Create HTML for birthday item
   */
  createBirthdayHTML(birthday) {
    return `
      <div class="widget-item ${birthday.isToday ? 'today' : ''}">
        <div class="widget-icon">
          <i data-lucide="cake" class="w-4 h-4"></i>
        </div>
        <div class="widget-content">
          <div class="widget-label">${birthday.name}</div>
          <div class="widget-sublabel">Class of ${birthday.year} • ${birthday.date}</div>
        </div>
        ${birthday.isToday ? '<div class="widget-icon"><i data-lucide="cake" class="w-4 h-4"></i></div>' : ''}
      </div>
    `;
  },

  /**
   * Render announcements widget
   */
  renderAnnouncements() {
    const container = document.getElementById('announcements-list');
    if (!container) return;

    container.innerHTML = this.announcements.map(announcement => this.createAnnouncementHTML(announcement)).join('');
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Create HTML for announcement item
   */
  createAnnouncementHTML(announcement) {
    return `
      <div class="widget-item">
        <div class="widget-icon">
          <i data-lucide="${announcement.icon}" class="w-4 h-4"></i>
        </div>
        <div class="widget-content">
          <div class="widget-label">${announcement.title}</div>
          <div class="widget-sublabel">${announcement.date}</div>
        </div>
      </div>
    `;
  },

  /**
   * Setup event listeners for composer
   */
  setupEventListeners() {
    // Image upload
    const addImageBtn = document.getElementById('add-image-btn');
    const imageUpload = document.getElementById('image-upload');
    const removeImageBtn = document.getElementById('remove-image');
    const postBtn = document.getElementById('post-btn');

    if (addImageBtn && imageUpload) {
      addImageBtn.addEventListener('click', () => imageUpload.click());
      
      imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            this.composerState.image = e.target.result;
            this.updateImagePreview();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', () => {
        this.composerState.image = null;
        this.updateImagePreview();
        if (imageUpload) imageUpload.value = '';
      });
    }

    if (postBtn) {
      postBtn.addEventListener('click', () => this.createPost());
    }

    // Auto-resize textarea
    const postInput = document.getElementById('post-input');
    if (postInput) {
      postInput.addEventListener('input', () => {
        postInput.style.height = 'auto';
        postInput.style.height = Math.min(postInput.scrollHeight, 200) + 'px';
      });
    }
  },

  /**
   * Update image preview in composer
   */
  updateImagePreview() {
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    
    if (this.composerState.image && preview && previewImg) {
      previewImg.src = this.composerState.image;
      preview.style.display = 'block';
    } else if (preview) {
      preview.style.display = 'none';
    }
  },

  /**
   * Create new post
   */
  createPost() {
    const postInput = document.getElementById('post-input');
    const text = postInput?.value.trim();
    
    if (!text && !this.composerState.image) {
      this.showToast('Please write something or add an image');
      return;
    }

    const newPost = {
      id: Date.now(),
      author: {
        name: 'Dr. James Anderson',
        avatar: 'https://i.pravatar.cc/150?img=11',
        title: 'Cardiologist at St. Luke\'s'
      },
      content: text,
      image: this.composerState.image,
      timestamp: new Date(),
      reactions: { love: 0, celebrate: 0, insightful: 0, like: 0 },
      userReaction: null,
      comments: [],
      shares: 0,
      showComments: false
    };

    this.posts.unshift(newPost);
    this.visibleCount++;
    this.renderPosts();
    
    // Reset composer
    if (postInput) postInput.value = '';
    this.composerState.image = null;
    this.updateImagePreview();
    
    const imageUpload = document.getElementById('image-upload');
    if (imageUpload) imageUpload.value = '';
    
    this.showToast('Post published successfully!');
  },

  /**
   * Get time ago string
   */
  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'h';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd';
    
    return Math.floor(seconds / 604800) + 'w';
  },

  /**
   * Show toast notification
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
      background: rgba(212, 175, 55, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      backdrop-filter: blur(10px);
      z-index: 1000;
      animation: slideUp 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }
};

// Expose globally
window.FeedModule = FeedModule;
