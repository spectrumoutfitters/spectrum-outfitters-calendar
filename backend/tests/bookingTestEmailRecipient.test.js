import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveBookingTestEmailTo } from '../utils/bookingTestEmailRecipient.js';

describe('resolveBookingTestEmailTo', () => {
  it('uses a trimmed, lowercased string body to when it matches the simple regex', () => {
    const r = resolveBookingTestEmailTo('  Shop@SpectrumOutfitters.COM  ', []);
    assert.deepEqual(r, { ok: true, to: 'shop@spectrumoutfitters.com', source: 'body' });
  });

  it('ignores non-string body to (0 / object / array) and falls back to first notify email', () => {
    for (const bodyTo of [0, { email: 'a@b.c' }, ['a@b.c'], null, undefined]) {
      const r = resolveBookingTestEmailTo(bodyTo, ['desk@shop.example']);
      assert.deepEqual(r, { ok: true, to: 'desk@shop.example', source: 'notify' }, String(bodyTo));
    }
  });

  it('rejects incomplete emails (no dot-suffix) and uses notify fallback', () => {
    const r = resolveBookingTestEmailTo('ops@shop', ['fallback@shop.example']);
    assert.deepEqual(r, { ok: true, to: 'fallback@shop.example', source: 'notify' });
  });

  it('does not re-validate the notify fallback (whitespace / missing @ kept)', () => {
    const r = resolveBookingTestEmailTo('', [' not-an-email ']);
    assert.deepEqual(r, { ok: true, to: ' not-an-email ', source: 'notify' });
  });

  it('fails when body to is unusable and notify_emails is empty/missing', () => {
    const err = 'Add notify emails in booking settings, or send ?to=inbox@yourshop.com.';
    assert.deepEqual(resolveBookingTestEmailTo('bad', []), { ok: false, error: err });
    assert.deepEqual(resolveBookingTestEmailTo('bad', null), { ok: false, error: err });
    assert.deepEqual(resolveBookingTestEmailTo('', undefined), { ok: false, error: err });
  });

  it('treats whitespace-only body to as missing (trim then empty)', () => {
    const r = resolveBookingTestEmailTo('   ', ['a@b.c']);
    assert.deepEqual(r, { ok: true, to: 'a@b.c', source: 'notify' });
  });
});
