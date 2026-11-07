import { addDay, format, weekStart } from "@formkit/tempo";
import type { Sermon } from "./sermons";

/* Helpers shared by the /sermons page and its archive ------------------- */

export function today() {
  return format({
    date: new Date(),
    format: "YYYY-MM-DD",
    tz: "America/New_York",
  });
}

/* tempo costs ~0.25ms a call and a render asks for the same few hundred
   dates over and over; kept per isolate, bounded by the dates that exist */
const weekStarts = new Map<string, string>();

/** The Sunday a "YYYY-MM-DD" date's week starts on */
export function startOfWeek(date: string) {
  let start = weekStarts.get(date);
  if (!start) {
    start = format(weekStart(date, 0), "YYYY-MM-DD");
    weekStarts.set(date, start);
  }
  return start;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** `value` if it's a real "YYYY-MM-DD" calendar date, else undefined */
export function validDate(value: string | null): string | undefined {
  if (!value || !isoDate.test(value)) return;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return real ? value : undefined;
}

export function addDays(date: string, days: number) {
  return format(addDay(date, days), "YYYY-MM-DD");
}

export function label(sermon: Sermon) {
  if (sermon.kind === "wednesday") return "Wednesday night";
  if (sermon.kind === "special") return "Special service";
  if (!sermon.series) return "Message";
  return sermon.parts && sermon.parts > 1
    ? `${sermon.series}, part ${sermon.part} of ${sermon.parts}`
    : sermon.series;
}

/** The current query string with `changes` applied, as a relative link */
export function link(params: URLSearchParams, changes: Record<string, string>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) next.set(key, value);
  return `?${next}`;
}

export const playLink = (params: URLSearchParams, sermon: Sermon) =>
  link(params, {
    v: sermon.id,
    week: startOfWeek(sermon.date),
    year: sermon.date.slice(0, 4),
  });
