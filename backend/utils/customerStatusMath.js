/**
 * Public customer-status link gates and payload shaping.
 * Generate is admin-only at the router; GET is unauthenticated.
 */

/** POST /generate rejects missing task_id via JS truthiness (0/'' fail; '0' passes). */
export function isMissingTaskId(taskId) {
  return !taskId;
}

/** Empty / falsy customer fields store as SQL null. */
export function normalizeOptionalCustomerField(value) {
  return value || null;
}

export function buildCustomerStatusUrl(token) {
  return `/status/${token}`;
}

export function isMissingStatusLink(link) {
  return !link;
}

/**
 * Public GET must not leak task_id, phone, created_by, or the raw token.
 */
export function toPublicCustomerStatus(link) {
  return {
    customer_name: link.customer_name,
    task_title: link.task_title,
    status: link.status,
    description: link.description,
    due_date: link.due_date,
    last_updated: link.last_updated,
  };
}
