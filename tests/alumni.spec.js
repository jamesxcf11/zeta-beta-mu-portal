const { test, expect } = require('@playwright/test');
const { mockSupabase, makeMember, seedAuthenticatedSession } = require('./fixtures/supabase-mock');

const ALUMNI = [
  { id: 1, name: 'Dr. Ana Reyes', nickname: 'Annie', batch: 'Koine', hospital: 'St. Luke\'s', field: 'Cardiology', specialization: 'Interventional Cardiology', email: 'ana@example.com', mobile: '0917-111-2222', address: 'Quezon City', schedule: 'Mon 1-3pm' },
  { id: 2, name: 'Dr. Ben Santos', nickname: null, batch: 'Patent', hospital: 'Makati Medical', field: 'Pediatrics', specialization: null },
  { id: 3, name: 'Dr. Cara <b>Lim</b>', nickname: null, batch: 'Trident', hospital: null, field: 'Surgery', specialization: null },
];
const CONTACT_FIELDS = ['email', 'mobile', 'telephone', 'address', 'birthday', 'schedule'];

/** Stand-in for /api/directory-search: AND-matches words, strips contact fields for non-officers. */
async function setup(page, { role = 'member' } = {}) {
  await mockSupabase(page, { member: makeMember({ role }) });
  await seedAuthenticatedSession(page, { role });
  const officer = role === 'officer' || role === 'admin';
  const calls = [];
  const searches = [];
  const directTableReads = [];
  await page.route('**/rest/v1/alumni**', (route) => { directTableReads.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await page.route('**/api/directory-search', async (route) => {
    const { q } = route.request().postDataJSON();
    searches.push(q);
    const terms = q.toLowerCase().split(/\s+/);
    const results = ALUMNI.filter((a) => terms.every((t) => [a.name, a.nickname, a.batch, a.hospital, a.field, a.specialization].join(' ').toLowerCase().includes(t)))
      .map((a) => (officer ? a : Object.fromEntries(Object.entries(a).filter(([k]) => !CONTACT_FIELDS.includes(k)))));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, results, total: results.length, offset: 0, nextOffset: null, officer }) });
  });
  await page.route('**/api/admin-alumni', async (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, imported: 2, skipped: [] }) });
  });
  return { calls, searches, directTableReads };
}

async function search(page, term) {
  await page.fill('#directory-search', term);
  await page.press('#directory-search', 'Enter');
}

