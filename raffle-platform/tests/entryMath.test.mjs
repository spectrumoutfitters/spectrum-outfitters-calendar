import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BONUS_WEIGHTS,
  DEFAULT_BONUS_RULES,
  computeTicketCount,
  computeTicketsFromBonuses,
} from '../src/lib/entryMath.ts';

describe('entryMath legacy wrappers', () => {
  it('keeps deprecated BONUS_WEIGHTS for old sheet IDs', () => {
    assert.deepEqual(BONUS_WEIGHTS, {
      instagram: 2,
      review: 5,
      referral: 3,
    });
  });

  it('re-exports empty DEFAULT_BONUS_RULES from bonusDefaults', () => {
    assert.deepEqual(DEFAULT_BONUS_RULES, []);
  });

  it('computeTicketCount uses DEFAULT_BONUS_RULES (no social ladder tickets)', () => {
    // Current defaults ship no free social bonus rules, so selected legacy flags
    // must not inflate the base entry count.
    assert.equal(
      computeTicketCount({
        bonusInstagram: true,
        bonusReview: true,
        bonusReferral: true,
      }),
      computeTicketsFromBonuses(
        { instagram: true, review: true, referral: true },
        DEFAULT_BONUS_RULES,
      ),
    );
    assert.equal(
      computeTicketCount({
        bonusInstagram: true,
        bonusReview: true,
        bonusReferral: true,
      }),
      2,
    );
  });
});
