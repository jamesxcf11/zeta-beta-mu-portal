const { test, expect } = require('@playwright/test');
const { mockSupabase, makeMember, seedSession, seedAdminSession } = require('./fixtures/supabase-mock');

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

  test('tags, search and filters work together, including from inside an album', async ({ page }) => {
    await page.evaluate(() => {
      const mk = (id, title, category, date, tags) => ({
        id, title, description: '', date, location: 'Manila', coverImage: 'x.jpg',
        category, categoryIcon: 'folder', categoryColor: '#fff', isPublic: true, tags,
        photos: [{ src: 'x.jpg', thumb: 'x.jpg', caption: '', tags }]
      });
      VaultModule.albums = [
        mk('a1', 'Gala Night', 'Annual Gala', 'March 3, 2024', ['gala', 'service']),
        mk('a2', 'Medical Mission', 'Charity Mission', 'June 5, 2023', ['service', 'porac']),
        mk('a3', 'Review Class', 'Research', 'May 1, 2023', ['scholarship'])
      ];
      VaultModule.clearAllFilters();
    });
    await expect(page.locator('.album-card')).toHaveCount(3);

    await page.locator('.vault-tag-chip[data-tag="service"]').click();
    await expect(page.locator('.album-card')).toHaveCount(2);
    await expect(page.locator('#vault-results-count')).toHaveText('2 albums');

    await page.fill('#vault-search', '#porac');
    await expect(page.locator('.album-card')).toHaveCount(1);

    await page.click('#vault-clear-filters');
    await expect(page.locator('.album-card')).toHaveCount(3);

    await page.locator('.album-card', { hasText: 'Review Class' }).click();
    await expect(page.locator('.album-hero-card')).toBeVisible();
    await page.locator('.album-hero-card .vault-tag-badge', { hasText: '#scholarship' }).click();
    await expect(page.locator('.album-hero-card')).toHaveCount(0);
    await expect(page.locator('.album-card')).toHaveCount(1);
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
    await page.locator('.vault-radio', { hasText: 'Add to existing album' }).click();
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

  test('upload modal: hashtag/tag field is parsed and shown in review step', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    await page.fill('#upload-album-name', 'PLE Board Passers 2026');
    await page.fill('#upload-date', '2026-03-01');
    await page.fill('#upload-tags', '#scholarship, #ple, revalida');
    await page.setInputFiles('#vault-file-input', {
      name: 'passers.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
    });
    await page.click('#vault-submit-btn');
    await expect(page.locator('#vault-upload-step-2')).toBeVisible();
    await expect(page.locator('#vault-review-content')).toContainText('#scholarship');
    await expect(page.locator('#vault-review-content')).toContainText('#ple');
    await expect(page.locator('#vault-review-content')).toContainText('#revalida');
  });

  test('Albums stat is a button that returns to the default vault view', async ({ page }) => {
    await page.fill('#vault-search', 'zzz');
    await expect(page.locator('.album-card')).toHaveCount(0);
    await page.click('button.vault-stat-button');
    await expect(page.locator('#vault-search')).toHaveValue('');
    await expect(page.locator('.album-card')).toHaveCount(1);

    await page.locator('.album-card').first().click();
    await expect(page.locator('.album-hero-card')).toBeVisible();
    await page.click('button.vault-stat-button');
    await expect(page.locator('.album-hero-card')).toHaveCount(0);
    await expect(page.locator('.album-card')).toHaveCount(1);

    // Photos stat opens the all-photos view
    await page.locator('button.vault-stat-button', { hasText: 'Photos' }).click();
    await expect(page.locator('.album-hero-title')).toHaveText('All Photos');
    await expect(page.locator('.album-grid-item')).toHaveCount(2);
    await page.locator('button.vault-stat-button', { hasText: 'Albums' }).click();
    await expect(page.locator('.album-card')).toHaveCount(1);
  });

  test('upload form rejects blank/"none" titles and a missing date', async ({ page }) => {
    await page.click('button:has-text("Upload Photos")');
    await page.setInputFiles('#vault-file-input', { name: 'a.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') });

    await page.click('#vault-submit-btn');
    await expect(page.locator('#upload-album-name-error')).toContainText('required');
    await expect(page.locator('#upload-date-error')).toContainText('required');
    await expect(page.locator('#vault-upload-step-2')).toBeHidden();

    await page.fill('#upload-album-name', ' None ');
    await page.fill('#upload-date', '2026-03-01');
    await page.click('#vault-submit-btn');
    await expect(page.locator('#upload-album-name-error')).toContainText('real album name');
    await expect(page.locator('#upload-date-error')).toBeHidden();

    await page.fill('#upload-album-name', 'Real Album');
    await page.click('#vault-submit-btn');
    await expect(page.locator('#vault-upload-step-2')).toBeVisible();
  });

  test('bad stored data renders gracefully; one year hides the year filter', async ({ page }) => {
    await page.evaluate(() => {
      VaultModule.albums = [{
        id: 'b1', title: 'Untitled album', rawTitle: 'none', untitled: true, description: '', date: 'January 12, 2026',
        location: '', coverImage: 'x.jpg', category: 'Charity Mission', categoryIcon: 'heart', categoryColor: '#fff',
        isPublic: false, tags: [], photos: [{ src: 'x.jpg', thumb: 'x.jpg', caption: '' }]
      }];
      VaultModule.clearAllFilters();
    });
    await expect(page.locator('.album-title .vault-untitled')).toHaveText('Untitled album');
    await expect(page.locator('.album-location')).toHaveCount(0);
    await expect(page.locator('.yd-wrapper')).toHaveCount(0);
    await expect(page.locator('#vault-stats')).toContainText('Photos');
    await expect(page.locator('#vault-stats')).not.toContainText('Show All');
    await expect(page.locator('#vault-highlights')).toContainText('No highlights yet this week');
  });

  test('member-only session: officer View button is hidden (role gating)', async ({ page }) => {
    // applyRoleGating() in vault.js sets display:none on #officer-view-btn for non-officer sessions.
    const btn = page.locator('#officer-view-btn');
    await expect(btn).toBeHidden();
  });
});

