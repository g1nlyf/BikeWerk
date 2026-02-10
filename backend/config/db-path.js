/**
 * CANONICAL DATABASE PATH
 * Single source of truth for the database location.
 * All modules MUST import from here.
 */
const path = require('path');

const envPath = process.env.DB_PATH;
const DB_PATH = envPath
  ? (path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath))
  : path.resolve(__dirname, '../database/eubike.db');

module.exports = { DB_PATH };
