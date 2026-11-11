import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../routes/inventory.js'
);

/**
 * Load the barcode catalog helpers without importing the route.
 * inventory.js opens the database and mounts Express at import time.
 * fetch is injected so the tests stay offline and deterministic.
 */
function loadLookup(fetchImpl) {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const pickImageUrl = sliceFunction(src, 'function pickImageUrl(product)');
  const tryLookup = sliceFunction(src, 'async function tryLookupOneCode(code)');
  const lookup = sliceFunction(src, 'async function lookupBarcodeFromExternalSources(barcode)');
  const body = [
    pickImageUrl,
    tryLookup,
    lookup,
    'return { tryLookupOneCode, lookupBarcodeFromExternalSources };',
  ].join('\n');
  const loaded = new Function('fetch', body)(fetchImpl);
  return { src, ...loaded };
}

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) {
    throw new Error(`${signature} moved in inventory.js`);
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
  throw new Error(`${signature} is unterminated in inventory.js`);
}

function queuedFetch(steps) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const step = steps[calls.length];
    calls.push({ url: String(url), init });
    if (!step) throw new Error(`unexpected fetch ${url}`);
    if (step.throw) throw step.throw;
    return {
      ok: step.ok !== false,
      async json() {
        if (step.jsonThrows) throw new Error('bad json');
        return step.json;
      },
    };
  };
  return { fetchImpl, calls };
}

const routeSrc = fs.readFileSync(sourcePath, 'utf8');

