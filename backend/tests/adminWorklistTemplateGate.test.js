import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeWorklistTemplateCreate,
  normalizeWorklistTemplateUpdate,
} from '../utils/adminWorklistTemplateGate.js';

describe('normalizeWorklistTemplateCreate', () => {
  it('rejects falsy title (0 / "" / null / undefined) but keeps string "0"', () => {
    for (const title of [0, '', null, undefined, false]) {
      const r = normalizeWorklistTemplateCreate({ title, recurrence: 'daily' });
      assert.deepEqual(r, { ok: false, error: 'Title is required' }, String(title));
    }
    const kept = normalizeWorklistTemplateCreate({ title: '0', recurrence: 'daily' });
    assert.equal(kept.ok, true);
    assert.equal(kept.title, '0');
  });

  it('rejects recurrence outside daily/weekly/monthly (including missing and Daily)', () => {
    for (const recurrence of [undefined, null, '', 'Daily', 'weekly ', 'once']) {
      const r = normalizeWorklistTemplateCreate({ title: 'Standup', recurrence });
      assert.deepEqual(r, { ok: false, error: 'Invalid recurrence type' }, String(recurrence));
    }
  });

  it('keeps weekly day_of_week and monthly day_of_month; others null', () => {
    const weekly = normalizeWorklistTemplateCreate({
      title: 'Fri review',
      recurrence: 'weekly',
      day_of_week: 5,
      day_of_month: 15,
    });
    assert.equal(weekly.day_of_week, 5);
    assert.equal(weekly.day_of_month, null);

    const monthly = normalizeWorklistTemplateCreate({
      title: 'Month close',
      recurrence: 'monthly',
      day_of_week: 1,
      day_of_month: 28,
    });
    assert.equal(monthly.day_of_week, null);
    assert.equal(monthly.day_of_month, 28);

    const daily = normalizeWorklistTemplateCreate({
      title: 'Daily',
      recurrence: 'daily',
      day_of_week: 2,
      day_of_month: 3,
    });
    assert.equal(daily.day_of_week, null);
    assert.equal(daily.day_of_month, null);
  });

  it('coerces description/link_target with || null and sort_order with || 0', () => {
    const r = normalizeWorklistTemplateCreate({ title: 'T', recurrence: 'daily' });
    assert.equal(r.description, null);
    assert.equal(r.link_target, null);
    assert.equal(r.sort_order, 0);

    const empty = normalizeWorklistTemplateCreate({
      title: 'T',
      recurrence: 'daily',
      description: '',
      link_target: '',
      sort_order: '',
    });
    assert.equal(empty.description, null);
    assert.equal(empty.link_target, null);
    assert.equal(empty.sort_order, 0);

    const neg = normalizeWorklistTemplateCreate({ title: 'T', recurrence: 'daily', sort_order: -3 });
    assert.equal(neg.sort_order, -3);
  });

  it('defaults enabled on unless enabled is exactly false (0 / "false" still on)', () => {
    assert.equal(normalizeWorklistTemplateCreate({ title: 'T', recurrence: 'daily' }).enabled, 1);
    assert.equal(normalizeWorklistTemplateCreate({ title: 'T', recurrence: 'daily', enabled: 0 }).enabled, 1);
    assert.equal(normalizeWorklistTemplateCreate({ title: 'T', recurrence: 'daily', enabled: 'false' }).enabled, 1);
    assert.equal(normalizeWorklistTemplateCreate({ title: 'T', recurrence: 'daily', enabled: false }).enabled, 0);
  });
});

describe('normalizeWorklistTemplateUpdate', () => {
  const existing = {
    title: 'Keep',
    description: 'old desc',
    recurrence: 'weekly',
    day_of_week: 1,
    day_of_month: null,
    link_target: '/admin',
    sort_order: 4,
    enabled: 1,
  };

  it('keeps existing fields when body omits them, but clears day columns when recurrence is omitted', () => {
    const r = normalizeWorklistTemplateUpdate({}, existing);
    assert.equal(r.title, 'Keep');
    assert.equal(r.description, 'old desc');
    assert.equal(r.recurrence, 'weekly');
    assert.equal(r.link_target, '/admin');
    assert.equal(r.sort_order, 4);
    assert.equal(r.enabled, 1);
    // body.recurrence is undefined, so day fields follow `recurrence === 'weekly'` on the raw body
    assert.equal(r.day_of_week, null);
    assert.equal(r.day_of_month, null);
  });

  it('uses truthy enabled on update (0 / "" disable; create-style !== false is not used)', () => {
    assert.equal(normalizeWorklistTemplateUpdate({ enabled: true }, existing).enabled, 1);
    assert.equal(normalizeWorklistTemplateUpdate({ enabled: 1 }, existing).enabled, 1);
    assert.equal(normalizeWorklistTemplateUpdate({ enabled: 'false' }, existing).enabled, 1);
    assert.equal(normalizeWorklistTemplateUpdate({ enabled: 0 }, existing).enabled, 0);
    assert.equal(normalizeWorklistTemplateUpdate({ enabled: '' }, existing).enabled, 0);
    assert.equal(normalizeWorklistTemplateUpdate({ enabled: false }, existing).enabled, 0);
  });

  it('can set empty title on update (no re-validation)', () => {
    const r = normalizeWorklistTemplateUpdate({ title: '' }, existing);
    assert.equal(r.title, '');
  });

  it('sets weekly/monthly day fields from body recurrence only', () => {
    const weekly = normalizeWorklistTemplateUpdate(
      { recurrence: 'weekly', day_of_week: 5, day_of_month: 9 },
      existing
    );
    assert.equal(weekly.day_of_week, 5);
    assert.equal(weekly.day_of_month, null);

    const monthly = normalizeWorklistTemplateUpdate(
      { recurrence: 'monthly', day_of_week: 5, day_of_month: 9 },
      existing
    );
    assert.equal(monthly.day_of_week, null);
    assert.equal(monthly.day_of_month, 9);
  });
});
