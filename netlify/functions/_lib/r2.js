/**
 * Cloudflare R2 client helpers.
 *
 * R2 is S3-API compatible, so we use the AWS SDK v3 pointed at the
 * account-specific endpoint. Credentials stay server-side only — they are
 * never referenced from anything under js/.
 */

const { S3Client, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const MIME_EXTENSIONS = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const ALLOWED_MIME = Object.keys(MIME_EXTENSIONS);

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Env values pasted into the Netlify UI often carry trailing whitespace or
// newlines. A stray character in R2_ACCOUNT_ID or R2_BUCKET produces an
// invalid endpoint/bucket that throws deep inside getSignedUrl, surfacing
// only as an opaque 502. Trim everything centrally.
function env(name) {
  return String(process.env[name] || '').trim();
}

function maxUploadBytes() {
  const parsed = parseInt(env('R2_MAX_UPLOAD_BYTES'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BYTES;
}

function client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    },
    // AWS SDK v3 >= 3.729 computes CRC32 checksums by default. R2 does not
    // support them: presigned URLs gain x-amz-checksum-* params that R2
    // rejects. WHEN_REQUIRED restores pre-3.729 behaviour for S3-compatible
    // storage.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

function publicUrl(key) {
  const base = env('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
  return `${base}/${key}`;
}

/**
 * Reject anything that could escape the intended prefix. Client-supplied
 * filenames are never used to build keys, but album ids are, so they must be
 * constrained.
 */
function safeSegment(value, fallback) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned.length > 0 && cleaned.length <= 100 ? cleaned : fallback;
}

/**
 * Only allow deletion of keys we actually own, so a compromised caller cannot
 * pass arbitrary paths.
 */
function isManagedKey(key) {
  if (typeof key !== 'string' || key.includes('..') || key.startsWith('/')) return false;
  return /^(vault|posts|profiles)\/[a-zA-Z0-9._/-]+\.(webp|jpg|png)$/.test(key);
}

async function deleteKeys(keys) {
  const valid = keys.filter(isManagedKey);
  if (valid.length === 0) return { deleted: 0 };

  await client().send(
    new DeleteObjectsCommand({
      Bucket: env('R2_BUCKET'),
      Delete: { Objects: valid.map((Key) => ({ Key })), Quiet: true },
    })
  );

  return { deleted: valid.length };
}

module.exports = {
  client,
  env,
  publicUrl,
  safeSegment,
  isManagedKey,
  deleteKeys,
  MIME_EXTENSIONS,
  ALLOWED_MIME,
  maxUploadBytes,
};
