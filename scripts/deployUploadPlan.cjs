/**
 * Pure upload plan for scripts/deploy.cjs (cache/scp path).
 * Secrets and sqlite databases must not be selected for upload.
 * Database directory uploads are limited to migration scripts (*.js).
 */

/** Relative backend path skipped by the non-rsync uploader. */
function isBackendUploadExcluded(rel) {
  const normalized = String(rel ?? '').replace(/\\/g, '/');
  return normalized.includes('.env') || normalized.endsWith('.db');
}

/**
 * Paths present in `current` whose mtime or size differs from `cached`.
 * Keys that exist only in the cache (deleted locally) are not returned.
 */
function changedRelativePaths(current, cached) {
  const prevMap = cached && typeof cached === 'object' ? cached : {};
  const out = [];
  for (const [rel, cur] of Object.entries(current || {})) {
    const prev = prevMap[rel];
    if (!prev || prev.mtime !== cur.mtime || prev.size !== cur.size) out.push(rel);
  }
  return out;
}

/** Database folder: ship .js scripts only, never .db / other files. */
function databaseScriptNames(names) {
  return (names || []).filter((f) => typeof f === 'string' && f.endsWith('.js'));
}

module.exports = {
  isBackendUploadExcluded,
  changedRelativePaths,
  databaseScriptNames,
};
