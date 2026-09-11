/**
 * HTTP body gate for POST /api/finance/payroll-history-import.
 * Distinct from file-shape unwrap (`records`/`history`/`employees`, #119)
 * and merge/dedupe persistence (#47/#113).
 *
 * Accepts `{ records: [...] }` or a raw array body. Empty arrays and
 * file-style `{ history: [...] }` wrappers are rejected — the HTTP path
 * does not unwrap the way the file reader does.
 *
 * @returns {Array|null} records when importable, otherwise null
 */
export function payrollHistoryImportRecords(body) {
  let records = body?.records;
  if (!Array.isArray(records) && Array.isArray(body)) records = body;
  if (!Array.isArray(records) || records.length === 0) return null;
  return records;
}
