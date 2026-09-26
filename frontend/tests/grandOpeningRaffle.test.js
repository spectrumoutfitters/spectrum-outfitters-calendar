import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { raffleEventIsLive, raffleGrandOpeningUrls } from '../src/utils/grandOpeningRaffle.js';

describe('raffleGrandOpeningUrls', () => {
  it('uses the public raffle host when no origin is configured', () => {
    const urls = raffleGrandOpeningUrls(undefined);
    assert.equal(urls.adminUrl, 'https://raffle.spectrumoutfitters.com/admin/grand-opening');
    assert.equal(urls.publicEntryUrl, 'https://raffle.spectrumoutfitters.com/e/grand-opening');
    assert.equal(urls.checkUrl, 'https://raffle.spectrumoutfitters.com/api/event/grand-opening');
    assert.deepEqual(raffleGrandOpeningUrls(''), urls);
  });

  it('strips one trailing slash and keeps a subpath', () => {
    const urls = raffleGrandOpeningUrls('https://raffle.example.com/app/');
    assert.equal(urls.adminUrl, 'https://raffle.example.com/app/admin/grand-opening');
    assert.equal(urls.publicEntryUrl, 'https://raffle.example.com/app/e/grand-opening');
    assert.equal(urls.checkUrl, 'https://raffle.example.com/app/api/event/grand-opening');
  });

  it('leaves an origin that already has no trailing slash', () => {
    const urls = raffleGrandOpeningUrls('https://raffle.example.com');
    assert.equal(urls.checkUrl, 'https://raffle.example.com/api/event/grand-opening');
  });
});

describe('raffleEventIsLive', () => {
  it('is live only when the response is ok and an event is present', () => {
    assert.equal(raffleEventIsLive(true, { ok: true, event: { slug: 'grand-opening' } }), true);
    assert.equal(raffleEventIsLive(true, { ok: true, event: { name: 'Grand Opening' } }), true);
  });

  it('stays in setup when the payload has no event', () => {
    assert.equal(raffleEventIsLive(true, { ok: true }), false);
    assert.equal(raffleEventIsLive(true, { ok: true, event: null }), false);
    assert.equal(raffleEventIsLive(true, { ok: true, event: '' }), false);
  });

  it('stays in setup when the event payload is not ok', () => {
    assert.equal(raffleEventIsLive(true, { ok: false, event: { slug: 'grand-opening' } }), false);
    assert.equal(raffleEventIsLive(true, null), false);
    assert.equal(raffleEventIsLive(true, undefined), false);
  });

  it('stays in setup when the HTTP status is not ok', () => {
    assert.equal(raffleEventIsLive(false, { ok: true, event: { slug: 'grand-opening' } }), false);
  });
});
