import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BONUS_RULES,
  computeTicketsFromBonuses,
  isLegacyBonusRulesFingerprint,
  mergeBonusRulesWithDefaults,
  resolveBonusRules,
} from '../src/lib/bonusDefaults.ts';

describe('DEFAULT_BONUS_RULES', () => {
  it('is empty — shipped social-follow bonuses are not modeled as rules', () => {
    assert.deepEqual(DEFAULT_BONUS_RULES, []);
  });
});

describe('computeTicketsFromBonuses', () => {
  const rules = [
    { id: 'custom_a', tickets: 2 },
    { id: 'custom_b', tickets: 5 },
  ];

  it('starts at 2 when base is omitted', () => {
    assert.equal(computeTicketsFromBonuses({}, rules), 2);
  });

  it('treats base 0 as missing and falls back to 2', () => {
    assert.equal(computeTicketsFromBonuses({}, rules, 0), 2);
  });

  it('clamps negative base to 1', () => {
    assert.equal(computeTicketsFromBonuses({}, rules, -5), 1);
  });

  it('floors a fractional base', () => {
    assert.equal(computeTicketsFromBonuses({}, rules, 2.9), 2);
  });

  it('adds only selected rule tickets', () => {
    assert.equal(computeTicketsFromBonuses({ custom_a: true, custom_b: false }, rules, 2), 4);
    assert.equal(computeTicketsFromBonuses({ custom_a: true, custom_b: true }, rules, 2), 9);
  });

  it('ignores selections that are not in the rule list', () => {
    assert.equal(computeTicketsFromBonuses({ instagram: true }, rules, 2), 2);
  });
});

describe('isLegacyBonusRulesFingerprint', () => {
  it('is false for empty or non-array', () => {
    assert.equal(isLegacyBonusRulesFingerprint([]), false);
    assert.equal(isLegacyBonusRulesFingerprint(null), false);
  });

  it('is true when every id is a previously shipped default', () => {
    assert.equal(
      isLegacyBonusRulesFingerprint([
        { id: 'instagram', tickets: 2 },
        { id: 'tiktok', tickets: 2 },
        { id: 'review', tickets: 5 },
      ]),
      true,
    );
  });

  it('is false when any custom id is present', () => {
    assert.equal(
      isLegacyBonusRulesFingerprint([
        { id: 'instagram', tickets: 2 },
        { id: 'shop_visit', tickets: 1 },
      ]),
      false,
    );
  });
});

describe('resolveBonusRules', () => {
  it('uses empty defaults when bonuses are missing', () => {
    assert.deepEqual(resolveBonusRules({}), []);
    assert.deepEqual(resolveBonusRules({ bonuses: null }), []);
    assert.deepEqual(resolveBonusRules({ bonuses: [] }), []);
  });

  it('strips legacy shipped fingerprints so old sheet JSON does not revive follow bonuses', () => {
    assert.deepEqual(
      resolveBonusRules({
        bonuses: [
          { id: 'facebook', tickets: 2 },
          { id: 'referral', tickets: 3 },
        ],
      }),
      [],
    );
  });

  it('keeps custom ladders', () => {
    const custom = [{ id: 'shop_visit', label: 'Visit', tickets: 3 }];
    assert.deepEqual(resolveBonusRules({ bonuses: custom }), custom);
  });
});

describe('mergeBonusRulesWithDefaults', () => {
  it('is currently a passthrough because shipped defaults are empty', () => {
    const rules = [{ id: 'shop_visit', label: 'Visit', tickets: 3 }];
    assert.deepEqual(mergeBonusRulesWithDefaults(rules), rules);
  });
});
