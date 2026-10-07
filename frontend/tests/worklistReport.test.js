import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  completionPercent,
  formatAverageWorkMinutes,
  formatHistoryMinutes,
  worklistCategoryLabel,
  worklistHistorySearchParams,
  worklistStatsSearchParams,
} from '../src/utils/worklistReport.js';

describe('completionPercent', () => {
  it('returns 0 when there is nothing to complete', () => {
    assert.equal(completionPercent(0, 0), 0);
    assert.equal(completionPercent(1, 0), 0);
    assert.equal(completionPercent(null, null), 0);
    assert.equal(completionPercent(3, '0'), 0);
  });

  it('rounds the share of completed items', () => {
    assert.equal(completionPercent(0, 5), 0);
    assert.equal(completionPercent(1, 2), 50);
    assert.equal(completionPercent(1, 3), 33);
    assert.equal(completionPercent(2, 3), 67);
    assert.equal(completionPercent(4, 4), 100);
    assert.equal(completionPercent('1', '2'), 50);
  });

  it('treats a null completed count as zero when the bucket has items', () => {
    assert.equal(completionPercent(null, 4), 0);
  });
});

describe('worklist labels and minute display', () => {
  it('maps known categories and leaves unknown keys visible', () => {
    assert.equal(worklistCategoryLabel('time_approval'), 'Time Approval');
    assert.equal(worklistCategoryLabel('task_review'), 'Task Review');
    assert.equal(worklistCategoryLabel('compliance'), 'Compliance');
    assert.equal(worklistCategoryLabel('inventory'), 'Inventory');
    assert.equal(worklistCategoryLabel('general'), 'General');
    assert.equal(worklistCategoryLabel('shop_errand'), 'shop_errand');
  });

  it('rounds the average and shows a dash when there is no average', () => {
    assert.equal(formatAverageWorkMinutes(12.4), '12m');
    assert.equal(formatAverageWorkMinutes(12.5), '13m');
    assert.equal(formatAverageWorkMinutes(0), '-');
    assert.equal(formatAverageWorkMinutes(null), '-');
  });

  it('shows history minutes, and a dash for zero or missing time', () => {
    assert.equal(formatHistoryMinutes(15), '15 min');
    assert.equal(formatHistoryMinutes(0), '-');
    assert.equal(formatHistoryMinutes(null), '-');
  });
});

describe('worklist report query params', () => {
  it('omits empty stat dates', () => {
    const params = worklistStatsSearchParams({ start_date: '', end_date: '2026-05-18' });
    assert.equal(params.toString(), 'end_date=2026-05-18');
  });

  it('does not send All Categories as a category filter', () => {
    const params = worklistHistorySearchParams({
      start_date: '2026-05-01',
      end_date: '2026-05-18',
      category: 'all',
    });
    assert.equal(params.get('category'), null);
    assert.equal(params.get('start_date'), '2026-05-01');
    assert.equal(params.get('end_date'), '2026-05-18');
  });

  it('sends a specific history category', () => {
    const params = worklistHistorySearchParams({
      start_date: '',
      end_date: '',
      category: 'inventory',
    });
    assert.equal(params.toString(), 'category=inventory');
  });
});
