/**
 * Pure ShopMonkey repair-order → task extraction helpers (no API client).
 * Line-item type filter and vehicle field mapping used by routes/shopmonkey.js.
 */

function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Whether a ShopMonkey line item should become a work item (parts/labor/service only).
 * Explicit fee/tax/etc. types are excluded; untyped items are included.
 */
export function shouldIncludeShopMonkeyLineItem(lineItem) {
  if (!lineItem || typeof lineItem !== 'object') return false;

  let description =
    lineItem.description ||
    lineItem.name ||
    lineItem.title ||
    lineItem.item ||
    lineItem.partName ||
    lineItem.laborName ||
    '';

  if (!description || typeof description !== 'string') return false;
  description = description.trim();
  if (description.length < 3 || description.match(/^\$[\d,]+\.\d{2}$/)) return false;

  if (lineItem.lineItemType) {
    const lineItemType = String(lineItem.lineItemType).toLowerCase();
    if (lineItemType !== 'service' && lineItemType !== 'part' && lineItemType !== 'labor') {
      return false;
    }
  }

  return true;
}

/** Strip prices, qty, and part-number noise from a line-item description. */
export function cleanShopMonkeyLineDescription(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let description = raw.trim();
  description = description.replace(/\$\s*[\d,]+\.\d{2}/g, '').trim();
  description = description.replace(/[\d,]+\.\d{2}\s*$/g, '').trim();
  description = description.replace(/\s*(QTY|Qty|qty|Quantity|quantity)[:\s]*\d+\s*$/i, '').trim();
  description = description.replace(/\s+\d+\s*$/, '').trim();
  description = description.replace(/Part\s*#:\s*[A-Z0-9-]+/gi, '').trim();
  description = description.replace(/P\/N[:\s]*[A-Z0-9-]+/gi, '').trim();
  description = description.replace(/\s+/g, ' ').trim();
  return description;
}

/**
 * Map ShopMonkey line items to work-item titles (parts/labor/service only, deduped).
 */
export function mapShopMonkeyLineItemsToWorkItems(lineItems) {
  const items = [];
  if (!Array.isArray(lineItems)) return items;

  lineItems.forEach((lineItem, index) => {
    if (!shouldIncludeShopMonkeyLineItem(lineItem)) return;

    const raw =
      lineItem.description ||
      lineItem.name ||
      lineItem.title ||
      lineItem.item ||
      lineItem.partName ||
      lineItem.laborName ||
      '';

    const description = cleanShopMonkeyLineDescription(raw);
    if (description.length <= 3) return;

    const exists = items.some((item) => item.title.toLowerCase() === description.toLowerCase());
    if (!exists) {
      items.push({
        title: toTitleCase(description),
        order: index + 1,
      });
    }
  });

  return items;
}

/** Extract vehicle / RO / customer fields from a ShopMonkey order object. */
export function extractVehicleInfoFromOrder(order) {
  const info = {};
  if (!order || typeof order !== 'object') return info;

  if (order.vehicle) {
    if (order.vehicle.year) info.year = order.vehicle.year;
    if (order.vehicle.make) info.make = order.vehicle.make;
    if (order.vehicle.model) info.model = order.vehicle.model;
    if (order.vehicle.vin) info.vin = order.vehicle.vin;
    if (order.vehicle.mileage) info.mileage = order.vehicle.mileage.toString();
  }

  if (order.number) {
    info.repairOrderNumber = order.number.toString();
  }

  if (order.customer && order.customer.name) {
    info.customerName = order.customer.name;
  }

  return info;
}
