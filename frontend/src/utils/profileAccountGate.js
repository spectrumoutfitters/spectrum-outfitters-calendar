/**
 * Profile page password / username client gates.
 * Distinct from backend userAccountMath (#93) role/pay/split/self-deactivate
 * and from users.js create-user password length (server still re-checks).
 */

export function validatePasswordChange({ newPassword, confirmPassword }) {
  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match' };
  }
  if (newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }
  return {};
}

/**
 * Empty/whitespace rejected. Same-as-current compares the raw field
 * (no trim) — a leading space is not treated as "same" and is sent
 * trimmed to the API (current Profile.jsx behavior).
 */
export function validateUsernameChange({ newUsername, currentUsername }) {
  if (!newUsername || newUsername.trim().length === 0) {
    return { error: 'Username cannot be empty' };
  }
  if (newUsername === currentUsername) {
    return { error: 'Username is the same as current' };
  }
  return {};
}
