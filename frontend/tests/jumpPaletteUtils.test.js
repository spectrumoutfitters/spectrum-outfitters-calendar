import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminCommands,
  JUMP_RECENT_KEY,
  loadRecentIds,
  MAX_RECENT,
  pushRecentId,
  rankCommands,
} from '../src/components/Layout/jumpPaletteUtils.js';

function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
  };
}

function buildCommandsWithNavigateLog() {
  const calls = [];
  const commands = buildAdminCommands((to) => calls.push(to));
  return { calls, commands };
}

describe('jump palette command generation', () => {
  it('builds admin deep-link commands for registered secondary tabs', () => {
    const { calls, commands } = buildCommandsWithNavigateLog();
    const payStub = commands.find((cmd) => cmd.id === 'admin:finance:paystub_maker');

    assert.ok(payStub, 'expected a command for the Finance > Pay stub PDF tab');
    assert.equal(payStub.title, 'Pay stub PDF');

    payStub.run();

    assert.deepEqual(calls, [
      {
        pathname: '/admin',
        search: '?adm=finance&adsub=paystub_maker',
      },
    ]);
  });

  it('keeps route shortcuts distinct from admin tab deep links', () => {
    const { calls, commands } = buildCommandsWithNavigateLog();
    const quickJobs = commands.find((cmd) => cmd.id === 'route:/crm/quick-jobs');

    assert.ok(quickJobs, 'expected a quick-jobs route shortcut');

    quickJobs.run();

    assert.deepEqual(calls, ['/crm/quick-jobs']);
  });
});

describe('jump palette ranking', () => {
  it('finds high-risk finance destinations by business synonyms', () => {
    const { commands } = buildCommandsWithNavigateLog();
    const ranked = rankCommands(commands, '1099 pdf', []);

    assert.equal(ranked[0]?.cmd.id, 'admin:finance:paystub_maker');
    assert.equal(ranked[0]?.isRecent, false);
  });

  it('orders valid recent commands first for an empty query and ignores stale ids', () => {
    const { commands } = buildCommandsWithNavigateLog();
    const ranked = rankCommands(commands, '', [
      'missing:old-command',
      'admin:settings:security',
      'admin:finance:payroll',
      'admin:settings:security',
    ]);

    assert.deepEqual(
      ranked.slice(0, 3).map((row) => [row.cmd.id, row.isRecent]),
      [
        ['admin:settings:security', true],
        ['admin:finance:payroll', true],
        ['admin:overview', false],
      ],
    );
  });
});

describe('jump palette recent storage', () => {
  it('loads only string ids and clamps to the stored recent limit', () => {
    const validIds = Array.from({ length: MAX_RECENT + 2 }, (_, i) => `cmd:${i}`);
    const storage = memoryStorage({
      [JUMP_RECENT_KEY]: JSON.stringify([...validIds, null, 42, { id: 'bad' }]),
    });

    assert.deepEqual(loadRecentIds(storage), validIds.slice(0, MAX_RECENT));
  });

  it('deduplicates pushed ids, moves them to the front, and persists JSON', () => {
    const existing = ['admin:finance:payroll', 'admin:settings:security'];
    const storage = memoryStorage({ [JUMP_RECENT_KEY]: JSON.stringify(existing) });

    const next = pushRecentId('admin:settings:security', storage);

    assert.deepEqual(next, ['admin:settings:security', 'admin:finance:payroll']);
    assert.deepEqual(JSON.parse(storage.getItem(JUMP_RECENT_KEY)), next);
  });

  it('treats invalid or unavailable storage as empty without throwing', () => {
    assert.deepEqual(loadRecentIds(memoryStorage({ [JUMP_RECENT_KEY]: '{nope' })), []);
    assert.deepEqual(pushRecentId('admin:overview', undefined), ['admin:overview']);
  });
});
