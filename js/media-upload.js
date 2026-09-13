/**
 * Zeta Beta Mu Fraternity Portal
 * Media Upload Module — Cloudflare R2
 *
 * Handles the browser side of the direct-to-R2 upload pipeline:
 *   1. Validate the file (type + size) before anything else.
 *   2. Compress to WebP and generate a real 400px thumbnail via <canvas>.
 *      R2 does not resize images (that is Cloudflare Images, a separate
 *      product), so derivatives must be produced here.
 *   3. Ask /api/upload-url for a short-lived presigned PUT URL.
 *   4. PUT the bytes straight to R2 — they never touch our server.
 *
 * The caller then persists { publicUrl, fileKey } to Supabase.
 *
 * Follows the same global-object pattern as the other modules in js/ (no
 * bundler is used; pages load plain <script src> tags).
 */

const MediaUpload = {
  ENDPOINT: '/api/upload-url',
  DELETE_ENDPOINT: '/api/delete-object',

  MAX_BYTES: 10 * 1024 * 1024, // keep in sync with R2_MAX_UPLOAD_BYTES
  MAX_DIMENSION: 2048,
  THUMB_DIMENSION: 400,
  AVATAR_DIMENSION: 512,
  WEBP_QUALITY: 0.82,
  THUMB_QUALITY: 0.75,
  AVATAR_QUALITY: 0.8,

  ACCEPTED_INPUT: ['image/jpeg', 'image/png', 'image/webp'],

  /**
   * True when the deployment can actually reach the upload API. Netlify
   * Functions are not available under `http-server` during local dev or
   * Playwright runs, so callers fall back to their existing mock behaviour —
   * mirroring the hasSupabase() pattern used elsewhere.
   */
  isConfigured() {
    const host = location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
    return !isLocal || window.__ZBM_FORCE_UPLOADS === true;
  },

  /**
   * Validate a File before any expensive work.
   * @returns {string|null} error message, or null when acceptable
   */
  validate(file) {
    if (!file) return 'No file selected';
    if (!this.ACCEPTED_INPUT.includes(file.type)) {
      if (file.type && file.type.startsWith('video/')) {
        return `Videos are not supported yet — "${file.name}" was not uploaded`;
      }
      return `"${file.name}" is not a supported image (JPG, PNG or WebP)`;
    }
    if (file.size > this.MAX_BYTES) {
      const mb = Math.round(this.MAX_BYTES / 1024 / 1024);
      return `"${file.name}" is larger than ${mb}MB`;
    }
    if (file.size === 0) {
      return `"${file.name}" is empty`;
    }
    return null;
  },

  /**
   * Decode a File into an ImageBitmap (or HTMLImageElement fallback).
   */
  async _decode(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file);
      } catch (e) {
        // Fall through to the <img> path below.
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not decode image'));
        el.src = url;
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  /**
   * Draw a decoded image onto a canvas scaled to fit maxDim, then encode.
   * @returns {Promise<Blob>}
   */
  async _encode(source, maxDim, quality) {
    const width = source.width;
    const height = source.height;
    const scale = Math.min(1, maxDim / Math.max(width, height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );

    if (!blob) throw new Error('Image encoding failed');
    return blob;
  },

  /**
   * Produce the full-size WebP derivative.
   */
  async compressToWebP(file, maxDim) {
    const source = await this._decode(file);
    return this._encode(source, maxDim || this.MAX_DIMENSION, this.WEBP_QUALITY);
  },

  /**
   * Produce the thumbnail WebP derivative. Previously the vault stored the
   * full-size URL as the thumbnail, so grids downloaded full images.
   */
  async makeThumbnail(file, maxDim) {
    const source = await this._decode(file);
    return this._encode(source, maxDim || this.THUMB_DIMENSION, this.THUMB_QUALITY);
  },

  async makeAvatar(file) {
    const source = await this._decode(file);
    const side = Math.min(source.width, source.height);
    const size = Math.min(this.AVATAR_DIMENSION, side);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      source,
      (source.width - side) / 2,
      (source.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', this.AVATAR_QUALITY));
    if (!blob) throw new Error('Profile image encoding failed');
    return blob;
  },

  /**
   * Current Supabase access token. This is the real credential the API
   * verifies — the localStorage zbm-session blob is not trusted server-side.
   */
  async _accessToken() {
    if (typeof db === 'undefined' || !db || !db.auth) return null;
    try {
      const { data } = await db.auth.getSession();
      return data && data.session ? data.session.access_token : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Request a presigned PUT URL.
   */
  async _presign({ scope, contentType, size, albumId, variant }) {
    const token = await this._accessToken();
    if (!token) {
      throw new Error('You must be signed in to upload. Please log in again.');
    }

    const response = await fetch(this.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ scope, contentType, size, albumId, variant }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const base = payload.error || `Upload authorization failed (${response.status})`;
      throw new Error(payload.detail ? `${base}: ${payload.detail}` : base);
    }
    return payload;
  },

  /**
   * PUT a blob to the presigned URL.
   */
  async _put(uploadUrl, blob, contentType) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: blob,
    });

    if (!response.ok) {
      throw new Error(`Upload to storage failed (${response.status})`);
    }
  },

  /**
   * Upload a single already-encoded blob.
   * @returns {Promise<{publicUrl: string, fileKey: string}>}
   */
  async uploadBlob(blob, { scope, albumId, variant }) {
    const presigned = await this._presign({
      scope,
      contentType: 'image/webp',
      size: blob.size,
      albumId,
      variant,
    });

    await this._put(presigned.uploadUrl, blob, 'image/webp');

    return { publicUrl: presigned.publicUrl, fileKey: presigned.fileKey };
  },

  /**
   * Full pipeline for one image: validate, derive, upload both variants.
   *
   * @param {File} file
   * @param {'vault'|'post'} scope
   * @param {object} [options] - { albumId, withThumbnail, onProgress }
   * @returns {Promise<{full: object, thumb: object|null}>}
   */
  async upload(file, scope, options = {}) {
    const { albumId, withThumbnail = scope === 'vault', onProgress } = options;

    const invalid = this.validate(file);
    if (invalid) throw new Error(invalid);

    const report = (stage) => {
      if (typeof onProgress === 'function') onProgress(stage, file);
    };

    report('compressing');
    const fullBlob = scope === 'profile'
      ? await this.makeAvatar(file)
      : await this.compressToWebP(file);

    let thumbBlob = null;
    if (withThumbnail) {
      thumbBlob = await this.makeThumbnail(file);
    }

    report('uploading');
    const full = await this.uploadBlob(fullBlob, { scope, albumId, variant: 'full' });

    let thumb = null;
    if (thumbBlob) {
      thumb = await this.uploadBlob(thumbBlob, { scope, albumId, variant: 'thumb' });
    }

    report('done');
    return { full, thumb };
  },

  /**
   * Officer-only deletion of previously uploaded objects.
   */
  async deleteKeys(keys) {
    const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
    if (list.length === 0) return { deleted: 0 };

    const token = await this._accessToken();
    if (!token) throw new Error('You must be signed in to delete media');

    const response = await fetch(this.DELETE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keys: list }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Could not delete media');
    }
    return payload;
  },
};

window.MediaUpload = MediaUpload;
