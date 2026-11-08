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
 * Load the type parser without importing the service.
 * That module opens the database at import time.
 */
function loadParser() {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const normalizeText = sliceFunction(src, 'function normalizeText(s)');
  const typeMatchText = sliceFunction(src, 'function typeMatchText(summary)');
  const parseTypeFromSummary = sliceFunction(src, 'function parseTypeFromSummary(summary)');
  return new Function(
    `${normalizeText}\n${typeMatchText}\n${parseTypeFromSummary}\nreturn { parseTypeFromSummary };`
  )();
}

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`${signature} moved in googleCalendarService.js`);
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

const { parseTypeFromSummary } = loadParser();

/** Same summary template pushEventToGoogle writes onto the Google event. */
function googleSummary(namePart, typeLabel, reason) {
  return `[SO] ${namePart} - ${typeLabel}${reason ? ` (${reason})` : ''}`;
}

describe('parseTypeFromSummary app round trip', () => {
  it('keeps the pushed label when the reason contains an earlier leave keyword', () => {
    assert.equal(parseTypeFromSummary(googleSummary('Alex', 'Meeting', 'personal topic')), 'meeting');
    assert.equal(parseTypeFromSummary(googleSummary('Alex', 'Meeting', 'training the new hire')), 'meeting');
    assert.equal(parseTypeFromSummary(googleSummary('Alex', 'Training', 'personal development')), 'training');
    assert.equal(parseTypeFromSummary(googleSummary('Alex', 'Training', 'sick leave procedures')), 'training');
    assert.equal(parseTypeFromSummary(googleSummary('Alex', 'Day Off', "I'm sick")), 'day_off');
    assert.equal(parseTypeFromSummary(googleSummary('Alex', 'Approved Time Off', 'vacation overlap')), 'approved_time_off');
    assert.equal(parseTypeFromSummary(googleSummary('Alex', 'Other', 'meeting notes')), 'other');
  });

  it('does not let the employee name steal the type', () => {
    assert.equal(parseTypeFromSummary(googleSummary('Sandy Sickles', 'Meeting')), 'meeting');
    assert.equal(parseTypeFromSummary(googleSummary('Sandy Sickles', 'Day Off', 'appointment')), 'day_off');
    assert.equal(parseTypeFromSummary(googleSummary('Shop Closed', 'Other', 'staff meeting')), 'other');
  });

  it('still classifies each clean label', () => {
    const cases = [
      ['Day Off', 'day_off'],
      ['Approved Time Off', 'approved_time_off'],
      ['Out of Office', 'out_of_office'],
      ['Vacation', 'vacation'],
      ['Sick Leave', 'sick_leave'],
      ['Personal Leave', 'personal_leave'],
      ['Training', 'training'],
      ['Meeting', 'meeting'],
      ['Other', 'other'],
    ];
    for (const [label, type] of cases) {
      assert.equal(parseTypeFromSummary(googleSummary('Alex', label)), type, label);
    }
  });

  it('does not turn Approved Time Off into Day Off', () => {
    assert.equal(parseTypeFromSummary(googleSummary('Alex', 'Approved Time Off')), 'approved_time_off');
    assert.equal(parseTypeFromSummary(googleSummary('Alex', 'Day Off')), 'day_off');
  });

  it('keeps unstructured Google titles on the same keyword rules', () => {
    assert.equal(parseTypeFromSummary('Vacation'), 'vacation');
    assert.equal(parseTypeFromSummary('Team meeting'), 'meeting');
    assert.equal(parseTypeFromSummary('Out of office'), 'out_of_office');
  });
});
