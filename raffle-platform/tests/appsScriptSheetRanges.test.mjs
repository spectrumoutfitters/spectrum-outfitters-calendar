import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Loads the raffle workbook writer. CreateSpreadsheet.gs builds A1 ranges from
 * column numbers so a string-concat bug cannot shift headers or sample rows.
 */
const codePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../google-apps-script/CreateSpreadsheet.gs',
);
const source = fs.readFileSync(codePath, 'utf8');

function endOfFunction(text, openBrace) {
  let depth = 0;
  let state = 'code';
  for (let i = openBrace; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (state === 'line') {
      if (c === '\n') state = 'code';
      continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code';
        i += 1;
      }
      continue;
    }
    if (state === 'sq' || state === 'dq') {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"')) state = 'code';
      continue;
    }
    if (c === '/' && next === '/') {
      state = 'line';
      i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      state = 'block';
      i += 1;
      continue;
    }
    if (c === "'") {
      state = 'sq';
      continue;
    }
    if (c === '"') {
      state = 'dq';
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('unterminated function body');
}

function sliceFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `CreateSpreadsheet.gs is missing ${name}`);
  assert.equal(source.indexOf(marker, start + marker.length), -1, `CreateSpreadsheet.gs defines ${name} twice`);
  const open = source.indexOf('{', start);
  const end = endOfFunction(source, open);
  return source.slice(start, end + 1);
}

function loadSheetWriter() {
  const body = [
    sliceFunction('columnIndexToLetter1_'),
    sliceFunction('setValuesBlock_'),
    'return { columnIndexToLetter1: columnIndexToLetter1_, setValuesBlock: setValuesBlock_ };',
  ].join('\n');
  return new Function(body)();
}

const { columnIndexToLetter1, setValuesBlock } = loadSheetWriter();

function recordingSheet() {
  const calls = [];
  return {
    calls,
    getRange(a1) {
      return {
        setValues(rows) {
          calls.push({ a1, rows });
        },
      };
    },
  };
}

describe('columnIndexToLetter1_', () => {
  it('converts 1-based columns through three letters', () => {
    const letters = {
      1: 'A',
      26: 'Z',
      27: 'AA',
      28: 'AB',
      52: 'AZ',
      53: 'BA',
      702: 'ZZ',
      703: 'AAA',
    };
    for (const [column, letter] of Object.entries(letters)) {
      assert.equal(columnIndexToLetter1(Number(column)), letter);
      assert.equal(columnIndexToLetter1(String(column)), letter);
    }
    assert.equal(columnIndexToLetter1(1.9), 'A');
  });

  it('rejects a column before A', () => {
    for (const column of [0, -1, 0.9]) {
      assert.throws(
        () => columnIndexToLetter1(column),
        (error) => error instanceof Error && error.message.includes('out of range'),
      );
    }
  });
});

describe('setValuesBlock_', () => {
  it('writes a numeric A1 range instead of concatenating the start row', () => {
    const rows = Array.from({ length: 3 }, () => Array.from({ length: 28 }, (_, index) => index));
    const sheet = recordingSheet();
    setValuesBlock(sheet, '2.9', rows);
    assert.equal(sheet.calls.length, 1);
    assert.equal(sheet.calls[0].a1, 'A2:AB4');
    assert.equal(sheet.calls[0].rows, rows);
  });

  it('rejects an empty block, a ragged row, or a start row before row 1', () => {
    const sheet = recordingSheet();
    const rejected = [
      [[], 'need at least one data row'],
      [[null], 'first row must be an array'],
      [[[]], 'empty row/column count'],
      [[[1, 2], [1]], 'width mismatch'],
    ];
    for (const [rows, message] of rejected) {
      assert.throws(
        () => setValuesBlock(sheet, 1, rows),
        (error) => error instanceof Error && error.message.includes(message),
      );
    }
    assert.throws(
      () => setValuesBlock(sheet, 0, [['only']]),
      (error) => error instanceof Error && error.message.includes('bad startRow'),
    );
    assert.equal(sheet.calls.length, 0);
  });
});
