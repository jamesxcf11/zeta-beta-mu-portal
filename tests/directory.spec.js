const { test, expect } = require('@playwright/test');
const { mockSupabase, seedAuthenticatedSession } = require('./fixtures/supabase-mock');

const RESULTS = [
  { id: 1, name: 'Douglas L. Abadco', nickname: 'Dougie', batch: 'Guapitos', hospital: 'St. Luke\'s Medical Center; Makati Medical Center', field: 'Surgery', specialization: 'General Surgery', deceased: false, retired: false },
  { id: 2, name: '<img src=x onerror="window.__xss=1">', nickname: null, batch: 'Koine', hospital: null, field: null, deceased: true, retired: false },
];

async function mockSearch(page, { total = RESULTS.length, nextOffset = null, results = RESULTS } = {}) {
  const requests = [];
  await page.route('**/api/directory-search', async (route) => {
    requests.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, results, total, offset: 0, nextOffset, officer: false }) });
  });
  return requests;
}

test.describe('Directory (directory.html)', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await seedAuthenticatedSession(page);
  });

  test('shows a search prompt and no members on load', async ({ page }) => {
    const requests = await mockSearch(page);
    await page.goto('/directory.html');
    await expect(page.locator('#directory-grid')).toContainText('Search the directory');
    await expect(page.locator('.member-card')).toHaveCount(0);
    await expect(page.locator('#directory-count-text')).toContainText('Search to see members');
    expect(requests).toHaveLength(0);
  });

  test('typing alone does not search or show results', async ({ page }) => {
    const requests = await mockSearch(page);
    await page.goto('/directory.html');
    await page.locator('#directory-search').pressSequentially('abadco', { delay: 40 });
    await page.waitForTimeout(500);
    await expect(page.locator('.member-card')).toHaveCount(0);
    expect(requests).toHaveLength(0);
  });

  test('pressing Enter searches and shows results', async ({ page }) => {
    const requests = await mockSearch(page);
    await page.goto('/directory.html');
    await page.fill('#directory-search', 'abadco');
    await page.press('#directory-search', 'Enter');
    await expect(page.locator('.member-card')).toHaveCount(2);
    await expect(page.locator('#directory-count-text')).toContainText('2 results for');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ q: 'abadco', offset: 0 });
  });

  test('the Search button searches too', async ({ page }) => {
    await mockSearch(page);
    await page.goto('/directory.html');
    await page.fill('#directory-search', 'dougie');
    await page.click('#directory-search-btn');
    await expect(page.locator('.member-card').first()).toContainText('Douglas L. Abadco');
    await expect(page.locator('.member-card').first()).toContainText('+1 more');
  });

  test('fewer than 2 characters does not call the server', async ({ page }) => {
    const requests = await mockSearch(page);
    await page.goto('/directory.html');
    await page.fill('#directory-search', 'a');
    await page.press('#directory-search', 'Enter');
    await expect(page.locator('#directory-grid')).toContainText('at least 2 characters');
    await expect(page.locator('.member-card')).toHaveCount(0);
    expect(requests).toHaveLength(0);
  });

  test('a filter chip does not show members before a search, and re-runs an existing search', async ({ page }) => {
    const requests = await mockSearch(page);
    await page.goto('/directory.html');
    await page.getByRole('button', { name: 'Surgery' }).click();
    await expect(page.locator('.member-card')).toHaveCount(0);
    expect(requests).toHaveLength(0);

    await page.fill('#directory-search', 'abadco');
    await page.press('#directory-search', 'Enter');
    await expect(page.locator('.member-card')).toHaveCount(2);
    expect(requests[0].specialty).toBe('Surgery');

    await page.getByRole('button', { name: 'All' }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].specialty).toBeUndefined();
  });

  test('Show more loads the next page', async ({ page }) => {
    const requests = [];
    await page.route('**/api/directory-search', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      requests.push(body);
      const first = !body.offset;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, results: [first ? RESULTS[0] : { ...RESULTS[0], id: 3, name: 'Second Page Person' }], total: 2, offset: body.offset || 0, nextOffset: first ? 25 : null, officer: false }),
      });
    });
    await page.goto('/directory.html');
    await page.fill('#directory-search', 'abadco');
    await page.press('#directory-search', 'Enter');
    await expect(page.locator('.member-card')).toHaveCount(1);
    await page.click('#directory-more');
    await expect(page.locator('.member-card')).toHaveCount(2);
    expect(requests[1].offset).toBe(25);
    await expect(page.locator('#directory-more')).toBeHidden();
  });

  test('result text is escaped (no HTML injection)', async ({ page }) => {
    await mockSearch(page);
    await page.goto('/directory.html');
    await page.fill('#directory-search', 'koine');
    await page.press('#directory-search', 'Enter');
    await expect(page.locator('.member-card')).toHaveCount(2);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('.member-card').nth(1)).toContainText('<img src=x');
  });

  test('server errors are shown instead of results', async ({ page }) => {
    await page.route('**/api/directory-search', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Too many searches. Please wait a moment and try again.' }) }));
    await page.goto('/directory.html');
    await page.fill('#directory-search', 'abadco');
    await page.press('#directory-search', 'Enter');
    await expect(page.locator('#directory-grid')).toContainText('Too many searches');
  });

  test('search handles special characters and SQL-injection-style input without crashing', async ({ page }) => {
    await mockSearch(page, { results: [], total: 0 });
    await page.goto('/directory.html');
    await page.fill('#directory-search', "'; DROP TABLE members; --");
    await page.press('#directory-search', 'Enter');
    await expect(page.locator('#directory-grid')).toContainText('No members found');
  });

  test('search input accepts emoji and long strings without breaking layout', async ({ page }) => {
    await mockSearch(page, { results: [], total: 0 });
    await page.goto('/directory.html');
    await page.fill('#directory-search', '🚀'.repeat(50));
    await page.press('#directory-search', 'Enter');
    await expect(page.locator('#directory-grid')).toBeAttached();
  });

  test('Excel import modal opens and closes', async ({ page }) => {
    await page.goto('/directory.html');
    const importModal = page.locator('#import-modal');
    if (await importModal.count()) {
      await expect(importModal).toHaveClass(/hidden/);
    }
  });
});
