/**
 * Build Turn14 search query params. Empty / whitespace-only input returns null
 * so the UI can reject the request before hitting the API.
 */
export function buildTurn14SearchParams({ searchMode, searchQuery, partNumber, make, model, year }) {
  const params = {};

  if (searchMode === 'query' && searchQuery.trim()) {
    params.query = searchQuery.trim();
  } else if (searchMode === 'partNumber' && partNumber.trim()) {
    params.partNumber = partNumber.trim();
  } else if (searchMode === 'vehicle') {
    if (make.trim()) params.make = make.trim();
    if (model.trim()) params.model = model.trim();
    if (year.trim()) params.year = year.trim();
  }

  if (Object.keys(params).length === 0) return null;
  params.limit = 50;
  return params;
}

/** Key used to fetch details/pricing/availability — does not fall back to part.id. */
export function turn14PartLookupKey(part) {
  return part.partNumber || part.part_number || part.sku || part.number;
}

export function formatTurn14Price(price) {
  if (typeof price === 'number') {
    return `$${price.toFixed(2)}`;
  }
  if (typeof price === 'string') {
    return price;
  }
  if (price && price.amount) {
    return `$${parseFloat(price.amount).toFixed(2)}`;
  }
  if (price && price.value) {
    return `$${parseFloat(price.value).toFixed(2)}`;
  }
  return 'N/A';
}

export function getTurn14PartNumber(part) {
  return part.partNumber || part.part_number || part.sku || part.number || part.id || 'N/A';
}

export function getTurn14PartName(part) {
  return part.name || part.description || part.title || part.productName || 'Unknown Part';
}
