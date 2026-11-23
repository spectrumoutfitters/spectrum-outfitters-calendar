import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const servicePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../utils/googleCalendarService.js'
);

/**
 * Booking mail lives in googleCalendarService.js. Importing that module opens
 * SQLite and the Google client, so these tests execute only the sender helpers.
 */
function loadBookingMail(deps) {
  const src = fs.readFileSync(servicePath, 'utf8');
  const gmailScope = sliceFunction(src, 'export function hasGmailSendScope(');
  const identityScope = sliceFunction(src, 'export function hasSenderIdentityScope(');
  const resolveFn = sliceFunction(src, 'async function resolveOutboundFromAddress(');
  const sendFn = sliceFunction(src, 'export async function sendMailViaGoogle(');

  if (!resolveFn.includes('userinfo.get') || !resolveFn.includes('users.getProfile')) {
    throw new Error('slice missed sender-address fallback');
  }
  if (!resolveFn.includes('Could not resolve sender email')) {
    throw new Error('slice missed the unresolved-sender error');
  }
  if (resolveFn.includes('messages.send') || resolveFn.includes('db.')) {
    throw new Error('slice pulled send or database code into sender resolution');
  }
  if (!sendFn.includes('messages.send') || !sendFn.includes("userId: 'me'")) {
    throw new Error('slice missed the Gmail raw send');
  }
  if (!sendFn.includes("replace(/\\+/g, '-')") || !sendFn.includes('multipart/alternative')) {
    throw new Error('slice missed base64url MIME assembly');
  }
  if (sendFn.includes('listCalendars') || sendFn.includes('db.') || sendFn.includes('router.')) {
    throw new Error('slice pulled in the rest of the calendar service');
  }

  const silent = { warn() {} };
  return new Function(
    'google',
    'crypto',
    'createAuthedOAuth2Client',
    'getGoogleCalendarConfig',
    'console',
    `${stripExport(gmailScope)}
${stripExport(identityScope)}
${resolveFn}
${stripExport(sendFn)}
return { resolveOutboundFromAddress, sendMailViaGoogle };`
  )(
    deps.google,
    deps.crypto || { randomBytes() { throw new Error('unexpected randomBytes'); } },
    deps.createAuthedOAuth2Client || unexpectedAsync('createAuthedOAuth2Client'),
    deps.getGoogleCalendarConfig || unexpectedAsync('getGoogleCalendarConfig'),
    deps.console || silent
  );
}

function stripExport(fn) {
  return fn.replace(/^export /, '');
}

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  const openParen = src.indexOf('(', start);
  let depth = 0;
  let endParen = -1;
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        endParen = i;
        break;
      }
    }
  }
  if (endParen < 0) throw new Error(`unterminated params for ${signature}`);
  const body = src.indexOf('{', endParen);
  return src.slice(start, endOfBrace(src, body));
}

function endOfBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error('unterminated booking mail helper');
}

function unexpectedAsync(name) {
  return async () => {
    throw new Error(`unexpected ${name}`);
  };
}

function decodeRaw(encoded) {
  let padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  return Buffer.from(padded, 'base64').toString('utf8');
}

