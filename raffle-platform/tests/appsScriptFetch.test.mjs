import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { fetchAppsScriptPost } from '../src/lib/appsScriptFetch.ts';

/**
 * Every raffle route that talks to Google Apps Script (public entry, paid
 * checkout, Stripe webhook, admin config, draw, export, insights, refund,
 * and stats) goes through this one POST. Apps Script rejects a JSON content
 * type (it triggers a preflight the web app does not answer), and a hung
 * cold start has to abort before nginx's proxy_read_timeout. The helper is
 * imported directly; this file does not open a network connection.
 */

const realFetch = globalThis.fetch;
const realTimeout = AbortSignal.timeout;

afterEach(() => {
  globalThis.fetch = realFetch;
  AbortSignal.timeout = realTimeout;
});

function installFetchDouble() {
  const timeouts = [];
  const calls = [];
  AbortSignal.timeout = (ms) => {
    timeouts.push(ms);
    return new AbortController().signal;
  };
  globalThis.fetch = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
  };
  return { timeouts, calls };
}

describe('fetchAppsScriptPost', () => {
  it('posts the JSON body as text/plain and arms a 90s abort', async () => {
    const { timeouts, calls } = installFetchDouble();
    const body = {
      action: 'submitEntry',
      payload: { slug: 'spring-draw', email: 'buyer@example.com', tickets: 2 },
    };

    const res = await fetchAppsScriptPost('https://script.google.com/macros/s/abc/exec', body);

    assert.equal(res.status, 200);
    assert.equal(await res.text(), '{"ok":true}');
    assert.deepEqual(timeouts, [90_000]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://script.google.com/macros/s/abc/exec');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers['Content-Type'], 'text/plain;charset=utf-8');
    assert.equal(
      calls[0].init.body,
      '{"action":"submitEntry","payload":{"slug":"spring-draw","email":"buyer@example.com","tickets":2}}',
    );
    assert.equal(calls[0].init.signal.aborted, false);
    assert.ok(calls[0].init.signal instanceof AbortSignal);
  });

  it('forwards a fetch failure unchanged so callers can map timeout vs unreachable', async () => {
    const timeoutErr = new Error('The operation was aborted due to timeout');
    timeoutErr.name = 'TimeoutError';
    AbortSignal.timeout = () => new AbortController().signal;
    globalThis.fetch = () => Promise.reject(timeoutErr);

    await assert.rejects(
      () => fetchAppsScriptPost('https://script.google.com/macros/s/abc/exec', { action: 'getAdminStats' }),
      (err) => err === timeoutErr,
    );
  });
});
