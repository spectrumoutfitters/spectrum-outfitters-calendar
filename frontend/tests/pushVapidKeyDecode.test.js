import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { urlBase64ToUint8Array } from '../src/utils/pushVapidKeyDecode.js';

function bytesFromUtf8(s) {
  return Uint8Array.from(Buffer.from(s, 'utf8'));
}

describe('urlBase64ToUint8Array', () => {
  it('decodes standard base64 (padding already present)', () => {
    assert.deepEqual(urlBase64ToUint8Array('YQ=='), bytesFromUtf8('a'));
    assert.deepEqual(urlBase64ToUint8Array('YWI='), bytesFromUtf8('ab'));
    assert.deepEqual(urlBase64ToUint8Array('YWJj'), bytesFromUtf8('abc'));
  });

  it('adds missing padding from URL-safe length', () => {
    assert.deepEqual(urlBase64ToUint8Array('YQ'), bytesFromUtf8('a'));
    assert.deepEqual(urlBase64ToUint8Array('YWI'), bytesFromUtf8('ab'));
  });

  it('maps URL-safe alphabet (- and _) back to + /', () => {
    // bytes 0xfb 0xff → "+/8=" in standard, "-_8" in URL-safe without padding
    const standard = urlBase64ToUint8Array('+/8=');
    const urlSafe = urlBase64ToUint8Array('-_8');
    assert.deepEqual(urlSafe, standard);
    assert.equal(urlSafe.length, 2);
    assert.equal(urlSafe[0], 0xfb);
    assert.equal(urlSafe[1], 0xff);
  });
});