describe('resolveOutboundFromAddress', () => {
  it('uses the trimmed UserInfo email and does not ask Gmail for a profile', async () => {
    const calls = [];
    const oauth2Client = { marker: 'client' };
    const google = {
      oauth2(opts) {
        calls.push(['oauth2', opts]);
        return {
          userinfo: {
            async get() {
              calls.push(['userinfo']);
              return { data: { email: '  Desk@Shop.TEST  ' } };
            }
          }
        };
      },
      gmail() {
        calls.push(['gmail']);
        throw new Error('gmail profile should not be called');
      }
    };
    const { resolveOutboundFromAddress } = loadBookingMail({ google });

    assert.equal(await resolveOutboundFromAddress(oauth2Client), 'Desk@Shop.TEST');
    assert.deepEqual(calls, [
      ['oauth2', { version: 'v2', auth: oauth2Client }],
      ['userinfo']
    ]);
  });

  it('falls back to the trimmed Gmail profile when UserInfo has no email or throws', async () => {
    const oauth2Client = { marker: 'client' };
    const profileCalls = [];

    function googleWith(userinfoGet) {
      return {
        oauth2() {
          return { userinfo: { get: userinfoGet } };
        },
        gmail(opts) {
          profileCalls.push(opts);
          return {
            users: {
              async getProfile(args) {
                profileCalls.push(args);
                return { data: { emailAddress: '  desk@shop.test  ' } };
              }
            }
          };
        }
      };
    }

    const missing = loadBookingMail({
      google: googleWith(async () => ({ data: {} }))
    });
    assert.equal(await missing.resolveOutboundFromAddress(oauth2Client), 'desk@shop.test');

    const thrown = loadBookingMail({
      google: googleWith(async () => {
        throw new Error('userinfo disabled');
      })
    });
    assert.equal(await thrown.resolveOutboundFromAddress(oauth2Client), 'desk@shop.test');

    assert.deepEqual(profileCalls, [
      { version: 'v1', auth: oauth2Client },
      { userId: 'me' },
      { version: 'v1', auth: oauth2Client },
      { userId: 'me' }
    ]);
  });

  it('rejects when neither UserInfo nor the Gmail profile yields an email', async () => {
    const google = {
      oauth2() {
        return {
          userinfo: {
            async get() {
              throw new Error('userinfo down');
            }
          }
        };
      },
      gmail() {
        return {
          users: {
            async getProfile() {
              return { data: {} };
            }
          }
        };
      }
    };
    const { resolveOutboundFromAddress } = loadBookingMail({ google });

    await assert.rejects(
      () => resolveOutboundFromAddress({ marker: 'client' }),
      (err) => err instanceof Error && /Could not resolve sender email/.test(err.message)
    );
  });
});

