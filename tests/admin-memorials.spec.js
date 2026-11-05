const { test, expect } = require('@playwright/test');
const { mockSupabase, makeMember, seedAuthenticatedSession } = require('./fixtures/supabase-mock');

test.describe('Admin In Memoriam tab', () => {
  test('officers can add a brother to the memorial', async ({ page }) => {
    await mockSupabase(page, { member: makeMember({ role: 'officer' }) });
    await seedAuthenticatedSession(page, { role: 'officer' });
    const writes = [];
    await page.route('**/rest/v1/memorials**', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
          { id: 1, full_name: 'Dr. Existing <i>Brother</i>', nickname: null, batch: '1980', specialty: 'Surgery', birth_year: 1950, death_year: 2020, tribute: null, photo_url: null, photo_key: null },
        ]) });
      }
      writes.push({ method: req.method(), body: req.postDataJSON() });
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/admin.html#memorials');
    await expect(page.locator('#panel-memorials')).toBeVisible();
    await expect(page.locator('#memorials-table-body tr')).toHaveCount(1);
    await expect(page.locator('#memorials-table-body')).toContainText('<i>Brother</i>');

    await page.click('#add-memorial-btn');
    await page.fill('#mem-name', 'Dr. New Memorial');
    await page.fill('#mem-death', '2024');
    await page.click('#admin-modal-form button[type="submit"]');

    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].method).toBe('POST');
    expect(writes[0].body).toMatchObject({ full_name: 'Dr. New Memorial', death_year: 2024, birth_year: null, is_public: true });
  });

  test('name is required', async ({ page }) => {
    await mockSupabase(page, { member: makeMember({ role: 'officer' }) });
    await seedAuthenticatedSession(page, { role: 'officer' });
    await page.goto('/admin.html#memorials');
    await page.click('#add-memorial-btn');
    await page.click('#admin-modal-form button[type="submit"]');
    await expect(page.locator('#admin-modal')).toBeVisible();
  });
});
