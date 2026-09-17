const { test, expect } = require('@playwright/test');
const { mockSupabase, seedSession } = require('./fixtures/supabase-mock');

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/6V8nWQAAAABJRU5ErkJggg==', 'base64');

test.describe('Memorial detail (memorial.html)', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await page.goto('/memorial.html?id=2');
    await expect(page.locator('#post-tribute-btn')).toBeVisible();
  });

  test('loads the brother selected on the memoriam page', async ({ page }) => {
    await expect(page.locator('.memorial-name')).toHaveText('Dr. Antonio L. Cruz');
    await expect(page).toHaveTitle(/Dr\. Antonio L\. Cruz/);
  });

  test('Post Tribute keeps working after the wall re-renders from a like or comment', async ({ page }) => {
    page.on('dialog', (d) => d.accept('A kind comment'));
    await page.locator('[data-action="like-tribute"]').first().click();
    await page.locator('[data-action="comment-tribute"]').first().click();
    await expect(page.locator('.memorial-comment-text', { hasText: 'A kind comment' })).toBeVisible();

    await page.fill('#tribute-input', 'Posted after a like and a comment');
    await page.click('#post-tribute-btn');
    await expect(page.locator('.memorial-tribute').first()).toContainText('Posted after a like and a comment');
    await expect(page.locator('#tribute-input')).toHaveValue('');
  });

  test('a typed draft survives liking another tribute', async ({ page }) => {
    await page.fill('#tribute-input', 'Draft in progress');
    await page.locator('[data-action="like-tribute"]').first().click();
    await expect(page.locator('#tribute-input')).toHaveValue('Draft in progress');
  });

  test('empty tribute is rejected with a message', async ({ page }) => {
    const before = await page.locator('.memorial-tribute').count();
    await page.click('#post-tribute-btn');
    await expect(page.locator('#memorial-toast')).toContainText('write something');
    await expect(page.locator('.memorial-tribute')).toHaveCount(before);
  });

  test('Photo attaches an image, posts it with the tribute, and fills the gallery', async ({ page }) => {
    await expect(page.locator('#memorial-gallery-empty')).toBeVisible();

    await page.setInputFiles('#tribute-photo-input', { name: 'remember.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('#tribute-attachment-preview img')).toBeVisible();

    await page.fill('#tribute-input', 'A photo from the reunion');
    await page.click('#post-tribute-btn');

    const tribute = page.locator('.memorial-tribute').first();
    await expect(tribute).toContainText('A photo from the reunion');
    await expect(tribute.locator('.memorial-tribute-media img')).toBeVisible();
    await expect(page.locator('#tribute-attachment-preview')).toHaveCount(0);

    await expect(page.locator('#memorial-gallery-empty')).toHaveCount(0);
    await expect(page.locator('.memorial-gallery-item')).toHaveCount(1);

    // Gallery items open a lightbox instead of a "coming soon" toast
    await page.locator('.memorial-gallery-item').first().click();
    const lightbox = page.locator('#memorial-lightbox');
    await expect(lightbox).toHaveClass(/active/);
    await expect(lightbox.locator('img')).toBeVisible();
    await page.locator('#memorial-lightbox .vault-lightbox-close').click();
    await expect(page.locator('#memorial-lightbox')).toHaveCount(0);
  });

  test('Video attaches a clip and a photo-only tribute can be posted without text', async ({ page }) => {
    await page.setInputFiles('#tribute-video-input', { name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fake-video-bytes') });
    await expect(page.locator('#tribute-attachment-preview video')).toBeAttached();
    await page.click('#post-tribute-btn');
    await expect(page.locator('.memorial-tribute').first().locator('.memorial-tribute-media video')).toBeAttached();
    await expect(page.locator('.memorial-gallery-item')).toHaveCount(1);
  });

  test('unsupported attachments are rejected and can be removed before posting', async ({ page }) => {
    await page.setInputFiles('#tribute-photo-input', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.locator('#memorial-toast')).toContainText('not a supported');
    await expect(page.locator('#tribute-attachment-preview')).toHaveCount(0);

    await page.setInputFiles('#tribute-photo-input', { name: 'remember.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('#tribute-attachment-preview')).toBeVisible();
    await page.click('[data-action="remove-attachment"]');
    await expect(page.locator('#tribute-attachment-preview')).toHaveCount(0);
  });
});

test('memoriam cards open the matching memorial detail page', async ({ page }) => {
  await mockSupabase(page);
  await seedSession(page);
  await page.goto('/memoriam.html');
  await page.locator('.memoriam-card-link[href="memorial.html?id=3"]').click();
  await page.waitForURL('**/memorial.html?id=3');
  await expect(page.locator('.memorial-name')).toHaveText('Dr. Manuel P. Reyes');
});
