/**
 * Admin POST /api/admin/[slug]/export CSV download headers.
 * Distinct from admin-key trim (#104) and public/upload slug sanitizers (#105/#106) —
 * export interpolates the raw route slug into Content-Disposition (no strip/trim).
 */

/** Empty csv is treated as failure (`!data.csv`), including "". */
export function raffleExportCsvReady(resOk, data) {
  return Boolean(resOk && data?.ok && data.csv);
}

export function raffleExportCsvFilename(slug, ymd = new Date().toISOString().slice(0, 10)) {
  return `entries-${slug}-${ymd}.csv`;
}

export function raffleExportContentDisposition(filename) {
  return `attachment; filename="${filename}"`;
}

export function raffleExportCsvBody(csv) {
  return "\uFEFF" + csv;
}
