/**
 * CreateTaskForm client gates: PDF upload, title required vs present,
 * and ShopMonkey import selection.
 * Distinct from backend task assignment (#101), inventory link qty (#115),
 * and AI JSON work-item parse (#126).
 */

export const CREATE_TASK_PDF_MAX_BYTES = 10 * 1024 * 1024;

export function createTaskPdfUploadError(file) {
  if (!file) return null;
  if (file.type !== 'application/pdf') {
    return 'Please upload a PDF file';
  }
  if (file.size > CREATE_TASK_PDF_MAX_BYTES) {
    return 'File size must be less than 10MB';
  }
  return null;
}

/** Submit path: empty / whitespace-only titles are rejected. */
export function createTaskTitleError(title) {
  if (!title || !String(title).trim()) {
    return 'Title is required';
  }
  return null;
}

/**
 * AI estimate / assignment path: only falsy titles are rejected.
 * A whitespace-only title is treated as present (current CreateTaskForm).
 */
export function createTaskTitlePresent(title) {
  return Boolean(title);
}

export function createTaskImportSelectionError(selectedItems) {
  if (!selectedItems || selectedItems.length === 0) {
    return 'Please select at least one item to import.';
  }
  return null;
}
