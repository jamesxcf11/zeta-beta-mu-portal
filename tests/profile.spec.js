const path = require('path');
const { test, expect } = require('@playwright/test');
const { mockSupabase, makeMember, seedAuthenticatedSession } = require('./fixtures/supabase-mock');

test.describe('Current user profile', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page, {
      member: makeMember({
        middle_name: 'Quinn',
        nickname: 'Doc Test',
        birthday: '1984-05-20',
        specialization: 'Interventional Cardiology',
        batch: 'Aesculapius',
        bio: 'Serving patients and the brotherhood.',
        mobile: '09171234567',
      }),
    });
    await seedAuthenticatedSession(page);
    await page.goto('/profile.html');
    await expect(page.locator('#profile-form')).toBeVisible({ timeout: 10000 });
  });

  test('renders the authenticated member and keeps account fields read-only', async ({ page }) => {
    await expect(page.locator('#profile-name-heading')).toHaveText('Dr. Test Member');
    await expect(page.locator('#profile-first-name')).toHaveValue('Test');
    await expect(page.locator('#profile-hospital')).toHaveValue('Test Hospital');
    await expect(page.locator('#profile-username')).toHaveValue('testmember');
    await expect(page.locator('#profile-email')).toHaveValue('testmember@example.com');
    await expect(page.locator('#profile-username')).toHaveAttribute('readonly', '');
    await expect(page.locator('#profile-email')).toHaveAttribute('readonly', '');
  });

  test('saves editable fields and refreshes the portal session', async ({ page }) => {
    await page.fill('#profile-first-name', 'Jordan');
    await page.fill('#profile-hospital', 'Mercy Medical Center');
    await page.fill('#profile-bio', 'Updated member biography.');
    await page.click('#profile-save');

    await expect(page.locator('#profile-message')).toContainText('profile has been updated');
    await expect(page.locator('#profile-name-heading')).toContainText('Jordan');
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('zbm-session')));
    expect(session.name).toContain('Jordan');
    expect(session.hospital).toBe('Mercy Medical Center');
    expect(session.role).toBe('member');
  });

  test('shows API errors without losing entered values', async ({ page }) => {
    await page.route('**/api/profile**', async (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Profile validation failed' }) });
      }
      return route.fallback();
    });
    await page.fill('#profile-hospital', 'Entered Hospital');
    await page.click('#profile-save');
    await expect(page.locator('#profile-message')).toContainText('Profile validation failed');
    await expect(page.locator('#profile-hospital')).toHaveValue('Entered Hospital');
  });

  test('compresses and uploads a profile-scoped photo', async ({ page }) => {
    let presignRequest;
    let uploadedBytes = 0;
    await page.route('**/api/upload-url**', async (route) => {
      presignRequest = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uploadUrl: 'https://profile-upload.example.com/photo',
          publicUrl: 'https://media.zetabetamu.com/profiles/1/photo.webp',
          fileKey: 'profiles/1/photo.webp',
          expiresIn: 300,
        }),
      });
    });
    await page.route('https://profile-upload.example.com/photo', async (route) => {
      uploadedBytes = route.request().postDataBuffer().length;
      return route.fulfill({ status: 200 });
    });

    await page.setInputFiles('#profile-photo', path.join(__dirname, '..', 'image', 'placeholders', 'avatars', 'a11.jpg'));
    await expect(page.locator('#profile-message')).toContainText('Photo selected');
    await page.click('#profile-save');
    await expect(page.locator('#profile-message')).toContainText('profile has been updated');

    expect(presignRequest.scope).toBe('profile');
    expect(presignRequest.variant).toBe('full');
    expect(presignRequest.contentType).toBe('image/webp');
    expect(uploadedBytes).toBeGreaterThan(0);
    expect(uploadedBytes).toBeLessThan(1024 * 1024);
    await expect(page.locator('#profile-avatar-preview')).toHaveAttribute('src', /profiles\/1\/photo\.webp/);
  });

  test('fits the viewport without horizontal overflow', async ({ page }) => {
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport + 1);
    await expect(page.locator('#profile-save')).toBeVisible();
  });
});

test('profile page redirects visitors without a portal session', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/profile.html');
  await page.waitForURL('**/login.html');
});

test('home profile menu opens the dedicated profile page', async ({ page }) => {
  await mockSupabase(page);
  await seedAuthenticatedSession(page);
  await page.goto('/home.html');
  if (await page.locator('#hamburger-menu').isVisible()) await page.click('#hamburger-menu');
  await page.click('#user-card');
  await page.click('.profile-dropdown-item[href="profile.html"]');
  await page.waitForURL('**/profile.html');
});
