const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'memorials.json'), 'utf8'));

test.describe('data/memorials.json (client In Memoriam list)', () => {
  test('has all 73 brothers with unique names', () => {
    expect(rows).toHaveLength(73);
    const names = rows.map(r => r.full_name.toLowerCase());
    expect(new Set(names).size).toBe(73);
    rows.forEach(r => expect(r.full_name.trim()).toBeTruthy());
  });

  test('is ordered earliest to latest and sort_order puts the most recent first', () => {
    expect(rows[0].full_name).toBe('Herman L. Dy');
    expect(rows.slice(-3).map(r => r.full_name)).toEqual(['David Salom Jr.', 'Gumersindo Garcia III', 'Emilio Hernandez Jr.']);
    const orders = rows.map(r => r.sort_order);
    expect(orders).toEqual([...orders].sort((a, b) => b - a));
    expect(rows[rows.length - 1].sort_order).toBe(0);
  });

  test('the three 2026 brothers have the dates the client supplied', () => {
    const last = Object.fromEntries(rows.slice(-3).map(r => [r.full_name, [r.birth_year, r.death_year]]));
    expect(last).toEqual({
      'David Salom Jr.': [1952, 2026],
      'Gumersindo Garcia III': [1964, 2026],
      'Emilio Hernandez Jr.': [1950, 2026],
    });
  });

  test('years are plausible and batch names carry no "Batch" prefix', () => {
    rows.forEach(r => {
      if (r.birth_year && r.death_year) expect(r.death_year).toBeGreaterThan(r.birth_year);
      if (r.death_year) expect(r.death_year).toBeLessThanOrEqual(2026);
      if (r.batch) expect(r.batch).not.toMatch(/^batch\s/i);
    });
  });

  test('names are stored without the display title', () => {
    rows.forEach(r => expect(r.full_name).not.toMatch(/^(patrix|dr\.?)\s/i));
  });

  test('generated seed SQL matches the data file', () => {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'seed-memorials.sql'), 'utf8');
    expect((sql.match(/^  \('/gm) || [])).toHaveLength(73);
    expect(sql).toContain("ON CONFLICT (lower(full_name)) WHERE deleted_at IS NULL DO UPDATE");
    expect(sql).not.toMatch(/photo_url\s*=\s*EXCLUDED/);
  });
});
