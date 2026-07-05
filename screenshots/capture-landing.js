const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:3000/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: 'c:\\websites\\screenshots\\landing-page-full.png',
    fullPage: true,
  });

  await browser.close();
  console.log('Screenshot saved to c:\\websites\\screenshots\\landing-page-full.png');
})();
