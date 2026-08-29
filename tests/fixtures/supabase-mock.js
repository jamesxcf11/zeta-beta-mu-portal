/**
 * Shared Supabase network-mocking helpers for Playwright tests.
 *
 * The app (js/auth.js, js/feed.js, js/directory.js, js/vault.js, js/admin.js)
 * talks directly to Supabase's REST endpoints via the supabase-js client
 * (https://<project>.supabase.co/rest/v1/... and /auth/v1/...).
 *
 * These helpers intercept those requests so tests never touch the live
 * production database, and so we can deterministically simulate success,
 * empty, and error responses.
 */

const SUPABASE_HOST_GLOB = '**/*.supabase.co/**';

/** Fixture member row shaped like the `members` table. */
function makeMember(overrides = {}) {
  return {
    id: 1,
    username: 'testmember',
    email: 'testmember@example.com',
    name: 'Dr. Test Member',
    first_name: 'Test',
    last_name: 'Member',
    role: 'member',
    status: 'active',
    graduation_year: 2010,
    hospital: 'Test Hospital',
    field_of_medicine: 'Cardiology',
    avatar_url: 'image/placeholders/avatars/a11.jpg',
    deleted_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Fixture vault_items rows with R2 keys, shaped like the table. */
function makeVaultItems() {
  return [
    {
      id: 101,
      album_id: 'test-album-2025',
      year: 2025,
      title: 'Test Charity Mission 2025',
      caption: 'Fraternity members at the mission',
      media_url: 'https://media.zetabetamu.com/vault/test-album-2025/aaa.webp',
      thumbnail_url: 'https://media.zetabetamu.com/vault/test-album-2025/thumbs/aaa.webp',
      file_key: 'vault/test-album-2025/aaa.webp',
      thumb_key: 'vault/test-album-2025/thumbs/aaa.webp',
      category: 'charity_mission',
      event_date: '2025-12-15',
      location: 'Test School',
      is_featured: false,
      is_public: true,
    },
    {
      id: 102,
      album_id: 'test-album-2025',
      year: 2025,
      title: 'Test Charity Mission 2025',
      caption: 'Group photo with students',
      media_url: 'https://media.zetabetamu.com/vault/test-album-2025/bbb.webp',
      thumbnail_url: 'https://media.zetabetamu.com/vault/test-album-2025/thumbs/bbb.webp',
      file_key: 'vault/test-album-2025/bbb.webp',
      thumb_key: 'vault/test-album-2025/thumbs/bbb.webp',
      category: 'charity_mission',
      event_date: '2025-12-15',
      location: 'Test School',
      is_featured: false,
      is_public: true,
    },
  ];
}

/**
 * Install a baseline set of Supabase route mocks covering auth + all
 * `members`/`posts`/`announcements`/`vault_items` reads used across pages.
 * Individual tests can call `page.route()` again afterwards (Playwright
 * uses last-registered-first-matched) to override specific behavior.
 */
async function mockSupabase(page, { member = makeMember(), authError = null, vaultItems = makeVaultItems() } = {}) {
  // --- Auth: sign in ---
  await page.route('**/auth/v1/token**', async (route) => {
    if (authError) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: authError }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: { id: 'mock-user-id', email: member.email },
      }),
    });
  });

  // --- Auth: sign up ---
  await page.route('**/auth/v1/signup**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'mock-new-user-id', email: member.email },
        session: null,
      }),
    });
  });

  // --- REST: members table ---
  await page.route('**/rest/v1/members**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET') {
      const isSingle = request.headers()['accept'] === 'application/vnd.pgrst.object+json';
      const body = isSingle || url.searchParams.get('select')?.includes('email, status')
        ? JSON.stringify(member)
        : JSON.stringify([member]);
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    }
    if (method === 'POST') {
      const isSingle = request.headers()['accept'] === 'application/vnd.pgrst.object+json';
      const body = isSingle
        ? JSON.stringify({ ...member, id: Date.now() })
        : JSON.stringify([{ ...member, id: Date.now() }]);
      return route.fulfill({ status: 201, contentType: 'application/json', body });
    }
    if (method === 'PATCH') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([member]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  // --- REST: posts / reactions / comments / announcements / events ---
  const emptyTables = [
    'posts', 'post_reactions', 'comments', 'announcements',
    'events', 'birthdays', 'birthday_calendar',
  ];
  for (const table of emptyTables) {
    await page.route(`**/rest/v1/${table}**`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      if (method === 'POST') {
        const isSingle = route.request().headers()['accept'] === 'application/vnd.pgrst.object+json';
        const body = isSingle
          ? JSON.stringify({ id: Date.now() })
          : JSON.stringify([{ id: Date.now() }]);
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body,
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }

  // Catch-all: any other Supabase REST table not explicitly mocked above.
  await page.route('**/rest/v1/**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (method === 'POST') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ id: Date.now() }]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  // --- REST: vault_items (registered AFTER catch-all so it takes precedence) ---
  await page.route('**/rest/v1/vault_items**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vaultItems) });
    }
    if (method === 'POST') {
      const isSingle = route.request().headers()['accept'] === 'application/vnd.pgrst.object+json';
      const body = isSingle
        ? JSON.stringify({ id: Date.now() })
        : JSON.stringify([{ id: Date.now() }]);
      return route.fulfill({ status: 201, contentType: 'application/json', body });
    }
    if (method === 'PATCH') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vaultItems) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  // --- Mock R2 upload presign endpoint (Netlify Function) ---
  await page.route('**/api/upload-url**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        uploadUrl: 'https://mock-r2.example.com/put',
        publicUrl: 'https://media.zetabetamu.com/mock/mock.webp',
        fileKey: 'mock/mock.webp',
        expiresIn: 300,
      }),
    });
  });

  // --- Mock R2 delete endpoint (Netlify Function) ---
  await page.route('**/api/delete-object**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ deleted: 1 }),
    });
  });

  // --- Mock the actual R2 PUT (presigned URL upload) ---
  await page.route('https://mock-r2.example.com/put', async (route) => {
    return route.fulfill({ status: 200 });
  });
}

/** Seed a fake logged-in session in localStorage before navigation. */
async function seedSession(page, overrides = {}) {
  const session = {
    id: 1,
    username: 'testmember',
    name: 'Dr. Test Member',
    email: 'testmember@example.com',
    role: 'member',
    avatar: 'image/placeholders/avatars/a11.jpg',
    graduationYear: 2010,
    hospital: 'Test Hospital',
    field: 'Cardiology',
    loginTime: new Date().toISOString(),
    ...overrides,
  };
  await page.addInitScript((s) => {
    window.localStorage.setItem('zbm-session', JSON.stringify(s));
  }, session);
  return session;
}

async function seedAdminSession(page) {
  return seedSession(page, { role: 'admin', name: 'Dr. James Anderson', username: 'admin' });
}

module.exports = { mockSupabase, makeMember, makeVaultItems, seedSession, seedAdminSession, SUPABASE_HOST_GLOB };
