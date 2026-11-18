import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../utils/customerBookingService.js'
);

/**
 * Load the vehicle line used in the Google Calendar description and the staff email.
 * customerBookingService.js opens SQLite and Google clients on import.
 */
function loadFormatVehiclesHuman() {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const signature = 'function formatVehiclesHuman(vehicles)';
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  const body = src.slice(start, endOfBrace(src, src.indexOf('{', start)));

  if (!body.includes('[v.year, v.make, v.model]')) {
    throw new Error('slice missed the year/make/model order');
  }
  if (!body.includes(".join('; ')")) {
    throw new Error('slice missed the multi-vehicle separator');
  }
  if (!body.includes("return '—'")) {
    throw new Error('slice missed the empty-list marker');
  }
  if (body.includes('normalizeSlotFromRequest') || body.includes('db.') || body.includes('await ')) {
    throw new Error('slice pulled in booking submission');
  }

  return new Function(`${body}\nreturn formatVehiclesHuman;`)();
}

function endOfBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error('unterminated formatVehiclesHuman');
}

const formatVehiclesHuman = loadFormatVehiclesHuman();

describe('booking vehicle label', () => {
  it('uses an em dash when the drop-off has no vehicles', () => {
    assert.equal(formatVehiclesHuman([]), '—');
  });

  it('keeps year, make, and model in that order, including a multi-word make', () => {
    assert.equal(
      formatVehiclesHuman([{ year: '2024', make: 'Land Rover', model: 'Defender' }]),
      '2024 Land Rover Defender'
    );
  });

  it('drops blank parts and separates each vehicle with a semicolon', () => {
    assert.equal(
      formatVehiclesHuman([
        { year: '2018', make: '', model: 'F-150' },
        { make: 'Honda' },
        { year: '2016', model: 'Civic' }
      ]),
      '2018 F-150; Honda; 2016 Civic'
    );
  });
});
