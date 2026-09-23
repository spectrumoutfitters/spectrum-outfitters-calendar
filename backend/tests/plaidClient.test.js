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

  it('rejects a missing or short encryption key before writing ciphertext', async () => {
    const { encryptToken } = await import('../utils/plaidClient.js');
    const saved = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
    try {
      delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
      assert.throws(() => encryptToken('access-sandbox-token'), /PLAID_TOKEN_ENCRYPTION_KEY/);
      process.env.PLAID_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(15);
      assert.throws(() => encryptToken('access-sandbox-token'), /PLAID_TOKEN_ENCRYPTION_KEY/);
    } finally {
      process.env.PLAID_TOKEN_ENCRYPTION_KEY = saved;
    }
  });

  it('isPlaidConfigured requires client id, secret, and encryption key together', async () => {
    const { isPlaidConfigured } = await import('../utils/plaidClient.js');
    const saved = {
      id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      key: process.env.PLAID_TOKEN_ENCRYPTION_KEY,
    };
    const restore = () => {
      if (saved.id === undefined) delete process.env.PLAID_CLIENT_ID;
      else process.env.PLAID_CLIENT_ID = saved.id;
      if (saved.secret === undefined) delete process.env.PLAID_SECRET;
      else process.env.PLAID_SECRET = saved.secret;
      if (saved.key === undefined) delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
      else process.env.PLAID_TOKEN_ENCRYPTION_KEY = saved.key;
    };
    try {
      process.env.PLAID_CLIENT_ID = 'client';
      process.env.PLAID_SECRET = 'secret';
      process.env.PLAID_TOKEN_ENCRYPTION_KEY = 'c'.repeat(64);
      assert.equal(isPlaidConfigured(), true);

      delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
      assert.equal(isPlaidConfigured(), false);

      process.env.PLAID_TOKEN_ENCRYPTION_KEY = 'c'.repeat(64);
      delete process.env.PLAID_SECRET;
      assert.equal(isPlaidConfigured(), false);

      process.env.PLAID_SECRET = 'secret';
      delete process.env.PLAID_CLIENT_ID;
      assert.equal(isPlaidConfigured(), false);
    } finally {
      restore();
    }
  });

  it('does not return the access token from tampered ciphertext or another key', async () => {
    const { encryptToken, decryptToken } = await import('../utils/plaidClient.js');
    const token = 'access-sandbox-do-not-leak';
    const encrypted = encryptToken(token);
    const [iv, cipher] = encrypted.split(':');
    const flipped = cipher.slice(0, -1) + (cipher.endsWith('0') ? '1' : '0');

    let tampered = null;
    try {
      tampered = decryptToken(`${iv}:${flipped}`);
    } catch {
      tampered = null;
    }
    assert.notEqual(tampered, token);

    const saved = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = 'b'.repeat(64);
    try {
      let otherKey = null;
      try {
        otherKey = decryptToken(encrypted);
      } catch {
        otherKey = null;
      }
      assert.notEqual(otherKey, token);
    } finally {
      process.env.PLAID_TOKEN_ENCRYPTION_KEY = saved;
    }
  });

  it('uses only the first 64 hex characters of a longer key', async () => {
    const { encryptToken, decryptToken } = await import('../utils/plaidClient.js');
    const saved = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
    try {
      process.env.PLAID_TOKEN_ENCRYPTION_KEY = `${'d'.repeat(64)}ffff`;
      const encrypted = encryptToken('access-sandbox-long-key');
      process.env.PLAID_TOKEN_ENCRYPTION_KEY = 'd'.repeat(64);
      assert.equal(decryptToken(encrypted), 'access-sandbox-long-key');
    } finally {
      process.env.PLAID_TOKEN_ENCRYPTION_KEY = saved;
    }
  });
});