describe('sendMailViaGoogle', () => {
  const readyScopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  it('rejects an empty recipient list and a missing subject before contacting Google', async () => {
    let authed = 0;
    const { sendMailViaGoogle } = loadBookingMail({
      google: {},
      createAuthedOAuth2Client: async () => {
        authed += 1;
        throw new Error('should not authenticate');
      }
    });

    await assert.rejects(
      () => sendMailViaGoogle({ to: ['  ', null, ''], subject: 'Hello', text: 'body' }),
      /No recipients/
    );
    await assert.rejects(
      () => sendMailViaGoogle({ to: '   ', subject: 'Hello', text: 'body' }),
      /No recipients/
    );
    await assert.rejects(
      () => sendMailViaGoogle({ to: 'owner@shop.test', subject: '', text: 'body' }),
      /subject is required/
    );
    await assert.rejects(
      () => sendMailViaGoogle({ to: 'owner@shop.test', subject: null, text: 'body' }),
      /subject is required/
    );
    assert.equal(authed, 0);
  });

  it('stops on a missing Gmail-send or account-email scope before resolving From or sending', async () => {
    const calls = [];
    const configs = [
      { oauth_scopes: null },
      { oauth_scopes: 'https://www.googleapis.com/auth/gmail.send' }
    ];
    const { sendMailViaGoogle } = loadBookingMail({
      google: {
        oauth2() {
          calls.push('userinfo');
          throw new Error('should not resolve From');
        },
        gmail() {
          calls.push('send');
          throw new Error('should not send');
        }
      },
      createAuthedOAuth2Client: async () => {
        calls.push('auth');
        return { oauth2Client: { marker: 'client' } };
      },
      getGoogleCalendarConfig: async () => {
        calls.push('config');
        return configs.shift();
      }
    });

    await assert.rejects(
      () => sendMailViaGoogle({ to: 'owner@shop.test', subject: 'Hello', text: 'body' }),
      /Gmail send is not authorized/
    );
    await assert.rejects(
      () => sendMailViaGoogle({ to: 'owner@shop.test', subject: 'Hello', text: 'body' }),
      /Missing permission to read your Google account email/
    );
    assert.deepEqual(calls, ['auth', 'config', 'auth', 'config']);
    assert.equal(configs.length, 0);
  });

  it('sends a base64url multipart message for a booking notify list', async () => {
    const oauth2Client = { marker: 'client' };
    const sent = [];
    const google = {
      oauth2(opts) {
        assert.deepEqual(opts, { version: 'v2', auth: oauth2Client });
        return {
          userinfo: {
            async get() {
              return { data: { email: '  Desk@Shop.TEST  ' } };
            }
          }
        };
      },
      gmail(opts) {
        assert.deepEqual(opts, { version: 'v1', auth: oauth2Client });
        return {
          users: {
            async getProfile() {
              throw new Error('profile is unused when UserInfo returned an email');
            },
            messages: {
              async send(args) {
                sent.push(args);
                return { data: { id: 'msg' } };
              }
            }
          }
        };
      }
    };
    const { sendMailViaGoogle } = loadBookingMail({
      google,
      crypto: {
        randomBytes(size) {
          return Buffer.alloc(size, 0xab);
        }
      },
      createAuthedOAuth2Client: async () => ({ oauth2Client }),
      getGoogleCalendarConfig: async () => ({ oauth_scopes: readyScopes })
    });

    const result = await sendMailViaGoogle({
      to: ['  Alex@Shop.TEST ', '', '  ', null, 'bob@shop.test'],
      subject: '[SO Booking] Drop-off scheduled - Ada',
      text: 'When: Friday\nName: Ada\nArrival window > 15 min',
      html: '<p>booked</p>'
    });

    assert.equal(result.from, 'Desk@Shop.TEST');
    assert.deepEqual(result.recipients, ['alex@shop.test', 'bob@shop.test']);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].userId, 'me');

    const encoded = sent[0].requestBody.raw;
    assert.match(encoded, /^[A-Za-z0-9_-]+$/);
    const mime = decodeRaw(encoded);
    const standard = Buffer.from(mime, 'utf8').toString('base64');
    assert.match(standard, /[+\/]/);
    assert.equal(encoded, standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    assert.match(
      mime,
      /^From: Desk@Shop\.TEST\r\nTo: alex@shop\.test, bob@shop\.test\r\nSubject: \[SO Booking\] Drop-off scheduled - Ada\r\n/
    );
    const boundary = mime.match(/boundary="([^"]+)"/)?.[1];
    assert.ok(boundary);
    assert.match(mime, new RegExp(`Content-Type: multipart/alternative; boundary="${boundary}"`));
    assert.ok(mime.includes(`--${boundary}\r\nContent-Type: text/plain; charset=UTF-8`));
    assert.ok(mime.includes('When: Friday\nName: Ada\nArrival window > 15 min'));
    assert.ok(mime.includes(`--${boundary}\r\nContent-Type: text/html; charset=UTF-8`));
    assert.ok(mime.includes('<p>booked</p>'));
    assert.ok(mime.includes(`--${boundary}--`));
  });

  it('sends a plain message for one address when html is omitted', async () => {
    const sent = [];
    const { sendMailViaGoogle } = loadBookingMail({
      google: {
        oauth2() {
          return {
            userinfo: {
              async get() {
                return { data: { email: 'desk@shop.test' } };
              }
            }
          };
        },
        gmail() {
          return {
            users: {
              messages: {
                async send(args) {
                  sent.push(args);
                  return { data: {} };
                }
              }
            }
          };
        }
      },
      crypto: { randomBytes(size) { return Buffer.alloc(size, 1); } },
      createAuthedOAuth2Client: async () => ({ oauth2Client: { marker: 'client' } }),
      getGoogleCalendarConfig: async () => ({ oauth_scopes: readyScopes })
    });

    const result = await sendMailViaGoogle({
      to: '  Owner@Shop.TEST ',
      subject: 'Booking notice',
      text: 'ping'
    });

    assert.deepEqual(result, { from: 'desk@shop.test', recipients: ['owner@shop.test'] });
    const mime = decodeRaw(sent[0].requestBody.raw);
    assert.match(mime, /^From: desk@shop\.test\r\nTo: owner@shop\.test\r\nSubject: Booking notice\r\n/);
    assert.match(mime, /Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\nping$/);
    assert.equal(mime.includes('multipart/alternative'), false);
    assert.equal(mime.includes('text/html'), false);
  });
});
