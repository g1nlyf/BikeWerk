/**
 * CANONICAL DATABASE PATH
 * Single source of truth for the database location.
 * All modules MUST import from here.
 */
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../database/eubike.db');

module.exports = { DB_PATH };
