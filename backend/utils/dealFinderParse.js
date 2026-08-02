/**
 * Pure RSS / price / query helpers for inventory deal finder.
 * Extracted from services/deals/dealFinder.js for deterministic unit tests.
 */

export function stripCdata(s) {
  if (s == null) return '';
  return String(s).replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

export function decodeXmlEntities(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractFirstTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = String(xml).match(re);
  if (!m) return null;
  return decodeXmlEntities(stripCdata(m[1]).trim());
}

export function extractPriceFromText(text) {
  if (!text) return null;
  const t = String(text);
  if (/\bfree\b/i.test(t)) return 0;
  const m = t.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function normalizeQuery(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

export function buildItemQuery(item) {
  const supplierPart = normalizeQuery(item?.supplier_part_number);
  const name = normalizeQuery(item?.name);
  if (supplierPart) return supplierPart;
  return name;
}

export function parseRssItems(xml) {
  const text = String(xml || '');
  const items = [];
  const itemMatches = text.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const raw of itemMatches) {
    const title = extractFirstTag(raw, 'title');
    const link = extractFirstTag(raw, 'link');
    const pubDate = extractFirstTag(raw, 'pubDate');
    items.push({ title: title || null, link: link || null, pubDate: pubDate || null });
  }
  return items.filter((i) => i.link);
}

export function buildAmazonLink(item, quantity = 1) {
  const asin = normalizeQuery(item?.amazon_asin);
  const url = normalizeQuery(item?.amazon_url);
  if (url) return url;
  if (!asin) return null;
  return `https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=${encodeURIComponent(asin)}&Quantity.1=${encodeURIComponent(String(quantity))}`;
}
