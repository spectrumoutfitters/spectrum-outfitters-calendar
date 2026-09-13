/**
 * Parse JSON out of Claude / Ollama text replies used by utils/aiService.js.
 * Greedy first `[...]` / `{...}` match is intentional (current behavior).
 */

export function extractFirstJsonArrayText(text) {
  const jsonMatch = String(text ?? '').match(/\[[\s\S]*\]/);
  return jsonMatch ? jsonMatch[0] : null;
}

export function extractFirstJsonObjectText(text) {
  const jsonMatch = String(text ?? '').match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : null;
}

/** JSON.parse of the first array. Throws on invalid JSON (caller catches). */
export function parseFirstJsonArray(text) {
  const raw = extractFirstJsonArrayText(text);
  if (!raw) return null;
  return JSON.parse(raw);
}

/** JSON.parse of the first object. Throws on invalid JSON (caller catches). */
export function parseFirstJsonObject(text) {
  const raw = extractFirstJsonObjectText(text);
  if (!raw) return null;
  return JSON.parse(raw);
}

/** Work-item rows: title||name||'', order||0. */
export function normalizeAiWorkItems(items) {
  return items.map((item) => ({
    title: item.title || item.name || '',
    order: item.order || 0,
  }));
}

export function parseAiWorkItemsResponse(text) {
  const items = parseFirstJsonArray(text);
  if (!items) return null;
  return normalizeAiWorkItems(items);
}

/**
 * Category reply must name a category from the allowlist; otherwise null
 * (aiService then skips the suggestion).
 */
export function parseAiCategoryResponse(text, categories) {
  const result = parseFirstJsonObject(text);
  if (!result) return null;
  if (categories.includes(result.category)) return result;
  return null;
}
