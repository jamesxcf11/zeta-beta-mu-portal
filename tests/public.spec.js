const { test, expect } = require('@playwright/test');
const { mockSupabase, seedSession } = require('./fixtures/supabase-mock');

test.describe('Landing (index.html)', () => {
  test('mobile menu toggle stays onscreen and opens the drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');

    const toggle = page.locator('#landing-mobile-toggle');
    await expect(toggle).toBeVisible();
    const box = await toggle.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);

    // No horizontal page overflow
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);

    await toggle.click();
    await expect(page.locator('#landing-mobile-menu')).toHaveClass(/open|active|visible/);

    // Member Login remains reachable inside the drawer
    const drawerLogin = page.locator('#landing-mobile-menu a[href="login.html"]');
    await expect(drawerLogin).toBeVisible();
  });
});

test.describe('Auth pages mobile navbar', () => {
  for (const page_ of ['login.html', 'signup.html']) {
    test(`${page_}: navbar CTA stays fully inside the viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/' + page_);

      const cta = page.locator('.landing-navbar-actions .nav-login-btn');
      await expect(cta).toBeVisible();
      const box = await cta.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);
    });
  }
});

test.describe('Signup (signup.html)', () => {
  test('loads without duplicate-script console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/signup.html');
    await page.waitForLoadState('networkidle');
    expect(errors.filter(e => /already been declared/i.test(e))).toHaveLength(0);
  });

  test('Terms of Service and Privacy Policy open the legal modal', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/signup.html');

    // The agreement links live on wizard step 4 — walk the wizard there
    await page.fill('#first-name', 'Juan');
    await page.fill('#last-name', 'Santos');
    await page.fill('#nickname', 'JC');
    await page.fill('#birthday', '1990-01-01');
    await page.fill('#email', 'juan.santos@example.com');
    await page.fill('#username', 'juansantos');
    await page.fill('#password', 'Password123');
    await page.fill('#confirm-password', 'Password123');
    await page.click('.btn-continue[data-next="2"]', { force: true });
    await page.selectOption('#graduation-year', { index: 1 });
    await page.selectOption('#field-of-medicine', 'Cardiology');
    await page.fill('#batch', 'Ignis');
    await page.click('.btn-continue[data-next="3"]', { force: true });
    await page.fill('#mobile', '09171234567');
    await page.click('.btn-continue[data-next="4"]', { force: true });
    await expect(page.locator('.step-content[data-step="4"]')).not.toHaveClass(/hidden/);

    const terms = page.locator('a[data-legal="terms"]');
    const privacy = page.locator('a[data-legal="privacy"]');
    await expect(terms).toBeVisible();
    await expect(privacy).toBeVisible();

    await terms.click();
    const modal = page.locator('#legal-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#legal-terms')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    await privacy.click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#legal-privacy')).toBeVisible();
  });
});

test.describe('Welcome (welcome.html)', () => {
  test('social links point to real fraternity pages', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await page.goto('/welcome.html');

    const fb = page.locator('.social-link.facebook');
    const ig = page.locator('.social-link.instagram');
    await expect(fb).toHaveAttribute('href', /facebook\.com/);
    await expect(ig).toHaveAttribute('href', /instagram\.com/);
    await expect(fb).toHaveAttribute('target', '_blank');
    await expect(ig).toHaveAttribute('rel', /noopener/);
  });
});
