import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyShopMonkeySelectAll,
  confirmedShopMonkeyItems,
  shopMonkeySelectionState,
  toggleShopMonkeySelection,
} from '../src/utils/shopMonkeyWorkItemSelection.js';

describe('shopMonkey work-item selection', () => {
  it('includes items unless selected is explicitly false', () => {
    const state = shopMonkeySelectionState([
      { name: 'PPF hood', hours: 2 },
      { name: 'Skipped', selected: false },
      { name: 'Tint', selected: true },
      { name: 'Zero flag', selected: 0 },
    ]);

    assert.equal(state.selectAll, false);
    assert.deepEqual(
      state.items.map((item) => item.selected),
      [true, false, true, true]
    );
    assert.deepEqual(
      confirmedShopMonkeyItems(state.items).map((item) => item.name),
      ['PPF hood', 'Tint', 'Zero flag']
    );
  });

  it('starts with select-all when every item is included', () => {
    const state = shopMonkeySelectionState([{ name: 'Oil change' }, { name: 'Filter', selected: true }]);
    assert.equal(state.selectAll, true);
    assert.equal(confirmedShopMonkeyItems(state.items).length, 2);
  });

  it('treats a non-array payload as nothing to import', () => {
    const state = shopMonkeySelectionState({ name: 'not-a-list' });
    assert.deepEqual(state, { items: [], selectAll: false });
    assert.deepEqual(confirmedShopMonkeyItems(state.items), []);
  });

  it('drops an item when it is toggled off and restores select-all when the last exclusion is cleared', () => {
    const initial = shopMonkeySelectionState([
      { name: 'A' },
      { name: 'B' },
    ]);
    const off = toggleShopMonkeySelection(initial.items, 1);
    assert.equal(off.selectAll, false);
    assert.deepEqual(
      confirmedShopMonkeyItems(off.items).map((item) => item.name),
      ['A']
    );

    const on = toggleShopMonkeySelection(off.items, 1);
    assert.equal(on.selectAll, true);
    assert.equal(confirmedShopMonkeyItems(on.items).length, 2);
  });

  it('select-all flips every item, including an empty list', () => {
    const cleared = applyShopMonkeySelectAll(
      shopMonkeySelectionState([{ name: 'A' }, { name: 'B', selected: false }]).items,
      true
    );
    assert.equal(cleared.selectAll, false);
    assert.deepEqual(confirmedShopMonkeyItems(cleared.items), []);

    const empty = applyShopMonkeySelectAll([], false);
    assert.equal(empty.selectAll, true);
    assert.deepEqual(empty.items, []);
  });
});
