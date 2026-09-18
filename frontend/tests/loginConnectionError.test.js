import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapLoginConnectionError } from '../src/utils/loginConnectionError.js';

describe('mapLoginConnectionError', () => {
  it('rewrites backend-down strings to the port-5000 operator copy', () => {
    const copy = 'Cannot connect to server. Please ensure the backend is running on port 5000.';
    assert.equal(mapLoginConnectionError('Cannot connect to http://localhost:5000'), copy);
    assert.equal(mapLoginConnectionError('ERR_CONNECTION_REFUSED'), copy);
    assert.equal(mapLoginConnectionError('Network Error'), copy);
    assert.equal(
      mapLoginConnectionError('axios Network Error while posting /auth/login'),
      copy,
    );
  });

  it('passes credential and other API errors through unchanged', () => {
    assert.equal(mapLoginConnectionError('Invalid credentials'), 'Invalid credentials');
    assert.equal(mapLoginConnectionError('Login failed'), 'Login failed');
    assert.equal(mapLoginConnectionError(''), '');
    assert.equal(mapLoginConnectionError(undefined), undefined);
  });
});
