const { test, expect } = require('@playwright/test');
const path = require('path');

const authPath = require.resolve('../netlify/functions/_lib/auth.js');
const fnPath = require.resolve('../netlify/functions/admin-alumni.js');

/** In-memory stand-in for the supabase-js calls admin-alumni makes. */
function fakeSupabase(rows) {
  const state = { rows: rows.map(r => ({ deleted_at: null, ...r })), inserts: [], updates: [] };
  let nextId = 1000;
  const client = {
    from() {
      let mode = 'select';
      let payload;
      let filterId = null;
      const q = {
        select() { return q; },
        is() { return q; },
        order() { return q; },
        range(from, to) { return Promise.resolve({ data: state.rows.slice(from, to + 1), error: null }); },
        insert(p) { mode = 'insert'; payload = p; return q; },
        update(p) { mode = 'update'; payload = p; return q; },
        eq(col, val) { filterId = val; return q; },
        then(resolve) {
          if (mode === 'insert') {
            const list = Array.isArray(payload) ? payload : [payload];
            list.forEach(r => state.rows.push({ id: nextId++, deleted_at: null, ...r }));
            state.inserts.push(...list);
          } else if (mode === 'update') {
            state.updates.push({ id: filterId, changes: payload });
          }
          resolve({ data: null, error: null });
        },
      };
      return q;
    },
  };
  return { client, state };
}

function loadHandler(supabase, role = 'officer') {
  const real = require(authPath);
  require.cache[authPath].exports = {
    ...real,
    requiredEnv: () => [],
    authenticate: async () => ({ member: { id: 1, role }, supabase }),
  };
  delete require.cache[fnPath];
  return require(fnPath).handler;
}

const call = (handler, body) => handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) }).then(r => ({ status: r.statusCode, body: JSON.parse(r.body) }));

test.afterEach(() => {
  delete require.cache[authPath];
  delete require.cache[fnPath];
});

test('import updates existing alumni (same name + batch) instead of duplicating', async () => {
  const { client, state } = fakeSupabase([{ id: 1, full_name: 'Dr. Ana Reyes', batch: '1985' }]);
  const handler = loadHandler(client);
  const res = await call(handler, {
    action: 'import',
    rows: [
      { full_name: 'dr. ana reyes', batch: '1985', hospital: 'New Hospital', email: '' },
      { full_name: 'Dr. New Person', batch: '2001' },
      { full_name: 'Dr. New Person', batch: '2001', hospital: 'Merged' },
      { full_name: '' },
    ],
  });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ created: 1, updated: 1, imported: 2 });
  expect(res.body.skipped).toHaveLength(1);
  expect(state.inserts).toHaveLength(1);
  expect(state.inserts[0]).toMatchObject({ full_name: 'Dr. New Person', hospital: 'Merged' });
  expect(state.updates).toHaveLength(1);
  expect(state.updates[0].id).toBe(1);
  expect(state.updates[0].changes.hospital).toBe('New Hospital');
  expect(state.updates[0].changes).not.toHaveProperty('email');
});

test('same name with a different batch is a different person', async () => {
  const { client, state } = fakeSupabase([{ id: 1, full_name: 'Dr. Ana Reyes', batch: '1985' }]);
  const res = await call(loadHandler(client), { action: 'import', rows: [{ full_name: 'Dr. Ana Reyes', batch: '1990' }] });
  expect(res.body).toMatchObject({ created: 1, updated: 0 });
  expect(state.inserts).toHaveLength(1);
});

test('import sanitizes roster fields (awards, deceased, birthday, member_no)', async () => {
  const { client, state } = fakeSupabase([]);
  const res = await call(loadHandler(client), {
    action: 'import',
    rows: [
      { full_name: 'A One', batch: 'Cosa Nostra', semester: '1st Semester 1973-1974', awards: 'Batch Leader', is_deceased: 'true', birthday: '1960-04-13', member_no: '37' },
      { full_name: 'B Two', batch: 'Cosa Nostra', is_deceased: '', birthday: '1960-02-31', member_no: 'abc' },
    ],
  });
  expect(res.status).toBe(200);
  expect(state.inserts[0]).toMatchObject({ awards: 'Batch Leader', is_deceased: true, birthday: '1960-04-13', member_no: 37 });
  expect(state.inserts[1]).toMatchObject({ is_deceased: false, birthday: null, member_no: null });
});

test('regular members are refused', async () => {
  const { client } = fakeSupabase([]);
  const res = await call(loadHandler(client, 'member'), { action: 'import', rows: [{ full_name: 'X' }] });
  expect(res.status).toBe(403);
});
