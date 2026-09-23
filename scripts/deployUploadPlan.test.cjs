const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isBackendUploadExcluded,
  changedRelativePaths,
  databaseScriptNames,
} = require('./deployUploadPlan.cjs');

describe('isBackendUploadExcluded', () => {
  it('skips env files anywhere in the relative path', () => {
    assert.equal(isBackendUploadExcluded('.env'), true);
    assert.equal(isBackendUploadExcluded('.env.local'), true);
    assert.equal(isBackendUploadExcluded('.env.example'), true);
    assert.equal(isBackendUploadExcluded('config/.env'), true);
    assert.equal(isBackendUploadExcluded('nested\\secrets\\.env'), true);
  });

  it('skips sqlite database files by .db suffix', () => {
    assert.equal(isBackendUploadExcluded('spectrum.db'), true);
    assert.equal(isBackendUploadExcluded('database/app.db'), true);
    assert.equal(isBackendUploadExcluded('data/archive.db'), true);
  });

  it('keeps application source that is not an env file or database', () => {
    assert.equal(isBackendUploadExcluded('server.js'), false);
    assert.equal(isBackendUploadExcluded('routes/auth.js'), false);
    assert.equal(isBackendUploadExcluded('database/migrations.js'), false);
    assert.equal(isBackendUploadExcluded('utils/plaidClient.js'), false);
    assert.equal(isBackendUploadExcluded('package.json'), false);
  });
});

describe('changedRelativePaths', () => {
  it('includes new files and files whose mtime or size changed', () => {
    const current = {
      'server.js': { mtime: 2, size: 10 },
      'routes/auth.js': { mtime: 5, size: 20 },
      'utils/helpers.js': { mtime: 1, size: 8 },
    };
    const cached = {
      'server.js': { mtime: 2, size: 10 },
      'routes/auth.js': { mtime: 4, size: 20 },
      'old.js': { mtime: 1, size: 1 },
    };

    assert.deepEqual(changedRelativePaths(current, cached).sort(), [
      'routes/auth.js',
      'utils/helpers.js',
    ]);
  });

  it('treats a size-only change as an upload', () => {
    const current = { 'package.json': { mtime: 1, size: 12 } };
    const cached = { 'package.json': { mtime: 1, size: 11 } };
    assert.deepEqual(changedRelativePaths(current, cached), ['package.json']);
  });

  it('returns every current path when there is no cache', () => {
    const current = {
      'server.js': { mtime: 1, size: 1 },
      'routes/a.js': { mtime: 1, size: 1 },
    };
    assert.deepEqual(changedRelativePaths(current, null).sort(), ['routes/a.js', 'server.js']);
    assert.deepEqual(changedRelativePaths(null, { 'server.js': { mtime: 1, size: 1 } }), []);
  });

  it('does not resurrect files that were deleted locally', () => {
    const cached = {
      'server.js': { mtime: 1, size: 1 },
      'routes/gone.js': { mtime: 1, size: 1 },
    };
    assert.deepEqual(
      changedRelativePaths({ 'server.js': { mtime: 1, size: 1 } }, cached),
      [],
    );
  });
});

describe('databaseScriptNames', () => {
  it('uploads database .js scripts and drops databases and other files', () => {
    assert.deepEqual(
      databaseScriptNames(['migrations.js', 'app.db', 'readme.md', 'add_users.js', 'notes']),
      ['migrations.js', 'add_users.js'],
    );
  });

  it('returns an empty list for missing input', () => {
    assert.deepEqual(databaseScriptNames(null), []);
    assert.deepEqual(databaseScriptNames(undefined), []);
  });
});
