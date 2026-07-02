/**
 * One-time helper: downloads remote placeholder images (picsum/unsplash/pravatar)
 * to local folders so the shell works offline and loads faster.
 * Run: node scripts/download-placeholders.mjs
 */
import { mkdirSync, createWriteStream, existsSync } from 'node:fs';
import { get } from 'node:https';

const jobs = [];

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        return resolve(download(res.headers.location, dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`${res.statusCode} for ${url}`));
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
      file.on('error', reject);
    }).on('error', reject);
  });
}

for (const dir of [
  'image/placeholders/avatars',
  'image/placeholders/photos',
  'image/placeholders/picsum',
  'image/placeholders/covers'
]) mkdirSync(dir, { recursive: true });

// Avatars (pravatar ids used across the shell)
for (const i of [3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 33, 52, 60, 68]) {
  jobs.push([`https://i.pravatar.cc/240?img=${i}`, `image/placeholders/avatars/a${i}.jpg`]);
}

// Picsum images (feed posts, galleries, welcome video thumb)
const picsum = {
  1: '800/400', 2: '800/400', 100: '800/450',
  301: '600/400', 302: '600/400', 303: '600/400', 304: '600/400', 305: '600/400',
  306: '600/400', 307: '600/400', 308: '600/400', 309: '600/400', 310: '600/400',
  401: '600/400', 402: '600/400', 403: '600/400', 404: '600/400',
  501: '400/300', 502: '400/300', 503: '400/300', 504: '400/300', 505: '400/300', 506: '400/300'
};
for (const [k, size] of Object.entries(picsum)) {
  jobs.push([`https://picsum.photos/${size}?random=${k}`, `image/placeholders/picsum/p${k}.jpg`]);
}

// Traditions magazine covers (6 rotating local covers)
for (let i = 1; i <= 6; i++) {
  jobs.push([`https://picsum.photos/300/400?random=90${i}`, `image/placeholders/covers/c${i}.jpg`]);
}

// Unsplash vault album photos (unique photo ids, one 1200px copy each)
const unsplashIds = [
  '1464366400600-7168b8af9bc3', '1475721027785-f74eccf877e2', '1478145046317-39f10e56b5e9',
  '1492684223066-81342ee5ff30', '1505236858219-8359eb29e329', '1511578314322-379afb476865',
  '1511795409834-ef04bbd61622', '1515187029135-18ee286d815b', '1516549655169-df83a0774514',
  '1517486808906-6ca8b3f04846', '1519167758481-83f29da8c2b0', '1519225421980-715cb0215aed',
  '1522071820081-009f0129c71c', '1523050854058-8df90110c9f1', '1524178232363-1fb2b075b655',
  '1529070538774-1843cb3265df', '1530103862676-de8c9debad1d', '1532094349884-543bc11b234d',
  '1541339907198-e08756dedf3f', '1556761175-4b46a572b786', '1576091160399-112ba8d25d1d',
  '1576091160550-2173dba999ef', '1579684385127-1ef15d508118', '1581093458791-9d42e1e4b8f3',
  '1581594549595-35f6edc7b762', '1582560475093-ba66accbc424', '1582750433449-648ed127bb54',
  '1584982751601-97dcc096659c', '1631815588090-d4bfec5b1ccb'
];
for (const id of unsplashIds) {
  jobs.push([`https://images.unsplash.com/photo-${id}?w=1200&h=800&fit=crop&q=75`, `image/placeholders/photos/u-${id}.jpg`]);
}

let done = 0, failed = 0;
const queue = jobs.filter(([, dest]) => !existsSync(dest));
console.log(`Downloading ${queue.length} files (${jobs.length - queue.length} already present)...`);

const CONCURRENCY = 6;
async function worker() {
  while (queue.length) {
    const [url, dest] = queue.shift();
    try {
      await download(url, dest);
      done++;
    } catch (e) {
      failed++;
      console.error(`FAILED ${url}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`Done: ${done} downloaded, ${failed} failed.`);
