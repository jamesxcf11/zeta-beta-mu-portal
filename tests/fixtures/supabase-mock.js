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
    preferences: {},
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
async function mockSupabase(page, { member = makeMember(), authError = null, vaultItems = makeVaultItems(), settings = null } = {}) {
  let profile = {
    id: member.id,
    username: member.username,
    email: member.email,
    firstName: member.first_name || '',
    middleName: member.middle_name || '',
    lastName: member.last_name || '',
    name: member.name,
    nickname: member.nickname || '',
    birthday: member.birthday || '',
    graduationYear: member.graduation_year || '',
    hospital: member.hospital || '',
    field: member.field_of_medicine || '',
    medicalLicense: member.medical_license || '',
    specialization: member.specialization || '',
    batch: member.batch || '',
    bio: member.bio || '',
    avatarUrl: member.avatar_url || '',
    phone: member.phone || '',
    mobile: member.mobile || '',
    telephone: member.telephone || '',
    homePhone: member.home_phone || '',
    facebook: member.facebook || '',
    instagram: member.instagram || '',
    address: member.address || '',
    role: member.role,
    status: member.status,
  };

  await page.route('**/api/profile**', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile }) });
    }
    if (route.request().method() === 'PATCH') {
      const updates = route.request().postDataJSON();
      profile = {
        ...profile,
        ...updates,
        name: [updates.firstName ?? profile.firstName, updates.middleName ?? profile.middleName, updates.lastName ?? profile.lastName].filter(Boolean).join(' '),
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile }) });
    }
    return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Method not allowed' }) });
  });

  // --- Settings: /api/settings (Netlify Function) ---
  let memberSettings = settings || {
    notifications: { reactions: true, comments: true, announcements: true },
    privacy: { showOnCalendar: false, showAge: false, hasBirthday: !!member.birthday },
  };
  await page.route('**/api/settings**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: memberSettings }) });
    }
    if (method === 'PATCH') {
      const updates = route.request().postDataJSON();
      memberSettings = {
        notifications: { ...memberSettings.notifications, ...(updates.notifications || {}) },
        privacy: { ...memberSettings.privacy, ...(updates.privacy || {}) },
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: memberSettings }) });
    }
    return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Method not allowed' }) });
  });

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

  // --- Auth: update user (password change on the settings page) ---
  await page.route('**/auth/v1/user**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'mock-user-id', email: member.email }),
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
        const created = { id: Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        const body = JSON.stringify(isSingle ? created : [created]);
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body,
        });
      }
      if (method === 'PATCH') {
        const updated = {
          id: Number(new URL(route.request().url()).searchParams.get('id')?.replace('eq.', '')) || 1,
          ...route.request().postDataJSON(),
          updated_at: new Date(Date.now() + 1000).toISOString(),
        };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updated) });
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
      // PostgREST returns a single object (not an array) when the client
      // requested one via .single() — mirror that so data.id resolves.
      const isSingle = route.request().headers()['accept'] === 'application/vnd.pgrst.object+json';
      const created = { id: Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const body = JSON.stringify(isSingle ? created : [created]);
      return route.fulfill({ status: 201, contentType: 'application/json', body });
    }
    if (method === 'PATCH') {
      const updated = {
        id: Number(new URL(route.request().url()).searchParams.get('id')?.replace('eq.', '')) || 1,
        ...route.request().postDataJSON(),
        updated_at: new Date(Date.now() + 1000).toISOString(),
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updated) });
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
    const request = route.request().postDataJSON();
    const fileKey = request.scope === 'profile'
      ? 'profiles/1/mock.webp'
      : request.scope === 'post' ? 'posts/1/mock.webp' : 'vault/mock/mock.webp';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        uploadUrl: 'https://mock-r2.example.com/put',
        publicUrl: `https://media.zetabetamu.com/${fileKey}`,
        fileKey,
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

async function seedAuthenticatedSession(page, overrides = {}) {
  const session = await seedSession(page, overrides);
  await page.addInitScript((member) => {
    window.localStorage.setItem('zbm-auth', JSON.stringify({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: 'mock-user-id',
        email: member.email,
        aud: 'authenticated',
        role: 'authenticated',
      },
    }));
  }, session);
  return session;
}

module.exports = { mockSupabase, makeMember, makeVaultItems, seedSession, seedAdminSession, seedAuthenticatedSession, SUPABASE_HOST_GLOB };
