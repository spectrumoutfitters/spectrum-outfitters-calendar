/**
 * Public customer booking: format and group available slots by shop timezone calendar day.
 */

export function formatTimeOnly(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

/** Single readable line for confirmation + errors (duration shown once). */
export function formatSelectedSlotSummary(iso, timeZone, slotMinutes) {
  try {
    const d = new Date(iso);
    const dateLine = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone,
    }).format(d);
    const timeLine = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    }).format(d);
    return `${dateLine} at ${timeLine} · ${slotMinutes}-minute drop-off`;
  } catch {
    return iso;
  }
}

/**
 * @param {Array<{ slot_start_iso?: string }>} slots
 * @param {string} timeZone
 * @param {number} [slotMinutes]
 * @returns {Array<{ dayKey: string, label: string, compactDay: string, isoList: string[] }>}
 */
export function groupSlots(slots, timeZone, _slotMinutes) {
  const map = new Map();
  for (const s of slots || []) {
    const iso = s.slot_start_iso;
    try {
      const d = new Date(iso);
      const key = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone,
      }).format(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(iso);
    } catch (_) {
      if (!map.has('_')) map.set('_', []);
      map.get('_').push(iso);
    }
  }
  const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([dayKey, isoList]) => {
    const first = isoList[0];
    const label =
      first && !Number.isNaN(Date.parse(first))
        ? new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone,
          }).format(new Date(first))
        : dayKey === '_'
          ? 'Suggested times'
          : dayKey;
    const compactDay =
      first && !Number.isNaN(Date.parse(first))
        ? new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone,
          }).format(new Date(first))
        : dayKey === '_'
          ? 'Open times'
          : dayKey;

    return { dayKey, label, compactDay, isoList };
  });
}
