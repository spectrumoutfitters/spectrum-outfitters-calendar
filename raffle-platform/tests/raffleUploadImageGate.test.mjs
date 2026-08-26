import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_RAFFLE_UPLOAD_BYTES,
  extensionForAllowedMime,
  raffleImagePublicUrl,
  safeSlugSegment,
  validateRaffleUploadBytesAndType,
} from '../src/lib/raffleUploadImageGate.js';

describe('safeSlugSegment', () => {
  it('strips path separators and other unsafe chars; empty becomes event', () => {
    assert.equal(safeSlugSegment('grand-opening_1'), 'grand-opening_1');
    assert.equal(safeSlugSegment('../etc/passwd'), 'etcpasswd');
    assert.equal(safeSlugSegment('..'), 'event');
    assert.equal(safeSlugSegment(''), 'event');
    assert.equal(safeSlugSegment(null), 'event');
    assert.equal(safeSlugSegment('foo/bar baz'), 'foobarbaz');
    assert.equal(safeSlugSegment('a'.repeat(80)).length, 64);
  });
});

describe('validateRaffleUploadBytesAndType / extensionForAllowedMime', () => {
  it('allows jpeg/png/webp at or under 2MB and maps jpeg → jpg', () => {
    assert.deepEqual(validateRaffleUploadBytesAndType(0, 'image/jpeg'), {
      ok: true,
      mime: 'image/jpeg',
      ext: 'jpg',
    });
    assert.deepEqual(validateRaffleUploadBytesAndType(MAX_RAFFLE_UPLOAD_BYTES, 'image/png'), {
      ok: true,
      mime: 'image/png',
      ext: 'png',
    });
    assert.equal(validateRaffleUploadBytesAndType(10, 'image/webp').ext, 'webp');
    assert.equal(extensionForAllowedMime('image/jpeg'), 'jpg');
    assert.equal(extensionForAllowedMime('image/png'), 'png');
    assert.equal(extensionForAllowedMime('image/webp'), 'webp');
  });

  it('rejects oversize and disallowed/missing MIME (empty type is octet-stream)', () => {
    assert.deepEqual(validateRaffleUploadBytesAndType(MAX_RAFFLE_UPLOAD_BYTES + 1, 'image/jpeg'), {
      ok: false,
      error: 'file_too_large',
    });
    assert.deepEqual(validateRaffleUploadBytesAndType(10, 'image/gif'), {
      ok: false,
      error: 'invalid_type',
    });
    assert.deepEqual(validateRaffleUploadBytesAndType(10, ''), {
      ok: false,
      error: 'invalid_type',
    });
    assert.deepEqual(validateRaffleUploadBytesAndType(10, undefined), {
      ok: false,
      error: 'invalid_type',
    });
  });
});

describe('raffleImagePublicUrl', () => {
  it('builds a public path using the sanitized slug segment', () => {
    assert.equal(
      raffleImagePublicUrl('ok-event', 'abc.jpg'),
      '/raffle-images/ok-event/abc.jpg',
    );
    assert.equal(
      raffleImagePublicUrl('../secret', 'x.png'),
      '/raffle-images/secret/x.png',
    );
  });
});
