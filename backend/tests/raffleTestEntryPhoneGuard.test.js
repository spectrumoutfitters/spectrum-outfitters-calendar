import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTestModeFlag,
  rowOccupiesPhoneSlot,
  phoneTakenForOfficialEntry,
  resolveUpdateTestMode,
} from '../utils/raffleTestEntryPhoneGuard.js';

describe('isTestModeFlag', () => {
  it('accepts TRUE / true / 1', () => {
    assert.equal(isTestModeFlag(true), true);
    assert.equal(isTestModeFlag('TRUE'), true);
    assert.equal(isTestModeFlag('true'), true);
    assert.equal(isTestModeFlag(1), true);
    assert.equal(isTestModeFlag('1'), true);
  });

  it('rejects FALSE / empty / unrelated', () => {
    assert.equal(isTestModeFlag(false), false);
    assert.equal(isTestModeFlag('FALSE'), false);
    assert.equal(isTestModeFlag(''), false);
    assert.equal(isTestModeFlag(null), false);
    assert.equal(isTestModeFlag(undefined), false);
  });
});

describe('phoneTakenForOfficialEntry', () => {
  const slug = 'summer-giveaway';
  const phone = '5551234567';

  it('does not treat a test-mode row as occupying the phone slot', () => {
    const rows = [{ slug, phoneNorm: phone, isTest: true }];
    assert.equal(phoneTakenForOfficialEntry(rows, slug, phone), false);
  });

  it('blocks when a real (non-test) row already has that phone', () => {
    const rows = [{ slug, phoneNorm: phone, isTest: false }];
    assert.equal(phoneTakenForOfficialEntry(rows, slug, phone), true);
  });

  it('ignores test rows even when mixed with a different phone', () => {
    const rows = [
      { slug, phoneNorm: phone, isTest: 'TRUE' },
      { slug, phoneNorm: '5559990000', isTest: false },
    ];
    assert.equal(phoneTakenForOfficialEntry(rows, slug, phone), false);
  });

  it('ignores the same phone on a different event slug', () => {
    const rows = [{ slug: 'other-event', phoneNorm: phone, isTest: false }];
    assert.equal(phoneTakenForOfficialEntry(rows, slug, phone), false);
  });

  it('still blocks if a real row exists alongside a test squat of the same phone', () => {
    const rows = [
      { slug, phoneNorm: phone, isTest: true },
      { slug, phoneNorm: phone, isTest: false },
    ];
    assert.equal(phoneTakenForOfficialEntry(rows, slug, phone), true);
  });
});

describe('resolveUpdateTestMode', () => {
  it('does not let client/event-absent ?test=1 flip a real entry to test', () => {
    assert.equal(
      resolveUpdateTestMode({ existingRowsAreAllTest: false, eventDefaultTestMode: false }),
      false,
    );
  });

  it('keeps an all-test entry in test mode (do not demote into the official draw)', () => {
    assert.equal(
      resolveUpdateTestMode({ existingRowsAreAllTest: true, eventDefaultTestMode: false }),
      true,
    );
  });

  it('honors event-wide defaultTestMode', () => {
    assert.equal(
      resolveUpdateTestMode({ existingRowsAreAllTest: false, eventDefaultTestMode: true }),
      true,
    );
  });
});

describe('rowOccupiesPhoneSlot', () => {
  it('only official rows occupy the slot', () => {
    assert.equal(rowOccupiesPhoneSlot(true), false);
    assert.equal(rowOccupiesPhoneSlot(false), true);
  });
});
