import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const panelPath = path.join(here, '../src/components/raffle/AdminEventConfigPanel.tsx');
const scriptPath = path.join(here, '../google-apps-script/Code.gs');

/**
 * Staff-facing copy for saveEventConfig error codes. An unmapped code stays
 * visible so a new server rejection is not replaced with a generic failure.
 */
const STAFF_MESSAGES = {
  need_at_least_one_raffle: 'Keep at least one prize row.',
  too_many_raffles: 'Too many prizes (max 24).',
  invalid_raffle_id: 'Each prize needs an ID (letters, numbers, dashes, underscores only).',
  invalid_raffle_title: 'Each prize needs a title (max 200 characters).',
  invalid_raffle_subtitle: 'Subtitle too long (max 500 characters).',
  duplicate_raffle_id: 'Two prizes used the same ID — make each prize ID unique.',
  image_url_must_be_https_or_empty: 'Image URL must be empty or start with https://',
  invalid_raffle_value_label: 'Prize value text is too long (max 160 characters).',
  invalid_raffle_draw_at:
    'Draw date/time is invalid or too long — use a real date/time or leave it blank.',
  invalid_bonus_rules_json: 'Bonus rules must be valid JSON or empty.',
  unauthorized: 'Admin key was rejected.',
};

/**
 * Load the draw-time converters and the save-error map without importing the
 * client component. The panel pulls in React at module scope.
 */
function loadPanelHelpers() {
  const src = fs.readFileSync(panelPath, 'utf8');
  const drawAtToDatetimeLocal = stripParamTypes(
    sliceFunction(src, 'function drawAtToDatetimeLocal(iso: string): string')
  );
  const datetimeLocalToIso = stripParamTypes(
    sliceFunction(src, 'function datetimeLocalToIso(local: string): string')
  );
  const formatConfigSaveError = stripParamTypes(
    sliceFunction(src, 'function formatConfigSaveError(code: string | undefined): string')
  );
  const body = [
    drawAtToDatetimeLocal,
    datetimeLocalToIso,
    formatConfigSaveError,
    'return { drawAtToDatetimeLocal, datetimeLocalToIso, formatConfigSaveError };',
  ].join('\n');
  return { src, ...new Function(body)() };
}

function stripParamTypes(fnSrc) {
  return fnSrc
    .replace('(iso: string): string', '(iso)')
    .replace('(local: string): string', '(local)')
    .replace('(code: string | undefined): string', '(code)')
    .replace('(n: number)', '(n)');
}

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) {
    throw new Error(`${signature} moved`);
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
  throw new Error(`${signature} is unterminated`);
}

const { src: panelSrc, drawAtToDatetimeLocal, datetimeLocalToIso, formatConfigSaveError } =
  loadPanelHelpers();
const saveHandler = sliceFunction(
  fs.readFileSync(scriptPath, 'utf8'),
  'function handleSaveEventConfig_(data)'
);

function assertPickerRoundTrip(local) {
  const iso = datetimeLocalToIso(local);
  assert.equal(iso.slice(0, 50), iso, 'picker slice(0, 50) must not chop a valid instant');
  assert.ok(iso.length <= 50);
  assert.match(iso, /Z$/);
  assert.equal(Number.isNaN(new Date(iso).getTime()), false);
  assert.equal(drawAtToDatetimeLocal(iso), local);
  assert.equal(datetimeLocalToIso(drawAtToDatetimeLocal(iso)), iso);

  const [date, time] = local.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const back = new Date(iso);
  assert.equal(back.getFullYear(), year);
  assert.equal(back.getMonth() + 1, month);
  assert.equal(back.getDate(), day);
  assert.equal(back.getHours(), hour);
  assert.equal(back.getMinutes(), minute);
  assert.equal(back.getSeconds(), 0);
}

describe('admin event draw time and save errors', () => {
  it('round-trips a picker value without moving the local clock or exceeding the server cap', () => {
    // June afternoon and a zero-padded winter morning. Both exist in every
    // host zone. Date-only strings and DST gaps follow the host and stay untested.
    assertPickerRoundTrip('2026-06-15T14:30');
    assertPickerRoundTrip('2026-01-05T08:07');

    const iso = datetimeLocalToIso('2026-06-15T14:30');
    assert.equal(datetimeLocalToIso('  2026-06-15T14:30 \n'), iso);
    assert.equal(drawAtToDatetimeLocal(` \t${iso}\n`), '2026-06-15T14:30');
    assert.match(saveHandler, /drawAt[\s\S]{0,80}length > 50/);
    assert.ok(saveHandler.includes("error: 'invalid_raffle_draw_at'"));
  });

  it('turns a blank or unparseable draw time into an empty instant', () => {
    for (const blank of ['', '   ', '\n\t', null, undefined]) {
      assert.equal(drawAtToDatetimeLocal(blank), '');
      assert.equal(datetimeLocalToIso(blank), '');
    }
    assert.equal(drawAtToDatetimeLocal('not-a-date'), '');
    assert.equal(datetimeLocalToIso('not-a-date'), '');
    assert.equal(drawAtToDatetimeLocal('2026-13-40T99:99'), '');
    assert.equal(datetimeLocalToIso('2026-13-40T99:99'), '');
  });

  it('maps each save rejection to staff text and leaves an unmapped code visible', () => {
    for (const [code, message] of Object.entries(STAFF_MESSAGES)) {
      assert.equal(formatConfigSaveError(code), message);
      assert.ok(saveHandler.includes(`'${code}'`), `${code} is not returned by handleSaveEventConfig_`);
    }
    assert.equal(new Set(Object.values(STAFF_MESSAGES)).size, Object.keys(STAFF_MESSAGES).length);
    assert.equal(formatConfigSaveError('event_not_found'), 'event_not_found');
    assert.equal(formatConfigSaveError(undefined), 'Save failed');
    assert.equal(formatConfigSaveError(''), 'Save failed');
  });

  it('wires the picker and the save error through these helpers', () => {
    assert.ok(panelSrc.includes('value={drawAtToDatetimeLocal(row.drawAt)}'));
    assert.ok(panelSrc.includes('datetimeLocalToIso(e.target.value).slice(0, 50)'));
    assert.ok(panelSrc.includes('setErr(formatConfigSaveError(data.error));'));
  });
});
