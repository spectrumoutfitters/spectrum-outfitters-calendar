import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  firstNonInternalIPv4,
  normalizeViteBasePath,
  rewriteViteApiPath,
} from '../viteBasePath.js';

describe('normalizeViteBasePath', () => {
  it('uses / when the env value is missing or only slashes', () => {
    assert.deepEqual(normalizeViteBasePath(undefined), { basePath: '', base: '/' });
    assert.deepEqual(normalizeViteBasePath(null), { basePath: '', base: '/' });
    assert.deepEqual(normalizeViteBasePath(''), { basePath: '', base: '/' });
    assert.deepEqual(normalizeViteBasePath('/'), { basePath: '', base: '/' });
    assert.deepEqual(normalizeViteBasePath('///'), { basePath: '', base: '/' });
  });

  it('strips trailing slashes and keeps a subpath', () => {
    assert.deepEqual(normalizeViteBasePath('/so-app/'), { basePath: '/so-app', base: '/so-app/' });
    assert.deepEqual(normalizeViteBasePath('/so-app///'), { basePath: '/so-app', base: '/so-app/' });
  });
});

describe('rewriteViteApiPath', () => {
  it('strips one leading subpath so the API proxy still hits /api', () => {
    assert.equal(rewriteViteApiPath('/so-app/api/tasks', '/so-app'), '/api/tasks');
    assert.equal(rewriteViteApiPath('/so-app/so-app/api', '/so-app'), '/so-app/api');
  });

  it('does not strip a prefix that is not at the start', () => {
    assert.equal(rewriteViteApiPath('/other/so-app/api', '/so-app'), '/other/so-app/api');
  });

  it('escapes regex characters in the base path', () => {
    assert.equal(rewriteViteApiPath('/so.app/api/tasks', '/so.app'), '/api/tasks');
    assert.equal(rewriteViteApiPath('/soXapp/api/tasks', '/so.app'), '/soXapp/api/tasks');
  });

  it('leaves the path unchanged when there is no base prefix', () => {
    assert.equal(rewriteViteApiPath('/api/tasks', ''), '/api/tasks');
  });
});

describe('firstNonInternalIPv4', () => {
  it('skips loopback and IPv6 and returns the first public IPv4', () => {
    const address = firstNonInternalIPv4({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      eth0: [
        { family: 'IPv6', internal: false, address: 'fe80::1' },
        { family: 'IPv4', internal: true, address: '127.0.0.1' },
        { family: 'IPv4', internal: false, address: '10.0.0.5' },
      ],
      wlan: [{ family: 'IPv4', internal: false, address: '192.168.1.9' }],
    });
    assert.equal(address, '10.0.0.5');
  });

  it('returns null when every address is internal or missing', () => {
    assert.equal(firstNonInternalIPv4({}), null);
    assert.equal(
      firstNonInternalIPv4({
        lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      }),
      null,
    );
  });
});
