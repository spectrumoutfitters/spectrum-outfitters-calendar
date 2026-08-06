import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkItemsFromOrderFallback } from '../utils/shopmonkeyWorkItemFallback.js';

describe('buildWorkItemsFromOrderFallback', () => {
  it('returns empty for null/non-object orders', () => {
    assert.deepEqual(buildWorkItemsFromOrderFallback(null), []);
    assert.deepEqual(buildWorkItemsFromOrderFallback(undefined), []);
    assert.deepEqual(buildWorkItemsFromOrderFallback('x'), []);
  });

  it('prefers generatedName over name and coalescedName', () => {
    const items = buildWorkItemsFromOrderFallback({
      generatedName: 'brake job',
      name: 'ignored',
      coalescedName: 'also ignored'
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Brake Job');
    assert.equal(items[0].order, 1);
    assert.equal(items[0].source, 'shopmonkey');
  });

  it('falls back to name then coalescedName', () => {
    assert.equal(
      buildWorkItemsFromOrderFallback({ name: 'oil change' })[0].title,
      'Oil Change'
    );
    assert.equal(
      buildWorkItemsFromOrderFallback({ coalescedName: 'state inspection' })[0].title,
      'State Inspection'
    );
  });

  it('adds inspection only when NotCompleted with count > 0', () => {
    assert.equal(
      buildWorkItemsFromOrderFallback({
        inspectionStatus: 'NotCompleted',
        inspectionCount: 0
      }).length,
      0
    );
    assert.equal(
      buildWorkItemsFromOrderFallback({
        inspectionStatus: 'Completed',
        inspectionCount: 2
      }).length,
      0
    );
    const items = buildWorkItemsFromOrderFallback({
      inspectionStatus: 'NotCompleted',
      inspectionCount: 1
    });
    assert.deepEqual(items.map((i) => i.title), ['Vehicle Inspection']);
  });

  it('formats labor with hours when both laborCents and totalLaborHours are set', () => {
    const withHours = buildWorkItemsFromOrderFallback({
      laborCents: 15000,
      totalLaborHours: 2
    });
    assert.equal(withHours[0].title, 'Labor - 2 hours');

    const singular = buildWorkItemsFromOrderFallback({
      laborCents: 7500,
      totalLaborHours: 1
    });
    assert.equal(singular[0].title, 'Labor - 1 hour');

    const noHours = buildWorkItemsFromOrderFallback({ laborCents: 5000 });
    assert.equal(noHours[0].title, 'Labor');
  });

  it('adds parts when partsCents > 0 and skips zero cents', () => {
    assert.deepEqual(
      buildWorkItemsFromOrderFallback({ partsCents: 0 }).map((i) => i.title),
      []
    );
    assert.equal(
      buildWorkItemsFromOrderFallback({ partsCents: 2500 })[0].title,
      'Parts'
    );
  });

  it('includes complaint and recommendation with title case and stable order', () => {
    const items = buildWorkItemsFromOrderFallback({
      generatedName: 'diagnostic',
      laborCents: 1000,
      partsCents: 500,
      complaint: 'rough idle',
      recommendation: 'clean throttle body'
    });
    assert.deepEqual(
      items.map((i) => i.title),
      ['Diagnostic', 'Labor', 'Parts', 'Rough Idle', 'Clean Throttle Body']
    );
    assert.deepEqual(
      items.map((i) => i.order),
      [1, 2, 3, 4, 5]
    );
  });

  it('ignores blank whitespace-only service/complaint fields', () => {
    assert.deepEqual(
      buildWorkItemsFromOrderFallback({
        generatedName: '   ',
        complaint: '\t',
        recommendation: ''
      }),
      []
    );
  });
});
