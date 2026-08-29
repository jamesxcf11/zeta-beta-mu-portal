// One-off full-page screenshot helper using system Chrome via playwright-core.
// Usage: node scripts/screenshot.mjs [url] [outfile] [theme] [auth]
//   theme: 'dark' (default) or 'light'
//   auth:  pass 'auth' to seed a mock admin session so protected portal
//          pages (home.html, admin.html, ...) render instead of redirecting
//          to login.html. Omit for landing/login/signup captures.
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://127.0.0.1:3000/index.html';
const out = process.argv[3] || 'landing-fullpage.png';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const theme = process.argv[4] || 'dark';
const seedAuth = process.argv[5] === 'auth';
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
await page.addInitScript((t) => {
  localStorage.setItem('zbm-theme-preference', t);
}, theme);
if (seedAuth) {
  await page.addInitScript(() => {
    localStorage.setItem('zbm-session', JSON.stringify({
      id: 1,
      username: 'admin',
      name: 'Dr. James Anderson',
      email: 'james@zetabetamu.com',
      role: 'admin',
      avatar: 'image/placeholders/avatars/a11.jpg',
      graduationYear: 1995,
      hospital: "St. Luke's Medical Center",
      field: 'Cardiology',
      loginTime: new Date().toISOString()
    }));
  });
}
await page.goto(url, { waitUntil: 'networkidle' });

// Scroll through the page to trigger reveal animations and lazy images
await page.evaluate(async () => {
  const step = 600;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
});
// Force-reveal any remaining hidden elements
await page.evaluate(() => {
  document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('revealed'));
});
await page.waitForTimeout(1200);

await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('Saved', out);
