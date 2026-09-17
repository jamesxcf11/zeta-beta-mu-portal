const { test, expect } = require('@playwright/test');
const { mockSupabase, seedSession, seedAdminSession } = require('./fixtures/supabase-mock');

test.describe('Admin (admin.html) - admin session', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await seedAdminSession(page);
    await page.goto('/admin.html');
    // Wait for AdminModule.init() to complete — renderStats() runs after
    // async data loading and populates #admin-stats.
    await expect(page.locator('#admin-stats')).not.toBeEmpty({ timeout: 10000 });
    // Dismiss mobile overlay if present (intercepts pointer events on mobile viewport).
    await page.evaluate(() => {
      const overlay = document.getElementById('mobile-overlay');
      if (overlay) {
        overlay.classList.remove('overlay-active');
        overlay.style.pointerEvents = 'none';
      }
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('sidebar-open');
      document.body.style.overflow = '';
    });
  });

  test('renders stats cards on load', async ({ page }) => {
    await expect(page.locator('#admin-stats')).toBeVisible();
    await expect(page.locator('#admin-stats')).not.toBeEmpty();
  });

  test('pending members panel renders', async ({ page }) => {
    await expect(page.locator('#pending-members')).toBeAttached();
  });

  test('member search input filters without crashing', async ({ page }) => {
    // Use switchTab directly — navigating to /admin.html#members from /admin.html
    // may only trigger a hash change without full reload.
    await page.waitForFunction(() => typeof AdminModule !== 'undefined' && AdminModule.switchTab, { timeout: 10000 });
    await page.evaluate(() => AdminModule.switchTab('members'));
    await expect(page.locator('#panel-members')).toBeVisible({ timeout: 10000 });
    const searchInput = page.locator('#member-search');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Smith');
    await page.waitForTimeout(300);
    await expect(page.locator('#members-table-body')).toBeAttached();
  });

  test('pagination Previous/Next buttons are hidden when no data', async ({ page }) => {
    await page.evaluate(() => AdminModule.switchTab('members'));
    await expect(page.locator('#panel-members')).toBeVisible({ timeout: 10000 });
    const prevBtn = page.locator('#member-prev');
    const nextBtn = page.locator('#member-next');
    // Buttons are hidden entirely when there are no members to paginate (mock returns empty).
    await expect(prevBtn).toBeHidden();
    await expect(nextBtn).toBeHidden();
  });

  test('magazine upload form rejects empty required fields', async ({ page }) => {
    await page.evaluate(() => AdminModule.switchTab('content'));
    await expect(page.locator('#panel-content')).toBeVisible({ timeout: 10000 });
    const form = page.locator('#upload-form');
    await expect(form).toBeVisible();
    await form.locator('button[type="submit"]').click();
    // Form should still be attached (no crash/navigation).
    await expect(form).toBeAttached();
  });

  test('vault-upload-form field accepts a URL and rejects malformed URL via type=url validation', async ({ page }) => {
    await page.evaluate(() => AdminModule.switchTab('content'));
    await expect(page.locator('#panel-content')).toBeVisible({ timeout: 10000 });
    const urlInput = page.locator('#magazine-cover-url');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('not-a-valid-url');
    const valid = await urlInput.evaluate((el) => el.checkValidity());
    expect(valid).toBe(false);
  });

  // Header actions (incl. the bell) live in .top-header, which is
  // desktop-only across the portal — same as home.html's bell.
  test('notification bell opens a real dropdown of pending work', async ({ page, isMobile }) => {
    test.skip(isMobile, 'top-header is hidden on mobile by design');
    await page.evaluate(() => {
      AdminModule.pendingMembers = [{ id: 1, name: 'Dr. Pending Applicant' }];
      AdminModule.reports = { posts: [{ id: 9 }], comments: [] };
      AdminModule.renderNotifications();
    });
    await page.click('#admin-notif-btn');
    const dropdown = page.locator('#admin-notif-dropdown');
    await expect(dropdown).toHaveClass(/show/);
    await expect(page.locator('#admin-notif-dot')).toBeVisible();

    const item = dropdown.locator('[data-notif-tab="members"]');
    await expect(item).toContainText('1 membership application awaiting review');
    await expect(dropdown.locator('[data-notif-tab="moderation"]')).toContainText('1 open moderation report');
    await item.click();

    await expect(dropdown).not.toHaveClass(/show/);
    await expect(page.locator('#panel-members')).toBeVisible({ timeout: 10000 });
  });

  test('notification dropdown shows caught-up state when nothing is pending', async ({ page, isMobile }) => {
    test.skip(isMobile, 'top-header is hidden on mobile by design');
    await page.evaluate(() => {
      AdminModule.pendingMembers = [];
      AdminModule.reports = { posts: [], comments: [] };
      AdminModule.renderNotifications();
    });
    await page.click('#admin-notif-btn');
    await expect(page.locator('#admin-notif-list')).toContainText('all caught up');
    await expect(page.locator('#admin-notif-dot')).toBeHidden();
  });

  test('drop-zone click opens a file picker that fills the URL field', async ({ page }) => {
    await page.evaluate(() => AdminModule.switchTab('content'));
    await expect(page.locator('#panel-content')).toBeVisible({ timeout: 10000 });

    // Clicking the zone must not toast "coming soon" — it creates a real picker
    await page.click('#vault-drop-zone');
    const picker = page.locator('#vault-drop-zone-file-input');
    await expect(picker).toBeAttached();
    await picker.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-jpg') });
    await expect(page.locator('#vault-media-url')).toHaveValue(/^blob:/);
  });
});

test.describe('Admin (admin.html) - non-admin / logged-out access', () => {
  test('logged-out user is redirected to login.html', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/admin.html');
    // checkAdminAccess() redirects to login.html when no session is found.
    await page.waitForURL('**/login.html', { timeout: 5000 });
    expect(page.url()).toContain('login.html');
  });

  test('regular member session is redirected to home.html', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page); // role: 'member'
    await page.goto('/admin.html');
    // checkAdminAccess() redirects non-admin/non-officer sessions to home.html.
    await page.waitForURL('**/home.html', { timeout: 5000 });
    expect(page.url()).toContain('home.html');
  });
});
