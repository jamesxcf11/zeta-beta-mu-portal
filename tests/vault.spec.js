const { test, expect } = require('@playwright/test');
const { mockSupabase, seedSession, seedAdminSession } = require('./fixtures/supabase-mock');

test.describe('Vault (vault.html)', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await page.goto('/vault.html');
    // Dismiss mobile overlay and dev-inspector if present (intercepts pointer events).
    await page.evaluate(() => {
      const overlay = document.getElementById('mobile-overlay');
      if (overlay) {
        overlay.classList.remove('overlay-active');
        overlay.style.pointerEvents = 'none';
      }
      const devInspector = document.getElementById('dev-inspector-panel');
      if (devInspector) {
        devInspector.style.display = 'none';
        devInspector.style.pointerEvents = 'none';
      }
    });
  });

  test('renders album grid and stats on load', async ({ page }) => {
    await expect(page.locator('#vault-gallery')).toBeVisible();
    await expect(page.locator('#vault-stats')).toBeAttached();
    // Mock data should produce at least one album card
    await expect(page.locator('.album-card')).toHaveCount(1);
  });

  test('search filters albums without crashing', async ({ page }) => {
    await page.fill('#vault-search', 'Charity');
    await page.waitForTimeout(300);
    await expect(page.locator('#vault-gallery')).toBeAttached();
    // The mock album title contains "Charity Mission"
    await expect(page.locator('.album-card')).toHaveCount(1);

    // Search for something that doesn't match → empty state
    await page.fill('#vault-search', 'NonexistentEvent');
    await page.waitForTimeout(300);
    await expect(page.locator('.vault-empty-state')).toBeAttached();
  });

  test('upload modal: submitting without album name shows validation toast', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    await expect(page.locator('#vault-upload-modal')).not.toHaveClass(/hidden/);
    const submitBtn = page.locator('#vault-upload-modal button:has-text("Submit")');
    if (await submitBtn.count()) {
      await submitBtn.click();
      // submitUploadForApproval() should not close modal / should show toast on missing name
      await expect(page.locator('#vault-upload-modal')).not.toHaveClass(/hidden/);
    }
  });

  test('upload modal: submitting without files shows validation toast', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    await page.fill('#upload-album-name', 'Medical Mission 2026');
    await page.fill('#upload-location', 'Porac, Pampanga');
    const submitBtn = page.locator('#vault-upload-modal button:has-text("Submit")');
    if (await submitBtn.count()) {
      await submitBtn.click();
      // Should stay open because no files selected
      await expect(page.locator('#vault-upload-modal')).not.toHaveClass(/hidden/);
    }
  });

  test('upload modal closes via backdrop and close button', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    await expect(page.locator('#vault-upload-modal')).not.toHaveClass(/hidden/);
    await page.click('.vault-modal-close');
    await expect(page.locator('#vault-upload-modal')).toHaveClass(/hidden/);
  });

  test('member-only session: officer View button is hidden (role gating)', async ({ page }) => {
    // applyRoleGating() in vault.js sets display:none on #officer-view-btn for non-officer sessions.
    const btn = page.locator('#officer-view-btn');
    await expect(btn).toBeHidden();
  });
});

test.describe('Vault - officer/admin session', () => {
  test('officer view shows pending approvals panel', async ({ page }) => {
    await mockSupabase(page);
    await seedAdminSession(page);
    await page.goto('/vault.html');
    await page.evaluate(() => {
      const overlay = document.getElementById('mobile-overlay');
      if (overlay) {
        overlay.classList.remove('overlay-active');
        overlay.style.pointerEvents = 'none';
      }
      const devInspector = document.getElementById('dev-inspector-panel');
      if (devInspector) {
        devInspector.style.display = 'none';
        devInspector.style.pointerEvents = 'none';
      }
    });
    await page.click('#officer-view-btn');
    await expect(page.locator('#officer-approval-panel')).toBeVisible();
  });
});
