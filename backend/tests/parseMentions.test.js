import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMentionUsernames, filterMentionUsers, parseMentions } from '../utils/parseMentions.js';

describe('extractMentionUsernames', () => {
  it('returns empty for non-strings and empty text', () => {
    assert.deepEqual(extractMentionUsernames(null), []);
    assert.deepEqual(extractMentionUsernames(undefined), []);
    assert.deepEqual(extractMentionUsernames(12), []);
    assert.deepEqual(extractMentionUsernames(''), []);
    assert.deepEqual(extractMentionUsernames('no mentions here'), []);
  });

  it('extracts unique @usernames matching ChatWindow /@(\\w+)/g', () => {
    assert.deepEqual(extractMentionUsernames('hey @neel and @sam check this'), ['neel', 'sam']);
    assert.deepEqual(extractMentionUsernames('@Neel @neel @NEEL'), ['Neel']);
    // Same /@(\w+)/g highlighter as ChatWindow — tokens after @, including inside emails
    assert.deepEqual(extractMentionUsernames('ping @shop'), ['shop']);
  });
});

describe('filterMentionUsers', () => {
  const admin = { id: 1, username: 'boss', role: 'admin' };
  const employee = { id: 2, username: 'tech', role: 'employee' };

  it('drops malformed rows', () => {
    assert.deepEqual(filterMentionUsers([null, {}, admin]), [admin]);
  });

  it('keeps employees on team board', () => {
    assert.deepEqual(filterMentionUsers([admin, employee], { boardType: 'team_board' }), [admin, employee]);
  });

  it('strips employees from admin-board mentions (no body leak via mention_notification)', () => {
    assert.deepEqual(filterMentionUsers([admin, employee], { boardType: 'admin_board' }), [admin]);
  });
});

describe('parseMentions', () => {
  it('returns [] without lookup and never throws on lookup failure', async () => {
    assert.deepEqual(await parseMentions('@neel'), []);
    assert.deepEqual(
      await parseMentions('@neel', {
        lookupUsers: async () => {
          throw new Error('db down');
        },
      }),
      []
    );
  });

  it('resolves mentions via lookupUsers', async () => {
    const users = [{ id: 7, username: 'neel', role: 'admin' }];
    const result = await parseMentions('ping @neel please', {
      lookupUsers: async (names) => {
        assert.deepEqual(names, ['neel']);
        return users;
      },
      boardType: 'team_board',
    });
    assert.deepEqual(result, users);
  });

  it('does not notify employees mentioned on the admin board', async () => {
    const result = await parseMentions('@tech see payroll', {
      lookupUsers: async () => [{ id: 2, username: 'tech', role: 'employee' }],
      boardType: 'admin_board',
    });
    assert.deepEqual(result, []);
  });
});
