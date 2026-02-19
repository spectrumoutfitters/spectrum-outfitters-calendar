import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('plaidClient encryption', () => {
  const originalKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY;

  before(() => {
    // Set a deterministic key for tests
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  after(() => {
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = originalKey || '';
  });

  it('encrypts and decrypts a token correctly', async () => {
    const { encryptToken, decryptToken } = await import('../utils/plaidClient.js');
    const token = 'access-sandbox-abc123-test-token';
    const encrypted = encryptToken(token);

    assert.notEqual(encrypted, token, 'encrypted should differ from plaintext');
    assert.ok(encrypted.includes(':'), 'encrypted format should be iv:ciphertext');

    const decrypted = decryptToken(encrypted);
    assert.equal(decrypted, token, 'decrypted should match original');
  });

  it('produces different ciphertext each time (random IV)', async () => {
    const { encryptToken } = await import('../utils/plaidClient.js');
    const token = 'access-sandbox-test-token-123';
    const a = encryptToken(token);
    const b = encryptToken(token);
    assert.notEqual(a, b, 'two encryptions of the same token should differ');
  });

  it('isPlaidConfigured returns false when keys are missing', async () => {
    const saved = { ...process.env };
    delete process.env.PLAID_CLIENT_ID;
    delete process.env.PLAID_SECRET;

    // Re-import to get fresh check (module cache means we call the function)
    const { isPlaidConfigured } = await import('../utils/plaidClient.js');
    assert.equal(isPlaidConfigured(), false);

    process.env.PLAID_CLIENT_ID = saved.PLAID_CLIENT_ID;
    process.env.PLAID_SECRET = saved.PLAID_SECRET;
  });
});
