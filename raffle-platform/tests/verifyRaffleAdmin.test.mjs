import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { verifyRaffleAdminKey } from '../src/lib/verifyRaffleAdmin.ts';
import { fetchEventConfig } from '../src/lib/eventServer.ts';
import { getAppsScriptUrl } from '../src/lib/env.ts';

describe('getAppsScriptUrl', () => {
  const original = process.env.APPS_SCRIPT_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.APPS_SCRIPT_URL;
    else process.env.APPS_SCRIPT_URL = original;
  });

  it('returns null when unset or blank', () => {
    delete process.env.APPS_SCRIPT_URL;
    assert.equal(getAppsScriptUrl(), null);
    process.env.APPS_SCRIPT_URL = '   ';
    assert.equal(getAppsScriptUrl(), null);
  });

  it('trims and returns a configured URL', () => {
    process.env.APPS_SCRIPT_URL = ' https://script.example/exec ';
    assert.equal(getAppsScriptUrl(), 'https://script.example/exec');
  });
});

describe('verifyRaffleAdminKey', () => {
  const originalUrl = process.env.APPS_SCRIPT_URL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.APPS_SCRIPT_URL = 'https://script.example/exec';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.APPS_SCRIPT_URL;
    else process.env.APPS_SCRIPT_URL = originalUrl;
  });

  it('rejects blank admin keys without calling Apps Script', async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response('{}');
    };
    assert.equal(await verifyRaffleAdminKey('grand-opening', '  '), false);
    assert.equal(called, false);
  });

  it('rejects when APPS_SCRIPT_URL is missing', async () => {
    delete process.env.APPS_SCRIPT_URL;
    assert.equal(await verifyRaffleAdminKey('grand-opening', 'secret'), false);
  });

  it('returns true only when Apps Script responds ok with { ok: true }', async () => {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body, {
        action: 'getAdminStats',
        slug: 'grand-opening',
        adminKey: 'secret-key',
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    assert.equal(await verifyRaffleAdminKey('grand-opening', 'secret-key'), true);
  });

  it('returns false on HTTP failure, ok:false payload, or network errors', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true }), { status: 401 });
    assert.equal(await verifyRaffleAdminKey('grand-opening', 'secret'), false);

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false }), { status: 200 });
    assert.equal(await verifyRaffleAdminKey('grand-opening', 'secret'), false);

    globalThis.fetch = async () => {
      throw new Error('network down');
    };
    assert.equal(await verifyRaffleAdminKey('grand-opening', 'secret'), false);
  });
});

describe('fetchEventConfig', () => {
  const originalUrl = process.env.APPS_SCRIPT_URL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.APPS_SCRIPT_URL = 'https://script.example/exec';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.APPS_SCRIPT_URL;
    else process.env.APPS_SCRIPT_URL = originalUrl;
  });

  it('returns missing_apps_script_url when env is unset', async () => {
    delete process.env.APPS_SCRIPT_URL;
    assert.deepEqual(await fetchEventConfig('go'), {
      ok: false,
      error: 'missing_apps_script_url',
    });
  });

  it('GETs getEvent with encoded slug and parses JSON', async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), 'https://script.example/exec?action=getEvent&slug=grand%20opening');
      assert.equal(init?.method, 'GET');
      assert.equal(init?.cache, undefined);
      assert.deepEqual(init?.next, { revalidate: 60 });
      return new Response(JSON.stringify({ ok: true, event: { slug: 'grand opening' } }), {
        status: 200,
      });
    };
    const result = await fetchEventConfig('grand opening');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.event.slug, 'grand opening');
  });

  it('uses cache: no-store when requested for live/admin paths', async () => {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.next, undefined);
      return new Response(JSON.stringify({ ok: true, event: { slug: 'go' } }));
    };
    const result = await fetchEventConfig('go', { noStore: true });
    assert.equal(result.ok, true);
  });

  it('returns invalid_response when the body is not JSON', async () => {
    globalThis.fetch = async () => new Response('<html>cold start</html>', { status: 200 });
    assert.deepEqual(await fetchEventConfig('go'), {
      ok: false,
      error: 'invalid_response',
    });
  });
});