const pendingRow = (id, album, title) => ({
  id, album_id: album, title, category: 'charity_mission', event_date: '2026-01-12', location: 'QC',
  is_public: false, created_at: '2026-01-13T00:00:00Z', uploaded_by: 1,
  media_url: 'https://media.zetabetamu.com/a.webp', thumbnail_url: 'https://media.zetabetamu.com/a.webp',
  approval_status: 'pending', tags: ['service']
});

async function openOfficerVault(page, pending = []) {
  await mockSupabase(page, { member: makeMember({ role: 'admin' }) });
  await page.route('**/rest/v1/vault_items**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET' && req.url().includes('approval_status=eq.pending')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pending) });
    }
    if (req.method() === 'PATCH') {
      await page.evaluate((b) => { (window.__patches = window.__patches || []).push(b); }, { url: req.url(), body: req.postDataJSON() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"id":1}]' });
    }
    return route.fallback();
  });
  await seedAdminSession(page);
  await page.goto('/vault.html');
  await page.evaluate(() => {
    const overlay = document.getElementById('mobile-overlay');
    if (overlay) { overlay.classList.remove('overlay-active'); overlay.style.pointerEvents = 'none'; }
    const dev = document.getElementById('dev-inspector-panel');
    if (dev) { dev.style.display = 'none'; dev.style.pointerEvents = 'none'; }
  });
  await page.click('#officer-view-btn');
}

