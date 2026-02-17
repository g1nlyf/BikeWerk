/**
 * CANONICAL DATABASE PATH
 * Single source of truth for the database location.
 * All modules MUST import from here.
 */
const path = require('path');
const fs = require('fs');

const envPath = process.env.DB_PATH;
const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..');

function resolveDbPath(inputPath) {
  if (!inputPath) return path.resolve(backendRoot, 'database/eubike.db');
  if (path.isAbsolute(inputPath)) return inputPath;

  const normalized = String(inputPath).replace(/^\.\/?/, '').replace(/\\/g, '/');
  if (
    normalized === 'database/eubike.db' ||
    normalized.endsWith('/database/eubike.db') ||
    normalized.endsWith('backend/database/eubike.db')
  ) {
    return path.resolve(backendRoot, 'database/eubike.db');
  }
  const fromCwd = path.resolve(process.cwd(), normalized);
  const fromProject = path.resolve(projectRoot, normalized);
  const fromBackend = path.resolve(backendRoot, normalized);

  const candidates = [fromBackend, fromProject, fromCwd];
  for (const candidate of candidates) {
    if (fs.existsSync(path.dirname(candidate))) {
      return candidate;
    }
  }

  return fromCwd;
}

const DB_PATH = resolveDbPath(envPath);

module.exports = { DB_PATH };
