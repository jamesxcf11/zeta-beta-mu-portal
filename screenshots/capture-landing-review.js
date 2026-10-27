const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://127.0.0.1:3000/index.html');
    await page.waitForLoadState('networkidle');

    if (theme === 'dark') {
      await page.evaluate(() => {
        localStorage.setItem('zbm-theme-preference', 'dark');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    // Scroll through the whole page slowly to trigger all scroll-reveal observers
    await page.evaluate(async () => {
      const step = 400;
      const height = document.body.scrollHeight;
      for (let y = 0; y < height; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `c:\\websites\\screenshots\\landing-review-${theme}.png`,
      fullPage: true,
    });

    // Also grab a focused hero shot and pillars/stats shot
    await page.screenshot({
      path: `c:\\websites\\screenshots\\landing-review-${theme}-hero.png`,
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    await page.close();
  }

  await browser.close();
  console.log('Done');
})();
