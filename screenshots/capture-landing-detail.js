const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    await page.goto('http://127.0.0.1:3000/index.html');
    await page.waitForLoadState('networkidle');

    if (theme === 'dark') {
      await page.evaluate(() => {
        localStorage.setItem('zbm-theme-preference', 'dark');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    const pillars = await page.$('#pillars');
    await pillars.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `c:\\websites\\screenshots\\landing-detail-${theme}-pillars.png`,
    });

    const vault = await page.$('#vault');
    await vault.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `c:\\websites\\screenshots\\landing-detail-${theme}-vault.png`,
    });

    await page.close();
  }

  await browser.close();
  console.log('Done');
})();
