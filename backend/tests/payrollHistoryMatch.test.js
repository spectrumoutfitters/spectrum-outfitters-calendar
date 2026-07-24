import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { namesLikelyMatch } from '../utils/payrollHistoryMatch.js';

describe('namesLikelyMatch token boundaries', () => {
  it('matches middle-name variants via first+last', () => {
    assert.equal(namesLikelyMatch('Patrick Tung Gaines', 'Patrick Gaines'), true);
    assert.equal(namesLikelyMatch('Patrick Gaines', 'Patrick Tung Gaines'), true);
  });

  it('does not treat substring tokens as the same person', () => {
    assert.equal(namesLikelyMatch('Ann Lee', 'Joanne Lee'), false);
    assert.equal(namesLikelyMatch('Joanne Lee', 'Ann Lee'), false);
    assert.equal(namesLikelyMatch('Chris Johnson', 'Christina Johnson'), false);
    assert.equal(namesLikelyMatch('Rob Smith', 'Robert Smith'), false);
  });

  it('still matches exact and reversed payroll forms', () => {
    assert.equal(namesLikelyMatch('Jane Doe', 'Jane Doe'), true);
    assert.equal(namesLikelyMatch('Jane Doe', 'Doe, Jane'), true);
  });
});
