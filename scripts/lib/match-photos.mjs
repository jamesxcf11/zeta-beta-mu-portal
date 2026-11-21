/**
 * Matches photo filenames to memorial names. Pure functions, no I/O.
 *
 * A photo matches a memorial when the file name contains the memorial's first
 * AND last name (initials, titles, suffixes and punctuation are ignored), e.g.
 * "Patrix Dr. Herman Dy.jpg" -> "Herman L. Dy".
 */

const IGNORE = new Set(['patrix', 'dr', 'doc', 'doctor', 'jr', 'sr', 'ii', 'iii', 'iv', 'photo', 'img', 'image', 'final', 'web', 'copy']);

export function tokens(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .split(/[^a-z]+/)
    .filter(t => t.length > 1 && !IGNORE.has(t));
}

function nameKeys(fullName) {
  const t = tokens(fullName);
  return t.length >= 2 ? [t[0], t[t.length - 1]] : t;
}

/**
 * @param {string[]} files  file names (not paths)
 * @param {{id:number, full_name:string}[]} memorials
 * @returns {{matched: {file:string, memorial:object}[], unmatched:string[], ambiguous:{file:string, candidates:string[]}[], missing:object[]}}
 */
export function matchPhotos(files, memorials) {
  const candidatesByFile = new Map();
  for (const file of files) {
    const fileTokens = new Set(tokens(file));
    const hits = memorials.filter(m => nameKeys(m.full_name).every(k => fileTokens.has(k)));
    candidatesByFile.set(file, hits);
  }

  const filesByMemorial = new Map();
  for (const [file, hits] of candidatesByFile) {
    if (hits.length === 1) {
      const list = filesByMemorial.get(hits[0].id) || [];
      list.push(file);
      filesByMemorial.set(hits[0].id, list);
    }
  }

  const matched = [];
  const unmatched = [];
  const ambiguous = [];
  for (const [file, hits] of candidatesByFile) {
    if (hits.length === 0) unmatched.push(file);
    else if (hits.length > 1) ambiguous.push({ file, candidates: hits.map(h => h.full_name) });
    else if (filesByMemorial.get(hits[0].id).length > 1) ambiguous.push({ file, candidates: [`${hits[0].full_name} (several files match)`] });
    else matched.push({ file, memorial: hits[0] });
  }

  const matchedIds = new Set(matched.map(m => m.memorial.id));
  const missing = memorials.filter(m => !matchedIds.has(m.id));
  return { matched, unmatched, ambiguous, missing };
}
