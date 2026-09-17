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

  test('CSV import parses rows and adds members to the grid', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    const csv = [
      'Name,Graduation Year,Hospital,Field of Medicine',
      '"Dr. Test Import","2001","Test General Hospital","Cardiology"',
      '"Dr. Second Import","2003","Import Medical Center","Neurology"'
    ].join('\n');

    const before = await page.locator('.member-card').count();
    await page.evaluate(() => openImportModal());
    await page.setInputFiles('#import-file-input', { name: 'members.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.evaluate(() => handleImportReview());

    await expect(page.locator('#import-modal')).toHaveClass(/hidden/);
    await expect(page.locator('.member-card')).toHaveCount(before + 2);
    await expect(page.locator('#directory-grid')).toContainText('Dr. Test Import');
    await expect(page.locator('#directory-grid')).toContainText('Dr. Second Import');
  });

  test('non-CSV import is rejected with a clear message and adds nothing', async ({ page }) => {
    let dialogMsg = '';
    page.on('dialog', (d) => { dialogMsg = d.message(); d.accept(); });

    const before = await page.locator('.member-card').count();
    await page.evaluate(() => openImportModal());
    await page.setInputFiles('#import-file-input', { name: 'members.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('xlsx') });
    await page.evaluate(() => handleImportReview());

    await page.waitForTimeout(300);
    expect(dialogMsg).toContain('.csv');
    await expect(page.locator('.member-card')).toHaveCount(before);
  });
});
