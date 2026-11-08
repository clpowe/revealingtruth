/* When an open /live page reloads to pick up a new state. The cron runs on
   each 5-minute mark; 70s later it has finished and any copy of the page
   the edge cached (60s) is gone */
const step = 5 * 60 * 1000;
const settle = 70 * 1000;
const day = 24 * 60 * 60 * 1000;

/** The first moment after `after` the page can show a newer state */
export function nextCheck(after: number) {
  return Math.floor((after - settle) / step) * step + step + settle;
}

/** Milliseconds until the page should reload, or undefined to leave it be */
export function reloadDelay(status: string | undefined, now: number, startsAt?: number) {
  // A stream being watched is never cut off
  if (status === "live") return;
  // Upcoming: the first check after the start, then each one while it's late.
  // Nothing scheduled: every check, so a waiting visitor sees a service start
  const from = status === "upcoming" && startsAt ? Math.max(startsAt, now) : now;
  // Capped at a day: setTimeout overflows past ~24.8 days and would fire at once
  return Math.min(nextCheck(from) - now, day);
}
