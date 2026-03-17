function stripCdata(s) {
  if (s == null) return '';
  return String(s).replace(/^<!\\[CDATA\\[/, '').replace(/\\]\\]>$/, '');
}

function decodeXmlEntities(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractFirstTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = String(xml).match(re);
  if (!m) return null;
  return decodeXmlEntities(stripCdata(m[1]).trim());
}

function extractPriceFromText(text) {
  if (!text) return null;
  const t = String(text);
  if (/\\bfree\\b/i.test(t)) return 0;
  const m = t.match(/\\$\\s*(\\d+(?:\\.\\d{1,2})?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function normalizeQuery(s) {
  return String(s || '')
    .replace(/\\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function buildItemQuery(item) {
  const supplierPart = normalizeQuery(item?.supplier_part_number);
  const name = normalizeQuery(item?.name);
  if (supplierPart) return supplierPart;
  return name;
}

async function fetchText(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SpectrumOutfitters-Inventory/1.0',
        'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function parseRssItems(xml) {
  const text = String(xml || '');
  const items = [];
  // NOTE: use a single backslash to escape the forward slash in a regex literal.
  const itemMatches = text.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const raw of itemMatches) {
    const title = extractFirstTag(raw, 'title');
    const link = extractFirstTag(raw, 'link');
    const pubDate = extractFirstTag(raw, 'pubDate');
    items.push({ title: title || null, link: link || null, pubDate: pubDate || null });
  }
  return items.filter((i) => i.link);
}

async function findSlickdeals(query) {
  const q = normalizeQuery(query);
  if (!q) return [];

  // Slickdeals provides an RSS output via newsearch.php when rss=1.
  // Note: This is best-effort; if Slickdeals changes their format, we fall back gracefully.
  const url = `https://slickdeals.net/newsearch.php?searchin=first&rss=1&q=${encodeURIComponent(q)}`;
  const xml = await fetchText(url);
  if (!xml) return [];

  const items = parseRssItems(xml);
  return items.slice(0, 10).map((i) => {
    const price = extractPriceFromText(i.title);
    const score = price == null ? 0.5 : Math.max(0, 100 - price); // cheaper → higher
    return {
      source: 'slickdeals',
      title: i.title,
      url: i.link,
      price,
      currency: 'USD',
      shipping: null,
      coupon_code: null,
      expires_at: null,
      score,
      reason: `Matched query: ${q}`,
      raw_json: JSON.stringify(i),
    };
  });
}

function buildAmazonLink(item, quantity = 1) {
  const asin = normalizeQuery(item?.amazon_asin);
  const url = normalizeQuery(item?.amazon_url);
  if (url) return url;
  if (!asin) return null;
  // Add-to-cart URL (not guaranteed; best-effort).
  return `https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=${encodeURIComponent(asin)}&Quantity.1=${encodeURIComponent(String(quantity))}`;
}

export async function findDealsForInventoryItem(item) {
  const query = buildItemQuery(item);

  const [slickDeals] = await Promise.all([
    findSlickdeals(query).catch(() => []),
  ]);

  const deals = [...slickDeals];

  const amazonLink = buildAmazonLink(item, 1);
  if (amazonLink) {
    deals.unshift({
      source: 'amazon',
      title: `${item?.name || 'Amazon'} (Amazon)`,
      url: amazonLink,
      price: null,
      currency: 'USD',
      shipping: null,
      coupon_code: null,
      expires_at: null,
      score: 1,
      reason: item?.amazon_url || item?.amazon_asin ? 'Amazon link on item' : 'Amazon link generated from ASIN',
      raw_json: null,
    });
  }

  return deals;
}

