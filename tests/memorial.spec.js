const { test, expect } = require('@playwright/test');
const { mockSupabase, makeMember, seedSession } = require('./fixtures/supabase-mock');

const BROTHERS = [
  { id: 2, full_name: 'Dr. Antonio L. Cruz', nickname: null, batch: '1973', specialty: 'Neurosurgery', birth_year: 1948, death_year: 2022, tribute: 'A brilliant surgeon and mentor.', photo_url: null },
  { id: 3, full_name: 'Dr. Manuel P. Reyes', nickname: 'Manny', batch: '1975', specialty: 'Pediatrics', birth_year: 1950, death_year: 2021, tribute: 'A gentle spirit.', photo_url: 'https://media.zetabetamu.com/memorials/x.webp' },
];

/**
 * Stateful PostgREST mock for memorials + memorial_comments.
 * Registered after mockSupabase() so it takes precedence over the catch-all.
 */
async function mockMemorials(page, { brothers = BROTHERS, comments = [], failPost = false } = {}) {
  const state = { comments: [...comments], posted: [], deleted: [] };

  await page.route('**/rest/v1/memorials**', async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fulfill({ status: 204, body: '' });
    const idParam = new URL(req.url()).searchParams.get('id');
    const rows = idParam ? brothers.filter(b => `eq.${b.id}` === idParam) : brothers;
    const single = (req.headers()['accept'] || '').includes('pgrst.object');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(single ? (rows[0] || null) : rows),
    });
  });

  await page.route('**/rest/v1/memorial_comments**', async (route) => {
    const req = route.request();
    const single = (req.headers()['accept'] || '').includes('pgrst.object');
    if (req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.comments) });
    }
    if (req.method() === 'POST') {
      if (failPost) {
        return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'denied' }) });
      }
      const body = req.postDataJSON();
      state.posted.push(body);
      const created = { id: Date.now(), created_at: new Date().toISOString(), ...body };
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(single ? created : [created]) });
    }
    if (req.method() === 'DELETE') {
      const id = Number(new URL(req.url()).searchParams.get('id').replace('eq.', ''));
      state.deleted.push(id);
      state.comments = state.comments.filter(c => c.id !== id);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  return state;
}

const comment = (overrides = {}) => ({
  id: 500,
  member_id: 1,
  content: 'Rest well, brother.',
  created_at: new Date().toISOString(),
  members: { name: 'Dr. Test Member', avatar_url: 'image/placeholders/avatars/a11.jpg' },
  ...overrides,
});

test.describe('In Memoriam list (memoriam.html)', () => {
  test('renders a shrine card per memorial and links to its page', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await mockMemorials(page);
    await page.goto('/memoriam.html');
    await expect(page.locator('.memoriam-card')).toHaveCount(2);
    await expect(page.locator('.memoriam-name').first()).toHaveText('Dr. Antonio L. Cruz');
    await expect(page.locator('.memoriam-dates').first()).toContainText('1948');
    await page.locator('.memoriam-card-link[href="memorial.html?id=3"]').click();
    await page.waitForURL('**/memorial.html?id=3');
    await expect(page.locator('.memorial-name')).toHaveText('Dr. Manuel P. Reyes');
  });

  test('shows an empty state when there are no memorials', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await mockMemorials(page, { brothers: [] });
    await page.goto('/memoriam.html');
    await expect(page.locator('.empty-state')).toContainText('No brothers have been added');
  });
});

test.describe('Memorial detail (memorial.html)', () => {
  test('loads the brother selected on the memoriam page', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await mockMemorials(page);
    await page.goto('/memorial.html?id=2');
    await expect(page.locator('.memorial-name')).toHaveText('Dr. Antonio L. Cruz');
    await expect(page).toHaveTitle(/Dr\. Antonio L\. Cruz/);
  });

  test('unknown memorial shows a not-found message', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await mockMemorials(page);
    await page.goto('/memorial.html?id=999');
    await expect(page.locator('.memorial-name')).toHaveText('Memorial not found');
  });

  test('logged-out visitors see a login prompt instead of the composer', async ({ page }) => {
    await mockSupabase(page);
    await mockMemorials(page);
    await page.goto('/memorial.html?id=2');
    await expect(page.locator('#memorial-login-prompt')).toBeVisible();
    await expect(page.locator('#post-tribute-btn')).toHaveCount(0);
  });

  test('a member can leave a message and it is saved', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    const state = await mockMemorials(page);
    await page.goto('/memorial.html?id=2');
    await expect(page.locator('#memorial-no-comments')).toBeVisible();

    await page.fill('#tribute-input', 'Thank you for your mentorship');
    await page.click('#post-tribute-btn');

    await expect(page.locator('.memorial-tribute-text')).toHaveText('Thank you for your mentorship');
    await expect(page.locator('#tribute-input')).toHaveValue('');
    expect(state.posted).toEqual([{ memorial_id: 2, member_id: 1, content: 'Thank you for your mentorship' }]);
  });

  test('empty message is rejected with a message', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    const state = await mockMemorials(page);
    await page.goto('/memorial.html?id=2');
    await page.click('#post-tribute-btn');
    await expect(page.locator('#memorial-toast')).toContainText('write something');
    expect(state.posted).toHaveLength(0);
  });

  test('a failed save reports an error and keeps nothing on the wall', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await mockMemorials(page, { failPost: true });
    await page.goto('/memorial.html?id=2');
    await page.fill('#tribute-input', 'Will not save');
    await page.click('#post-tribute-btn');
    await expect(page.locator('#memorial-toast')).toContainText('Could not post');
    await expect(page.locator('.memorial-tribute')).toHaveCount(0);
  });

  test('authors can delete their own message but not others', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    const state = await mockMemorials(page, {
      comments: [comment({ id: 500 }), comment({ id: 501, member_id: 7, content: 'From someone else', members: { name: 'Dr. Other', avatar_url: null } })],
    });
    await page.goto('/memorial.html?id=2');
    await expect(page.locator('.memorial-tribute')).toHaveCount(2);
    await expect(page.locator('[data-action="delete-comment"]')).toHaveCount(1);

    page.once('dialog', (d) => d.accept());
    await page.click('[data-action="delete-comment"]');
    await expect(page.locator('.memorial-tribute')).toHaveCount(1);
    expect(state.deleted).toEqual([500]);
  });

  test('officers can delete any message', async ({ page }) => {
    await mockSupabase(page, { member: makeMember({ role: 'officer' }) });
    await seedSession(page, { role: 'officer' });
    await mockMemorials(page, {
      comments: [comment({ id: 501, member_id: 7, content: 'From someone else', members: { name: 'Dr. Other', avatar_url: null } })],
    });
    await page.goto('/memorial.html?id=2');
    await expect(page.locator('[data-action="delete-comment"]')).toHaveCount(1);
  });

  test('message text is escaped', async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page);
    await mockMemorials(page, { comments: [comment({ content: '<img src=x onerror=window.__xss=1>' })] });
    await page.goto('/memorial.html?id=2');
    await expect(page.locator('.memorial-tribute-text')).toHaveText('<img src=x onerror=window.__xss=1>');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });
});
