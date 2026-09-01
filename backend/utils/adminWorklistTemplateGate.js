/**
 * Admin worklist template create/update coercion.
 * Create requires a truthy title and exact daily/weekly/monthly recurrence.
 * Update does not re-validate title/recurrence; day columns follow the
 * *body* recurrence (undefined recurrence clears both day fields).
 * Create `enabled !== false` defaults on; update uses truthy `enabled`.
 */

const RECURRENCE = ['daily', 'weekly', 'monthly'];

export function normalizeWorklistTemplateCreate(body = {}) {
  const { title, description, recurrence, day_of_week, day_of_month, link_target, sort_order, enabled } = body;

  if (!title) {
    return { ok: false, error: 'Title is required' };
  }

  if (!RECURRENCE.includes(recurrence)) {
    return { ok: false, error: 'Invalid recurrence type' };
  }

  return {
    ok: true,
    title,
    description: description || null,
    recurrence,
    day_of_week: recurrence === 'weekly' ? day_of_week : null,
    day_of_month: recurrence === 'monthly' ? day_of_month : null,
    link_target: link_target || null,
    sort_order: sort_order || 0,
    enabled: enabled !== false ? 1 : 0,
  };
}

export function normalizeWorklistTemplateUpdate(body = {}, existing) {
  const { title, description, recurrence, day_of_week, day_of_month, link_target, sort_order, enabled } = body;

  return {
    title: title !== undefined ? title : existing.title,
    description: description !== undefined ? description : existing.description,
    recurrence: recurrence !== undefined ? recurrence : existing.recurrence,
    day_of_week: recurrence === 'weekly' ? day_of_week : null,
    day_of_month: recurrence === 'monthly' ? day_of_month : null,
    link_target: link_target !== undefined ? link_target : existing.link_target,
    sort_order: sort_order !== undefined ? sort_order : existing.sort_order,
    enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
  };
}
