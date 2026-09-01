import { test, expect, Page, Locator } from '@playwright/test';
import { getScreenshotPath } from './utils/screenshot-path';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type Theme = 'dark' | 'light';

const THEMES: Theme[] = ['dark', 'light'];

/**
 * Force a theme on the page by calling ThemeManager.setTheme() and waiting
 * for the body class to update.
 */
async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((t) => {
    if (window.ThemeManager) {
      window.ThemeManager.setTheme(t);
    } else {
      document.body.classList.remove('dark-theme', 'light-theme');
      document.body.classList.add(t === 'dark' ? 'dark-theme' : 'light-theme');
    }
  }, theme);
  await page.waitForFunction(
    (t) => document.body.classList.contains(t === 'dark' ? 'dark-theme' : 'light-theme'),
    theme,
    { timeout: 5000 },
  );
  // Brief pause for CSS transitions to settle
  await page.waitForTimeout(300);
}

/**
 * Set up Supabase network mocks so auth-gated pages render with mock data.
 * Mirrors the pattern in tests/fixtures/supabase-mock.js.
 */
async function mockSupabase(page: Page) {
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh',
        user: { id: '1', email: 'test@example.com' },
      }),
    }),
  );

  const member = {
    id: 1,
    username: 'testmember',
    email: 'test@example.com',
    name: 'Dr. Test Member',
    first_name: 'Test',
    last_name: 'Member',
    role: 'member',
    status: 'active',
    graduation_year: 2010,
    hospital: 'Test Hospital',
    field_of_medicine: 'Cardiology',
    avatar_url: 'image/placeholders/avatars/a11.jpg',
    deleted_at: null,
    created_at: new Date().toISOString(),
  };

  await page.route('**/rest/v1/members**', (route) => {
    const method = route.request().method();
    const isSingle = route.request().headers()['accept'] === 'application/vnd.pgrst.object+json';
    if (method === 'GET') {
      const body = isSingle ? JSON.stringify(member) : JSON.stringify([member]);
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  // Empty tables
  for (const table of ['posts', 'post_reactions', 'comments', 'announcements', 'events', 'birthdays', 'birthday_calendar']) {
    await page.route(`**/rest/v1/${table}**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
  }

  // Vault items with sample data
  const vaultItems = [
    {
      id: 101,
      album_id: 'test-2025',
      year: 2025,
      title: 'Charity Mission 2025',
      caption: 'Members at the mission',
      media_url: 'https://example.com/vault/test.webp',
      thumbnail_url: 'https://example.com/vault/thumbs/test.webp',
      file_key: 'vault/test.webp',
      thumb_key: 'vault/thumbs/test.webp',
      category: 'charity_mission',
      event_date: '2025-12-15',
      location: 'Test School',
      is_featured: false,
      is_public: true,
    },
  ];
  await page.route('**/rest/v1/vault_items**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vaultItems) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  // Catch-all for other REST endpoints
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  // Mock R2 upload/delete
  await page.route('**/api/upload-url**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ uploadUrl: 'https://mock.example.com/put', publicUrl: 'https://mock.example.com/test.webp', fileKey: 'mock/test.webp', expiresIn: 300 }),
    }),
  );
  await page.route('**/api/delete-object**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: 1 }) }),
  );
}

/**
 * Seed a logged-in session in localStorage before navigation.
 */
async function seedSession(page: Page, role: string = 'member') {
  const session = {
    id: 1,
    username: role === 'admin' ? 'admin' : 'testmember',
    name: role === 'admin' ? 'Dr. James Anderson' : 'Dr. Test Member',
    email: 'test@example.com',
    role,
    avatar: 'image/placeholders/avatars/a11.jpg',
    graduationYear: 2010,
    hospital: 'Test Hospital',
    field: 'Cardiology',
    loginTime: new Date().toISOString(),
  };
  await page.addInitScript((s) => {
    window.localStorage.setItem('zbm-session', JSON.stringify(s));
  }, session);
}

/**
 * Take a full-page screenshot for both themes.
 */
async function captureFullPage(
  page: Page,
  url: string,
  section: string,
  pageName: string,
  state: string,
  options?: { setup?: (page: Page) => Promise<void>; viewport?: { width: number; height: number } },
) {
  for (const theme of THEMES) {
    if (options?.viewport) {
      await page.setViewportSize(options.viewport);
    }
    if (options?.setup) {
      await options.setup(page);
    }
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setTheme(page, theme);
    await page.waitForTimeout(500);
    const screenshotPath = getScreenshotPath(section, pageName, state, theme);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
}

/**
 * Take an element-level screenshot for both themes.
 */
async function captureElement(
  page: Page,
  url: string,
  selector: string,
  section: string,
  pageName: string,
  state: string,
  options?: { setup?: (page: Page) => Promise<void>; action?: (page: Page) => Promise<void> },
) {
  for (const theme of THEMES) {
    if (options?.setup) {
      await options.setup(page);
    }
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setTheme(page, theme);
    await page.waitForTimeout(500);
    if (options?.action) {
      await options.action(page);
      await page.waitForTimeout(500);
    }
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    const screenshotPath = getScreenshotPath(section, pageName, state, theme);
    await locator.screenshot({ path: screenshotPath });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A. GLOBAL LAYOUTS & CORE PAGES
// ─────────────────────────────────────────────────────────────────────────────

test.describe('A. Layout — Full-page screenshots', () => {
  test('landing — default', async ({ page }) => {
    await captureFullPage(page, '/index.html', 'layout', 'landing', 'default');
  });

  test('landing — scrolled', async ({ page }) => {
    for (const theme of THEMES) {
      await page.goto('/index.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await setTheme(page, theme);
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(500);
      const path = getScreenshotPath('layout', 'landing', 'scrolled', theme);
      await page.screenshot({ path, fullPage: false });
    }
  });

  test('login — default', async ({ page }) => {
    await captureFullPage(page, '/login.html', 'layout', 'login', 'default');
  });

  test('signup — default', async ({ page }) => {
    await captureFullPage(page, '/signup.html', 'layout', 'signup', 'default');
  });

  test('home — default (auth)', async ({ page }) => {
    await captureFullPage(page, '/home.html', 'layout', 'home', 'default', {
      setup: async (p) => {
        await mockSupabase(p);
        await seedSession(p);
      },
    });
  });

  test('directory — default', async ({ page }) => {
    await captureFullPage(page, '/directory.html', 'layout', 'directory', 'default', {
      setup: async (p) => {
        await mockSupabase(p);
        await seedSession(p);
      },
    });
  });

  test('vault — default', async ({ page }) => {
    await captureFullPage(page, '/vault.html', 'layout', 'vault', 'default', {
      setup: async (p) => {
        await mockSupabase(p);
        await seedSession(p);
      },
    });
  });

  test('admin — default', async ({ page }) => {
    await captureFullPage(page, '/admin.html', 'layout', 'admin', 'default', {
      setup: async (p) => {
        await mockSupabase(p);
        await seedSession(p, 'admin');
      },
    });
  });

  test('announcements — default', async ({ page }) => {
    await captureFullPage(page, '/announcements.html', 'layout', 'announcements', 'default', {
      setup: async (p) => {
        await mockSupabase(p);
        await seedSession(p);
      },
    });
  });

  test('birthdays — default', async ({ page }) => {
    await captureFullPage(page, '/birthdays.html', 'layout', 'birthdays', 'default', {
      setup: async (p) => {
        await mockSupabase(p);
        await seedSession(p);
      },
    });
  });

  test('merchandise — default', async ({ page }) => {
    await captureFullPage(page, '/merchandise.html', 'layout', 'merchandise', 'default', {
      setup: async (p) => {
        await mockSupabase(p);
        await seedSession(p);
      },
    });
  });

  test('traditions — default', async ({ page }) => {
    await captureFullPage(page, '/traditions.html', 'layout', 'traditions', 'default', {
      setup: async (p) => {
        await mockSupabase(p);
        await seedSession(p);
      },
    });
  });

  test('memorial — default', async ({ page }) => {
    await captureFullPage(page, '/memorial.html', 'layout', 'memorial', 'default');
  });

  test('memoriam — default', async ({ page }) => {
    await captureFullPage(page, '/memoriam.html', 'layout', 'memoriam', 'default', {
      setup: async (p) => {
        await mockSupabase(p);
        await seedSession(p);
      },
    });
  });

  test('mobile — landing at Pixel 5 viewport', async ({ page }) => {
    await captureFullPage(page, '/index.html', 'layout', 'mobile', 'default', {
      viewport: { width: 412, height: 732 },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. INTERACTIVE STATES
// ─────────────────────────────────────────────────────────────────────────────

test.describe('B. Interactive — Element-level screenshots', () => {
  test('theme-toggle — default', async ({ page }) => {
    await captureElement(page, '/index.html', '.navbar-theme-toggle', 'interactive', 'theme-toggle', 'default');
  });

  test('theme-toggle — clicked (opposite theme)', async ({ page }) => {
    for (const theme of THEMES) {
      await page.goto('/index.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await setTheme(page, theme);
      await page.waitForTimeout(300);
      // Click to toggle to opposite theme
      await page.locator('.navbar-theme-toggle').first().click();
      await page.waitForTimeout(500);
      const opposite = theme === 'dark' ? 'light' : 'dark';
      const path = getScreenshotPath('interactive', 'theme-toggle', 'clicked', opposite);
      await page.locator('.navbar-theme-toggle').first().screenshot({ path });
    }
  });

  test('lightbox — open (landing gallery)', async ({ page }) => {
    for (const theme of THEMES) {
      await page.goto('/index.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // Wait for landing.js to render gallery
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      // Open the first gallery album via LandingModule
      await page.evaluate(() => {
        if (window.LandingModule && window.LandingModule.albums.length > 0) {
          window.LandingModule.openAlbum(0);
        }
      });
      await page.waitForTimeout(800);
      const lightbox = page.locator('#landing-lightbox').first();
      await lightbox.waitFor({ state: 'visible', timeout: 5000 });
      const path = getScreenshotPath('interactive', 'lightbox', 'open', theme);
      await page.screenshot({ path, fullPage: false });
    }
  });

  test('upload-modal — step1 (vault)', async ({ page }) => {
    for (const theme of THEMES) {
      await mockSupabase(page);
      await seedSession(page);
      await page.goto('/vault.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      // Open the upload modal
      await page.evaluate(() => {
        if (window.VaultModule) window.VaultModule.openUploadModal();
      });
      await page.waitForTimeout(500);
      const modal = page.locator('#vault-upload-modal').first();
      await modal.waitFor({ state: 'visible', timeout: 5000 });
      const path = getScreenshotPath('interactive', 'upload-modal', 'step1', theme);
      await page.screenshot({ path, fullPage: false });
    }
  });

  test('notification-dropdown — open (home)', async ({ page }) => {
    for (const theme of THEMES) {
      await mockSupabase(page);
      await seedSession(page);
      await page.goto('/home.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      // Open notification dropdown
      await page.evaluate(() => {
        if (window.FeedModule) window.FeedModule.toggleNotificationDropdown();
      });
      await page.waitForTimeout(500);
      const dropdown = page.locator('#notification-dropdown').first();
      const path = getScreenshotPath('interactive', 'notification-dropdown', 'open', theme);
      await dropdown.screenshot({ path });
    }
  });

  test('admin-modal — open (admin)', async ({ page }) => {
    for (const theme of THEMES) {
      await mockSupabase(page);
      await seedSession(page, 'admin');
      await page.goto('/admin.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      // Open add member modal
      await page.evaluate(() => {
        if (window.AdminModule) window.AdminModule.openAddMemberModal();
      });
      await page.waitForTimeout(500);
      const modal = page.locator('#admin-modal').first();
      await modal.waitFor({ state: 'visible', timeout: 5000 });
      const path = getScreenshotPath('interactive', 'admin-modal', 'open', theme);
      await modal.screenshot({ path });
    }
  });

  test('mobile-menu — open (home)', async ({ page }) => {
    for (const theme of THEMES) {
      await mockSupabase(page);
      await seedSession(page);
      await page.setViewportSize({ width: 412, height: 732 });
      await page.goto('/home.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      // Click hamburger menu
      await page.locator('#hamburger-menu').first().click();
      await page.waitForTimeout(500);
      const sidebar = page.locator('#sidebar').first();
      const path = getScreenshotPath('interactive', 'mobile-menu', 'open', theme);
      await sidebar.screenshot({ path });
    }
  });

  test('post-composer — focused (home)', async ({ page }) => {
    for (const theme of THEMES) {
      await mockSupabase(page);
      await seedSession(page);
      await page.goto('/home.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      // Focus the post input
      await page.locator('#post-input').first().click();
      await page.waitForTimeout(300);
      const composer = page.locator('.post-composer').first();
      const path = getScreenshotPath('interactive', 'post-composer', 'focused', theme);
      await composer.screenshot({ path });
    }
  });

  test('search — focused (directory)', async ({ page }) => {
    for (const theme of THEMES) {
      await mockSupabase(page);
      await seedSession(page);
      await page.goto('/directory.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      // Focus the search input
      await page.locator('#directory-search').first().click();
      await page.waitForTimeout(300);
      const searchContainer = page.locator('.max-w-2xl').first();
      const path = getScreenshotPath('interactive', 'search', 'focused', theme);
      await searchContainer.screenshot({ path });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. TRANSIENT & FLOATING ELEMENTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('C. Floating — Hover & transient screenshots', () => {
  test('year-dropdown — open (vault)', async ({ page }) => {
    for (const theme of THEMES) {
      await mockSupabase(page);
      await seedSession(page);
      await page.goto('/vault.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      // Toggle year dropdown
      await page.evaluate(() => {
        if (window.VaultModule) window.VaultModule.toggleYearDropdown(new Event('click'));
      });
      await page.waitForTimeout(500);
      const wrapper = page.locator('.yd-wrapper').first();
      const path = getScreenshotPath('floating', 'year-dropdown', 'open', theme);
      await wrapper.screenshot({ path });
    }
  });

  test('gallery-card — hover (landing)', async ({ page }) => {
    for (const theme of THEMES) {
      await page.goto('/index.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // Wait for gallery render
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      const card = page.locator('.landing-gallery-card').first();
      if (await card.isVisible()) {
        await card.hover();
        await page.waitForTimeout(300);
        const path = getScreenshotPath('floating', 'gallery-card', 'hover', theme);
        await card.screenshot({ path });
      }
    }
  });

  test('post-card — hover (home)', async ({ page }) => {
    for (const theme of THEMES) {
      await mockSupabase(page);
      await seedSession(page);
      await page.goto('/home.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      const card = page.locator('.post-card').first();
      if (await card.isVisible()) {
        await card.hover();
        await page.waitForTimeout(300);
        const path = getScreenshotPath('floating', 'post-card', 'hover', theme);
        await card.screenshot({ path });
      }
    }
  });

  test('login-input — focused (login)', async ({ page }) => {
    for (const theme of THEMES) {
      await page.goto('/login.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      // Focus the username input
      await page.locator('#username').first().click();
      await page.waitForTimeout(300);
      const inputWrapper = page.locator('#username').first();
      const path = getScreenshotPath('floating', 'login-input', 'focused', theme);
      // Screenshot the parent div containing the icon + input
      const parent = inputWrapper.locator('..');
      await parent.screenshot({ path });
    }
  });

  test('nav-button — hover (landing)', async ({ page }) => {
    for (const theme of THEMES) {
      await page.goto('/index.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      const navLink = page.locator('.landing-navbar-links a').first();
      await navLink.hover();
      await page.waitForTimeout(300);
      const path = getScreenshotPath('floating', 'nav-button', 'hover', theme);
      await navLink.screenshot({ path });
    }
  });

  test('cta-button — hover (landing hero)', async ({ page }) => {
    for (const theme of THEMES) {
      await page.goto('/index.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      const cta = page.locator('.hero-btn-primary').first();
      await cta.hover();
      await page.waitForTimeout(300);
      const path = getScreenshotPath('floating', 'cta-button', 'hover', theme);
      await cta.screenshot({ path });
    }
  });
});
