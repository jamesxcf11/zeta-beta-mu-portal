/**
 * Shared display helpers for the In Memoriam pages (list, shrine and the
 * public Sacrifice honor roll). Names are stored plain; the fraternity title
 * is added at display time so it can be changed in one place.
 */
const MemorialCommon = {
  TITLE: 'Patrix Dr.',
  FALLBACK_PHOTO: 'image/logo1.png',

  displayName(name) {
    return `${this.TITLE} ${name || ''}`.trim();
  },

  photoClass(photoUrl) {
    return photoUrl ? '' : ' is-placeholder-photo';
  }
};

window.MemorialCommon = MemorialCommon;
