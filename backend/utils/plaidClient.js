import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('PLAID_TOKEN_ENCRYPTION_KEY must be set (at least 32 hex chars)');
  }
  return Buffer.from(key.slice(0, 64), 'hex');
}

export function encryptToken(plainText) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptToken(cipherText) {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = cipherText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function getPlaidEnv() {
  const env = (process.env.PLAID_ENV || 'sandbox').toLowerCase();
  if (env === 'production') return PlaidEnvironments.production;
  if (env === 'development') return PlaidEnvironments.development;
  return PlaidEnvironments.sandbox;
}

let _client = null;

export function getPlaidClient() {
  if (_client) return _client;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set in .env');
  }

  const configuration = new Configuration({
    basePath: getPlaidEnv(),
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  _client = new PlaidApi(configuration);
  return _client;
}

export function isPlaidConfigured() {
  return !!(
    process.env.PLAID_CLIENT_ID &&
    process.env.PLAID_SECRET &&
    process.env.PLAID_TOKEN_ENCRYPTION_KEY
  );
}