describe('lookup product by barcode', () => {
  it('keeps a foreign catalog name out of the autofilled product name', () => {
    assert.ok(routeSrc.includes('const result = await lookupBarcodeFromExternalSources(barcode);'));
    assert.ok(routeSrc.includes("suggestCategoryId(result.name || result.categoryHint || '')"));
    assert.ok(
      routeSrc.includes(
        'res.json({ name: result.name ?? null, brand: result.brand || null, image_url: result.image_url || null, category_id, source: result.source })'
      )
    );
  });

  it('does not call a catalog for a blank barcode or an empty code', async () => {
    const { fetchImpl, calls } = queuedFetch([]);
    const { tryLookupOneCode, lookupBarcodeFromExternalSources } = loadLookup(fetchImpl);

    assert.equal(await lookupBarcodeFromExternalSources(''), null);
    assert.equal(await lookupBarcodeFromExternalSources('   '), null);
    assert.equal(await lookupBarcodeFromExternalSources('\n\t'), null);
    assert.equal(await tryLookupOneCode(''), null);
    assert.equal(await tryLookupOneCode(null), null);
    assert.equal(await tryLookupOneCode(undefined), null);
    assert.equal(calls.length, 0);
  });

  it('uses an English UPCItemDB hit and does not ask Open Food Facts', async () => {
    const { fetchImpl, calls } = queuedFetch([
      {
        json: {
          items: [
            {
              title: 'Widget',
              brand: '  ACME, INC  ',
              images: ['  https://cdn.example/a.jpg  '],
            },
          ],
        },
      },
    ]);
    const { tryLookupOneCode } = loadLookup(fetchImpl);
    const result = await tryLookupOneCode('012345678905');

    assert.deepEqual(result, {
      name: 'ACME, INC - Widget',
      brand: 'ACME, INC',
      image_url: 'https://cdn.example/a.jpg',
      source: 'upcitemdb',
    });
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905'
    );
    assert.deepEqual(calls[0].init, { headers: { Accept: 'application/json' } });
  });

  it('falls through to Open Food Facts when UPCItemDB has no title', async () => {
    const englishProduct = {
      status: 1,
      product: {
        product_name_en: 'Motor oil',
        generic_name_en: 'Engine lubricant',
        brands: ' Mobil , Exxon',
        product_name: 'Huile moteur',
        image_url: 'https://img.example/oil.jpg',
      },
    };
    const genericProduct = {
      status: 1,
      product: {
        product_name_en: '',
        generic_name_en: 'Engine lubricant',
        brands: 'Mobil',
        product_name: 'Huile',
      },
    };
    const { fetchImpl, calls } = queuedFetch([
      { jsonThrows: true },
      { ok: false },
      { json: { items: [] } },
      { json: englishProduct },
      { ok: false },
      { json: genericProduct },
    ]);
    const { tryLookupOneCode } = loadLookup(fetchImpl);

    assert.equal(await tryLookupOneCode('012345678905'), null);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /upcitemdb\.com/);
    assert.equal(calls[1].url, 'https://world.openfoodfacts.org/api/v2/product/012345678905.json');
    assert.deepEqual(calls[1].init, {
      headers: { 'User-Agent': 'SpectrumOutfitters-Inventory/1.0' },
    });

    assert.deepEqual(await tryLookupOneCode('012345678905'), {
      name: 'Mobil - Motor oil',
      brand: 'Mobil',
      image_url: 'https://img.example/oil.jpg',
      source: 'openfoodfacts',
      categoryHint: 'Huile moteur',
    });

    assert.deepEqual(await tryLookupOneCode('012345678905'), {
      name: 'Mobil - Engine lubricant',
      brand: 'Mobil',
      image_url: null,
      source: 'openfoodfacts',
      categoryHint: 'Huile',
    });
    assert.equal(calls.length, 6);
  });

  it('keeps a non-English catalog name off the product and still returns an image', async () => {
    const { fetchImpl, calls } = queuedFetch([
      {
        json: {
          status: 1,
          product: {
            product_name: 'Huile moteur',
            product_name_en: '',
            brands: 'Mobil, Exxon',
            image_url: 'https://img.example/oil.jpg',
          },
        },
      },
      {
        json: {
          status: 1,
          product: {
            product_name: 'Huile moteur',
            brands: 'Mobil',
          },
        },
      },
      { json: { status: 0, product: { product_name_en: 'Motor oil' } } },
    ]);
    const { tryLookupOneCode } = loadLookup(fetchImpl);

    assert.deepEqual(await tryLookupOneCode('1234567'), {
      name: null,
      brand: 'Mobil',
      image_url: 'https://img.example/oil.jpg',
      source: 'openfoodfacts',
      categoryHint: 'Huile moteur',
    });
    assert.equal(await tryLookupOneCode('1234567'), null);
    assert.equal(await tryLookupOneCode('1234567'), null);
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.equal(call.url, 'https://world.openfoodfacts.org/api/v2/product/1234567.json');
    }
  });

  it('returns null when both catalogs fail and encodes reserved characters', async () => {
    const { fetchImpl, calls } = queuedFetch([
      { throw: new Error('upc down') },
      { throw: new Error('off down') },
      { ok: false },
      { ok: false },
    ]);
    const { tryLookupOneCode } = loadLookup(fetchImpl);

    assert.equal(await tryLookupOneCode('012345678905'), null);
    assert.equal(calls.length, 2);

    assert.equal(await tryLookupOneCode('12345678&x'), null);
    assert.equal(calls.length, 4);
    assert.equal(
      calls[2].url,
      'https://api.upcitemdb.com/prod/trial/lookup?upc=12345678%26x'
    );
    assert.equal(
      calls[3].url,
      'https://world.openfoodfacts.org/api/v2/product/12345678%26x.json'
    );
  });

  it('retries digits only when they differ from the scanned code and are long enough', async () => {
    const missBoth = [{ ok: false }, { ok: false }];
    const upcHit = [
      {
        json: {
          items: [{ title: 'Filter', brand: 'ACME', images: [] }],
        },
      },
    ];
    const { fetchImpl, calls } = queuedFetch([
      ...upcHit,
      ...missBoth,
      ...missBoth,
      ...missBoth,
      ...upcHit,
      ...missBoth,
    ]);
    const { lookupBarcodeFromExternalSources } = loadLookup(fetchImpl);

    assert.deepEqual(await lookupBarcodeFromExternalSources('  05083285aa  '), {
      name: 'ACME - Filter',
      brand: 'ACME',
      image_url: null,
      source: 'upcitemdb',
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.upcitemdb.com/prod/trial/lookup?upc=05083285aa');

    assert.equal(await lookupBarcodeFromExternalSources('05083285aa'), null);
    assert.equal(calls.length, 5);
    assert.equal(calls[1].url, 'https://api.upcitemdb.com/prod/trial/lookup?upc=05083285aa');
    assert.equal(calls[2].url, 'https://world.openfoodfacts.org/api/v2/product/05083285aa.json');
    assert.equal(calls[3].url, 'https://api.upcitemdb.com/prod/trial/lookup?upc=05083285');
    assert.equal(calls[4].url, 'https://world.openfoodfacts.org/api/v2/product/05083285.json');

    assert.deepEqual(await lookupBarcodeFromExternalSources('12ab34567890'), {
      name: 'ACME - Filter',
      brand: 'ACME',
      image_url: null,
      source: 'upcitemdb',
    });
    assert.equal(calls.length, 8);
    assert.equal(calls[5].url, 'https://api.upcitemdb.com/prod/trial/lookup?upc=12ab34567890');
    assert.equal(calls[6].url, 'https://world.openfoodfacts.org/api/v2/product/12ab34567890.json');
    assert.equal(calls[7].url, 'https://api.upcitemdb.com/prod/trial/lookup?upc=1234567890');

    assert.equal(await lookupBarcodeFromExternalSources('12345678'), null);
    assert.equal(calls.length, 10);
    assert.equal(calls[8].url, 'https://api.upcitemdb.com/prod/trial/lookup?upc=12345678');
    assert.equal(calls[9].url, 'https://world.openfoodfacts.org/api/v2/product/12345678.json');
  });
});
