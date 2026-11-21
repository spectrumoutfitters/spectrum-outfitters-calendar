import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../utils/googleCalendarService.js'
);

/**
 * Load the two employee matchers used when a Google event is imported.
 * They are not exported. The module also opens SQLite and talks to Google,
 * so the test executes only these functions plus the text normalizer they call.
 */
function loadMatchers(db) {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const normalize = sliceFunction(src, 'function normalizeText(s)');
  const byEmail = sliceFunction(src, 'async function findUserIdByEmail(email)');
  const fromText = sliceFunction(src, 'async function findUserIdFromEventText(text)');

  if (!normalize.includes(".toLowerCase()")) {
    throw new Error('slice missed text lowercasing');
  }
  if (!byEmail.includes('is_active = 1') || !byEmail.includes('db.getAsync')) {
    throw new Error('slice missed the active-user email lookup');
  }
  if (!fromText.includes('is_active = 1') || !fromText.includes('db.allAsync')) {
    throw new Error('slice missed the active-user text scan');
  }
  if (
    fromText.indexOf('u.full_name') > fromText.indexOf('u.username') ||
    fromText.indexOf('u.username') > fromText.indexOf('u.email')
  ) {
    throw new Error('slice missed full name, then username, then email');
  }
  const combined = `${normalize}\n${byEmail}\n${fromText}`;
  if (
    combined.includes('googleapis') ||
    combined.includes('calendar.events') ||
    combined.includes('upsertEntryFromGoogleEvent') ||
    combined.includes('INSERT')
  ) {
    throw new Error('slice pulled in Google sync or a database write');
  }

  return new Function(
    'db',
    `${combined}\nreturn { findUserIdByEmail, findUserIdFromEventText };`
  )(db);
}

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  return src.slice(start, endOfBrace(src, src.indexOf('{', start)));
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
  throw new Error('unterminated calendar user matcher');
}

describe('calendar event employee match', () => {
  it('does not query when the organizer email is missing or blank', async () => {
    const queries = [];
    const { findUserIdByEmail } = loadMatchers({
      async getAsync(sql, params) {
        queries.push({ sql, params });
        return { id: 4 };
      }
    });

    for (const email of [null, undefined, '', '   ', 12]) {
      assert.equal(await findUserIdByEmail(email), null);
    }
    assert.deepEqual(queries, []);
  });

  it('looks up an active user by the trimmed lowercase organizer email', async () => {
    const queries = [];
    const { findUserIdByEmail } = loadMatchers({
      async getAsync(sql, params) {
        queries.push({ sql, params });
        return params[0] === 'alex.rivera@shop.test' ? { id: 4 } : undefined;
      }
    });

    assert.equal(await findUserIdByEmail('  Alex.Rivera@Shop.TEST '), 4);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].sql.includes('is_active = 1'), true);
    assert.deepEqual(queries[0].params, ['alex.rivera@shop.test']);
  });

  it('returns null when the organizer email belongs to nobody', async () => {
    const { findUserIdByEmail } = loadMatchers({
      async getAsync() {
        return undefined;
      }
    });

    assert.equal(await findUserIdByEmail('nobody@shop.test'), null);
  });

  it('does not query when the event text is empty', async () => {
    const queries = [];
    const { findUserIdFromEventText } = loadMatchers({
      async allAsync(sql) {
        queries.push(sql);
        return [{ id: 4, full_name: 'Alex Rivera', username: 'arivera', email: 'alex.rivera@shop.test' }];
      }
    });

    for (const text of [null, undefined, '']) {
      assert.equal(await findUserIdFromEventText(text), null);
    }
    assert.deepEqual(queries, []);
  });

  it('prefers a full name over an earlier user whose username also appears', async () => {
    const queries = [];
    const { findUserIdFromEventText } = loadMatchers({
      async allAsync(sql) {
        queries.push(sql);
        return [
          { id: 8, full_name: 'Jordan Blake', username: 'alex', email: 'jordan@shop.test' },
          { id: 4, full_name: 'Alex Rivera', username: 'arivera', email: 'alex.rivera@shop.test' }
        ];
      }
    });

    assert.equal(await findUserIdFromEventText('ALEX RIVERA (alex)'), 4);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].includes('is_active = 1'), true);
  });

  it('uses the username when no full name appears in the event', async () => {
    const { findUserIdFromEventText } = loadMatchers({
      async allAsync() {
        return [
          { id: 5, full_name: 'Casey Ng', username: 'cng', email: 'casey.ng@shop.test' }
        ];
      }
    });

    assert.equal(await findUserIdFromEventText('Covered by CNG today'), 5);
  });

  it('uses the email when the name and username do not appear', async () => {
    const { findUserIdFromEventText } = loadMatchers({
      async allAsync() {
        return [
          { id: 5, full_name: 'Casey Ng', username: 'cng', email: 'riley.chen@shop.test' }
        ];
      }
    });

    assert.equal(await findUserIdFromEventText('Organizer Riley.Chen@Shop.Test'), 5);
  });

  it('does not assign a user whose name, username, and email are blank', async () => {
    const { findUserIdFromEventText } = loadMatchers({
      async allAsync() {
        return [
          { id: 1, full_name: '', username: '', email: '' },
          { id: 2, full_name: null, username: null, email: null },
          { id: 3, full_name: 'Riley Chen', username: 'rchen', email: 'riley.chen@shop.test' }
        ];
      }
    });

    assert.equal(await findUserIdFromEventText('Pump delivery window'), null);
  });
});
