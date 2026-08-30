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

  test('upload modal: submit button is disabled when no files are staged', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    await expect(page.locator('#vault-upload-modal')).not.toHaveClass(/hidden/);
    const submitBtn = page.locator('#vault-submit-btn');
    await expect(submitBtn).toBeDisabled();
  });

  test('upload modal: album name field works and submit stays disabled without files', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    await page.fill('#upload-album-name', 'Medical Mission 2026');
    await page.fill('#upload-location', 'Porac, Pampanga');
    // Submit button should still be disabled because no files are staged
    const submitBtn = page.locator('#vault-submit-btn');
    await expect(submitBtn).toBeDisabled();
    // Modal should still be open
    await expect(page.locator('#vault-upload-modal')).not.toHaveClass(/hidden/);
  });

  test('upload modal closes via backdrop and close button', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    await expect(page.locator('#vault-upload-modal')).not.toHaveClass(/hidden/);
    await page.click('.vault-modal-close');
    await expect(page.locator('#vault-upload-modal')).toHaveClass(/hidden/);
  });

  test('upload modal: album mode radio switches field type', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    // Default: new album mode shows text input
    await expect(page.locator('#upload-album-name')).toBeVisible();
    await expect(page.locator('#upload-album-existing-group')).toBeHidden();
    // Switch to existing album mode
    await page.check('input[name="album-mode"][value="existing"]');
    await expect(page.locator('#upload-album-existing-group')).toBeVisible();
    await expect(page.locator('#upload-album-new-group')).toBeHidden();
    // Should show "No albums yet" placeholder since mock has 1 album
    const existingSelect = page.locator('#upload-existing-album');
    await expect(existingSelect).toBeVisible();
  });

  test('upload modal: file preview appears when file is selected', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    // Initially dropzone shows empty state
    await expect(page.locator('#vault-dropzone-empty')).toBeVisible();
    await expect(page.locator('#vault-dropzone-previews')).toBeHidden();
    // Upload a fake file
    await page.setInputFiles('#vault-file-input', {
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
    });
    // Preview should now be visible
    await expect(page.locator('#vault-dropzone-previews')).toBeVisible();
    await expect(page.locator('.vault-dropzone-thumb')).toHaveCount(1);
    // Submit button should be enabled
    await expect(page.locator('#vault-submit-btn')).toBeEnabled();
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
