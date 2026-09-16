import path from 'path';

/**
 * Resolve SQLite DATABASE_PATH the same way `database/db.js` does at boot.
 * Relative values are resolved from the backend directory (parent of `database/`).
 * Empty/missing env falls back to `database/shop_tasks.db` next to the database module.
 */
export function resolveDatabasePath(databasePathEnv, { databaseDir, backendDir }) {
  if (!databasePathEnv) {
    return path.join(databaseDir, 'shop_tasks.db');
  }
  if (!path.isAbsolute(databasePathEnv)) {
    return path.normalize(path.resolve(backendDir, databasePathEnv));
  }
  return databasePathEnv;
}
