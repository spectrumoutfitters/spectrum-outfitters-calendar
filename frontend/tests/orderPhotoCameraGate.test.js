import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOrderPhotoCameraHostAllowed,
  shouldBlockOrderPhotoCamera,
} from '../src/utils/orderPhotoCameraGate.js';

describe('isOrderPhotoCameraHostAllowed', () => {
  it('allows localhost, 127.0.0.1, and https', () => {
    assert.equal(isOrderPhotoCameraHostAllowed({ hostname: 'localhost', protocol: 'http:' }), true);
    assert.equal(isOrderPhotoCameraHostAllowed({ hostname: '127.0.0.1', protocol: 'http:' }), true);
    assert.equal(isOrderPhotoCameraHostAllowed({ hostname: 'shop.example', protocol: 'https:' }), true);
  });

  it('rejects LAN/public HTTP hosts (distinct from barcode localhost-only)', () => {
    assert.equal(isOrderPhotoCameraHostAllowed({ hostname: '192.168.1.20', protocol: 'http:' }), false);
    assert.equal(isOrderPhotoCameraHostAllowed({ hostname: 'shop.example', protocol: 'http:' }), false);
    assert.equal(isOrderPhotoCameraHostAllowed({ hostname: '::1', protocol: 'http:' }), false);
  });
});

describe('shouldBlockOrderPhotoCamera', () => {
  it('never blocks when getUserMedia exists', () => {
    assert.equal(
      shouldBlockOrderPhotoCamera({
        hostname: 'shop.example',
        protocol: 'http:',
        hasGetUserMedia: true,
      }),
      false,
    );
  });

  it('blocks public HTTP when getUserMedia is missing', () => {
    assert.equal(
      shouldBlockOrderPhotoCamera({
        hostname: 'shop.example',
        protocol: 'http:',
        hasGetUserMedia: false,
      }),
      true,
    );
    assert.equal(
      shouldBlockOrderPhotoCamera({
        hostname: '192.168.1.20',
        protocol: 'http:',
        hasGetUserMedia: false,
      }),
      true,
    );
  });

  it('does not block localhost / 127.0.0.1 / https when getUserMedia is missing', () => {
    assert.equal(
      shouldBlockOrderPhotoCamera({
        hostname: 'localhost',
        protocol: 'http:',
        hasGetUserMedia: false,
      }),
      false,
    );
    assert.equal(
      shouldBlockOrderPhotoCamera({
        hostname: '127.0.0.1',
        protocol: 'http:',
        hasGetUserMedia: false,
      }),
      false,
    );
    assert.equal(
      shouldBlockOrderPhotoCamera({
        hostname: 'shop.example',
        protocol: 'https:',
        hasGetUserMedia: false,
      }),
      false,
    );
  });
});
