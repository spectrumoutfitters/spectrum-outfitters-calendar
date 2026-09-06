import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isMyWorklistCompleted,
  partitionMyWorklistItems,
} from '../src/utils/myWorklistCompleted.js';

describe('isMyWorklistCompleted', () => {
  it('truthy is_completed including string "0" / "1" / true; exact 0 / false pending', () => {
    assert.equal(isMyWorklistCompleted({ is_completed: 1 }), true);
    assert.equal(isMyWorklistCompleted({ is_completed: true }), true);
    assert.equal(isMyWorklistCompleted({ is_completed: '1' }), true);
    assert.equal(isMyWorklistCompleted({ is_completed: '0' }), true);
    assert.equal(isMyWorklistCompleted({ is_completed: 0 }), false);
    assert.equal(isMyWorklistCompleted({ is_completed: false }), false);
    assert.equal(isMyWorklistCompleted({ is_completed: '' }), false);
    assert.equal(isMyWorklistCompleted({ is_completed: null }), false);
    assert.equal(isMyWorklistCompleted({}), false);
  });
});

describe('partitionMyWorklistItems', () => {
  it('splits on truthy is_completed — Admin #114 === 1 would keep true/"1" pending', () => {
    const items = [
      { id: 'a', is_completed: 0 },
      { id: 'b', is_completed: 1 },
      { id: 'c', is_completed: true },
      { id: 'd', is_completed: '1' },
      { id: 'e', is_completed: '0' },
      { id: 'f', is_completed: false },
    ];
    const { pendingItems, completedItems } = partitionMyWorklistItems(items);
    assert.deepEqual(pendingItems.map((i) => i.id), ['a', 'f']);
    assert.deepEqual(completedItems.map((i) => i.id), ['b', 'c', 'd', 'e']);
  });
});
