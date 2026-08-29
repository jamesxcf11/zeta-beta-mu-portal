const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { mockSupabase, seedSession } = require('./fixtures/supabase-mock');

const pages = [
  { name: 'Landing', path: '/index.html', authed: false },
  { name: 'Login', path: '/login.html', authed: false },
  { name: 'Signup', path: '/signup.html', authed: false },
  { name: 'Home/Feed', path: '/home.html', authed: true },
  { name: 'Directory', path: '/directory.html', authed: true },
  { name: 'Vault', path: '/vault.html', authed: true },
];

for (const { name, path, authed } of pages) {
  test(`accessibility scan: ${name}`, async ({ page }) => {
    await mockSupabase(page);
    if (authed) await seedSession(page);
    await page.goto(path);
    await page.waitForTimeout(500); // allow dynamic content to render

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const allViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (allViolations.length) {
      console.log(`\n[a11y] ${name} violations:`,
        allViolations.map((v) =>
          `  ${v.impact} - ${v.id}: ${v.description} (${v.nodes.length} nodes)`
        ).join('\n'));
    }

    // Only fail on critical impact — serious violations (e.g. color-contrast)
    // are logged and documented in TEST_REPORT.md but don't block CI.
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical, `Critical accessibility violations found on ${name}`).toEqual([]);
  });
}

test.describe('Responsive layout smoke checks', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    test(`login form remains usable at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login.html');
      const submitBtn = page.locator('#login-form button[type="submit"]');
      await expect(submitBtn).toBeVisible();
      const box = await submitBtn.boundingBox();
      expect(box.width).toBeGreaterThan(20);
      expect(box.height).toBeGreaterThanOrEqual(30); // tappable target size
    });
  }
});
