export const PAY_STUB_WAGE_FIELDS = [
  'gross',
  'regularHours',
  'hourlyRate',
  'otherLabel',
  'otherAmount',
];

function pickWageFields(source = {}) {
  return PAY_STUB_WAGE_FIELDS.reduce((picked, key) => {
    picked[key] = source[key] ?? '';
    return picked;
  }, {});
}

function hasAnyWageField(source = {}) {
  return PAY_STUB_WAGE_FIELDS.some((key) => `${source[key] ?? ''}`.trim() !== '');
}

export function copySharedWagesToPeriods(periodRows, sharedValues) {
  const sharedWages = pickWageFields(sharedValues);
  return periodRows.map((row) => ({ ...row, ...sharedWages }));
}

export function copyFirstPeriodWagesToShared(sharedValues, periodRows) {
  const source = periodRows.find(hasAnyWageField) || periodRows[0] || {};
  return { ...sharedValues, ...pickWageFields(source) };
}
