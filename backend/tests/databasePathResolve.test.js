import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { resolveDatabasePath } from '../utils/databasePathResolve.js';

const databaseDir = path.join('/app', 'backend', 'database');
const backendDir = path.join('/app', 'backend');
const dirs = { databaseDir, backendDir };

describe('resolveDatabasePath', () => {
  it('defaults to shop_tasks.db beside the database module when env is missing', () => {
    assert.equal(
      resolveDatabasePath(undefined, dirs),
      path.join(databaseDir, 'shop_tasks.db')
    );
    assert.equal(resolveDatabasePath('', dirs), path.join(databaseDir, 'shop_tasks.db'));
    assert.equal(resolveDatabasePath(null, dirs), path.join(databaseDir, 'shop_tasks.db'));
  });

  it('keeps an absolute DATABASE_PATH unchanged', () => {
    const abs = path.join('/var', 'data', 'shop_tasks.db');
    assert.equal(resolveDatabasePath(abs, dirs), abs);
  });

  it('resolves a relative DATABASE_PATH from the backend directory', () => {
    assert.equal(
      resolveDatabasePath('./database/shop_tasks.db', dirs),
      path.normalize(path.join(backendDir, 'database', 'shop_tasks.db'))
    );
    assert.equal(
      resolveDatabasePath('database/shop_tasks.db', dirs),
      path.normalize(path.join(backendDir, 'database', 'shop_tasks.db'))
    );
  });

  it('normalizes parent-directory relative paths', () => {
    assert.equal(
      resolveDatabasePath('../data/shop_tasks.db', dirs),
      path.normalize(path.join('/app', 'data', 'shop_tasks.db'))
    );
  });
});
