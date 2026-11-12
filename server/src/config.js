const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  PORT: Number(process.env.PORT) || 3001,
  HOST: '127.0.0.1',
  ENGINE_PATH:
    process.env.ENGINE_PATH ||
    path.join(REPO_ROOT, 'engine', 'build', 'routeopt-engine'),
  DEFAULT_TIME_LIMIT_MS: 10000,
  MAX_TIME_LIMIT_MS: 120000,
  KILL_MARGIN_MS: 5000,
  MAX_OUTPUT_BYTES: 64 * 1024 * 1024,
  ALGORITHMS: ['nearest_neighbor', 'mst_dfs', 'held_karp', 'backtracking'],
  CORS_ORIGINS: ['http://localhost:5173', 'http://127.0.0.1:5173'],
};

