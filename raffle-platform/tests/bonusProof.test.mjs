import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { trimBonusProofForSubmit, validateBonusProof } from '../src/lib/bonusProof.ts';
import {
  computeTicketsFromBonuses,
  isLegacyBonusRulesFingerprint,
  resolveBonusRules,
} from '../src/lib/bonusDefaults.ts';

const reviewRule = {
  id: 'custom_review',
  label: 'Leave a review',
  tickets: 5,
  proofFields: [
    { id: 'url', label: 'Review URL', input: 'url', requiredWhenBonus: true },
    { id: 'note', label: 'Note', input: 'text' },
  ],
};

describe('validateBonusProof', () => {
  it('skips required fields when the bonus is not selected', () => {
    assert.equal(validateBonusProof({}, [reviewRule], {}), null);
    assert.equal(validateBonusProof({}, [reviewRule], { custom_review: false }), null);
  });

  it('requires trimmed non-empty values for requiredWhenBonus fields', () => {
    const selected = { custom_review: true };
    assert.match(
      validateBonusProof({}, [reviewRule], selected),
      /Review URL/,
    );
    assert.match(
      validateBonusProof({ custom_review: { url: '   ' } }, [reviewRule], selected),
      /Review URL/,
    );
  });

  it('rejects non-https URLs but allows empty optional URL fields', () => {
    const selected = { custom_review: true };
    const optionalUrlRule = {
      ...reviewRule,
      proofFields: [{ id: 'url', label: 'Review URL', input: 'url' }],
    };
    assert.equal(validateBonusProof({}, [optionalUrlRule], selected), null);
    assert.match(
      validateBonusProof({ custom_review: { url: 'http://example.com' } }, [reviewRule], selected),
      /https:\/\//,
    );
    assert.equal(
      validateBonusProof(
        { custom_review: { url: 'HTTPS://example.com/review' } },
        [reviewRule],
        selected,
      ),
      null,
    );
  });

  it('does not require proof when a selected rule has no proofFields', () => {
    const bare = { id: 'newsletter', label: 'Newsletter', tickets: 2 };
    assert.equal(validateBonusProof({}, [bare], { newsletter: true }), null);
  });
});

describe('trimBonusProofForSubmit', () => {
  it('keeps only configured fields, trims, and caps at 500 characters', () => {
    const long = `https://example.com/${'x'.repeat(600)}`;
    const trimmed = trimBonusProofForSubmit(
      {
        custom_review: {
          url: `  https://example.com/ok  `,
          note: '',
          extra: 'drop-me',
        },
        unknown_rule: { url: 'https://ignored.example' },
      },
      [reviewRule],
    );
    assert.deepEqual(Object.keys(trimmed), ['custom_review']);
    assert.equal(trimmed.custom_review.url, 'https://example.com/ok');
    assert.equal(trimmed.custom_review.note, undefined);
    assert.equal(trimmed.custom_review.extra, undefined);

    const capped = trimBonusProofForSubmit(
      { custom_review: { url: long } },
      [reviewRule],
    );
    assert.equal(capped.custom_review.url.length, 500);
  });

  it('drops a rule entirely when every field is blank after trim', () => {
    const trimmed = trimBonusProofForSubmit(
      { custom_review: { url: '  ', note: '' } },
      [reviewRule],
    );
    assert.deepEqual(trimmed, {});
  });
});

describe('bonusDefaults remaining (custom rules / legacy fingerprint)', () => {
  it('treats only all-shipped social IDs as a legacy fingerprint', () => {
    assert.equal(isLegacyBonusRulesFingerprint([]), false);
    assert.equal(isLegacyBonusRulesFingerprint(null), false);
    assert.equal(
      isLegacyBonusRulesFingerprint([{ id: 'instagram' }, { id: 'review' }]),
      true,
    );
    assert.equal(
      isLegacyBonusRulesFingerprint([{ id: ' instagram ' }]),
      true,
    );
    assert.equal(
      isLegacyBonusRulesFingerprint([{ id: 'instagram' }, { id: 'custom_review' }]),
      false,
    );
  });

  it('resolveBonusRules swaps legacy fingerprints for empty current defaults', () => {
    assert.deepEqual(
      resolveBonusRules({ bonuses: [{ id: 'tiktok', tickets: 3, label: 'TikTok' }] }),
      [],
    );
    const custom = [{ id: 'custom_review', label: 'Review', tickets: 5 }];
    assert.deepEqual(resolveBonusRules({ bonuses: custom }), custom);
    assert.deepEqual(resolveBonusRules({ bonuses: null }), []);
  });

  it('computeTicketsFromBonuses adds selected custom tickets and coerces base', () => {
    const rules = [
      { id: 'custom_review', tickets: 5 },
      { id: 'referral', tickets: 3 },
    ];
    assert.equal(computeTicketsFromBonuses({}, rules), 2);
    assert.equal(computeTicketsFromBonuses({ custom_review: true }, rules), 7);
    assert.equal(
      computeTicketsFromBonuses({ custom_review: true, referral: true }, rules, 4),
      12,
    );
    // 0 is falsy → falls through to default 2, then max(1, 2)
    assert.equal(computeTicketsFromBonuses({}, rules, 0), 2);
    // negative floors then max(1, …)
    assert.equal(computeTicketsFromBonuses({}, rules, -3), 1);
  });
});
