const { test, expect } = require('@playwright/test');

const authPath = require.resolve('../netlify/functions/_lib/auth.js');
const fnPath = require.resolve('../netlify/functions/directory-search.js');

const ROWS = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1, full_name: `Person ${i + 1}`, last_name: `Person${i + 1}`, nickname: 'Nick', batch: 'Koine', hospital: 'St. Luke\'s',
  specialization: 'Surgery', field_of_medicine: 'Surgery', intl_location: null, avatar_url: null, is_deceased: false, is_retired: false,
  email: `p${i + 1}@example.com`, mobile: '0917-000-0000', address: 'Secret St.', birthday: '1960-01-01', schedule: 'MWF', deleted_at: null,
}));

/** Records the query chain the function builds. */
function fakeSupabase() {
  const calls = { select: null, ilike: [], range: null, isFilters: [] };
  const q = {
    select(cols, opts) { calls.select = { cols, opts }; return q; },
    is(col, val) { calls.isFilters.push([col, val]); return q; },
    ilike(col, pattern) { calls.ilike.push([col, pattern]); return q; },
    order() { return q; },
    range(from, to) {
      calls.range = [from, to];
      return Promise.resolve({ data: ROWS.slice(from, to + 1), error: null, count: ROWS.length });
    },
  };
  return { client: { from: () => q }, calls };
}

function loadHandler(supabase, role = 'member', id = 1) {
  const real = require(authPath);
  require.cache[authPath].exports = {
    ...real,
    requiredEnv: () => [],
    authenticate: async () => ({ member: { id, role }, supabase }),
  };
  delete require.cache[fnPath];
  return require(fnPath).handler;
}

const call = (handler, body, method = 'POST') => handler({ httpMethod: method, headers: {}, body: JSON.stringify(body) }).then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) }));

test.afterEach(() => {
  delete require.cache[authPath];
  delete require.cache[fnPath];
});

test('requires a login (authentication errors are passed through)', async () => {
  const real = require(authPath);
  require.cache[authPath].exports = {
    ...real,
    requiredEnv: () => [],
    authenticate: async () => ({ error: { statusCode: 401, headers: {}, body: JSON.stringify({ error: 'Missing Authorization bearer token' }) } }),
  };
  delete require.cache[fnPath];
  const res = await call(require(fnPath).handler, { q: 'abad' });
  expect(res.status).toBe(401);
});

test('only POST is allowed', async () => {
  const { client } = fakeSupabase();
  expect((await call(loadHandler(client), {}, 'GET')).status).toBe(405);
});

test('rejects searches shorter than 2 characters and never touches the database', async () => {
  const { client, calls } = fakeSupabase();
  const handler = loadHandler(client);
  for (const q of ['', ' ', 'a', ' a ', undefined, 42]) {
    const res = await call(handler, { q });
    expect(res.status).toBe(400);
  }
  expect(calls.select).toBeNull();
});

test('members get limited fields only (no contact details, birthday or schedule)', async () => {
  const { client, calls } = fakeSupabase();
  const res = await call(loadHandler(client, 'member'), { q: 'person' });
  expect(res.status).toBe(200);
  expect(res.body.officer).toBe(false);
  expect(calls.select.cols).not.toMatch(/email|mobile|address|birthday|schedule/);
  const first = res.body.results[0];
  expect(first).toMatchObject({ name: 'Person 1', batch: 'Koine', hospital: 'St. Luke\'s' });
  for (const key of ['email', 'mobile', 'address', 'birthday', 'schedule', 'telephone']) expect(first).not.toHaveProperty(key);
});

test('officers and admins also get contact details', async () => {
  for (const role of ['officer', 'admin']) {
    const { client, calls } = fakeSupabase();
    const res = await call(loadHandler(client, role), { q: 'person' });
    expect(res.body.officer).toBe(true);
    expect(calls.select.cols).toMatch(/email/);
    expect(res.body.results[0]).toMatchObject({ email: 'p1@example.com', mobile: '0917-000-0000', address: 'Secret St.', birthday: '1960-01-01' });
  }
});

test('pages of 25 with a next offset, and excludes deleted rows', async () => {
  const { client, calls } = fakeSupabase();
  const handler = loadHandler(client);
  const first = await call(handler, { q: 'person' });
  expect(first.body.results).toHaveLength(25);
  expect(first.body.total).toBe(30);
  expect(first.body.nextOffset).toBe(25);
  expect(calls.isFilters).toContainEqual(['deleted_at', null]);

  const second = await call(handler, { q: 'person', offset: 25 });
  expect(second.body.results).toHaveLength(5);
  expect(second.body.nextOffset).toBeNull();
  expect(calls.range).toEqual([25, 49]);
});

test('every word must match, and LIKE wildcards in the query are escaped', async () => {
  const { client, calls } = fakeSupabase();
  await call(loadHandler(client), { q: '100%_Abad\\ Núñez' });
  const patterns = calls.ilike.map(([, p]) => p);
  expect(patterns).toEqual(['%100\\%\\_abad\\\\%', '%nunez%']);
});

test('specialty filter adds a term; unknown specialties are ignored', async () => {
  const a = fakeSupabase();
  await call(loadHandler(a.client), { q: 'abad', specialty: 'Cardiology' });
  expect(a.calls.ilike.map(([, p]) => p)).toEqual(['%abad%', '%cardi%']);
  const b = fakeSupabase();
  await call(loadHandler(b.client), { q: 'abad', specialty: "x'; DROP TABLE alumni;--" });
  expect(b.calls.ilike.map(([, p]) => p)).toEqual(['%abad%']);
});

test('caps the number of words and the offset', async () => {
  const { client, calls } = fakeSupabase();
  await call(loadHandler(client), { q: 'a1 b2 c3 d4 e5 f6 g7 h8', offset: 999999 });
  expect(calls.ilike).toHaveLength(6);
  expect(calls.range[0]).toBe(5000);
});

test('rate limits a member who searches too fast', async () => {
  const { client } = fakeSupabase();
  const handler = loadHandler(client, 'member', 777);
  let last;
  for (let i = 0; i < 45; i++) last = await call(handler, { q: 'abad' });
  expect(last.status).toBe(429);
});
