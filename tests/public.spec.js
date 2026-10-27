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

test.describe('About Us & Pillar Pages', () => {
  test('about.html displays 19 Founders at top, 50-year Our History in middle, and Through the Years Vault gallery at bottom', async ({ page }) => {
    await page.goto('/about.html');
    await expect(page.locator('h1.landing-section-title')).toHaveText('About Us');

    // Part 1: 19 Founding Members
    const founderCards = page.locator('.founders-grid .founder-card');
    await expect(founderCards).toHaveCount(19);
    await expect(founderCards.first().locator('.founder-name')).toHaveText('Edgar Angeles Cainglet');
    await expect(founderCards.last().locator('.founder-name')).toHaveText('Romeo Tanglao Maniulit');

    // Part 2: 50-year Our History write-up
    await expect(page.locator('.about-history-content')).toContainText('On August 21, 1971, a group of nineteen second-year medical students');
    await expect(page.locator('.about-history-content')).toContainText('Patrix Doctor Eduardo Geronimo');
    await expect(page.locator('.about-history-content')).toContainText('Zeal for Brotherhood among Medics');
    await expect(page.locator('.about-history-content')).toContainText('On August 21, 2021, Zeta Beta Mu Fraternity marked its 50th anniversary.');

    // Part 3: Through the Years Vault gallery + year chips
    await expect(page.locator('#about-vault-years .about-vault-year-chip').first()).toContainText('All Years');
    const vaultCards = page.locator('#about-vault-gallery .landing-gallery-card');
    expect(await vaultCards.count()).toBeGreaterThan(0);
  });

  test('pillars-sacrifice.html displays clean Sacrifice header and In Memoriam placeholder', async ({ page }) => {
    await page.goto('/pillars-sacrifice.html');
    await expect(page.locator('h1.landing-section-title')).toHaveText('Sacrifice');
    await expect(page.locator('.vault-empty-title')).toContainText('In Memoriam');
  });

  test('pillar and About Us title headers match primary Zeta Beta Mu Fraternity header font family and weight (600)', async ({ page }) => {
    await page.goto('/index.html');
    const heroFont = await page.locator('.landing-hero-title').evaluate(el => {
      const s = getComputedStyle(el);
      return { fontFamily: s.fontFamily, fontWeight: s.fontWeight };
    });
    const aboutFont = await page.locator('.about-title').evaluate(el => {
      const s = getComputedStyle(el);
      return { fontFamily: s.fontFamily, fontWeight: s.fontWeight };
    });
    expect(aboutFont.fontFamily).toBe(heroFont.fontFamily);
    expect(aboutFont.fontWeight).toBe('600');

    for (const path of ['/about.html', '/pillars-scholarship.html', '/pillars-service.html', '/pillars-sociability.html', '/pillars-sacrifice.html', '/pillars-idealism.html']) {
      await page.goto(path);
      const titleFont = await page.locator('h1.landing-section-title').evaluate(el => {
        const s = getComputedStyle(el);
        return { fontFamily: s.fontFamily, fontWeight: s.fontWeight };
      });
      expect(titleFont.fontFamily).toBe(heroFont.fontFamily);
      expect(titleFont.fontWeight).toBe('600');
    }
  });

  test('pillars-idealism.html renders 3 alumni profiles in chronological order (2005 -> 2022 -> 2023)', async ({ page }) => {
    await page.goto('/pillars-idealism.html');
    await expect(page.locator('h1.landing-section-title')).toHaveText('Idealism');

    const cards = page.locator('.idealism-alumni-card');
    await expect(cards).toHaveCount(3);

    // 1. Eldest: Class of 2005 (top)
    await expect(cards.nth(0).locator('.idealism-alumni-name')).toHaveText('Patrix Doctor John Hubert C. Pua');
    await expect(cards.nth(0).locator('.idealism-alumni-credentials')).toContainText('Class of 2005');
    await expect(cards.nth(0).locator('.idealism-alumni-credentials')).toContainText('Magna Cum Laude');
    await expect(cards.nth(0).locator('.idealism-alumni-quote')).toContainText('Message to follow');

    // 2. Middle: Class of 2022
    await expect(cards.nth(1).locator('.idealism-alumni-name')).toHaveText('Patrix Doctor Roberto Armando M. Cruz Jr.');
    await expect(cards.nth(1).locator('.idealism-alumni-credentials')).toContainText('Class of 2022');
    await expect(cards.nth(1).locator('.idealism-alumni-credentials')).toContainText('Cum Laude');
    await expect(cards.nth(1).locator('.idealism-alumni-quote')).toContainText('idealism stopped being a dream I held and became a standard I live by');

    // 3. Youngest: Class of 2023 (bottom)
    await expect(cards.nth(2).locator('.idealism-alumni-name')).toHaveText('Patrix Doctor Renz Dwine L. Mendoza');
    await expect(cards.nth(2).locator('.idealism-alumni-credentials')).toContainText('Class of 2023');
    await expect(cards.nth(2).locator('.idealism-alumni-credentials')).toContainText('Cum Laude');
    await expect(cards.nth(2).locator('.idealism-alumni-quote')).toContainText('Hail To Thee!');
  });

  test('pillar pages embed Vault Viewer with max 6 photos per page', async ({ page }) => {
    for (const pillarPage of ['/pillars-scholarship.html', '/pillars-service.html', '/pillars-sociability.html']) {
      await page.goto(pillarPage);
      const viewer = page.locator('[data-vault-viewer]');
      await expect(viewer).toBeVisible();
      await expect(viewer).toHaveAttribute('data-vault-limit', '6');
      const cards = viewer.locator('.pillar-vault-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(6);
    }
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
    await page.locator('.btn-continue[data-next="2"]').dispatchEvent('click');
    await page.selectOption('#graduation-year', { index: 1 });
    await page.selectOption('#field-of-medicine', 'Cardiology');
    await page.fill('#batch', 'Ignis');
    await page.locator('.btn-continue[data-next="3"]').dispatchEvent('click');
    await page.fill('#mobile', '09171234567');
    await page.fill('#address', 'Sampaloc, Manila');
    await page.locator('.btn-continue[data-next="4"]').dispatchEvent('click');
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
