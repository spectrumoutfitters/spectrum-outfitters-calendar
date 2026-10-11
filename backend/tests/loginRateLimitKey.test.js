import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loginRateLimitKey } from '../utils/loginRateLimitKey.js';

describe('loginRateLimitKey', () => {
  it('shares one bucket for the same person on one IP regardless of username casing', () => {
    const shopIp = '203.0.113.10';
    const lower = loginRateLimitKey({ ip: shopIp, body: { username: 'alex' } });
    const mixed = loginRateLimitKey({ ip: shopIp, body: { username: 'Alex' } });
    const upper = loginRateLimitKey({ ip: shopIp, body: { username: 'ALEX' } });

    assert.equal(lower, '203.0.113.10-alex');
    assert.equal(mixed, lower);
    assert.equal(upper, lower);
  });

  it('keeps coworkers on a shared shop IP in separate buckets', () => {
    const shopIp = '203.0.113.10';
    const alex = loginRateLimitKey({ ip: shopIp, body: { username: 'alex' } });
    const sam = loginRateLimitKey({ ip: shopIp, body: { username: 'sam' } });

    assert.notEqual(alex, sam);
    assert.equal(alex, '203.0.113.10-alex');
    assert.equal(sam, '203.0.113.10-sam');
  });

  it('splits the same username across different IPs', () => {
    const home = loginRateLimitKey({ ip: '198.51.100.2', body: { username: 'alex' } });
    const shop = loginRateLimitKey({ ip: '203.0.113.10', body: { username: 'alex' } });

    assert.notEqual(home, shop);
  });

  it('falls back to the IP when the username is missing or blank', () => {
    const ip = '203.0.113.10';
    assert.equal(loginRateLimitKey({ ip, body: {} }), ip);
    assert.equal(loginRateLimitKey({ ip, body: { username: '' } }), ip);
    assert.equal(loginRateLimitKey({ ip, body: { username: null } }), ip);
    assert.equal(loginRateLimitKey({ ip }), ip);
  });

  it('treats a whitespace-only username as its own bucket', () => {
    const ip = '203.0.113.10';
    assert.equal(loginRateLimitKey({ ip, body: { username: ' ' } }), '203.0.113.10- ');
    assert.notEqual(
      loginRateLimitKey({ ip, body: { username: ' ' } }),
      loginRateLimitKey({ ip, body: {} }),
    );
  });
});
