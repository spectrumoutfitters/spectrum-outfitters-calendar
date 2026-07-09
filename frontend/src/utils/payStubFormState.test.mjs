import assert from 'node:assert/strict';
import test from 'node:test';

import {
  copyFirstPeriodWagesToShared,
  copySharedWagesToPeriods,
} from './payStubFormState.js';

test('copySharedWagesToPeriods fills each period wage field from shared values', () => {
  const periods = [
    { periodEnd: '2026-01-09', gross: '', regularHours: '', hourlyRate: '' },
    { periodEnd: '2026-01-16', gross: '', regularHours: '', hourlyRate: '' },
  ];
  const shared = {
    gross: '1500.00',
    regularHours: '40',
    hourlyRate: '37.50',
    otherLabel: 'Tools',
    otherAmount: '25.00',
    federal: '99.00',
  };

  assert.deepEqual(copySharedWagesToPeriods(periods, shared), [
    {
      periodEnd: '2026-01-09',
      gross: '1500.00',
      regularHours: '40',
      hourlyRate: '37.50',
      otherLabel: 'Tools',
      otherAmount: '25.00',
    },
    {
      periodEnd: '2026-01-16',
      gross: '1500.00',
      regularHours: '40',
      hourlyRate: '37.50',
      otherLabel: 'Tools',
      otherAmount: '25.00',
    },
  ]);
});

test('copyFirstPeriodWagesToShared preserves visible wages when collapsing to shared mode', () => {
  const shared = { gross: '', regularHours: '', hourlyRate: '', otherLabel: '', otherAmount: '', federal: '11.00' };
  const periods = [
    { periodEnd: '2026-01-09', gross: '', regularHours: '', hourlyRate: '', otherLabel: '', otherAmount: '' },
    {
      periodEnd: '2026-01-16',
      gross: '1200.00',
      regularHours: '32',
      hourlyRate: '37.50',
      otherLabel: 'Health',
      otherAmount: '15.00',
    },
  ];

  assert.deepEqual(copyFirstPeriodWagesToShared(shared, periods), {
    gross: '1200.00',
    regularHours: '32',
    hourlyRate: '37.50',
    otherLabel: 'Health',
    otherAmount: '15.00',
    federal: '11.00',
  });
});
