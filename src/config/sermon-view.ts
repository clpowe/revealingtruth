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

/** The Sunday a "YYYY-MM-DD" date's week starts on */
export function startOfWeek(date: string) {
  return format(weekStart(date, 0), "YYYY-MM-DD");
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
