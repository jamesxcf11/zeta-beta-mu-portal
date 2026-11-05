/**
 * Zeta Beta Mu Fraternity Portal
 * Memorial Module - shrine page for one departed brother with a comment wall.
 *
 * Loads the brother from `memorials` (?id=) and his comments from
 * `memorial_comments`. Authorization is enforced by RLS (sql/migrations/
 * 006-memorials.sql); the role check here only decides which buttons to show.
 */

const MemorialModule = {
  FALLBACK_PHOTO: 'image/logo1.png',
  MAX_COMMENT_LENGTH: 2000,

  currentBrother: null,
  comments: [],
  composerText: '',
  posting: false,

  hasSupabase() {
    return typeof db !== 'undefined' && db &&
           typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem('zbm-session') || 'null');
    } catch (e) {
      return null;
    }
  },

  isOfficer() {
    const s = this.getSession();
    return !!s && (s.role === 'admin' || s.role === 'officer');
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

  async init() {
    const hero = document.querySelector('.memorial-hero');
    const id = parseInt(new URLSearchParams(window.location.search).get('id'), 10);

    if (!this.hasSupabase() || !Number.isFinite(id)) {
      this.renderNotFound();
      return;
    }

    const { data, error } = await db
      .from('memorials')
      .select('id, full_name, nickname, batch, specialty, birth_year, death_year, tribute, photo_url')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !data) {
      this.renderNotFound(hero);
      return;
    }

    this.currentBrother = data;
    this.renderHero();
    await this.loadComments();
    this.renderWall();
    this.setupEventListeners();
  },

  renderNotFound() {
    const hero = document.querySelector('.memorial-hero');
    if (hero) {
      hero.innerHTML = `
        <h1 class="memorial-name">Memorial not found</h1>
        <p class="memorial-bio">This memorial does not exist or is no longer available.</p>
        <a href="memoriam.html" class="btn btn-glass btn-sm">Back to In Memoriam</a>`;
    }
    const wall = document.getElementById('tribute-wall');
    if (wall) wall.innerHTML = '';
  },

  formatDates(b) {
    if (b.birth_year && b.death_year) return `${b.birth_year} \u2014 ${b.death_year}`;
    if (b.death_year) return `d. ${b.death_year}`;
    if (b.birth_year) return `b. ${b.birth_year}`;
    return '';
  },

  renderHero() {
    const b = this.currentBrother;
    const hero = document.querySelector('.memorial-hero');
    if (!hero) return;
    const e = this.escapeHTML.bind(this);
    const meta = [b.specialty, b.batch ? `Batch ${b.batch}` : ''].filter(Boolean).join(' \u2022 ');
    const dates = this.formatDates(b);
    hero.innerHTML = `
      <div class="memorial-candle"><i data-lucide="flame" class="w-7 h-7"></i></div>
      <img src="${e(b.photo_url || this.FALLBACK_PHOTO)}" alt="${e(b.full_name)}" class="memorial-portrait" decoding="async">
      <h1 class="memorial-name">${e(b.full_name)}</h1>
      ${b.nickname ? `<p class="memorial-meta">&ldquo;${e(b.nickname)}&rdquo;</p>` : ''}
      ${dates ? `<p class="memorial-dates">${e(dates)}</p>` : ''}
      ${meta ? `<p class="memorial-meta">${e(meta)}</p>` : ''}
      ${b.tribute ? `<p class="memorial-bio">${e(b.tribute)}</p>` : ''}
    `;
    document.title = `${b.full_name} | In Memoriam | Zeta Beta Mu Fraternity`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  async loadComments() {
    this.comments = [];
    this.loadError = false;
    if (!this.getSession()) return;
    const { data, error } = await db
      .from('memorial_comments')
      .select('id, member_id, content, created_at, members:member_id (name, avatar_url)')
      .eq('memorial_id', this.currentBrother.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) {
      this.loadError = true;
      return;
    }
    this.comments = data || [];
  },

  timeAgo(iso) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  renderWall() {
    const container = document.getElementById('tribute-wall');
    if (!container) return;
    const session = this.getSession();

    const composer = session ? `
      <div class="memorial-composer glass-card">
        <textarea id="tribute-input" class="composer-input" maxlength="${this.MAX_COMMENT_LENGTH}" placeholder="Leave a message for our brother...">${this.escapeHTML(this.composerText)}</textarea>
        <div class="memorial-composer-actions">
          <span></span>
          <button id="post-tribute-btn" class="btn btn-gold" type="button" data-action="post-comment" ${this.posting ? 'disabled' : ''}>
            <i data-lucide="send" class="w-4 h-4"></i> Leave a Message
          </button>
        </div>
      </div>` : `
      <div class="memorial-composer glass-card" id="memorial-login-prompt">
        <p>Please <a href="login.html" class="underline">log in</a> to read and leave messages for our brother.</p>
      </div>`;

    let list = '';
    if (session) {
      if (this.loadError) list = '<p class="landing-muted-text">Messages could not be loaded. Please try again later.</p>';
      else if (!this.comments.length) list = '<p id="memorial-no-comments" class="landing-muted-text">No messages yet. Be the first to leave words for our brother.</p>';
      else list = this.comments.map(c => this.commentHTML(c, session)).join('');
    }

    container.innerHTML = composer + list;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  commentHTML(c, session) {
    const e = this.escapeHTML.bind(this);
    const author = c.members || {};
    const canDelete = (session && session.id === c.member_id) || this.isOfficer();
    return `
      <article class="memorial-tribute glass-card" data-comment-id="${e(c.id)}">
        <div class="memorial-tribute-head">
          <img src="${e(author.avatar_url || 'image/placeholders/avatars/a11.jpg')}" alt="" class="memorial-tribute-avatar" loading="lazy" decoding="async">
          <div>
            <div class="memorial-tribute-author">${e(author.name || 'Brother')}</div>
            <div class="memorial-tribute-time">${e(this.timeAgo(c.created_at))}</div>
          </div>
        </div>
        <p class="memorial-tribute-text">${e(c.content)}</p>
        ${canDelete ? `
        <div class="memorial-tribute-actions">
          <button class="reaction-btn" type="button" data-action="delete-comment" data-id="${e(c.id)}">
            <i data-lucide="trash-2" class="w-4 h-4"></i> <span>Delete</span>
          </button>
        </div>` : ''}
      </article>`;
  },

  async postComment() {
    if (this.posting) return;
    const session = this.getSession();
    if (!session) { this.showToast('Please log in to leave a message'); return; }

    const input = document.getElementById('tribute-input');
    const text = (input ? input.value : this.composerText).trim();
    if (!text) { this.showToast('Please write something before posting'); return; }

    this.posting = true;
    const { data, error } = await db
      .from('memorial_comments')
      .insert({ memorial_id: this.currentBrother.id, member_id: session.id, content: text })
      .select('id, member_id, content, created_at')
      .single();
    this.posting = false;

    if (error || !data) {
      this.showToast('Could not post your message. Please try again.');
      this.renderWall();
      return;
    }

    this.comments.push({
      ...data,
      members: { name: session.name || 'Brother', avatar_url: session.avatar }
    });
    this.composerText = '';
    this.renderWall();
    this.showToast('Message posted');
  },

  async deleteComment(id) {
    if (!window.confirm('Delete this message?')) return;
    const { error } = await db.from('memorial_comments').delete().eq('id', id);
    if (error) { this.showToast('Could not delete the message'); return; }
    this.comments = this.comments.filter(c => c.id !== id);
    this.renderWall();
    this.showToast('Message deleted');
  },

  setupEventListeners() {
    if (this.listenersBound) return;
    this.listenersBound = true;

    const wall = document.getElementById('tribute-wall');
    if (!wall) return;

    wall.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.dataset.action === 'post-comment') this.postComment();
      else if (button.dataset.action === 'delete-comment') this.deleteComment(Number(button.dataset.id));
    });

    wall.addEventListener('input', (e) => {
      if (e.target.id === 'tribute-input') this.composerText = e.target.value;
    });
  },

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
    this.toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MemorialModule.init());
} else {
  MemorialModule.init();
}

window.addEventListener('zbm-bfcache-restore', () => MemorialModule.init());

window.MemorialModule = MemorialModule;
