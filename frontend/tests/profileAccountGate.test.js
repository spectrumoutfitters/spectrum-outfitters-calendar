import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePasswordChange,
  validateUsernameChange,
} from '../src/utils/profileAccountGate.js';

describe('validatePasswordChange', () => {
  it('rejects a mismatch before checking length', () => {
    assert.deepEqual(
      validatePasswordChange({ newPassword: 'abcdef', confirmPassword: 'abcdeg' }),
      { error: 'New passwords do not match' }
    );
  });

  it('rejects matching passwords shorter than 6 characters', () => {
    assert.deepEqual(
      validatePasswordChange({ newPassword: 'abcde', confirmPassword: 'abcde' }),
      { error: 'Password must be at least 6 characters' }
    );
    assert.deepEqual(
      validatePasswordChange({ newPassword: '', confirmPassword: '' }),
      { error: 'Password must be at least 6 characters' }
    );
  });

  it('accepts matching passwords of at least 6 characters', () => {
    assert.deepEqual(
      validatePasswordChange({ newPassword: 'abcdef', confirmPassword: 'abcdef' }),
      {}
    );
  });
});

describe('validateUsernameChange', () => {
  it('rejects missing or whitespace-only usernames', () => {
    assert.deepEqual(
      validateUsernameChange({ newUsername: '', currentUsername: 'alex' }),
      { error: 'Username cannot be empty' }
    );
    assert.deepEqual(
      validateUsernameChange({ newUsername: '   ', currentUsername: 'alex' }),
      { error: 'Username cannot be empty' }
    );
    assert.deepEqual(
      validateUsernameChange({ newUsername: null, currentUsername: 'alex' }),
      { error: 'Username cannot be empty' }
    );
  });

  it('rejects the exact current username without trimming', () => {
    assert.deepEqual(
      validateUsernameChange({ newUsername: 'alex', currentUsername: 'alex' }),
      { error: 'Username is the same as current' }
    );
    assert.equal(
      validateUsernameChange({ newUsername: ' alex', currentUsername: 'alex' }).error,
      undefined
    );
  });
});
