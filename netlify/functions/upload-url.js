/**
 * POST /api/upload-url
 *
 * Mints a short-lived presigned PUT URL so the browser can upload media
 * directly to Cloudflare R2 without the bytes passing through this function.
 *
 * Request body:
 *   {
 *     scope:       'vault' | 'post',
 *     contentType: 'image/webp' | 'image/jpeg' | 'image/png',
 *     size:        <bytes>,
 *     albumId?:    string   // required when scope === 'vault'
 *     variant?:    'full' | 'thumb'  // vault only, defaults to 'full'
 *   }
 *
 * Response:
 *   { uploadUrl, publicUrl, fileKey, expiresIn }
 *
 * Security notes:
 *   - The caller's Supabase JWT is verified server-side; the localStorage
 *     session blob is ignored entirely.
 *   - `scope: 'vault'` additionally requires an admin/officer role.
 *   - The object key is generated here. A client-supplied filename is never
 *     used, which avoids both path traversal and key collisions.
 */

const { randomUUID } = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const { json, requiredEnv, authenticate, isOfficer } = require('./_lib/auth');
const r2 = require('./_lib/r2');

const URL_TTL_SECONDS = 300; // 5 minutes
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const missingEnv = requiredEnv(REQUIRED_ENV);
  if (missingEnv.length > 0) {
    console.error('upload-url: missing env vars', missingEnv);
    return json(500, { error: 'Storage is not configured' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body must be valid JSON' });
  }

  const { scope, contentType, size, albumId, variant } = body;

  if (scope !== 'vault' && scope !== 'post') {
    return json(400, { error: 'scope must be "vault" or "post"' });
  }

  if (!r2.ALLOWED_MIME.includes(contentType)) {
    return json(415, {
      error: 'Unsupported content type',
      allowed: r2.ALLOWED_MIME,
    });
  }

  const maxBytes = r2.maxUploadBytes();
  const declaredSize = Number(size);
  if (!Number.isFinite(declaredSize) || declaredSize <= 0) {
    return json(400, { error: 'size (bytes) is required' });
  }
  if (declaredSize > maxBytes) {
    return json(413, {
      error: `File exceeds the ${Math.floor(maxBytes / 1024 / 1024)}MB limit`,
      maxBytes,
    });
  }

  const auth = await authenticate(event);
  if (auth.error) return auth.error;
  const { member } = auth;

  if (scope === 'vault' && !isOfficer(member)) {
    return json(403, { error: 'Only officers may upload to the vault' });
  }

  // ---- Build the key server-side ----
  const extension = r2.MIME_EXTENSIONS[contentType];
  const uuid = randomUUID();
  let fileKey;

  if (scope === 'vault') {
    const album = r2.safeSegment(albumId, '');
    if (!album) {
      return json(400, { error: 'albumId is required for vault uploads' });
    }
    fileKey =
      variant === 'thumb'
        ? `vault/${album}/thumbs/${uuid}.${extension}`
        : `vault/${album}/${uuid}.${extension}`;
  } else {
    fileKey = `posts/${member.id}/${uuid}.${extension}`;
  }

  try {
    const uploadUrl = await getSignedUrl(
      r2.client(),
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: fileKey,
        ContentType: contentType,
        ContentLength: declaredSize,
        CacheControl: CACHE_CONTROL,
      }),
      { expiresIn: URL_TTL_SECONDS }
    );

    return json(200, {
      uploadUrl,
      publicUrl: r2.publicUrl(fileKey),
      fileKey,
      expiresIn: URL_TTL_SECONDS,
    });
  } catch (err) {
    console.error('upload-url: presign failed', err);
    return json(502, { error: 'Could not create upload URL' });
  }
};
