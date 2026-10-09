import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import nextConfig from '../next.config.ts';

describe('raffle public routes and admin framing', () => {
  it('temporarily redirects legacy /u links onto the public /e pages', async () => {
    const redirects = await nextConfig.redirects();
    assert.deepEqual(redirects, [
      { source: '/u/:slug', destination: '/e/:slug', permanent: false },
      { source: '/u/:slug/live', destination: '/e/:slug/live', permanent: false },
      { source: '/u/:slug/my-entry', destination: '/e/:slug/my-entry', permanent: false },
      { source: '/u/:slug/buy/success', destination: '/e/:slug/buy/success', permanent: false },
    ]);
    assert.equal(redirects.every((rule) => rule.permanent === false), true);
  });

  it('allows the staff login origin to frame admin pages and no one else', async () => {
    const headers = await nextConfig.headers();
    assert.equal(headers.length, 1);
    assert.equal(headers[0].source, '/admin/:path*');
    assert.deepEqual(headers[0].headers, [
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self' https://login.spectrumoutfitters.com",
      },
    ]);
    assert.equal(headers[0].headers[0].value.includes('*'), false);
  });
});
