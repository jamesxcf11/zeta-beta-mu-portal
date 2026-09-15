/**
 * Zeta Beta Mu Fraternity Portal
 * Feed Module - Instagram-like Social Media Feed Functionality
 * 
 * Handles post creation, display, reactions, comments, and composer
 * for the social feed screen with multiple reactions and image support.
 */

const FeedModule = {
  /**
   * Escape HTML special characters to prevent XSS when injecting
   * user-provided strings via innerHTML.
   */
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Available Facebook-style reactions
  REACTIONS: [
    { type: 'like', icon: '👍', label: 'Like', color: '#3b82f6' },
    { type: 'love', icon: '❤️', label: 'Love', color: '#ef4444' },
    { type: 'celebrate', icon: '🎉', label: 'Celebrate', color: '#22c55e' },
    { type: 'support', icon: '🤝', label: 'Support', color: '#a855f7' },
    { type: 'insightful', icon: '💡', label: 'Insightful', color: '#d4af37' },
    { type: 'haha', icon: '😄', label: 'Haha', color: '#f59e0b' }
  ],

  // Double-submit guard for post creation
  isPosting: false,

  posts: [],
  feedLoadError: null,

  birthdays: [],
  announcements: [],

  // Derived notifications: reactions/comments on your posts + new
  // announcements since your last visit (see loadNotifications)
  notifications: [],

  /**
   * LocalStorage keys for per-member notification read state.
   */
  notifReadKey() {
    const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
    return session ? `zbm-notif-read-${session.id}` : null;
  },

  notifLastVisitKey() {
    const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
    return session ? `zbm-notif-last-visit-${session.id}` : null;
  },

  getReadNotificationIds() {
    const key = this.notifReadKey();
    if (!key) return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch (e) {
      return new Set();
    }
  },

  saveReadNotificationIds(ids) {
    const key = this.notifReadKey();
    if (key) localStorage.setItem(key, JSON.stringify([...ids]));
  },

  // Composer state
  composerState: {
    text: '',
    image: null,
    imageFile: null,
    imagePreview: null
  },

  /**
   * Check if Supabase is configured
   */
  hasSupabase() {
    return typeof db !== 'undefined' && db &&
           typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');
  },

  // Incremental rendering state (matches a future paginated API)
  visibleCount: 5,
  PAGE_SIZE: 5,
  scrollObserver: null,

  // Client-side search query from the header search input
  searchQuery: '',

  // Track which post overflow menu is open
  activeOverflowMenu: null,

  // Post id targeted by the open report modal
  reportTargetPostId: null,

  /**
   * Resolve the logged-in user from the session (with safe fallbacks).
   */
  getCurrentUser() {
    let session = null;
    if (typeof AuthHelper !== 'undefined') {
      try {
        session = AuthHelper.getCurrentUser();
      } catch (e) { /* invalid session */ }
    }
    const title = session && session.field && session.hospital
      ? `${session.field} at ${session.hospital}`
      : (session && session.role === 'admin' ? 'Administrator' : 'Member');
    return {
      name: (session && session.name) || 'Brother',
      avatar: (session && session.avatar) || 'image/placeholders/avatars/a11.jpg',
      title
    };
  },

  /**
   * Apply the logged-in user's identity to static composer UI.
   */
  applyUserToUI() {
    const user = this.getCurrentUser();

    const composerAvatar = document.querySelector('.composer-avatar');
    if (composerAvatar) {
      composerAvatar.src = user.avatar;
      composerAvatar.alt = user.name;
    }

    const postInput = document.getElementById('post-input');
    if (postInput) {
      const lastName = user.name.trim().split(/\s+/).pop();
      postInput.placeholder = `What's on your mind, Dr. ${lastName}?`;
    }
  },

  /**
   * Initialize feed module. Exposes this.ready (a promise) so dependent
   * UI such as the welcome modal can wait for real data to load.
   */
  init() {
    this.ready = this._init();
  },

  async _init() {
    this.applyUserToUI();
    if (this.hasSupabase()) {
      await this.loadPosts();
      await this.loadAnnouncements();
      await this.loadBirthdays();
      await this.loadNotifications();
    }
    this.renderPosts();
    this.renderBirthdays();
    this.renderAnnouncements();
    this.renderBirthdaysFullList();
    this.renderAnnouncementsFullList();
    this.renderNotifications();
    this.updateUnreadBadges();
    this.setupEventListeners();
  },

  /**
   * Load posts from Supabase and map to the existing data structure
   */
  async loadPosts() {
    this.feedLoadError = null;
    let result;
    try {
      result = await db
        .from('posts')
        .select(`
          id, content, image_url, is_pinned, post_type, status, created_at,
          member_id, members:member_id (name, avatar_url, hospital, field_of_medicine, role)
        `)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);
    } catch (error) {
      result = { error };
    }

    const { data, error } = result;
    if (error || !data) {
      console.error('feed: failed to load posts', error);
      this.posts = [];
      this.feedLoadError = 'The live feed could not be reached. Check your connection and try again.';
      return;
    }

    // Load reactions and comments for each post
    const postIds = data.map(p => p.id);
    const [{ data: reactions }, { data: comments }] = await Promise.all([
      db.from('post_reactions').select('post_id, member_id, reaction_type').in('post_id', postIds),
      db.from('comments').select('id, post_id, member_id, content, created_at, members:member_id (name, avatar_url)').eq('status', 'published').in('post_id', postIds).order('created_at', { ascending: true })
    ]);

    const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
    const currentUserId = session?.id;

    this.posts = data.map(p => {
      const postReactions = (reactions || []).filter(r => r.post_id === p.id);
      const reactionCounts = {};
      let userReaction = null;
      postReactions.forEach(r => {
        reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
        if (currentUserId && r.member_id === currentUserId) {
          userReaction = r.reaction_type;
        }
      });

      const postComments = (comments || []).filter(c => c.post_id === p.id).map(c => ({
        id: c.id,
        author: {
          name: c.members?.name || 'Unknown',
          avatar: c.members?.avatar_url || ''
        },
        content: c.content,
        timestamp: new Date(c.created_at)
      }));

      const member = p.members || {};
      return {
        id: p.id,
        memberId: p.member_id,
        author: {
          name: member.name || 'Unknown',
          avatar: member.avatar_url || 'image/placeholders/avatars/a11.jpg',
          title: member.field_of_medicine && member.hospital ? `${member.field_of_medicine} at ${member.hospital}` : 'Member',
          isOfficer: member.role === 'admin' || member.role === 'officer'
        },
        content: p.content,
        image: p.image_url,
        timestamp: new Date(p.created_at),
        isPinned: p.is_pinned,
        type: p.post_type || 'general',
        reactions: {
          like: reactionCounts.like || 0,
          love: reactionCounts.love || 0,
          celebrate: reactionCounts.celebrate || 0,
          insightful: reactionCounts.insightful || 0,
          support: reactionCounts.support || 0,
          haha: reactionCounts.haha || 0
        },
        userReaction,
        comments: postComments,
        shares: 0,
        showComments: false
      };
    });
  },

  async retryLoadPosts() {
    await this.loadPosts();
    this.renderPosts();
  },

  /**
   * Load announcements from Supabase
   */
  async loadAnnouncements() {
    const { data, error } = await db
      .from('announcements')
      .select('id, title, content, priority, is_pinned, starts_at, created_at')
      .is('deleted_at', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error || !data) return;

    const iconMap = { high: 'calendar', normal: 'award', low: 'mail', urgent: 'shield' };
    const accentMap = { high: 'gold', normal: 'emerald', low: 'info', urgent: 'gold' };

    this.announcements = data.map(a => ({
      id: a.id,
      title: a.title,
      date: new Date(a.starts_at || a.created_at),
      createdAt: new Date(a.created_at),
      content: a.content,
      icon: iconMap[a.priority] || 'megaphone',
      accent: accentMap[a.priority] || 'gold',
      unread: false
    }));
  },

  /**
   * Load birthdays from Supabase
   */
  async loadBirthdays() {
    const { data, error } = await db
      .from('birthday_calendar')
      .select(`
        birth_date, birth_year,
        members:member_id (id, name, avatar_url, graduation_year)
      `)
      .eq('show_on_calendar', true);

    if (error || !data) return;

    this.birthdays = data.map(b => ({
      name: b.members?.name || 'Unknown',
      date: new Date(b.birth_date),
      avatar: b.members?.avatar_url || '',
      year: b.members?.graduation_year || b.birth_year,
      wished: false
    }));
  },

  /**
   * Load notifications derived from real activity: reactions and comments
   * on your posts plus announcements created since your last visit.
   * Read state is persisted per member in localStorage.
   */
  async loadNotifications() {
    const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
    if (!session) return;

    // Baseline: first visit looks back one week so recent activity shows;
    // afterwards only activity since the previous visit counts.
    const FIRST_VISIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    const lastVisitKey = this.notifLastVisitKey();
    const stored = lastVisitKey ? localStorage.getItem(lastVisitKey) : null;
    const since = stored ? new Date(stored) : new Date(Date.now() - FIRST_VISIT_WINDOW_MS);
    if (lastVisitKey) localStorage.setItem(lastVisitKey, new Date().toISOString());

    const reads = this.getReadNotificationIds();
    const items = [];

    // Per-member notification preferences (Settings page). Fails open —
    // if preferences can't be loaded, everything stays enabled.
    let notifPrefs = {};
    try {
      const { data: prefRow } = await db
        .from('members')
        .select('preferences')
        .eq('id', session.id)
        .single();
      notifPrefs = (prefRow && prefRow.preferences && prefRow.preferences.notifications) || {};
    } catch (e) {
      notifPrefs = {};
    }
    const wantsNotification = (type) => notifPrefs[type + 's'] !== false;

    // Reactions and comments on MY posts
    const { data: myPosts } = await db.from('posts')
      .select('id')
      .eq('member_id', session.id);
    const myPostIds = (myPosts || []).map(p => p.id);

    if (myPostIds.length) {
      const [{ data: reactions }, { data: comments }] = await Promise.all([
        db.from('post_reactions')
          .select('id, member_id, reaction_type, created_at, members:member_id (name)')
          .in('post_id', myPostIds)
          .gt('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(20),
        db.from('comments')
          .select('id, member_id, created_at, members:member_id (name)')
          .eq('status', 'published')
          .in('post_id', myPostIds)
          .gt('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      (reactions || []).forEach(r => {
        if (r.member_id === session.id) return; // skip own activity
        const name = r.members?.name || 'A brother';
        items.push({
          id: `r-${r.id}`,
          type: 'reaction',
          icon: 'heart',
          text: `${name} reacted to your post`,
          time: this.getTimeAgo(new Date(r.created_at)),
          ts: new Date(r.created_at).getTime(),
          unread: !reads.has(`r-${r.id}`)
        });
      });

      (comments || []).forEach(c => {
        if (c.member_id === session.id) return; // skip own activity
        const name = c.members?.name || 'A brother';
        items.push({
          id: `c-${c.id}`,
          type: 'comment',
          icon: 'message-circle',
          text: `${name} commented on your post`,
          time: this.getTimeAgo(new Date(c.created_at)),
          ts: new Date(c.created_at).getTime(),
          unread: !reads.has(`c-${c.id}`)
        });
      });
    }

    // New announcements since the last visit
    (this.announcements || []).forEach(a => {
      if (!a.createdAt || a.createdAt <= since) return;
      items.push({
        id: `a-${a.id}`,
        type: 'announcement',
        icon: 'megaphone',
        text: `New announcement: ${a.title}`,
        time: this.getTimeAgo(a.createdAt),
        ts: a.createdAt.getTime(),
        unread: !reads.has(`a-${a.id}`)
      });
    });

    items.sort((x, y) => y.ts - x.ts);
    this.notifications = items.filter(i => wantsNotification(i.type)).slice(0, 20);
  },

  /**
   * Posts matching the active search query (all posts when empty).
   */
  getFilteredPosts() {
    const query = (this.searchQuery || '').trim().toLowerCase();
    if (!query) return this.posts;
    return this.posts.filter(p =>
      (p.content || '').toLowerCase().includes(query) ||
      (p.author && p.author.name || '').toLowerCase().includes(query)
    );
  },

  /**
   * Render visible posts to the feed (chunked; more load on scroll)
   */
  renderPosts() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    if (this.feedLoadError) {
      container.innerHTML = `
        <div class="empty-state feed-error-state" role="alert">
          <div class="empty-icon"><i data-lucide="wifi-off" class="w-8 h-8"></i></div>
          <div class="empty-title">Live feed unavailable</div>
          <div class="empty-text">${this.escapeHTML(this.feedLoadError)}</div>
          <button class="btn btn-secondary" type="button" onclick="FeedModule.retryLoadPosts()">Try again</button>
        </div>
      `;
      const loadMore = document.getElementById('feed-load-more');
      if (loadMore) loadMore.style.display = 'none';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const filtered = this.getFilteredPosts();
    const visible = filtered.slice(0, this.visibleCount);
    const hasMore = filtered.length > this.visibleCount;

    if (filtered.length === 0) {
      const query = (this.searchQuery || '').trim();
      container.innerHTML = query
        ? `
          <div class="empty-state">
            <div class="empty-icon"><i data-lucide="search-x" class="w-8 h-8"></i></div>
            <div class="empty-title">No posts found</div>
            <div class="empty-text">No posts or members match "${this.escapeHTML(query)}".</div>
          </div>
        `
        : `
          <div class="empty-state">
            <div class="empty-icon"><i data-lucide="newspaper" class="w-8 h-8"></i></div>
            <div class="empty-title">No posts yet</div>
            <div class="empty-text">Be the first to share something with the brotherhood.</div>
          </div>
        `;
    } else {
      container.innerHTML = visible.map(post => this.createPostHTML(post)).join('')
        + (hasMore ? '<div id="feed-sentinel" class="feed-sentinel" aria-hidden="true"></div>' : '');
    }

    this.observeSentinel();

    const loadMore = document.getElementById('feed-load-more');
    if (loadMore) {
      loadMore.style.display = hasMore ? '' : 'none';
    }

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
        this.visibleCount = Math.min(this.visibleCount + this.PAGE_SIZE, this.getFilteredPosts().length);
        this.renderPosts();
      }
    }, { rootMargin: '400px' });
    this.scrollObserver.observe(sentinel);
  },

  /**
   * Manual load-more trigger (button click)
   */
  loadMore() {
    this.visibleCount = Math.min(this.visibleCount + this.PAGE_SIZE, this.getFilteredPosts().length);
    this.renderPosts();
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
    const safeAuthorName = this.escapeHTML(post.author.name);
    const safeAuthorTitle = this.escapeHTML(post.author.title);
    const safeContent = this.escapeHTML(post.content);
    const totalReactions = Object.values(post.reactions).reduce((sum, count) => sum + count, 0);
    const reactionSummary = this.getReactionSummary(post.reactions, totalReactions);

    const current = this.REACTIONS.find(r => r.type === post.userReaction);

    const DEFAULT_REACTIONS = {
      achievement: { type: 'celebrate', icon: '🎉', label: 'Celebrate' },
      announcement: { type: 'love', icon: '❤️', label: 'Love' },
      case_study: { type: 'insightful', icon: '💡', label: 'Insightful' },
      general: { type: 'like', icon: '👍', label: 'Like' }
    };
    const fallback = DEFAULT_REACTIONS[post.type] || DEFAULT_REACTIONS.general;

    const mainLabel = current ? current.label : fallback.label;
    const mainIcon = current
      ? `<span class="reaction-emoji">${current.icon}</span>`
      : `<span class="reaction-emoji">${fallback.icon}</span>`;
    const defaultReactionType = current ? current.type : fallback.type;
    const picker = this.REACTIONS.map(r => `
      <button class="reaction-pick" title="${r.label}" onclick="FeedModule.toggleReaction(${post.id}, '${r.type}')">${r.icon}</button>
    `).join('');

    const officerBadge = post.author.isOfficer
      ? '<span class="officer-badge" title="Verified Officer">Officer</span>'
      : '';
    const pinnedLabel = post.isPinned
      ? '<div class="pinned-label"><i data-lucide="pin" class="w-3 h-3"></i> Pinned</div>'
      : '';

    return `
      <article class="post-card ${post.isPinned ? 'is-pinned' : ''}" data-post-id="${post.id}">
        ${pinnedLabel}
        <div class="post-header">
          <img src="${this.escapeHTML(post.author.avatar)}" alt="${safeAuthorName}" class="post-avatar" loading="lazy" decoding="async" width="48" height="48">
          <div class="post-author-info">
            <div class="post-author-name">${safeAuthorName}</div>
            <div class="post-author-title">${safeAuthorTitle}${officerBadge}</div>
          </div>
          <div class="post-timestamp">• ${timeAgo}</div>
          <button class="post-overflow-btn" onclick="FeedModule.toggleOverflowMenu(${post.id}, event)" aria-label="Post options">
            <i data-lucide="more-horizontal" class="w-4 h-4"></i>
          </button>
          <div class="post-overflow-menu" id="overflow-menu-${post.id}">
            <button class="overflow-menu-item" onclick="FeedModule.editPost(${post.id})">
              <i data-lucide="pencil" class="w-4 h-4"></i> Edit Post
            </button>
            <button class="overflow-menu-item overflow-menu-danger" onclick="FeedModule.deletePost(${post.id})">
              <i data-lucide="trash-2" class="w-4 h-4"></i> Delete Post
            </button>
            <button class="overflow-menu-item" onclick="FeedModule.reportPost(${post.id})">
              <i data-lucide="flag" class="w-4 h-4"></i> Report
            </button>
          </div>
        </div>
        
        <div class="post-content">${safeContent}</div>
        
        ${post.image ? `<img src="${this.escapeHTML(post.image)}" alt="Post image" class="post-image" loading="lazy" decoding="async">` : ''}
        
        <div class="post-actions">
          <div class="post-reactions">
            <div class="reaction-trigger">
              <button class="reaction-btn ${post.userReaction ? 'liked reacted-' + post.userReaction : ''}" onclick="FeedModule.toggleReaction(${post.id}, '${defaultReactionType}')">
                ${mainIcon}
                <span>${mainLabel}</span>
              </button>
              <div class="reaction-picker">${picker}</div>
            </div>
            <button class="reaction-btn ${post.userReaction ? 'commented' : ''}" onclick="FeedModule.toggleComments(${post.id})">
              <i data-lucide="message-circle" class="w-4 h-4"></i>
              <span>Comment</span>
            </button>
          </div>
        </div>
        
        ${totalReactions > 0 || post.comments.length > 0 ? `
          <div class="post-stats">
            ${totalReactions > 0 ? `<div class="reaction-bar">${reactionSummary}</div>` : ''}
            ${post.comments.length > 0 ? `<div>${post.comments.length} ${post.comments.length === 1 ? 'comment' : 'comments'}</div>` : ''}
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
              <img src="${this.escapeHTML(this.getCurrentUser().avatar)}" alt="You" class="comment-avatar">
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
    const safeName = this.escapeHTML(comment.author.name);
    return `
      <div class="comment">
        <img src="${this.escapeHTML(comment.author.avatar)}" alt="${safeName}" class="comment-avatar" loading="lazy" decoding="async" width="32" height="32">
        <div class="comment-content">
          <div class="comment-author">${safeName}</div>
          <div class="comment-text">${this.escapeHTML(comment.content)}</div>
          <div class="comment-time">${timeAgo}</div>
        </div>
      </div>
    `;
  },

  /**
   * Get reaction summary HTML — compact cluster of top 2-3 reactions + count
   */
  getReactionSummary(reactions, totalReactions) {
    const reacted = this.REACTIONS
      .filter(r => reactions[r.type] > 0)
      .sort((a, b) => reactions[b.type] - reactions[a.type]);

    const topIcons = reacted.slice(0, 3).map(r => `
      <span class="reaction-option reaction-${r.type}" title="${reactions[r.type]} ${r.type === 'love' ? 'loves' : r.type + 's'}">
        ${r.icon}
      </span>
    `).join('');

    return `${topIcons}<span class="reaction-count">${totalReactions}</span>`;
  },

  /**
   * Toggle reaction on post
   */
  async toggleReaction(postId, reactionType) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    if (post.reactions[reactionType] === undefined) post.reactions[reactionType] = 0;

    if (this.hasSupabase()) {
      const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      if (!session) { this.showToast('Please log in to react'); return; }

      if (post.userReaction === reactionType) {
        await db.from('post_reactions').delete().eq('post_id', postId).eq('member_id', session.id);
        post.reactions[reactionType] = Math.max(0, post.reactions[reactionType] - 1);
        post.userReaction = null;
      } else {
        if (post.userReaction) {
          await db.from('post_reactions').delete().eq('post_id', postId).eq('member_id', session.id);
          if (post.reactions[post.userReaction] !== undefined) {
            post.reactions[post.userReaction] = Math.max(0, post.reactions[post.userReaction] - 1);
          }
        }
        await db.from('post_reactions').insert({ post_id: postId, member_id: session.id, reaction_type: reactionType });
        post.reactions[reactionType]++;
        post.userReaction = reactionType;
      }
    } else {
      // Mock fallback
      if (post.userReaction === reactionType) {
        post.reactions[reactionType] = Math.max(0, post.reactions[reactionType] - 1);
        post.userReaction = null;
      } else {
        if (post.userReaction && post.reactions[post.userReaction] !== undefined) {
          post.reactions[post.userReaction] = Math.max(0, post.reactions[post.userReaction] - 1);
        }
        post.reactions[reactionType]++;
        post.userReaction = reactionType;
      }
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
  async addComment(postId, content) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    const user = this.getCurrentUser();

    if (this.hasSupabase()) {
      const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      if (!session) { this.showToast('Please log in to comment'); return; }
      const { data, error } = await db.from('comments').insert({
        post_id: postId, member_id: session.id, content
      }).select('id').single();
      if (error) { this.showToast('Failed to add comment'); return; }
    }

    const newComment = {
      id: Date.now(),
      author: { 
        name: user.name, 
        avatar: user.avatar 
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

    container.innerHTML = this.birthdays.slice(0, 3).map(birthday => this.createBirthdayHTML(birthday)).join('');
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Render full birthdays list page
   */
  renderBirthdaysFullList() {
    const container = document.getElementById('birthdays-full-list');
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
    const today = new Date();
    const target = new Date(birthday.date);
    const isToday = today.getMonth() === target.getMonth() && today.getDate() === target.getDate();
    const dateLabel = this.formatSidebarDate(birthday.date);
    const wished = birthday.wished ? ' wished' : '';
    const safeName = this.escapeHTML(birthday.name);
    const avatarHTML = this.createAvatarHTML(birthday.avatar, birthday.name, 'birthday-avatar');

    return `
      <div class="widget-item birthday-item ${isToday ? 'today' : ''}${wished}" data-name="${safeName}">
        <a href="#profile" class="birthday-row-link" aria-label="View ${safeName}'s profile">
          ${avatarHTML}
          <div class="widget-content">
            <div class="widget-label">${safeName}</div>
            <div class="widget-sublabel">Class of ${birthday.year} • ${dateLabel}</div>
          </div>
        </a>
        <button class="birthday-wish-btn" aria-label="Wish ${safeName} a happy birthday" title="Wish them well" onclick="FeedModule.wishHappyBirthday('${safeName}', event)">
          <span class="birthday-wish-emoji">🎉</span>
          <span class="birthday-wish-label">Wish</span>
        </button>
      </div>
    `;
  },

  /**
   * Handle "Wish them well" birthday action
   */
  wishHappyBirthday(name, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const person = this.birthdays.find(b => b.name === name);
    if (person) {
      person.wished = true;
      this.renderBirthdays();
    }
    this.showToast(`Sent birthday wishes to ${name}!`);
  },

  /**
   * Render announcements widget
   */
  renderAnnouncements() {
    const container = document.getElementById('announcements-list');
    if (!container) return;

    container.innerHTML = this.announcements.slice(0, 3).map(announcement => this.createAnnouncementHTML(announcement)).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Render full announcements list page
   */
  renderAnnouncementsFullList() {
    const container = document.getElementById('announcements-full-list');
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
    const unreadClass = announcement.unread ? ' unread' : '';
    const unreadDot = announcement.unread ? '<div class="announcement-unread-dot"></div>' : '';
    const dateLabel = this.formatSidebarDate(announcement.date);
    const safeTitle = this.escapeHTML(announcement.title);
    const safeContent = this.escapeHTML(announcement.content);
    const safeIcon = this.escapeHTML(announcement.icon);
    const safeAccent = this.escapeHTML(announcement.accent || 'gold');
    return `
      <div class="widget-item announcement-item${unreadClass}" data-accent="${safeAccent}">
        <div class="widget-icon">
          <i data-lucide="${safeIcon}" class="w-4 h-4"></i>
        </div>
        <div class="widget-content">
          <div class="announcement-title">${safeTitle}</div>
          <div class="announcement-desc">${safeContent}</div>
          <div class="announcement-date">${dateLabel}</div>
        </div>
        ${unreadDot}
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
          this.composerState.imageFile = file;
          this.composerState.image = URL.createObjectURL(file);
          this.updateImagePreview();
        }
      });
    }

    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', () => {
        if (this.composerState.image && this.composerState.image.startsWith('blob:')) {
          URL.revokeObjectURL(this.composerState.image);
        }
        this.composerState.image = null;
        this.composerState.imageFile = null;
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

    // Header search — client-side filter over loaded posts
    const searchInput = document.getElementById('feed-search-input');
    if (searchInput) {
      let searchTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          this.searchQuery = searchInput.value;
          this.visibleCount = this.PAGE_SIZE;
          this.renderPosts();
        }, 200);
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
  async createPost() {
    if (this.isPosting) return;

    const postInput = document.getElementById('post-input');
    const text = postInput?.value.trim();

    if (!text && !this.composerState.image) {
      this.showToast('Please write something or add an image');
      return;
    }

    // Photos require the R2 upload pipeline, which only exists on the
    // deployed site (Netlify Functions are not served by the local dev
    // server). Block early rather than persisting a session-only blob:
    // URL that would render as a broken image after reload.
    if (this.composerState.imageFile && typeof MediaUpload !== 'undefined' && !MediaUpload.isConfigured()) {
      this.showToast('Photo posts are only available on the deployed site — remove the photo to post text only');
      return;
    }

    const postBtn = document.getElementById('post-btn');
    this.isPosting = true;
    if (postBtn) { postBtn.disabled = true; postBtn.style.opacity = '0.6'; }

    try {
      const user = this.getCurrentUser();
      let postId = Date.now();
      let imageUrl = null;
      let imageKey = null;

      // Upload image to R2 when configured
      if (this.composerState.imageFile && typeof MediaUpload !== 'undefined' && MediaUpload.isConfigured()) {
        const validationError = MediaUpload.validate(this.composerState.imageFile);
        if (validationError) {
          this.showToast(validationError);
          return;
        }
        try {
          const { full } = await MediaUpload.upload(this.composerState.imageFile, 'post', {
            withThumbnail: false,
          });
          imageUrl = full.publicUrl;
          imageKey = full.fileKey;
        } catch (err) {
          this.showToast(err.message || 'Image upload failed');
          return;
        }
      }

      if (this.hasSupabase()) {
        const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
        if (!session) { this.showToast('Please log in to post'); return; }
        const { data, error } = await db.from('posts').insert({
          member_id: session.id,
          content: text,
          image_url: imageUrl || null,
          image_key: imageKey,
          post_type: 'general',
          status: 'published'
        }).select('id').single();
        if (error) { this.showToast('Failed to create post'); return; }
        postId = data.id;
      }

      const newPost = {
        id: postId,
        author: {
          name: user.name,
          avatar: user.avatar,
          title: user.title
        },
        content: text,
        image: imageUrl,
        timestamp: new Date(),
        type: 'general',
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
      if (this.composerState.image && this.composerState.image.startsWith('blob:')) {
        URL.revokeObjectURL(this.composerState.image);
      }
      this.composerState.image = null;
      this.composerState.imageFile = null;
      this.updateImagePreview();

      const imageUpload = document.getElementById('image-upload');
      if (imageUpload) imageUpload.value = '';

      this.showToast('Post published successfully!');
    } finally {
      this.isPosting = false;
      if (postBtn) { postBtn.disabled = false; postBtn.style.opacity = ''; }
    }
  },

  /**
   * Get time ago string
   */
  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd';
    
    return Math.floor(seconds / 604800) + 'w';
  },

  /**
   * Shared sidebar date formatter.
   * - Today / Tomorrow for dates within 48 hours.
   * - "Wed, Mar 18" for anything beyond.
   */
  formatSidebarDate(date) {
    const target = new Date(date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const diffMs = targetDay - now;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${weekdays[target.getDay()]}, ${months[target.getMonth()]} ${target.getDate()}`;
  },

  /**
   * Extract up to two initials from a full name.
   */
  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    const first = parts[0].charAt(0).toUpperCase();
    const last = parts[parts.length - 1].charAt(0).toUpperCase();
    return first + last;
  },

  /**
   * Return a deterministic color class for a name.
   */
  getAvatarColorClass(name) {
    const colors = ['avatar-gold', 'avatar-emerald', 'avatar-blue', 'avatar-purple', 'avatar-rose'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  },

  /**
   * Build avatar HTML with initials fallback for missing avatars.
   */
  createAvatarHTML(avatar, name, className = '') {
    const safeName = this.escapeHTML(name || 'User');
    if (avatar) {
      return `<img src="${this.escapeHTML(avatar)}" alt="${safeName}" class="${className}" loading="lazy" decoding="async">`;
    }
    const initials = this.getInitials(name);
    const colorClass = this.getAvatarColorClass(name);
    return `<span class="avatar-fallback ${colorClass} ${className}" aria-label="${safeName}">${initials}</span>`;
  },

  /**
   * Toggle overflow menu on a post
   */
  toggleOverflowMenu(postId, event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById(`overflow-menu-${postId}`);
    if (!menu) return;

    const isOpen = menu.classList.contains('show');

    // Close all menus
    document.querySelectorAll('.post-overflow-menu.show').forEach(m => m.classList.remove('show'));

    if (!isOpen) {
      menu.classList.add('show');
      this.activeOverflowMenu = postId;
    } else {
      this.activeOverflowMenu = null;
    }
  },

  /**
   * Edit post (mock)
   */
  editPost(postId) {
    this.showToast('Edit functionality coming soon');
    this.toggleOverflowMenu(postId);
  },

  /**
   * Delete post
   */
  async deletePost(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;
    if (!confirm('Delete this post?')) return;

    if (this.hasSupabase()) {
      const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
      if (!session) { this.showToast('Please log in'); return; }
      const { error } = await db.from('posts').delete().eq('id', postId).eq('member_id', session.id);
      if (error) { this.showToast('Failed to delete post'); return; }
    }

    this.posts = this.posts.filter(p => p.id !== postId);
    this.visibleCount = Math.min(this.visibleCount, this.posts.length);
    this.renderPosts();
    this.showToast('Post deleted');
  },

  /**
   * Report post — opens the reason picker modal
   */
  reportPost(postId) {
    this.toggleOverflowMenu(postId);

    const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
    const post = this.posts.find(p => p.id === postId);
    if (post && session && post.memberId === session.id) {
      this.showToast('You cannot report your own post');
      return;
    }

    this.reportTargetPostId = postId;
    const modal = document.getElementById('report-modal');
    if (modal) {
      modal.querySelectorAll('input[name="report-reason"]').forEach(r => { r.checked = false; });
      const desc = document.getElementById('report-description');
      if (desc) desc.value = '';
      modal.classList.remove('hidden');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  },

  /**
   * Close the report modal and reset its target
   */
  closeReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.classList.add('hidden');
    this.reportTargetPostId = null;
  },

  /**
   * Submit the report to moderation_reports
   */
  async submitReport() {
    const modal = document.getElementById('report-modal');
    const postId = this.reportTargetPostId;
    if (!modal || !postId) return;

    const checked = modal.querySelector('input[name="report-reason"]:checked');
    if (!checked) {
      this.showToast('Please choose a reason for this report');
      return;
    }

    const session = JSON.parse(localStorage.getItem('zbm-session') || 'null');
    if (!session) { this.showToast('Please log in to report'); return; }

    const descriptionInput = document.getElementById('report-description');
    const description = descriptionInput ? descriptionInput.value.trim() : '';

    const submitBtn = document.getElementById('report-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; }

    try {
      if (this.hasSupabase()) {
        const { error } = await db.from('moderation_reports').insert({
          reporter_id: session.id,
          content_type: 'post',
          content_id: postId,
          reason: checked.value,
          description: description || null
        });
        if (error) { this.showToast('Failed to submit report: ' + error.message); return; }
      }
      this.closeReportModal();
      this.showToast('Report submitted. Officers will review this post.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }
    }
  },

  /**
   * Render notifications dropdown
   */
  renderNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    const unread = this.notifications.filter(n => n.unread);
    const read = this.notifications.filter(n => !n.unread);

    const renderItem = n => `
      <div class="notification-item ${n.unread ? 'unread' : ''}" onclick="FeedModule.markNotificationRead('${this.escapeHTML(String(n.id))}')">
        <div class="notification-icon">
          <i data-lucide="${n.icon}" class="w-4 h-4"></i>
        </div>
        <div class="notification-content">
          <div class="notification-text">${this.escapeHTML(n.text)}</div>
          <div class="notification-time">${this.escapeHTML(n.time)}</div>
        </div>
        ${n.unread ? '<div class="notification-dot"></div>' : ''}
      </div>
    `;

    let html = '';

    if (unread.length > 0) {
      html += `<div class="notification-group-label">New</div>`;
      html += unread.map(renderItem).join('');
    }

    if (read.length > 0) {
      html += `<div class="notification-group-label">Earlier</div>`;
      html += read.map(renderItem).join('');
    }

    if (this.notifications.length === 0) {
      html = `
        <div class="notification-empty">
          <i data-lucide="check-circle" class="w-8 h-8"></i>
          <p>You're all caught up</p>
        </div>
      `;
    }

    container.innerHTML = html;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Mark notification as read (persisted per member)
   */
  markNotificationRead(id) {
    const n = this.notifications.find(x => x.id === id);
    if (n) n.unread = false;
    const reads = this.getReadNotificationIds();
    reads.add(id);
    this.saveReadNotificationIds(reads);
    this.renderNotifications();
    this.updateUnreadBadges();
  },

  /**
   * Mark all notifications as read (persisted per member)
   */
  markAllNotificationsRead() {
    this.notifications.forEach(n => n.unread = false);
    const reads = this.getReadNotificationIds();
    this.notifications.forEach(n => reads.add(n.id));
    this.saveReadNotificationIds(reads);
    this.renderNotifications();
    this.updateUnreadBadges();
  },

  /**
   * Toggle notification dropdown
   */
  toggleNotificationDropdown() {
    const panel = document.getElementById('notification-dropdown');
    if (!panel) return;
    panel.classList.toggle('show');
  },

  /**
   * Update unread count badges
   */
  updateUnreadBadges() {
    const unreadAnnouncements = this.announcements.filter(a => a.unread).length;
    const unreadNotifications = this.notifications.filter(n => n.unread).length;

    const annBadge = document.getElementById('announcements-unread');
    if (annBadge) {
      if (unreadAnnouncements > 0) {
        annBadge.textContent = unreadAnnouncements;
        annBadge.style.display = 'flex';
      } else {
        annBadge.style.display = 'none';
      }
    }

    const bellBadge = document.getElementById('bell-unread-count');
    if (bellBadge) {
      if (unreadNotifications > 0) {
        bellBadge.textContent = unreadNotifications;
        bellBadge.style.display = 'flex';
      } else {
        bellBadge.style.display = 'none';
      }
    }
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
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }
};

// Re-init on bfcache restore (browser back/forward)
window.addEventListener('zbm-bfcache-restore', () => {
  FeedModule.init();
});

// Expose globally
window.FeedModule = FeedModule;
