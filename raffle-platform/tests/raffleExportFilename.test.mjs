import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  raffleExportContentDisposition,
  raffleExportCsvBody,
  raffleExportCsvFilename,
  raffleExportCsvReady,
} from '../src/lib/raffleExportFilename.js';

describe('raffleExportCsvReady', () => {
  it('requires upstream ok, data.ok, and a truthy csv (empty string fails)', () => {
    assert.equal(raffleExportCsvReady(true, { ok: true, csv: 'a,b\n' }), true);
    assert.equal(raffleExportCsvReady(false, { ok: true, csv: 'a' }), false);
    assert.equal(raffleExportCsvReady(true, { ok: false, csv: 'a' }), false);
    assert.equal(raffleExportCsvReady(true, { ok: true, csv: '' }), false);
    assert.equal(raffleExportCsvReady(true, { ok: true }), false);
    assert.equal(raffleExportCsvReady(true, { ok: true, csv: 0 }), false);
  });
});

describe('raffleExportCsvFilename / Content-Disposition', () => {
  it('interpolates the raw slug (no trim/sanitize) and a YYYY-MM-DD date', () => {
    assert.equal(raffleExportCsvFilename('spring-bash', '2026-08-28'), 'entries-spring-bash-2026-08-28.csv');
    assert.equal(raffleExportCsvFilename('0', '2026-01-01'), 'entries-0-2026-01-01.csv');
    assert.equal(raffleExportCsvFilename('  spaced  ', '2026-08-28'), 'entries-  spaced  -2026-08-28.csv');
  });

  it('does not escape quotes/newlines in the filename (header injection surface)', () => {
    const filename = raffleExportCsvFilename('foo"; filename="evil', '2026-08-28');
    assert.equal(filename, 'entries-foo"; filename="evil-2026-08-28.csv');
    assert.equal(
      raffleExportContentDisposition(filename),
      'attachment; filename="entries-foo"; filename="evil-2026-08-28.csv"',
    );
  });
});

describe('raffleExportCsvBody', () => {
  it('prefixes a UTF-8 BOM so Excel opens the CSV', () => {
    assert.equal(raffleExportCsvBody('a,b'), '\uFEFFa,b');
  });
});
