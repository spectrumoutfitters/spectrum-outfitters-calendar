/**
 * Pure inventory barcode + category classification helpers.
 * Kept in sync with usage in backend/routes/inventory.js.
 */

export function normalizeBarcode(raw) {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  return str.length ? str : null;
}

/**
 * Heuristic category from item name. Rule order matters:
 * Oils & Fluids runs before Filters, so names containing "oil" (including
 * "oil filter") classify as Oils & Fluids. Parts runs before Fasteners so
 * "washer pump" is Parts, not Fasteners.
 */
export function pickCategoryNameFromItemName(name) {
  const n = String(name || '').toLowerCase();

  const has = (substr) => n.includes(substr);

  // Oils & fluids
  if (
    has('oil') ||
    has('atf') ||
    has('coolant') ||
    has('antifreeze') ||
    has('brake fluid') ||
    has('power steering') ||
    has('transmission') ||
    has('gear oil') ||
    has('quart') ||
    has('quarts') ||
    has('qt')
  ) {
    return 'Oils & Fluids';
  }

  // Cleaning
  if (
    has('fabuloso') ||
    has('cleaner') ||
    has('clean ') ||
    has('cleaning') ||
    has('degreaser') ||
    has('soap') ||
    has('sanitizer') ||
    has('disinfect')
  ) {
    return 'Cleaning';
  }

  // Spray paint & coatings
  if (
    has('spray paint') ||
    (has('spray') && has('paint')) ||
    has('aerosol') ||
    has('primer') ||
    has('enamel') ||
    has('clear coat') ||
    has('rustoleum') ||
    has('paint')
  ) {
    return 'Spray Paint & Coatings';
  }

  // Filters (before Parts so bare "filter" names match)
  if (has('filter')) return 'Filters';

  // Belts & hoses
  if (has('belt') || has('hose')) return 'Belts & Hoses';

  // Parts (pumps, grommets, sensors, motors, etc. — check before Fasteners so "washer pump" → Parts)
  if (
    has('pump') ||
    has('grommet') ||
    has('sensor') ||
    has('motor') ||
    has('relay') ||
    has('switch') ||
    has('cap') ||
    has('housing') ||
    has('bushing') ||
    has('bearing') ||
    has('seal') ||
    has('gasket') ||
    has('valve') ||
    has('module') ||
    has('actuator') ||
    has('solenoid') ||
    has('connector') ||
    has('bracket') ||
    has('reservoir') ||
    has('tank')
  ) {
    return 'Parts';
  }

  // Fasteners (bolts, nuts, screws, washers, plugs)
  if (
    has('washer') ||
    has('washers') ||
    has('bolt') ||
    has('nuts') ||
    has('nut ') ||
    has('screw') ||
    has('drain plug') ||
    has('plug')
  ) {
    return 'Fasteners';
  }

  return 'Other';
}
