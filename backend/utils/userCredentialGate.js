/**
 * Backend user create / email / password gates.
 * Distinct from userAccountMath (#93) role/pay/split/self-deactivate
 * and from Profile.jsx client gates (#126).
 */

import { validateEmail } from './helpers.js';

/** POST /users — required fields, optional email format, then password length. */
export function createUserValidationError({ username, password, full_name, email } = {}) {
  if (!username || !password || !full_name) {
    return 'Username, password, and full name required';
  }
  if (email && !validateEmail(email)) {
    return 'Invalid email format';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
}

/** PUT /users/:id — email is validated only when truthy (empty/null skips). */
export function updateUserEmailValidationError(email) {
  if (email && !validateEmail(email)) {
    return 'Invalid email format';
  }
  return null;
}

/** PUT /users/me/username — empty/whitespace rejected. Distinct from Profile copy. */
export function ownUsernameRequiredError(newUsername) {
  if (!newUsername || newUsername.trim().length === 0) {
    return 'Username is required';
  }
  return null;
}

/** PUT /users/me/password — both fields required, then new password length. */
export function changeOwnPasswordError({ currentPassword, newPassword } = {}) {
  if (!currentPassword || !newPassword) {
    return 'Current password and new password required';
  }
  if (newPassword.length < 6) {
    return 'New password must be at least 6 characters';
  }
  return null;
}

/** POST /users/:id/reset-password — missing or short password. */
export function resetPasswordError(newPassword) {
  if (!newPassword || newPassword.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
}
