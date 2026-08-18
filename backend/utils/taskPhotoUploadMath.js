/**
 * Pure helpers for task photo type/caption coercion and id parsing.
 * Extracted from routes/taskPhotos.js — keep behavior identical.
 */

export const TASK_PHOTO_TYPES = ['before', 'after', 'progress', 'other'];

/**
 * Unknown / omitted / `'Before'` (wrong case) all store `'other'`.
 * Only the four exact whitelist strings are kept.
 */
export function coercePhotoType(photoType) {
  return TASK_PHOTO_TYPES.includes(photoType) ? photoType : 'other';
}

/**
 * Caption: truthy values are String().trim().slice(0, 500); falsy
 * (`''`, `0`, `null`, omitted) stores null. Whitespace-only becomes `''`
 * after trim (still truthy input, so not null — empty string).
 */
export function coercePhotoCaption(caption) {
  return caption ? String(caption).trim().slice(0, 500) : null;
}

export function parsePhotoRouteId(id) {
  return Number(id);
}

/**
 * GET/POST `/:id/photos`: reject falsy or non-finite ids
 * (`0`, `NaN`, `Infinity`, `''` → 0).
 */
export function isInvalidTaskPhotoReadId(taskId) {
  return !taskId || !Number.isFinite(taskId);
}

/**
 * DELETE `/:taskId/photos/:photoId`: only `!taskId || !photoId`
 * (no Number.isFinite). `Infinity` is truthy so it would pass this gate.
 */
export function isInvalidTaskPhotoDeleteIds(taskId, photoId) {
  return !taskId || !photoId;
}
