import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_BONUS_RULES,
  computeTicketsFromBonuses,
  isLegacyBonusRulesFingerprint,
  resolveBonusRules
} from '../src/lib/bonusDefaults.ts';

describe('bonusDefaults', () => {
  it('ships an empty default bonus ladder', () => {
    assert.deepEqual(DEFAULT_BONUS_RULES, []);
  });

  it('detects legacy shipped social-bonus fingerprints', () => {
    assert.equal(
      isLegacyBonusRulesFingerprint([
        { id: 'instagram', label: 'IG', tickets: 2 },
        { id: 'tiktok', label: 'TT', tickets: 2 }
      ]),
      true
    );
    assert.equal(
      isLegacyBonusRulesFingerprint([
        { id: 'instagram', label: 'IG', tickets: 2 },
        { id: 'custom_bonus', label: 'Custom', tickets: 1 }
      ]),
      false
    );
    assert.equal(isLegacyBonusRulesFingerprint([]), false);
  });

  it('resolves legacy fingerprints and empty bonuses to current defaults', () => {
    assert.deepEqual(
      resolveBonusRules({
        bonuses: [
          { id: 'facebook', label: 'FB', tickets: 1 },
          { id: 'review', label: 'Review', tickets: 5 }
        ]
      }),
      []
    );
    assert.deepEqual(resolveBonusRules({ bonuses: null }), []);
    assert.deepEqual(resolveBonusRules({}), []);
  });

  it('keeps custom bonus rules intact', () => {
    const custom = [{ id: 'newsletter_extra', label: 'Extra', tickets: 2 }];
    assert.deepEqual(resolveBonusRules({ bonuses: custom }), custom);
  });

  it('sums selected bonus tickets onto a floored base of at least 1', () => {
    const rules = [
      { id: 'custom_a', tickets: 2 },
      { id: 'custom_b', tickets: 5 }
    ];
    assert.equal(computeTicketsFromBonuses({ custom_a: true }, rules, 2), 4);
    assert.equal(computeTicketsFromBonuses({ custom_a: true, custom_b: true }, rules, 2), 9);
    assert.equal(computeTicketsFromBonuses({}, rules, 0), 1);
    assert.equal(computeTicketsFromBonuses({}, rules, 3.9), 3);
  });
});
