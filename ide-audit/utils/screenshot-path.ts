import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_ROOT = path.resolve(__dirname, '..', 'audit-screenshots');

/**
 * Returns a structured file path for an audit screenshot.
 *
 * Directory structure:
 *   ./audit-screenshots/[section]/[page]/[theme]_[state].png
 *
 * Example: ./audit-screenshots/layout/landing/dark_default.png
 *
 * Also ensures the parent directory exists.
 */
export function getScreenshotPath(
  section: string,
  page: string,
  state: string,
  theme: string,
): string {
  const dir = path.join(SCREENSHOT_ROOT, section, page);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${theme}_${state}.png`;
  return path.join(dir, filename);
}

/**
 * Convenience wrapper that returns the path *relative* to the project root,
 * which is useful for logging.
 */
export function getScreenshotRelPath(
  section: string,
  page: string,
  state: string,
  theme: string,
): string {
  const abs = getScreenshotPath(section, page, state, theme);
  return path.relative(path.resolve(__dirname, '..'), abs);
}
