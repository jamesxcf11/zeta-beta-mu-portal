const { test, expect } = require('@playwright/test');
const { mockSupabase, makeMember, seedSession, seedAuthenticatedSession } = require('./fixtures/supabase-mock');

const ALUMNI = [
  { id: 1, full_name: 'Dr. Ana Reyes', nickname: 'Annie', batch: '1985', graduation_year: 1990, hospital: 'St. Luke\'s', field_of_medicine: 'Cardiology', specialization: 'Interventional Cardiology', email: 'ana@example.com', mobile: '0917-111-2222', telephone: null, address: 'Quezon City', facebook: null, instagram: null, avatar_url: null },
  { id: 2, full_name: 'Dr. Ben Santos', nickname: null, batch: '1992', graduation_year: null, hospital: 'Makati Medical', field_of_medicine: 'Pediatrics', specialization: null, email: null, mobile: null, telephone: null, address: null, facebook: null, instagram: null, avatar_url: null },
  { id: 3, full_name: 'Dr. Cara <b>Lim</b>', nickname: null, batch: '2001', graduation_year: 2001, hospital: null, field_of_medicine: 'Surgery', specialization: null, email: null, mobile: null, telephone: null, address: null, facebook: null, instagram: null, avatar_url: null },
];

async function setup(page, { role = 'member', rows = ALUMNI } = {}) {
  await mockSupabase(page, { member: makeMember({ role }) });
  await seedAuthenticatedSession(page, { role });
  const calls = [];
  await page.route('**/rest/v1/alumni**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
  await page.route('**/api/admin-alumni', async (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, imported: 2, skipped: [] }) });
  });
  return calls;
}

test.describe('Alumni directory', () => {
  test('renders alumni from the alumni table', async ({ page }) => {
    await setup(page);
    await page.goto('/directory.html');
    await expect(page.locator('.member-card')).toHaveCount(3);
    await expect(page.locator('#directory-count-text')).toContainText('3 of 3');
  });

  for (const [label, term, expected] of [
    ['name', 'santos', 'Dr. Ben Santos'],
    ['nickname', 'annie', 'Dr. Ana Reyes'],
    ['batch', '1992', 'Dr. Ben Santos'],
    ['hospital', 'makati', 'Dr. Ben Santos'],
    ['specialization', 'interventional', 'Dr. Ana Reyes'],
    ['email', 'ana@example', 'Dr. Ana Reyes'],
    ['contact number', '111-2222', 'Dr. Ana Reyes'],
  ]) {
    test(`search matches ${label}`, async ({ page }) => {
      await setup(page);
      await page.goto('/directory.html');
      await page.fill('#directory-search', term);
      await expect(page.locator('.member-card')).toHaveCount(1);
      await expect(page.locator('.member-name')).toHaveText(expected);
    });
  }

  test('alumni names are escaped and details open in a modal', async ({ page }) => {
    await setup(page);
    await page.goto('/directory.html');
    await expect(page.locator('.member-card').nth(2)).toContainText('<b>Lim</b>');
    await page.locator('.member-card').first().click();
    await expect(page.locator('#alumni-modal #alumni-detail')).toContainText('ana@example.com');
    await expect(page.locator('#alumni-modal [data-action="edit-from-detail"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#alumni-modal')).toHaveCount(0);
  });

  test('regular members do not see alumni management controls', async ({ page }) => {
    await setup(page);
    await page.goto('/directory.html');
    await expect(page.locator('.directory-admin-toolbar')).toBeHidden();
    await expect(page.locator('[data-action="edit-alumnus"]')).toHaveCount(0);
  });

  test('officers can add an alumnus', async ({ page }) => {
    const calls = await setup(page, { role: 'officer' });
    await page.goto('/directory.html');
    await expect(page.locator('.directory-admin-toolbar')).toBeVisible();
    await page.click('text=Add Alumnus');
    await page.fill('#al-full_name', 'Dr. New Brother');
    await page.fill('#al-batch', '2010');
    await page.click('#alumni-form button[type="submit"]');
    await expect(page.locator('#alumni-modal')).toHaveCount(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].action).toBe('create');
    expect(calls[0].alumnus.full_name).toBe('Dr. New Brother');
    expect(calls[0].alumnus.batch).toBe('2010');
  });

  test('add requires a name', async ({ page }) => {
    const calls = await setup(page, { role: 'officer' });
    await page.goto('/directory.html');
    await page.click('text=Add Alumnus');
    await page.click('#alumni-form button[type="submit"]');
    await expect(page.locator('#directory-toast')).toContainText('Full name is required');
    expect(calls).toHaveLength(0);
  });

  test('officers can edit an alumnus from the card', async ({ page }) => {
    const calls = await setup(page, { role: 'officer' });
    await page.goto('/directory.html');
    await page.locator('[data-action="edit-alumnus"]').first().click();
    await expect(page.locator('#al-full_name')).toHaveValue('Dr. Ana Reyes');
    await page.fill('#al-hospital', 'New Hospital');
    await page.click('#alumni-form button[type="submit"]');
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]).toMatchObject({ action: 'update', id: 1 });
    expect(calls[0].alumnus.hospital).toBe('New Hospital');
  });

  test('CSV import maps Excel-style headers and posts the rows', async ({ page }) => {
    const calls = await setup(page, { role: 'officer' });
    page.on('dialog', (d) => d.accept());
    await page.goto('/directory.html');
    const csv = [
      'Full Name,Nickname,Batch,Specialization,Hospital,Email,Contact Number,Birthday',
      '"Dr. Imp One","Uno","1999","Cardiology","Hosp A","one@example.com","0917-000-0001","1970-01-01"',
      '"Dr. Imp Two","","2003","Surgery","Hosp B","","",""',
    ].join('\n');
    await page.evaluate(() => openImportModal());
    await page.setInputFiles('#import-file-input', { name: 'alumni.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.evaluate(() => handleImportReview());
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].action).toBe('import');
    expect(calls[0].rows).toHaveLength(2);
    expect(calls[0].rows[0]).toMatchObject({
      full_name: 'Dr. Imp One', nickname: 'Uno', batch: '1999', graduation_year: '1999',
      specialization: 'Cardiology', hospital: 'Hosp A', email: 'one@example.com', mobile: '0917-000-0001',
    });
    await expect(page.locator('#import-modal')).toHaveClass(/hidden/);
  });

  test('non-CSV import is rejected with a clear message and sends nothing', async ({ page }) => {
    const calls = await setup(page, { role: 'officer' });
    await page.goto('/directory.html');
    await page.evaluate(() => openImportModal());
    await page.setInputFiles('#import-file-input', { name: 'alumni.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('xlsx') });
    await page.evaluate(() => handleImportReview());
    await expect(page.locator('#directory-toast')).toContainText('.csv');
    expect(calls).toHaveLength(0);
  });

  test('falls back to portal members when the alumni table is empty', async ({ page }) => {
    await setup(page, { rows: [] });
    await page.goto('/directory.html');
    await expect(page.locator('.member-card')).toHaveCount(1);
    await expect(page.locator('.member-name')).toHaveText('Dr. Test Member');
  });
});
