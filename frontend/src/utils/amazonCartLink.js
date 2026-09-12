/**
 * Prefer an explicit Amazon product URL; otherwise build the add-to-cart URL from ASIN.
 * Quantity is always 1 — matches Inventory Management's "Buy on Amazon" button.
 */
export function amazonCartLink(amazonUrl, amazonAsin) {
  const url = (amazonUrl || '').trim();
  if (url) return url;
  const asin = (amazonAsin || '').trim();
  if (!asin) return null;
  return `https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=${encodeURIComponent(asin)}&Quantity.1=1`;
}
