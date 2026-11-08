import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../utils/googleCalendarService.js'
);

/**
 * Load the calendar type helpers without importing the service.
 * That module opens the database at import time.
 */
function loadCalendarTypeHelpers() {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const typeLabel = sliceFunction(src, 'function typeLabel(type)');
  const normalizeText = sliceFunction(src, 'function normalizeText(s)');
  const parseTypeFromSummary = sliceFunction(src, 'function parseTypeFromSummary(summary)');
  const loaded = new Function(
    `${typeLabel}\n${normalizeText}\n${parseTypeFromSummary}\nreturn { typeLabel, parseTypeFromSummary };`
  )();
  return { src, ...loaded };
}

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) {
    throw new Error(`${signature} moved in googleCalendarService.js`);
  }
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${signature} is unterminated in googleCalendarService.js`);
}

const { src, typeLabel, parseTypeFromSummary } = loadCalendarTypeHelpers();

/** Same summary template pushEventToGoogle writes onto the Google event. */
function googleSummary({ namePart, type, reason }) {
  return `[SO] ${namePart} - ${typeLabel(type)}${reason ? ` (${reason})` : ''}`;
}

const ROUND_TRIP_LABELS = {
  day_off: 'Day Off',
  approved_time_off: 'Approved Time Off',
  out_of_office: 'Out of Office',
  vacation: 'Vacation',
  sick_leave: 'Sick Leave',
  personal_leave: 'Personal Leave',
  training: 'Training',
  meeting: 'Meeting',
  other: 'Other'
};

describe('typeLabel', () => {
  it('uses the labels pushEventToGoogle writes into the Google summary', () => {
    assert.match(
      src,
      /const summary = `\[SO\] \$\{namePart\} - \$\{typeLabel\(entry\.type\)\}\$\{entry\.reason \? ` \(\$\{entry\.reason\}\)` : ''\}`;/
    );
    for (const [type, label] of Object.entries(ROUND_TRIP_LABELS)) {
      assert.equal(typeLabel(type), label);
    }
    assert.equal(typeLabel('time_off_request'), 'Time Off Request');
  });

  it('keeps an unknown type string and replaces only blank types with Other', () => {
    assert.equal(typeLabel('pto'), 'pto');
    assert.equal(typeLabel(null), 'Other');
    assert.equal(typeLabel(undefined), 'Other');
    assert.equal(typeLabel(''), 'Other');
  });
});

describe('Google summary type round trip', () => {
  it('classifies each synced label back to the same schedule type', () => {
    for (const [type, label] of Object.entries(ROUND_TRIP_LABELS)) {
      assert.equal(parseTypeFromSummary(googleSummary({ namePart: 'Alex', type })), type, label);
      assert.equal(
        parseTypeFromSummary(googleSummary({ namePart: 'Shop Closed', type, reason: 'family visit' })),
        type,
        `${label} with a shop-closed name and a neutral reason`
      );
    }
  });

  it('does not let Approved Time Off collapse into Day Off', () => {
    assert.equal(
      parseTypeFromSummary(googleSummary({ namePart: 'Alex', type: 'approved_time_off' })),
      'approved_time_off'
    );
    assert.equal(
      parseTypeFromSummary(googleSummary({ namePart: 'Alex', type: 'day_off' })),
      'day_off'
    );
  });

  it('does not reclassify unsynced or free-text types as a different leave type', () => {
    for (const type of ['time_off_request', 'appointment', 'workshop', 'conference']) {
      const parsed = parseTypeFromSummary(googleSummary({ namePart: 'Alex', type }));
      assert.ok(
        parsed === type || parsed === 'other',
        `${type} parsed as ${parsed}`
      );
      assert.notEqual(parsed, 'vacation');
      assert.notEqual(parsed, 'sick_leave');
      assert.notEqual(parsed, 'personal_leave');
      assert.notEqual(parsed, 'day_off');
      assert.notEqual(parsed, 'approved_time_off');
    }
  });
});
