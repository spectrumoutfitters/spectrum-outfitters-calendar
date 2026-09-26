import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

function loadPushPayload() {
  const code = readFileSync(new URL('../public/pushNotificationPayload.js', import.meta.url), 'utf8');
  const sandbox = {};
  sandbox.globalThis = sandbox;
  runInNewContext(code, sandbox);
  return sandbox;
}

const loaded = loadPushPayload();

function parsePushEventData(rawText) {
  return JSON.parse(JSON.stringify(loaded.parsePushEventData(rawText)));
}

function notificationClickUrl(notificationData) {
  return loaded.notificationClickUrl(notificationData);
}

describe('parsePushEventData', () => {
  it('keeps title, body, tag, and deep link from a JSON payload', () => {
    const note = parsePushEventData(JSON.stringify({
      title: 'Parts arrived',
      body: 'Filter kit is at the counter',
      tag: 'parts-arrived',
      url: '/inventory',
    }));
    assert.deepEqual(note, {
      title: 'Parts arrived',
      body: 'Filter kit is at the counter',
      tag: 'parts-arrived',
      url: '/inventory',
    });
  });

  it('fills defaults when the JSON object omits fields', () => {
    assert.deepEqual(parsePushEventData('{}'), {
      title: 'Spectrum Outfitters',
      body: '',
      tag: 'spectrum',
      url: '/',
    });
  });

  it('treats blank title, body, tag, and url as missing', () => {
    assert.deepEqual(parsePushEventData(JSON.stringify({
      title: '',
      body: '',
      tag: '',
      url: '',
    })), {
      title: 'Spectrum Outfitters',
      body: '',
      tag: 'spectrum',
      url: '/',
    });
  });

  it('shows the raw text when the payload is not JSON', () => {
    assert.deepEqual(parsePushEventData('Customer is at the door'), {
      title: 'Spectrum Outfitters',
      body: 'Customer is at the door',
      tag: 'spectrum',
      url: '/',
    });
  });

  it('shows the raw text when JSON is truncated', () => {
    const raw = '{"title":"Clock in"';
    const note = parsePushEventData(raw);
    assert.equal(note.title, 'Spectrum Outfitters');
    assert.equal(note.body, raw);
    assert.equal(note.url, '/');
  });

  it('uses defaults when the push has no body', () => {
    assert.deepEqual(parsePushEventData(''), {
      title: 'Spectrum Outfitters',
      body: '',
      tag: 'spectrum',
      url: '/',
    });
    assert.deepEqual(parsePushEventData(null), {
      title: 'Spectrum Outfitters',
      body: '',
      tag: 'spectrum',
      url: '/',
    });
  });

  it('falls back to the raw text when JSON is null', () => {
    const note = parsePushEventData('null');
    assert.equal(note.title, 'Spectrum Outfitters');
    assert.equal(note.body, 'null');
    assert.equal(note.url, '/');
  });
});

describe('notificationClickUrl', () => {
  it('opens the payload url', () => {
    assert.equal(notificationClickUrl({ url: '/tasks/12' }), '/tasks/12');
  });

  it('opens home when notification data or url is missing', () => {
    assert.equal(notificationClickUrl(undefined), '/');
    assert.equal(notificationClickUrl(null), '/');
    assert.equal(notificationClickUrl({}), '/');
    assert.equal(notificationClickUrl({ url: '' }), '/');
  });
});
