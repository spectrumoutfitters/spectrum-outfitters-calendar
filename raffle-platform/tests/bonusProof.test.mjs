import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  trimBonusProofForSubmit,
  validateBonusProof
} from '../src/lib/bonusProof.ts';

const rules = [
  {
    id: 'instagram',
    label: 'Instagram share',
    tickets: 2,
    proofFields: [
      {
        id: 'handle',
        label: 'IG handle',
        requiredWhenBonus: true
      },
      {
        id: 'post_url',
        label: 'Post link',
        input: 'url',
        requiredWhenBonus: true
      },
      {
        id: 'notes',
        label: 'Notes'
      }
    ]
  },
  {
    id: 'review',
    label: 'Google review',
    tickets: 5,
    proofFields: [
      {
        id: 'review_url',
        label: 'Review link',
        input: 'url',
        requiredWhenBonus: true
      }
    ]
  }
];

describe('trimBonusProofForSubmit', () => {
  it('keeps only configured fields, trims values, and drops empties', () => {
    const proof = {
      instagram: {
        handle: '  @spectrum  ',
        post_url: 'https://instagram.com/p/abc',
        notes: '   ',
        ignored: 'should-drop'
      },
      review: {
        review_url: ''
      },
      unknown_rule: {
        handle: 'x'
      }
    };

    assert.deepEqual(trimBonusProofForSubmit(proof, rules), {
      instagram: {
        handle: '@spectrum',
        post_url: 'https://instagram.com/p/abc'
      }
    });
  });

  it('caps proof values at 500 characters', () => {
    const long = 'x'.repeat(600);
    const trimmed = trimBonusProofForSubmit(
      { instagram: { handle: long, post_url: 'https://example.com/a' } },
      rules
    );
    assert.equal(trimmed.instagram.handle.length, 500);
  });
});

describe('validateBonusProof', () => {
  it('returns null when selected bonuses have required proof filled', () => {
    const err = validateBonusProof(
      {
        instagram: {
          handle: '@ok',
          post_url: 'https://instagram.com/p/1'
        }
      },
      rules,
      { instagram: true }
    );
    assert.equal(err, null);
  });

  it('skips required checks for unselected bonuses', () => {
    const err = validateBonusProof({}, rules, { instagram: false, review: false });
    assert.equal(err, null);
  });

  it('requires proof fields when the bonus is selected', () => {
    const err = validateBonusProof(
      { instagram: { handle: '  ' } },
      rules,
      { instagram: true }
    );
    assert.match(err, /IG handle/);
    assert.match(err, /Instagram share/);
  });

  it('rejects non-https URLs for url proof fields', () => {
    const err = validateBonusProof(
      {
        instagram: {
          handle: '@ok',
          post_url: 'http://instagram.com/p/1'
        }
      },
      rules,
      { instagram: true }
    );
    assert.match(err, /https:\/\//i);
    assert.match(err, /Post link/);
  });

  it('allows blank optional url fields and accepts https links', () => {
    const withOptionalBlank = validateBonusProof(
      {
        instagram: {
          handle: '@ok',
          post_url: 'https://instagram.com/p/1',
          notes: ''
        }
      },
      [
        {
          ...rules[0],
          proofFields: [
            rules[0].proofFields[0],
            { id: 'optional_url', label: 'Optional link', input: 'url' },
            rules[0].proofFields[1]
          ]
        }
      ],
      { instagram: true }
    );
    assert.equal(withOptionalBlank, null);
  });
});
