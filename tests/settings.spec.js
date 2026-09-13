const { test, expect } = require('@playwright/test');
const { mockSupabase, makeMember, seedAuthenticatedSession } = require('./fixtures/supabase-mock');

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page, {
      member: makeMember({ birthday: '1984-05-20' }),
    });
    await seedAuthenticatedSession(page);
    await page.goto('/settings.html');
    await expect(page.locator('#settings-content')).toBeVisible({ timeout: 10000 });
  });

  test('renders all sections with saved preferences applied', async ({ page }) => {
    await expect(page.locator('#appearance-heading')).toBeVisible();
    await expect(page.locator('#notifications-heading')).toBeVisible();
    await expect(page.locator('#privacy-heading')).toBeVisible();
    await expect(page.locator('#security-heading')).toBeVisible();
    await expect(page.locator('#pref-reactions')).toBeChecked();
    await expect(page.locator('#pref-comments')).toBeChecked();
    await expect(page.locator('#pref-announcements')).toBeChecked();
    await expect(page.locator('#pref-show-on-calendar')).not.toBeChecked();
  });

  test('saves notification and privacy preferences', async ({ page }) => {
    let patchBody;
    await page.route('**/api/settings**', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = route.request().postDataJSON();
      }
      return route.fallback();
    });

    await page.locator('.settings-toggle', { has: page.locator('#pref-reactions') }).click();
    await page.locator('.settings-toggle', { has: page.locator('#pref-show-on-calendar') }).click();
    await page.click('#settings-prefs-save');

    await expect(page.locator('#settings-message')).toContainText('preferences have been saved');
    expect(patchBody.notifications.reactions).toBe(false);
    expect(patchBody.notifications.comments).toBe(true);
    expect(patchBody.privacy.showOnCalendar).toBe(true);
  });

  test('disables the calendar toggle and shows a hint when no birthday is set', async ({ page }) => {
    await page.route('**/api/settings**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          settings: {
            notifications: { reactions: true, comments: true, announcements: true },
            privacy: { showOnCalendar: false, showAge: false, hasBirthday: false },
          },
        }),
      });
    });
    await page.reload();
    await expect(page.locator('#settings-content')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#pref-show-on-calendar')).toBeDisabled();
    await expect(page.locator('#settings-birthday-hint')).toBeVisible();
  });

  test('switches theme and persists the preference', async ({ page }) => {
    await page.locator('.settings-theme-option', { hasText: 'Light' }).click();
    await expect(page.locator('body')).toHaveClass(/light-theme/);
    const stored = await page.evaluate(() => localStorage.getItem('zbm-theme-preference'));
    expect(stored).toBe('light');

    await page.locator('.settings-theme-option', { hasText: 'System' }).click();
    const cleared = await page.evaluate(() => localStorage.getItem('zbm-theme-preference'));
    expect(cleared).toBeNull();
  });

  test('shows API errors and disables preference controls', async ({ page }) => {
    await page.route('**/api/settings**', async (route) => {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Settings storage is not configured' }) });
    });
    await page.reload();
    await expect(page.locator('#settings-content')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#settings-error')).toContainText('Settings storage is not configured');
    await expect(page.locator('#pref-reactions')).toBeDisabled();
    await expect(page.locator('#settings-prefs-save')).toBeDisabled();
  });

  test('validates the new password before calling Supabase', async ({ page }) => {
    await page.fill('#settings-current-password', 'OldPass123');
    await page.fill('#settings-new-password', 'weak');
    await page.fill('#settings-confirm-password', 'weak');
    await page.click('#settings-password-save');
    await expect(page.locator('#settings-message')).toContainText('at least 8 characters');

    await page.fill('#settings-new-password', 'NewPass123');
    await page.fill('#settings-confirm-password', 'Different123');
    await page.click('#settings-password-save');
    await expect(page.locator('#settings-message')).toContainText('do not match');
  });

  test('changes the password when the current one verifies', async ({ page }) => {
    let updatedPassword;
    await page.route('**/auth/v1/user**', async (route) => {
      updatedPassword = route.request().postDataJSON().password;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'mock-user-id' }) });
    });
    await page.fill('#settings-current-password', 'OldPass123');
    await page.fill('#settings-new-password', 'NewPass123');
    await page.fill('#settings-confirm-password', 'NewPass123');
    await page.click('#settings-password-save');
    await expect(page.locator('#settings-message')).toContainText('password has been updated');
    expect(updatedPassword).toBe('NewPass123');
  });
});

test('settings page redirects visitors without a portal session', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/settings.html');
  await page.waitForURL('**/login.html');
});

test('profile menu links to the settings page', async ({ page }) => {
  await mockSupabase(page);
  await seedAuthenticatedSession(page);
  await page.goto('/home.html');
  if (await page.locator('#hamburger-menu').isVisible()) await page.click('#hamburger-menu');
  await page.click('#user-card');
  await page.click('.profile-dropdown-item[href="settings.html"]');
  await page.waitForURL('**/settings.html');
});
