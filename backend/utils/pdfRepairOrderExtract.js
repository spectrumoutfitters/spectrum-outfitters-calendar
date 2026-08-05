/**
 * Pure PDF repair-order text extractors (regex fallback when AI is off/fails).
 * Kept in sync with backend/routes/pdfParser.js.
 */

function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Extract work items from PDF text — line items from repair order (pages 1–2 only).
 */
export function extractWorkItems(text) {
  const items = [];
  if (!text || typeof text !== 'string') {
    return items;
  }

  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  let inWorkSection = false;
  let pageCount = 0;
  let stopParsing = false;

  for (let i = 0; i < lines.length && !stopParsing; i++) {
    const line = lines[i];

    if (line.match(/Page\s+\d+/i)) {
      const pageMatch = line.match(/Page\s+(\d+)/i);
      if (pageMatch) {
        const pageNum = parseInt(pageMatch[1], 10);
        if (pageNum > 2) {
          stopParsing = true;
          break;
        }
        pageCount = pageNum;
      }
    }

    if (
      line.toLowerCase().includes('vehicle intake') ||
      line.toLowerCase().includes('inspection') ||
      line.toLowerCase().includes('inspected:')
    ) {
      stopParsing = true;
      break;
    }

    if (
      line.includes('Spectrum Outfitters') ||
      line.includes('Repair Order') ||
      line.includes('Powered by') ||
      line.includes('Grand Total') ||
      line.includes('REMAINING BALANCE')
    ) {
      continue;
    }

    if (
      line.toLowerCase().includes('description') ||
      (line.toLowerCase().includes('item') &&
        (line.toLowerCase().includes('price') || line.toLowerCase().includes('qty')))
    ) {
      inWorkSection = true;
      continue;
    }

    if (line.match(/Subtotal|Total|Grand Total|Labor|Parts|Shop Supplies|EPA|Tax/i) && !line.match(/^\d+\s/)) {
      if (inWorkSection && pageCount >= 1) {
        let isEndSection = true;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].match(/^\d+\s+/) && !lines[j].match(/Subtotal|Total/i)) {
            isEndSection = false;
            break;
          }
        }
        if (isEndSection) {
          stopParsing = true;
          break;
        }
      }
    }

    if (
      line.match(/^\$[\d,]+\.\d{2}$/) ||
      (line.match(/^\d+$/) && !line.match(/^\d+\s/)) ||
      line.match(/^QTY|Subtotal|Total|Price$/i)
    ) {
      continue;
    }

    const numberedMatch = line.match(/^(\d+)\s+(.+)$/);
    if (numberedMatch && inWorkSection) {
      const itemNumber = numberedMatch[1];
      let description = numberedMatch[2].trim();

      if (description.match(/^\$[\d,]+\.\d{2}$/) || description.length < 3) {
        continue;
      }

      description = description.replace(/Part\s*#:\s*[A-Z0-9-]+/gi, '').trim();
      description = description.replace(/\$\s*[\d,]+\.\d{2}/g, '').trim();
      description = description.replace(/\s*(QTY|Qty|qty)[:\s]*\d+\s*$/i, '').trim();
      description = description.replace(/\s+\d+\s*$/, '').trim();
      description = description.replace(/\s+/g, ' ').trim();

      if (description.length > 3) {
        const exists = items.some((item) => item.title.toLowerCase() === description.toLowerCase());
        if (!exists) {
          items.push({
            title: toTitleCase(description),
            order: parseInt(itemNumber, 10),
          });
        }
      }
    }
  }

  const uniqueItems = [];
  const seen = new Set();

  for (const item of items) {
    const key = item.title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  uniqueItems.sort((a, b) => {
    if (a.order && b.order) return a.order - b.order;
    return 0;
  });

  return uniqueItems.map((item) => ({ title: item.title }));
}

/** Extract vehicle / RO / mileage fields from PDF text. */
export function extractVehicleInfo(text) {
  const info = {};
  if (!text || typeof text !== 'string') return info;

  const vinMatch = text.match(/VIN[:\s]+([A-Z0-9]{17})/i);
  if (vinMatch) {
    info.vin = vinMatch[1];
  }

  const vehicleMatch = text.match(/(\d{4})\s+([A-Za-z\s]+)\s+([A-Za-z0-9\s]+)/);
  if (vehicleMatch) {
    info.year = vehicleMatch[1];
    info.make = vehicleMatch[2].trim();
    info.model = vehicleMatch[3].trim();
  }

  const roMatch = text.match(/Repair Order[:\s#]+(\d+)/i);
  if (roMatch) {
    info.repairOrderNumber = roMatch[1];
  }

  const mileageMatch = text.match(/Mileage[:\s]+([\d,]+)\s*(mi|miles)?/i);
  if (mileageMatch) {
    info.mileage = mileageMatch[1].replace(/,/g, '');
  }

  return info;
}
