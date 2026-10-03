import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { imageUploadAllowed } from '../utils/imageUploadAllowed.js';

describe('imageUploadAllowed', () => {
  it('accepts jpeg, jpg, png, gif, and webp when extension and MIME both match', () => {
    assert.equal(imageUploadAllowed('photo.jpg', 'image/jpeg'), true);
    assert.equal(imageUploadAllowed('photo.JPEG', 'image/jpeg'), true);
    assert.equal(imageUploadAllowed('photo.JPG', 'image/jpg'), true);
    assert.equal(imageUploadAllowed('photo.png', 'image/png'), true);
    assert.equal(imageUploadAllowed('photo.GIF', 'image/gif'), true);
    assert.equal(imageUploadAllowed('photo.webp', 'image/webp'), true);
  });

  it('rejects a file unless both the extension and the MIME match', () => {
    assert.equal(imageUploadAllowed('photo.jpg', 'application/pdf'), false);
    assert.equal(imageUploadAllowed('notes.pdf', 'image/jpeg'), false);
    assert.equal(imageUploadAllowed('photo.jpg', 'image/svg+xml'), false);
    assert.equal(imageUploadAllowed('photo', 'image/png'), false);
    assert.equal(imageUploadAllowed('photo.png', ''), false);
    assert.equal(imageUploadAllowed('photo.png', null), false);
  });
});
