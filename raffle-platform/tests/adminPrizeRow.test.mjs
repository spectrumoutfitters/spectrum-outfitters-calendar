import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const panelPath = path.join(here, '../src/components/raffle/AdminEventConfigPanel.tsx');

/**
 * Load prize-row coercion without importing the client component. The panel
 * pulls in React at module scope. The list key is random; the stub replaces
 * only that call so the test never locks a UUID.
 */
function loadNormalizeRaffle() {
  const src = fs.readFileSync(panelPath, 'utf8');
  const sliced = sliceNormalizeRaffle(src);
  if (!sliced.raw.includes('existingKey || newClientListKey()')) {
    throw new Error('normalizeRaffle no longer delegates the list key');
  }
  const body = [
    'let generated = 0;',
    'function stableListKey() {',
    '  generated += 1;',
    "  return 'generated-' + generated;",
    '}',
    sliced.fn,
    'return { normalizeRaffle, generatedCount: () => generated };',
  ].join('\n');
  return { src, ...new Function(body)() };
}

function sliceNormalizeRaffle(src) {
  const start = src.indexOf('function normalizeRaffle(');
  if (start < 0) throw new Error('normalizeRaffle moved');
  const header = src.indexOf('): AdminRaffleRow {', start);
  if (header < 0) throw new Error('normalizeRaffle signature moved');
  const open = src.indexOf('{', header);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const raw = src.slice(start, i + 1);
        const fn = raw
          .replace(/function normalizeRaffle\([\s\S]*?\): AdminRaffleRow/, 'function normalizeRaffle(r)')
          .replace('newClientListKey()', 'stableListKey()');
        if (fn.includes('newClientListKey') || fn.includes('crypto')) {
          throw new Error('list key stub did not apply');
        }
        return { raw, fn };
      }
    }
  }
  throw new Error('normalizeRaffle is unterminated');
}

const { src: panelSrc, normalizeRaffle, generatedCount } = loadNormalizeRaffle();

