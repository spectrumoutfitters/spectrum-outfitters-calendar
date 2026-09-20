import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  changeOwnPasswordError,
  createUserValidationError,
  ownUsernameRequiredError,
  resetPasswordError,
  updateUserEmailValidationError,
} from '../utils/userCredentialGate.js';

describe('createUserValidationError', () => {
  it('requires username, password, and full name', () => {
    assert.equal(
      createUserValidationError({ username: '', password: 'secret1', full_name: 'Ada' }),
      'Username, password, and full name required',
    );
    assert.equal(
      createUserValidationError({ username: 'ada', password: '', full_name: 'Ada' }),
      'Username, password, and full name required',
    );
    assert.equal(
      createUserValidationError({ username: 'ada', password: 'secret1', full_name: '' }),
      'Username, password, and full name required',
    );
    assert.equal(
      createUserValidationError({}),
      'Username, password, and full name required',
    );
  });

  it('rejects a truthy but invalid email before password length', () => {
    assert.equal(
      createUserValidationError({
        username: 'ada',
        password: '123',
        full_name: 'Ada Lovelace',
        email: 'not-an-email',
      }),
      'Invalid email format',
    );
  });

  it('allows missing email and rejects short passwords', () => {
    assert.equal(
      createUserValidationError({
        username: 'ada',
        password: '12345',
        full_name: 'Ada Lovelace',
      }),
      'Password must be at least 6 characters',
    );
    assert.equal(
      createUserValidationError({
        username: 'ada',
        password: '123456',
        full_name: 'Ada Lovelace',
      }),
      null,
    );
  });

  it('accepts a valid optional email', () => {
    assert.equal(
      createUserValidationError({
        username: 'ada',
        password: 'secret1',
        full_name: 'Ada Lovelace',
        email: 'ada@example.com',
      }),
      null,
    );
  });
});

describe('updateUserEmailValidationError', () => {
  it('skips empty/null email and rejects invalid format', () => {
    assert.equal(updateUserEmailValidationError(undefined), null);
    assert.equal(updateUserEmailValidationError(null), null);
    assert.equal(updateUserEmailValidationError(''), null);
    assert.equal(updateUserEmailValidationError('ada@example.com'), null);
    assert.equal(updateUserEmailValidationError('ada@'), 'Invalid email format');
    assert.equal(updateUserEmailValidationError('   '), 'Invalid email format');
  });
});

describe('ownUsernameRequiredError', () => {
  it('rejects empty or whitespace-only usernames', () => {
    assert.equal(ownUsernameRequiredError(''), 'Username is required');
    assert.equal(ownUsernameRequiredError('   '), 'Username is required');
    assert.equal(ownUsernameRequiredError(null), 'Username is required');
    assert.equal(ownUsernameRequiredError('ada'), null);
  });
});

describe('changeOwnPasswordError', () => {
  it('requires both current and new passwords', () => {
    assert.equal(
      changeOwnPasswordError({ currentPassword: '', newPassword: 'secret1' }),
      'Current password and new password required',
    );
    assert.equal(
      changeOwnPasswordError({ currentPassword: 'old', newPassword: '' }),
      'Current password and new password required',
    );
  });

  it('uses the own-password copy for short new passwords', () => {
    assert.equal(
      changeOwnPasswordError({ currentPassword: 'old', newPassword: '12345' }),
      'New password must be at least 6 characters',
    );
    assert.equal(
      changeOwnPasswordError({ currentPassword: 'old', newPassword: '123456' }),
      null,
    );
  });
});

describe('resetPasswordError', () => {
  it('rejects missing or short admin-reset passwords', () => {
    assert.equal(resetPasswordError(''), 'Password must be at least 6 characters');
    assert.equal(resetPasswordError(null), 'Password must be at least 6 characters');
    assert.equal(resetPasswordError('12345'), 'Password must be at least 6 characters');
    assert.equal(resetPasswordError('123456'), null);
  });
});
