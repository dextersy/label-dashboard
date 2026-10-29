/**
 * Resolves the effective ticket-sales close time for an event.
 *
 * - If `close_time` is set, use it.
 * - If the event has more than one day, use 8h after the last day's start time
 *   so the close time covers the full run of a multi-day event.
 * - Otherwise fall back to `date_and_time` (single-day start time).
 *
 * Expects `event.days` to be eager-loaded. If not present, falls back to
 * single-day behaviour.
 */
export function resolveEventCloseTime(
  event: { close_time?: Date | string | null; date_and_time: Date | string; days?: { date_and_time: Date | string }[] }
): Date {
  if (event.close_time) return new Date(event.close_time);
  const days = event.days ?? [];
  if (days.length > 1) {
    const sorted = [...days].sort(
      (a, b) => new Date(a.date_and_time).getTime() - new Date(b.date_and_time).getTime()
    );
    return new Date(new Date(sorted[sorted.length - 1].date_and_time).getTime() + 8 * 60 * 60 * 1000);
  }
  return new Date(event.date_and_time);
}