describe('admin prize row coercion', () => {
  it('keeps one trimmed id, preferring the sheet raffleId over a stale row id', () => {
    const fromSheet = normalizeRaffle({
      raffleId: '  grand-prize  ',
      id: 'stale-react-id',
      title: 'Grand prize',
    });
    assert.equal(fromSheet.raffleId, 'grand-prize');
    assert.equal(fromSheet.id, 'grand-prize');

    const fromId = normalizeRaffle({ id: ' pool-b ' });
    assert.equal(fromId.raffleId, 'pool-b');
    assert.equal(fromId.id, 'pool-b');

    for (const blank of [{}, { raffleId: '', id: '' }, { raffleId: '   ', id: '   ' }, { raffleId: null, id: null }]) {
      const row = normalizeRaffle(blank);
      assert.equal(row.raffleId, 'new-prize');
      assert.equal(row.id, 'new-prize');
    }

    // The server rejects ids longer than 48. Chopping here would rename the prize
    // before that error can be shown.
    const longId = 'prize-' + 'a'.repeat(48);
    const kept = normalizeRaffle({ raffleId: longId });
    assert.equal(kept.raffleId, longId);
    assert.equal(kept.id, longId);
  });

  it('seeds an empty event with one active grand prize instead of a blank row', () => {
    const before = generatedCount();
    const row = normalizeRaffle({ raffleId: 'grand-prize', title: 'Grand prize', sortOrder: 1 });
    assert.deepEqual(
      {
        id: row.id,
        raffleId: row.raffleId,
        title: row.title,
        subtitle: row.subtitle,
        imageUrl: row.imageUrl,
        valueLabel: row.valueLabel,
        sortOrder: row.sortOrder,
        active: row.active,
        drawAt: row.drawAt,
      },
      {
        id: 'grand-prize',
        raffleId: 'grand-prize',
        title: 'Grand prize',
        subtitle: '',
        imageUrl: '',
        valueLabel: '',
        sortOrder: 1,
        active: true,
        drawAt: '',
      }
    );
    assert.match(row._clientListKey, /^generated-\d+$/);
    assert.equal(generatedCount(), before + 1);
    assert.ok(
      panelSrc.includes(
        'normalizeRaffle({ raffleId: "grand-prize", title: "Grand prize", sortOrder: 1 })'
      )
    );
  });

  it('deactivates only a boolean false or the sheet FALSE flag', () => {
    for (const inactive of [false, 'false', 'FALSE', 'False']) {
      assert.equal(normalizeRaffle({ raffleId: 'pool', active: inactive }).active, false, String(inactive));
    }
    for (const active of [true, 'true', 'TRUE', undefined, null]) {
      assert.equal(normalizeRaffle({ raffleId: 'pool', active }).active, true, String(active));
    }
    const omitted = normalizeRaffle({ raffleId: 'pool' });
    assert.equal(omitted.active, true);
  });

  it('trims and caps sticker text and draw time, and leaves the prize name intact', () => {
    const sticker = 'A'.repeat(160);
    const row = normalizeRaffle({
      raffleId: 'kayak',
      title: 'K'.repeat(201),
      subtitle: 'S'.repeat(501),
      imageUrl: '  https://cdn.example/' + 'p'.repeat(300) + '.jpg  ',
      valueLabel: '  ' + sticker + 'EXTRA  ',
      drawAt: '  2026-06-15T18:00:00.000Z \n',
      sortOrder: ' 4 ',
    });
    assert.equal(row.valueLabel, sticker);
    assert.equal(row.drawAt, '2026-06-15T18:00:00.000Z');
    assert.equal(row.imageUrl, 'https://cdn.example/' + 'p'.repeat(300) + '.jpg');
    assert.equal(row.title, 'K'.repeat(201));
    assert.equal(row.subtitle, 'S'.repeat(501));
    assert.equal(row.sortOrder, 4);

    assert.equal(normalizeRaffle({ raffleId: 'kayak', valueLabel: '   ', drawAt: '   ' }).valueLabel, '');
    assert.equal(normalizeRaffle({ raffleId: 'kayak', valueLabel: null, drawAt: null }).drawAt, '');
    assert.equal(normalizeRaffle({ raffleId: 'kayak', drawAt: 'd'.repeat(51) }).drawAt, 'd'.repeat(50));
    assert.equal(normalizeRaffle({ raffleId: 'kayak', imageUrl: null }).imageUrl, '');

    assert.equal(normalizeRaffle({ raffleId: 'kayak', sortOrder: 0 }).sortOrder, 0);
    assert.equal(normalizeRaffle({ raffleId: 'kayak', sortOrder: '0' }).sortOrder, 0);
    assert.equal(normalizeRaffle({ raffleId: 'kayak', sortOrder: -3 }).sortOrder, -3);
    assert.equal(normalizeRaffle({ raffleId: 'kayak', sortOrder: 1.5 }).sortOrder, 1.5);
    for (const bad of [undefined, null, '', 'nope', Infinity, Number.NaN]) {
      assert.equal(normalizeRaffle({ raffleId: 'kayak', sortOrder: bad }).sortOrder, 0, String(bad));
    }
  });

  it('keeps an existing list key when the prize id changes, and mints one when the key is missing', () => {
    const before = generatedCount();
    const kept = normalizeRaffle({
      _clientListKey: 'row-stable',
      raffleId: 'renamed-prize',
      id: 'old-prize',
      title: 'Kayak',
    });
    assert.equal(kept._clientListKey, 'row-stable');
    assert.equal(kept.raffleId, 'renamed-prize');
    assert.equal(generatedCount(), before);

    const minted = normalizeRaffle({ raffleId: 'kayak', _clientListKey: '' });
    const mintedFromNumber = normalizeRaffle({ raffleId: 'kayak', _clientListKey: 12 });
    assert.match(minted._clientListKey, /^generated-\d+$/);
    assert.match(mintedFromNumber._clientListKey, /^generated-\d+$/);
    assert.notEqual(minted._clientListKey, mintedFromNumber._clientListKey);
    assert.equal(generatedCount(), before + 2);
  });

  it('normalizes sheet rows on load, after save, and when a prize is added', () => {
    const maps = panelSrc.split('.map((r) => normalizeRaffle(r))').length - 1;
    assert.equal(maps, 2);
    assert.ok(
      panelSrc.includes('normalizeRaffle({ raffleId: id, title: "New prize", sortOrder: nextSort, active: true })')
    );
  });
});
