import {
  buildAmazonLink,
  buildItemQuery,
  extractPriceFromText,
  normalizeQuery,
  parseRssItems,
} from '../../utils/dealFinderParse.js';

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
