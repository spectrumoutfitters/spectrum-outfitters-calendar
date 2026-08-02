import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAmazonLink,
  buildItemQuery,
  decodeXmlEntities,
  extractFirstTag,
  extractPriceFromText,
  normalizeQuery,
  parseRssItems,
  stripCdata,
} from '../utils/dealFinderParse.js';

describe('stripCdata / decodeXmlEntities / extractFirstTag', () => {
  it('strips CDATA wrappers and decodes entities', () => {
    assert.equal(stripCdata('<![CDATA[Hello]]>'), 'Hello');
    assert.equal(stripCdata('plain'), 'plain');
    assert.equal(decodeXmlEntities('A &amp; B &lt;C&gt; &quot;x&quot; &#39;y&#39;'), 'A & B <C> "x" \'y\'');
    assert.equal(
      extractFirstTag('<title><![CDATA[Wheel &amp; Tire $99]]></title>', 'title'),
      'Wheel & Tire $99'
    );
  });
});

describe('extractPriceFromText', () => {
  it('parses dollar amounts and free markers', () => {
    assert.equal(extractPriceFromText('Widget $19.99 deal'), 19.99);
    assert.equal(extractPriceFromText('Only $5 left'), 5);
    assert.equal(extractPriceFromText('Get this free today'), 0);
    assert.equal(extractPriceFromText('No price here'), null);
    assert.equal(extractPriceFromText(''), null);
  });
});

describe('normalizeQuery / buildItemQuery', () => {
  it('collapses whitespace and prefers supplier part number', () => {
    assert.equal(normalizeQuery('  foo   bar  '), 'foo bar');
    assert.equal(
      buildItemQuery({ supplier_part_number: '  ABC-1  ', name: 'Nice Wheel' }),
      'ABC-1'
    );
    assert.equal(buildItemQuery({ name: '  Nice   Wheel ' }), 'Nice Wheel');
    assert.equal(buildItemQuery({}), '');
  });
});

describe('parseRssItems', () => {
  it('extracts items with links and drops link-less rows', () => {
    const xml = `
      <rss><channel>
        <item><title><![CDATA[Deal $5]]></title><link>https://x.test/a</link></item>
        <item><title>No link</title></item>
        <item><title>Second</title><link>https://x.test/b</link><pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate></item>
      </channel></rss>`;
    assert.deepEqual(parseRssItems(xml), [
      { title: 'Deal $5', link: 'https://x.test/a', pubDate: null },
      { title: 'Second', link: 'https://x.test/b', pubDate: 'Mon, 01 Jan 2026 00:00:00 GMT' },
    ]);
    assert.deepEqual(parseRssItems(''), []);
  });
});

describe('buildAmazonLink', () => {
  it('prefers amazon_url, else builds ASIN cart URL', () => {
    assert.equal(
      buildAmazonLink({ amazon_url: 'https://www.amazon.com/dp/B00X', amazon_asin: 'B00X' }),
      'https://www.amazon.com/dp/B00X'
    );
    assert.equal(
      buildAmazonLink({ amazon_asin: 'B00TEST' }, 2),
      'https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=B00TEST&Quantity.1=2'
    );
    assert.equal(buildAmazonLink({ name: 'No asin' }), null);
  });
});
