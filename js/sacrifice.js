/**
 * Zeta Beta Mu Fraternity Portal
 * Public Sacrifice page - read-only honor roll of departed brothers.
 *
 * Only memorials flagged is_public are returned to anonymous visitors (RLS in
 * sql/migrations/008-memorial-visibility.sql). Comments and the full shrine
 * pages stay members-only.
 */

const SacrificeRoll = {
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

  async init() {
    const root = document.getElementById('sacrifice-roll');
    const placeholder = document.getElementById('sacrifice-placeholder');
    if (!root || !this.hasSupabase()) return;

    const { data, error } = await db
      .from('memorials')
      .select('id, full_name, nickname, batch, specialty, birth_year, death_year, tribute, photo_url')
      .is('deleted_at', null)
      .eq('is_public', true)
      .order('sort_order', { ascending: true })
      .order('death_year', { ascending: false, nullsFirst: false })
      .order('full_name', { ascending: true });

    if (error || !data || !data.length) return;

    if (placeholder) placeholder.remove();
    root.innerHTML = `
      <p class="memoriam-intro-text text-center" style="margin-bottom:2rem">
        "In loving memory of our brothers who have passed. Their dedication to medicine, service, and brotherhood continues to inspire us."
      </p>
      <div class="memoriam-grid">${data.map(m => this.cardHTML(m)).join('')}</div>
      <p class="text-center landing-muted-text" style="margin-top:2rem">
        Brothers may <a href="memoriam.html" class="underline">log in to leave a message</a> for the brothers we remember.
      </p>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  cardHTML(m) {
    const e = this.escapeHTML.bind(this);
    const dates = m.birth_year && m.death_year ? `${m.birth_year} \u2014 ${m.death_year}` : (m.death_year ? `d. ${m.death_year}` : (m.birth_year ? `b. ${m.birth_year}` : ''));
    return `
      <article class="memoriam-card glass-card">
        <div class="memoriam-candle"><i data-lucide="flame" class="w-6 h-6"></i></div>
        <div class="memoriam-photo">
          <img src="${e(m.photo_url || 'image/logo1.png')}" alt="${e(m.full_name)}" class="memoriam-image" loading="lazy" decoding="async">
        </div>
        <div class="memoriam-info">
          <h3 class="memoriam-name">${e(m.full_name)}</h3>
          ${dates ? `<p class="memoriam-dates">${e(dates)}</p>` : ''}
          ${m.specialty ? `<p class="memoriam-specialty">${e(m.specialty)}</p>` : ''}
          ${m.batch ? `<p class="memoriam-years">Batch ${e(m.batch)}</p>` : ''}
          ${m.tribute ? `<p class="memoriam-tribute">${e(m.tribute)}</p>` : ''}
        </div>
      </article>`;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SacrificeRoll.init());
} else {
  SacrificeRoll.init();
}
window.SacrificeRoll = SacrificeRoll;