test.describe('Alumni directory', () => {
  test('nothing is listed (or downloaded) until a search is made', async ({ page }) => {
    const { searches, directTableReads } = await setup(page);
    await page.goto('/directory.html');
    await expect(page.locator('.member-card')).toHaveCount(0);
    expect(searches).toHaveLength(0);
    expect(directTableReads).toHaveLength(0);
    await search(page, 'santos');
    await expect(page.locator('.member-card')).toHaveCount(1);
    expect(directTableReads).toHaveLength(0);
  });

  for (const [label, term, expected] of [
    ['name', 'santos', 'Dr. Ben Santos'],
    ['nickname', 'annie', 'Dr. Ana Reyes'],
    ['batch', 'patent', 'Dr. Ben Santos'],
    ['hospital', 'makati', 'Dr. Ben Santos'],
    ['specialization', 'interventional', 'Dr. Ana Reyes'],
    ['several words', 'ana reyes koine', 'Dr. Ana Reyes'],
  ]) {
    test(`search matches ${label}`, async ({ page }) => {
      await setup(page);
      await page.goto('/directory.html');
      await search(page, term);
      await expect(page.locator('.member-card')).toHaveCount(1);
      await expect(page.locator('.member-name')).toHaveText(expected);
    });
  }

  test('names are escaped; members see limited details in the modal', async ({ page }) => {
    await setup(page);
    await page.goto('/directory.html');
    await search(page, 'dr.');
    await expect(page.locator('.member-card')).toHaveCount(3);
    await expect(page.locator('.member-card').nth(2)).toContainText('<b>Lim</b>');
    await page.locator('.member-card').first().click();
    const detail = page.locator('#alumni-modal #alumni-detail');
    await expect(detail).toContainText('Interventional Cardiology');
    await expect(detail).not.toContainText('ana@example.com');
    await expect(detail).not.toContainText('0917-111-2222');
    await expect(page.locator('#alumni-modal [data-action="edit-from-detail"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#alumni-modal')).toHaveCount(0);
  });

  test('officers see contact details in the modal', async ({ page }) => {
    await setup(page, { role: 'officer' });
    await page.goto('/directory.html');
    await search(page, 'annie');
    await page.locator('.member-card').first().click();
    await expect(page.locator('#alumni-modal #alumni-detail')).toContainText('ana@example.com');
    await expect(page.locator('#alumni-modal #alumni-detail')).toContainText('Mon 1-3pm');
  });

  test('regular members do not see alumni management controls', async ({ page }) => {
    await setup(page);
    await page.goto('/directory.html');
    await search(page, 'dr.');
    await expect(page.locator('.directory-admin-toolbar')).toBeHidden();
    await expect(page.locator('[data-action="edit-alumnus"]')).toHaveCount(0);
  });

  test('officers can add an alumnus', async ({ page }) => {
    const { calls } = await setup(page, { role: 'officer' });
    await page.goto('/directory.html');
    await expect(page.locator('.directory-admin-toolbar')).toBeVisible();
    await page.click('text=Add Alumnus');
    await page.fill('#al-full_name', 'Dr. New Brother');
    await page.fill('#al-batch', 'Trident');
    await page.click('#alumni-form button[type="submit"]');
    await expect(page.locator('#alumni-modal')).toHaveCount(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].action).toBe('create');
    expect(calls[0].alumnus.full_name).toBe('Dr. New Brother');
    expect(calls[0].alumnus.batch).toBe('Trident');
  });

  test('add requires a name', async ({ page }) => {
    const { calls } = await setup(page, { role: 'officer' });
    await page.goto('/directory.html');
    await page.click('text=Add Alumnus');
    await page.click('#alumni-form button[type="submit"]');
    await expect(page.locator('#directory-toast')).toContainText('Full name is required');
    expect(calls).toHaveLength(0);
  });

  test('officers can edit an alumnus from a search result, then the search refreshes', async ({ page }) => {
    const { calls, searches } = await setup(page, { role: 'officer' });
    await page.goto('/directory.html');
    await search(page, 'annie');
    await page.locator('[data-action="edit-alumnus"]').first().click();
    await expect(page.locator('#al-full_name')).toHaveValue('Dr. Ana Reyes');
    await expect(page.locator('#al-email')).toHaveValue('ana@example.com');
    await page.fill('#al-hospital', 'New Hospital');
    await page.click('#alumni-form button[type="submit"]');
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]).toMatchObject({ action: 'update', id: 1 });
    expect(calls[0].alumnus.hospital).toBe('New Hospital');
    await expect.poll(() => searches.length).toBe(2);
  });

  test('CSV import maps Excel-style headers and posts the rows', async ({ page }) => {
    const { calls } = await setup(page, { role: 'officer' });
    page.on('dialog', (d) => d.accept());
    await page.goto('/directory.html');
    const csv = [
      'Full Name,Nickname,Batch,Specialization,Hospital,Email,Other Emails,Contact Number,Birthday,Schedule,Is Deceased',
      '"Dr. Imp One","Uno","Koine","Cardiology","Hosp A","one@example.com","two@example.com","0917-000-0001","1970-01-01","Mon 1-3pm",""',
      '"Dr. Imp Two","","Patent","Surgery","Hosp B","","","","","","true"',
    ].join('\n');
    await page.evaluate(() => openImportModal());
    await page.setInputFiles('#import-file-input', { name: 'alumni.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.evaluate(() => handleImportReview());
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].action).toBe('import');
    expect(calls[0].rows).toHaveLength(2);
    expect(calls[0].rows[0]).toMatchObject({
      full_name: 'Dr. Imp One', nickname: 'Uno', batch: 'Koine', specialization: 'Cardiology', hospital: 'Hosp A',
      email: 'one@example.com', other_emails: 'two@example.com', mobile: '0917-000-0001', birthday: '1970-01-01', schedule: 'Mon 1-3pm',
    });
    expect(calls[0].rows[1].is_deceased).toBe('true');
    await expect(page.locator('#import-modal')).toHaveClass(/hidden/);
  });

  test('non-CSV import is rejected with a clear message and sends nothing', async ({ page }) => {
    const { calls } = await setup(page, { role: 'officer' });
    await page.goto('/directory.html');
    await page.evaluate(() => openImportModal());
    await page.setInputFiles('#import-file-input', { name: 'alumni.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('xlsx') });
    await page.evaluate(() => handleImportReview());
    await expect(page.locator('#directory-toast')).toContainText('.csv');
    expect(calls).toHaveLength(0);
  });
});
