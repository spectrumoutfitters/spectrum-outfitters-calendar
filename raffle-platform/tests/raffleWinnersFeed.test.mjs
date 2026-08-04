import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTestCell,
  resolveWinnersColMap,
  projectPublicWinnersFeed,
  entryPassesDrawTestFilter,
} from '../src/lib/raffleWinnersFeed.js';

describe('isTestCell', () => {
  it('treats TRUE strings and boolean true as test', () => {
    assert.equal(isTestCell('TRUE'), true);
    assert.equal(isTestCell('true'), true);
    assert.equal(isTestCell(true), true);
  });

  it('treats FALSE / empty / other as non-test', () => {
    assert.equal(isTestCell('FALSE'), false);
    assert.equal(isTestCell(''), false);
    assert.equal(isTestCell(null), false);
    assert.equal(isTestCell(false), false);
  });
});

describe('resolveWinnersColMap', () => {
  it('uses positional defaults without a drawId header', () => {
    assert.deepEqual(resolveWinnersColMap(null), {
      drawId: 0,
      timestamp: 1,
      slug: 2,
      raffleId: 3,
      winnerName: 4,
      ticketsInPool: 7,
      isTest: 8,
    });
  });

  it('remaps from headers when isTest is not at column 8', () => {
    const header = [
      'drawId',
      'timestamp',
      'slug',
      'raffleId',
      'winnerName',
      'winnerPhone',
      'winnerEmail',
      'isTest',
      'ticketsInPool',
    ];
    const cols = resolveWinnersColMap(header);
    assert.equal(cols.isTest, 7);
    assert.equal(cols.ticketsInPool, 8);
  });
});

describe('projectPublicWinnersFeed', () => {
  const header = [
    'drawId',
    'timestamp',
    'slug',
    'raffleId',
    'winnerName',
    'winnerPhone',
    'winnerEmail',
    'ticketsInPool',
    'isTest',
  ];

  it('skips test rows and other slugs; omits phone/email; sorts newest first; caps at 15', () => {
    const values = [header];
    for (let i = 0; i < 18; i++) {
      values.push([
        `dw_${i}`,
        `2026-08-0${(i % 9) + 1}T12:00:00.000Z`,
        'grand',
        'pool-a',
        `Winner ${i}`,
        '5551234567',
        'a@b.com',
        10 + i,
        'FALSE',
      ]);
    }
    values.push([
      'dw_test',
      '2026-08-20T12:00:00.000Z',
      'grand',
      'pool-a',
      'Test Winner',
      '5550000000',
      't@b.com',
      99,
      'TRUE',
    ]);
    values.push([
      'dw_other',
      '2026-08-21T12:00:00.000Z',
      'other-slug',
      'pool-a',
      'Other',
      '5551111111',
      'o@b.com',
      5,
      'FALSE',
    ]);

    const out = projectPublicWinnersFeed(values, 'grand', { 'pool-a': 'Pool A' }, 15);
    assert.equal(out.length, 15);
    assert.ok(out.every((w) => !('winnerPhone' in w) && !('winnerEmail' in w)));
    assert.ok(!out.some((w) => w.drawId === 'dw_test' || w.drawId === 'dw_other'));
    assert.equal(out[0].raffleTitle, 'Pool A');
    // Newest first among non-test grand rows
    for (let i = 1; i < out.length; i++) {
      assert.ok(out[i - 1].drewAt >= out[i].drewAt);
    }
  });

  it('skips rows with empty drawId', () => {
    const values = [
      header,
      ['', '2026-08-01T00:00:00.000Z', 'grand', 'p1', 'X', '', '', 1, 'FALSE'],
      ['dw_ok', '2026-08-01T00:00:00.000Z', 'grand', 'p1', 'Y', '', '', 2, false],
    ];
    const out = projectPublicWinnersFeed(values, 'grand');
    assert.equal(out.length, 1);
    assert.equal(out[0].drawId, 'dw_ok');
    assert.equal(out[0].winnerName, 'Y');
  });
});

describe('entryPassesDrawTestFilter', () => {
  it('live draws exclude test entries; testModeOnly keeps only test entries', () => {
    assert.equal(entryPassesDrawTestFilter('FALSE', false), true);
    assert.equal(entryPassesDrawTestFilter('TRUE', false), false);
    assert.equal(entryPassesDrawTestFilter('TRUE', true), true);
    assert.equal(entryPassesDrawTestFilter('FALSE', true), false);
    assert.equal(entryPassesDrawTestFilter(true, true), true);
  });
});