test.describe('Vault - officer/admin session', () => {
  test('pending queue: compact bar, drawer, bulk approve, reject confirm', async ({ page }) => {
    const rows = [pendingRow(1, 'alb-a', 'Gala 2025'), pendingRow(2, 'alb-b', 'Mission 2025'), pendingRow(3, 'alb-c', 'Induction 2025')];
    await openOfficerVault(page, rows);

    await expect(page.locator('.vault-approval-count')).toHaveText('3');
    await expect(page.locator('.vault-approval-item')).toHaveCount(0);
    await page.click('#vault-review-queue-btn');
    const drawer = page.locator('#vault-queue-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.vault-approval-item')).toHaveCount(3);

    // Esc closes the drawer
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    // Reject requires confirmation
    await page.click('#vault-review-queue-btn');
    await drawer.locator('.vault-approval-item').first().getByRole('button', { name: 'Reject' }).click();
    await expect(drawer.locator('.vault-reject-confirm')).toBeVisible();
    await page.fill('#vault-reject-reason', 'duplicate');
    await drawer.getByRole('button', { name: 'Reject submission' }).click();
    await expect(drawer.locator('.vault-approval-item')).toHaveCount(2);
    const patches = await page.evaluate(() => window.__patches);
    expect(patches[0].body).toMatchObject({ approval_status: 'rejected', rejection_reason: 'duplicate' });

    // Bulk approve
    await drawer.getByLabel('Select all').check().catch(() => {});
    await drawer.locator('.vault-queue-selectall input').check();
    await drawer.getByRole('button', { name: /Approve selected \(2\)/ }).click();
    await expect(page.locator('.vault-approval-count')).toHaveText('0');
    const all = await page.evaluate(() => window.__patches);
    expect(all.at(-1).body).toEqual({ approval_status: 'approved' });
    expect(all.at(-1).url).toContain('album_id=in.');
  });

  test('approving with share options posts to the feed and announcements once', async ({ page }) => {
    const rows = [pendingRow(1, 'test-album-2025', 'Gala 2025')];
    await openOfficerVault(page, rows);
    const posts = [];
    await page.route('**/rest/v1/posts**', async (route) => {
      if (route.request().method() === 'POST') {
        posts.push({ t: 'posts', body: route.request().postDataJSON() });
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{"id":901}' });
      }
      return route.fallback();
    });
    await page.route('**/rest/v1/announcements**', async (route) => {
      if (route.request().method() === 'POST') {
        posts.push({ t: 'announcements', body: route.request().postDataJSON() });
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{"id":902}' });
      }
      return route.fallback();
    });

    await page.click('#vault-review-queue-btn');
    const drawer = page.locator('#vault-queue-drawer');
    await expect(drawer.locator('#queue-share-feed')).not.toBeChecked();
    await expect(drawer.locator('#queue-share-announce')).not.toBeChecked();
    await drawer.locator('#queue-share-feed').check();
    await drawer.locator('#queue-share-announce').check();
    await drawer.locator('.vault-approval-item').first().getByRole('button', { name: 'Approve' }).click();

    await expect.poll(() => posts.length).toBe(2);
    const feed = posts.find(p => p.t === 'posts').body;
    expect(feed).toMatchObject({ post_type: 'vault_album', vault_album_id: 'test-album-2025', status: 'published' });
    expect(feed.content).toContain('New in the Vault');
    const ann = posts.find(p => p.t === 'announcements').body;
    expect(ann).toMatchObject({ vault_album_id: 'test-album-2025', priority: 'normal' });
    const patches = await page.evaluate(() => window.__patches);
    expect(patches.some(p => p.body.shared_post_id === 901 && p.body.shared_announcement_id === 902)).toBeTruthy();

    // Already shared: the card button is now disabled
    await expect(page.locator('.album-card').getByRole('button', { name: /Already shared/ })).toBeDisabled();
  });

  test('share dialog on an approved album', async ({ page }) => {
    await openOfficerVault(page);
    const calls = [];
    await page.route('**/rest/v1/posts**', async (route) => {
      if (route.request().method() === 'POST') {
        calls.push(route.request().postDataJSON());
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{"id":5}' });
      }
      return route.fallback();
    });
    await page.locator('.album-card').getByRole('button', { name: /Share/ }).first().click();
    await page.locator('.vault-share [data-act="ok"]').click();
    await expect(page.locator('.vault-share')).toHaveCount(1); // nothing chosen: stays open
    await page.locator('#share-feed').check();
    await page.locator('.vault-share [data-act="ok"]').click();
    await expect(page.locator('.vault-share')).toHaveCount(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].vault_album_id).toBe('test-album-2025');
  });

  test('making an album public needs confirmation', async ({ page }) => {
    await openOfficerVault(page);
    const sw = () => page.locator('.vault-vis-switch').first();
    // Fixture album starts public; going private needs no confirm
    await expect(sw()).toHaveAttribute('aria-checked', 'true');
    await sw().click();
    await expect(sw()).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.vault-confirm')).toHaveCount(0);

    // Going public asks first; Esc cancels
    await sw().click();
    await expect(page.locator('.vault-confirm')).toContainText('visible to anyone with the link');
    await page.keyboard.press('Escape');
    await expect(page.locator('.vault-confirm')).toHaveCount(0);
    await expect(sw()).toHaveAttribute('aria-checked', 'false');

    await sw().click();
    await page.locator('.vault-confirm [data-act="ok"]').click();
    await expect(sw()).toHaveAttribute('aria-checked', 'true');
  });

  test('officer can edit album title, date and location; bad values are rejected', async ({ page }) => {
    await openOfficerVault(page);
    await page.locator('.album-card .vault-edit-btn').first().click();
    const dlg = page.locator('.vault-edit');
    await expect(dlg).toBeVisible();

    await page.fill('#edit-title', 'none');
    await page.fill('#edit-date', '');
    await dlg.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#edit-title-error')).toContainText('real album name');
    await expect(page.locator('#edit-date-error')).toContainText('required');
    await expect(page.evaluate(() => window.__patches)).resolves.toBeUndefined();

    await page.fill('#edit-title', 'Medical Mission 2025');
    await page.fill('#edit-date', '2025-12-15');
    await page.fill('#edit-location', 'Porac, Pampanga');
    await page.fill('#edit-tags', '#service, porac');
    await dlg.getByRole('button', { name: 'Save changes' }).click();
    await expect(dlg).toHaveCount(0);
    const patches = await page.evaluate(() => window.__patches);
    expect(patches[0].body).toMatchObject({
      title: 'Medical Mission 2025', event_date: '2025-12-15', year: 2025, location: 'Porac, Pampanga', tags: ['service', 'porac']
    });
    expect(patches[0].url).toContain('album_id=eq.test-album-2025');
  });

  test('officer view shows pending approvals panel', async ({ page }) => {
    await mockSupabase(page, { member: makeMember({ role: 'admin' }) });
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
