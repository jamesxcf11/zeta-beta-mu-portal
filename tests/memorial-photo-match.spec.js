const { test, expect } = require('@playwright/test');

const memorials = [
  { id: 1, full_name: 'Herman L. Dy' },
  { id: 2, full_name: 'Michael M. Mendoza' },
  { id: 3, full_name: 'Victor Mendoza' },
  { id: 4, full_name: 'Joel Tañedo' },
  { id: 5, full_name: 'Poderoso B. Casuela Jr.' },
];

test('photo filenames are matched to memorials by first and last name', async () => {
  const { matchPhotos } = await import('../scripts/lib/match-photos.mjs');
  const files = ['Patrix Dr. Herman Dy.jpg', 'mendoza_michael.PNG', 'Joel Tanedo.jpeg', 'Casuela, Poderoso Jr.webp', 'Mendoza.jpg', 'unknown person.jpg'];
  const result = matchPhotos(files, memorials);

  const byFile = Object.fromEntries(result.matched.map(m => [m.file, m.memorial.full_name]));
  expect(byFile).toEqual({
    'Patrix Dr. Herman Dy.jpg': 'Herman L. Dy',
    'mendoza_michael.PNG': 'Michael M. Mendoza',
    'Joel Tanedo.jpeg': 'Joel Tañedo',
    'Casuela, Poderoso Jr.webp': 'Poderoso B. Casuela Jr.',
  });
  expect(result.unmatched.sort()).toEqual(['Mendoza.jpg', 'unknown person.jpg']);
  expect(result.missing.map(m => m.full_name)).toEqual(['Victor Mendoza']);
});

test('two files for the same brother are reported as ambiguous, not guessed', async () => {
  const { matchPhotos } = await import('../scripts/lib/match-photos.mjs');
  const result = matchPhotos(['herman dy 1.jpg', 'herman dy 2.jpg'], memorials);
  expect(result.matched).toHaveLength(0);
  expect(result.ambiguous).toHaveLength(2);
});
