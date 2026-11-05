/**
 * Zeta Beta Mu Fraternity Portal
 * In Memoriam list - renders the shrine cards from the `memorials` table.
 */

const MemoriamModule = {
  FALLBACK_PHOTO: 'image/logo1.png',

  hasSupabase() {
    return typeof db !== 'undefined' && db &&
           typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT');
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

  formatDates(m) {
    if (m.birth_year && m.death_year) return `${m.birth_year} \u2014 ${m.death_year}`;
    if (m.death_year) return `d. ${m.death_year}`;
    if (m.birth_year) return `b. ${m.birth_year}`;
    return '';
  },

  async init() {
    const grid = document.getElementById('memoriam-grid');
    if (!grid) return;

    if (!this.hasSupabase()) {
      grid.innerHTML = this.emptyHTML('The memorial is unavailable right now.');
      return;
    }

    const { data, error } = await db
      .from('memorials')
      .select('id, full_name, nickname, batch, specialty, birth_year, death_year, tribute, photo_url')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('death_year', { ascending: false, nullsFirst: false })
      .order('full_name', { ascending: true });

    if (error) {
      grid.innerHTML = this.emptyHTML('We could not load the memorial. Please try again later.');
      return;
    }
    if (!data || data.length === 0) {
      grid.innerHTML = this.emptyHTML('No brothers have been added to the memorial yet.');
      return;
    }

    grid.innerHTML = data.map(m => this.cardHTML(m)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  cardHTML(m) {
    const e = this.escapeHTML.bind(this);
    const photo = m.photo_url || this.FALLBACK_PHOTO;
    const dates = this.formatDates(m);
    return `
      <a class="memoriam-card glass-card memoriam-card-link" href="memorial.html?id=${encodeURIComponent(m.id)}">
        <div class="memoriam-candle"><i data-lucide="flame" class="w-6 h-6"></i></div>
        <div class="memoriam-photo">
          <img src="${e(photo)}" alt="${e(m.full_name)}" class="memoriam-image" loading="lazy" decoding="async">
        </div>
        <div class="memoriam-info">
          <h3 class="memoriam-name">${e(m.full_name)}</h3>
          ${dates ? `<p class="memoriam-dates">${e(dates)}</p>` : ''}
          ${m.specialty ? `<p class="memoriam-specialty">${e(m.specialty)}</p>` : ''}
          ${m.batch ? `<p class="memoriam-years">Batch ${e(m.batch)}</p>` : ''}
          ${m.tribute ? `<p class="memoriam-tribute">${e(m.tribute)}</p>` : ''}
        </div>
      </a>`;
  },

  emptyHTML(message) {
    return `<div class="empty-state col-span-full"><h3 class="empty-title">${this.escapeHTML(message)}</h3></div>`;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MemoriamModule.init());
} else {
  MemoriamModule.init();
}

window.addEventListener('zbm-bfcache-restore', () => MemoriamModule.init());
window.MemoriamModule = MemoriamModule;
