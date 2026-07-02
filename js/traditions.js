/**
 * Zeta Beta Mu Fraternity Portal
 * Traditions Module - Magazine Library
 * 
 * Handles the digitized yearly magazine collection
 * with grid-based viewing.
 */

const TraditionsModule = {
  // Mock magazines data (years 1971-2026)
  magazines: [],

  /**
   * Initialize magazines data
   */
  initData() {
    const titles = [
      'The Emerald Scroll',
      'Brotherhood Chronicles',
      'Medical Heritage',
      'Fraternity Legacy',
      'The Golden Caduceus',
      'Brothers in Medicine',
      'Zeal & Excellence',
      'The Healer\'s Bond'
    ];

    // Generate magazines from 1971 to 2026
    for (let year = 1971; year <= 2026; year++) {
      const titleIndex = (year - 1971) % titles.length;
      this.magazines.push({
        id: year,
        year: year,
        title: `${titles[titleIndex]} ${year}`,
        coverImage: `image/placeholders/covers/c${(year % 6) + 1}.jpg`,
        description: `Annual traditions publication documenting the brotherhood activities, achievements, and memories from ${year}.`,
        pages: Math.floor(Math.random() * 50) + 30,
        featured: year >= 2020 || year === 1971 || year === 2000
      });
    }

    // Sort by year descending (newest first)
    this.magazines.reverse();
  },

  /**
   * Initialize traditions module
   */
  init() {
    this.initData();
    this.renderMagazines();
  },

  /**
   * Render magazine cards
   */
  renderMagazines() {
    const grid = document.getElementById('magazines-grid');
    if (!grid) return;

    grid.innerHTML = this.magazines.map(magazine => this.createMagazineCardHTML(magazine)).join('');
  },

  /**
   * Create HTML for magazine card
   * @param {Object} magazine - Magazine data
   * @returns {string} HTML string
   */
  createMagazineCardHTML(magazine) {
    const featuredBadge = magazine.featured ? 
      `<span class="absolute top-3 right-3 px-2 py-1 bg-[#d4af37] text-[#064e3b] text-xs font-semibold rounded">Featured</span>` : '';

    return `
      <article class="glass-card magazine-card relative group" data-magazine-id="${magazine.id}">
        ${featuredBadge}
        <div class="overflow-hidden rounded-t-lg">
          <img src="${magazine.coverImage}" alt="${magazine.title}" class="magazine-cover">
        </div>
        <div class="magazine-info">
          <div class="magazine-year">${magazine.year}</div>
          <div class="magazine-title">${magazine.title}</div>
          <div class="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <i data-lucide="file-text" class="w-3 h-3"></i>
            <span>${magazine.pages} pages</span>
          </div>
        </div>
      </article>
    `;
  },

  /**
   * Open magazine viewer (mock)
   * @param {number} magazineId - Magazine ID
   */
  openMagazine(magazineId) {
    const magazine = this.magazines.find(m => m.id === magazineId);
    if (!magazine) return;

    // For demo purposes, show alert
    // In production, this would open a PDF viewer or modal
    alert(`Opening ${magazine.title}\n\n${magazine.description}\n\nPages: ${magazine.pages}\n\nIn production, this would open the digitized magazine viewer.`);
  }
};

// Setup click handlers
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.magazine-card');
    if (card && typeof TraditionsModule !== 'undefined') {
      const magazineId = parseInt(card.dataset.magazineId);
      TraditionsModule.openMagazine(magazineId);
    }
  });
});

// Expose globally
window.TraditionsModule = TraditionsModule;
