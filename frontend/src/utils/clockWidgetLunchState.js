/**
 * Lunch-still-out check shared by the header clock and the main clock widget.
 *
 * The latest entry whose notes contain "lunch break" and that has a clock-out
 * leaves the employee on lunch until some other entry has a later clock-in.
 * Any later clock-in counts, including next-day punches. This is separate from
 * same-day return pairing used when editing a time entry.
 */

export function isStillOnLunchBreak(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const recentEntry = list
    .filter((e) => e && e.clock_out && e.notes && e.notes.toLowerCase().includes('lunch break'))
    .sort((a, b) => new Date(b.clock_out) - new Date(a.clock_out))[0];

  if (!recentEntry) return false;

  const lunchOutTime = new Date(recentEntry.clock_out);
  const returnEntry = list.find((e) => {
    if (!e || !e.clock_in || e.id === recentEntry.id) return false;
    return new Date(e.clock_in) > lunchOutTime;
  });
  return !returnEntry;
}
