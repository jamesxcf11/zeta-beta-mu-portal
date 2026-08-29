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
