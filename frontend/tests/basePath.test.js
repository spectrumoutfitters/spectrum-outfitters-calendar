import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { joinBasePath } from '../src/utils/basePath.js';

describe('joinBasePath', () => {
  it('returns root-relative paths when base is empty', () => {
    assert.equal(joinBasePath('', '/api'), '/api');
    assert.equal(joinBasePath(null, 'login'), '/login');
    assert.equal(joinBasePath(undefined, '/login'), '/login');
  });

  it('prefixes Vite subpath deploy bases without duplicating slashes', () => {
    assert.equal(joinBasePath('/so-app', '/api'), '/so-app/api');
    assert.equal(joinBasePath('/so-app/', '/login'), '/so-app/login');
    assert.equal(joinBasePath('/so-app///', 'admin'), '/so-app/admin');
  });

  it('keeps API and auth redirects under the same base (regression)', () => {
    const base = '/so-app';
    assert.equal(joinBasePath(base, '/api'), '/so-app/api');
    assert.equal(joinBasePath(base, '/login'), '/so-app/login');
  });
});
