/**
 * Price written into the product form when a Turn14 part is added to the catalog.
 * The || chain keeps a numeric 0 from sticking when a nested amount/value exists,
 * and a missing price becomes the string "0".
 */
export function turn14CatalogPrice(part) {
  return part.price || part.pricing?.amount || part.pricing?.value || '0';
}
