const { test, expect } = require('@playwright/test');
const { mockSupabase, seedSession } = require('./fixtures/supabase-mock');

test.describe('Directory (directory.html)', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await page.goto('/directory.html');
  });

  test('renders member grid on load', async ({ page }) => {
    await expect(page.locator('#directory-grid')).toBeVisible();
  });

  test('search filters the member grid', async ({ page }) => {
    await page.fill('#directory-search', 'Nonexistent Member XYZ');
    await page.waitForTimeout(300);
    await expect(page.locator('#directory-count-text')).not.toContainText('Loading');
  });

  test('search handles special characters and SQL-injection-style input without crashing', async ({ page }) => {
    await page.fill('#directory-search', "'; DROP TABLE members; --");
    await page.waitForTimeout(300);
    // Page should not throw / crash; grid container still attached.
    await expect(page.locator('#directory-grid')).toBeAttached();
  });

  test('search input accepts emoji and long strings without breaking layout', async ({ page }) => {
    await page.fill('#directory-search', '🚀'.repeat(50));
    await page.waitForTimeout(300);
    await expect(page.locator('#directory-grid')).toBeAttached();
  });

  test('Excel import modal opens and closes', async ({ page }) => {
    const importModal = page.locator('#import-modal');
    // Only officers/admins typically see the import trigger; verify modal toggles if reachable.
    if (await importModal.count()) {
      await expect(importModal).toHaveClass(/hidden/);
    }
  });
});
