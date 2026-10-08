import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { frontendDevUrl, parseBackendNetworkAddress } from '../networkAccess.js';

describe('parseBackendNetworkAddress', () => {
  it('reads the IPv4 and port from a backend Network log line', () => {
    const output = [
      'Server running on port 3000',
      'Network: http://192.168.1.42:3000',
      'Local: http://localhost:3000',
    ].join('\n');

    assert.deepEqual(parseBackendNetworkAddress(output), {
      ip: '192.168.1.42',
      port: '3000',
    });
  });

  it('accepts extra whitespace and keeps the first IPv4 line', () => {
    const output = 'Network:\thttp://10.0.0.8:4000/\nNetwork: http://10.1.1.1:1111';
    assert.deepEqual(parseBackendNetworkAddress(output), {
      ip: '10.0.0.8',
      port: '4000',
    });
  });

  it('ignores localhost, https, and IPv6 lines', () => {
    assert.equal(parseBackendNetworkAddress('Network: http://localhost:3000'), null);
    assert.equal(parseBackendNetworkAddress('Network: https://192.168.0.5:3000'), null);
    assert.equal(parseBackendNetworkAddress('Network: http://[fe80::1]:3000'), null);
  });

  it('returns null when the log has no usable address', () => {
    assert.equal(parseBackendNetworkAddress(''), null);
    assert.equal(parseBackendNetworkAddress('Server running'), null);
    assert.equal(parseBackendNetworkAddress('Network: http://10.0.0.1'), null);
    assert.equal(parseBackendNetworkAddress(null), null);
    assert.equal(parseBackendNetworkAddress(undefined), null);
  });
});

describe('frontendDevUrl', () => {
  it('uses https on the Vite dev port so phone cameras can open the app', () => {
    assert.equal(frontendDevUrl('192.168.1.42'), 'https://192.168.1.42:5173');
    assert.equal(frontendDevUrl('localhost'), 'https://localhost:5173');
  });
});
