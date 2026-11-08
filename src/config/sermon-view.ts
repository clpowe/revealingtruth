import { addDay, format, weekStart } from "@formkit/tempo";
import { z } from "astro/zod";
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
   dates over and over; kept per isolate. Visitors pick ?week=, so the
   cache starts over past a size no real archive reaches */
const weekStarts = new Map<string, string>();
const weekStartsMax = 5000;

/** The Sunday a "YYYY-MM-DD" date's week starts on */
export function startOfWeek(date: string) {
  let start = weekStarts.get(date);
  if (!start) {
    start = format(weekStart(date, 0), "YYYY-MM-DD");
    if (weekStarts.size >= weekStartsMax) weekStarts.clear();
    weekStarts.set(date, start);
  }
  return start;
}

/** zod's check rejects impossible days too: 2026-02-30, 2025-02-29 */
const isoDate = z.iso.date();

/** `value` if it's a real "YYYY-MM-DD" calendar date, else undefined */
export function validDate(value: string | null): string | undefined {
  const parsed = isoDate.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/* /sermons query: anything malformed reads as absent, so a bad link falls
   back to the defaults instead of failing the page */
const sermonsQuery = z.object({
  v: z.string().regex(/^[\w-]{11}$/).optional().catch(undefined),
  week: isoDate.optional().catch(undefined),
  year: z.string().regex(/^\d{4}$/).optional().catch(undefined),
});

export type SermonsQuery = z.infer<typeof sermonsQuery>;

export function parseSermonsQuery(params: URLSearchParams): SermonsQuery {
  return sermonsQuery.parse({
    v: params.get("v") ?? undefined,
    week: params.get("week") ?? undefined,
    year: params.get("year") ?? undefined,
  });
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
