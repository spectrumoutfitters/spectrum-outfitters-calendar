import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEmailHeaderValue } from '../utils/emailHeaderSafe.js';

describe('sanitizeEmailHeaderValue', () => {
  it('strips CR/LF that would split MIME Subject headers', () => {
    const injected = 'Alice\r\nBcc: attacker@evil.com';
    const safe = sanitizeEmailHeaderValue(injected);
    assert.equal(safe.includes('\r'), false);
    assert.equal(safe.includes('\n'), false);
    assert.match(safe, /Alice/);
    assert.match(safe, /Bcc: attacker@evil.com/);
  });

  it('strips lone LF and other C0 controls', () => {
    const safe = sanitizeEmailHeaderValue('Bob\nCc: x@y.z\u0000hidden');
    assert.equal(safe.includes('\n'), false);
    assert.equal(safe.includes('\u0000'), false);
    assert.equal(safe, 'Bob Cc: x@y.z hidden');
  });

  it('trims and clamps length', () => {
    assert.equal(sanitizeEmailHeaderValue('  Pat  ', { maxLen: 200 }), 'Pat');
    assert.equal(sanitizeEmailHeaderValue('abcdefghij', { maxLen: 5 }), 'abcde');
  });

  it('collapses whitespace after control stripping', () => {
    assert.equal(sanitizeEmailHeaderValue('A\r\n\r\nB'), 'A B');
  });
});
