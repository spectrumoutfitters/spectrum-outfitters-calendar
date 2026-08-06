/**
 * Pure fallback when a ShopMonkey order has no line items.
 * Builds work items from order-level service/labor/parts/complaint fields.
 */

function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * @param {object|null|undefined} order
 * @returns {{ title: string, order: number, source: 'shopmonkey' }[]}
 */
export function buildWorkItemsFromOrderFallback(order) {
  const items = [];
  if (!order || typeof order !== 'object') return items;

  const serviceName = order.generatedName || order.name || order.coalescedName || '';
  if (serviceName && String(serviceName).trim().length > 0) {
    items.push({
      title: toTitleCase(String(serviceName).trim()),
      order: items.length + 1,
      source: 'shopmonkey'
    });
  }

  if (order.inspectionStatus === 'NotCompleted' && order.inspectionCount > 0) {
    items.push({
      title: 'Vehicle Inspection',
      order: items.length + 1,
      source: 'shopmonkey'
    });
  }

  if (order.laborCents > 0 && order.totalLaborHours > 0) {
    const laborHours = order.totalLaborHours;
    items.push({
      title: `Labor - ${laborHours} hour${laborHours !== 1 ? 's' : ''}`,
      order: items.length + 1,
      source: 'shopmonkey'
    });
  } else if (order.laborCents > 0) {
    items.push({
      title: 'Labor',
      order: items.length + 1,
      source: 'shopmonkey'
    });
  }

  if (order.partsCents > 0) {
    items.push({
      title: 'Parts',
      order: items.length + 1,
      source: 'shopmonkey'
    });
  }

  if (order.complaint && String(order.complaint).trim().length > 0) {
    items.push({
      title: toTitleCase(String(order.complaint).trim()),
      order: items.length + 1,
      source: 'shopmonkey'
    });
  }

  if (order.recommendation && String(order.recommendation).trim().length > 0) {
    items.push({
      title: toTitleCase(String(order.recommendation).trim()),
      order: items.length + 1,
      source: 'shopmonkey'
    });
  }

  return items;
}
