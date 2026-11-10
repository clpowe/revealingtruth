import { addDay, format, weekStart } from "@formkit/tempo";
import { z } from "astro/zod";
import { sermonTimeZone, type Sermon } from "./sermons";

/* Helpers shared by the /sermons page and its archive ------------------- */

export function today() {
  return format({
    date: new Date(),
    format: "YYYY-MM-DD",
    tz: sermonTimeZone,
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
  return sermon.part !== undefined && sermon.parts && sermon.parts > 1
    ? `${sermon.series}, part ${sermon.part} of ${sermon.parts}`
    : sermon.series;
}

/** The current query string with `changes` applied, as a relative link */
export function link(params: URLSearchParams, changes: Record<string, string>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) next.set(key, value);
  return `?${next}`;
}

export const playLink = (
  params: URLSearchParams,
  sermon: Pick<Sermon, "id" | "date">,
) =>
  link(params, {
    v: sermon.id,
    week: startOfWeek(sermon.date),
    year: sermon.date.slice(0, 4),
  });

const gatheringTime = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b/i;

export async function loadSermonView(db: D1Database, query: SermonsQuery) {
  const [selected, yearRows] = await Promise.all([
    db
      .prepare(
        `
      SELECT youtube_id, started_at, local_date
      FROM sermons
      WHERE youtube_id = COALESCE(
        (SELECT youtube_id FROM sermons WHERE youtube_id = ?1 AND status = 'published'),
        (SELECT youtube_id FROM sermons WHERE status = 'published' ORDER BY started_at DESC, youtube_id LIMIT 1)
      ) AND status = 'published'
    `,
      )
      .bind(query.v ?? null)
      .first<{ youtube_id: string; started_at: string; local_date: string }>(),
    db
      .prepare(
        `
      SELECT DISTINCT substr(local_date, 1, 4) AS year
      FROM sermons WHERE status = 'published'
      ORDER BY year DESC
    `,
      )
      .all<{ year: string }>(),
  ]);

  const years = yearRows.results.map(({ year }) => year);
  const date = selected?.local_date ?? today();
  const week = startOfWeek(query.week ?? date);
  const weekEnd = addDays(week, 7);
  const year = years.find((year) => year === query.year) ?? date.slice(0, 4);
  // The archive grid includes the entire first and last weeks touching the year.
  const archiveStart = startOfWeek(`${year}-01-01`);
  const archiveEnd = addDays(startOfWeek(`${year}-12-31`), 7);

  const [rows, newer] = await Promise.all([
    db
      .prepare(
        `
      SELECT s.youtube_id AS id, s.local_date AS date, s.raw_title,
        s.title, s.kind, s.series, s.part, s.speaker, series_parts.parts
      FROM sermons s
      LEFT JOIN sermon_series_parts series_parts
        ON s.series = series_parts.series AND s.local_date = series_parts.local_date
      WHERE s.status = 'published' AND (
        (s.local_date >= ?1 AND s.local_date < ?2) OR
        (s.local_date >= ?3 AND s.local_date < ?4) OR s.youtube_id = ?5
      )
      ORDER BY s.started_at DESC, s.youtube_id
    `,
      )
      .bind(
        week,
        weekEnd,
        archiveStart,
        archiveEnd,
        selected?.youtube_id ?? null,
      )
      .all<{
        id: string;
        date: string;
        raw_title: string;
        title: string;
        kind: Sermon["kind"];
        series: string | null;
        part: number | null;
        speaker: string | null;
        parts: number | null;
      }>(),
    selected &&
      db
        .prepare(
          `
      SELECT youtube_id AS id, local_date AS date, title
      FROM sermons
      WHERE status = 'published'
        AND (started_at > ?1 OR (started_at = ?1 AND youtube_id < ?2))
      ORDER BY started_at, youtube_id DESC
      LIMIT 1
    `,
        )
        .bind(selected.started_at, selected.youtube_id)
        .first<{ id: string; date: string; title: string }>(),
  ]);

  const sermons: Sermon[] = rows.results.map((row) => {
    // Keep the legacy gathering label as presentation of the raw YouTube title.
    const time =
      row.kind === "sunday" ? row.raw_title.match(gatheringTime) : null;
    return {
      id: row.id,
      date: row.date,
      title: row.title,
      kind: row.kind,
      series: row.series ?? undefined,
      part: row.part ?? undefined,
      parts: row.parts ?? undefined,
      speaker: row.speaker ?? undefined,
      gathering: time
        ? `${time[1]}:${time[2] ?? "00"} ${time[3].toUpperCase()}M`
        : undefined,
    };
  });

  return {
    playing: sermons.find((sermon) => sermon.id === selected?.youtube_id),
    newer: newer ?? undefined,
    week,
    weekSermons: sermons
      .filter(({ date }) => date >= week && date < weekEnd)
      .reverse(),
    year,
    years,
    archiveSermons: sermons.filter(
      ({ date }) => date >= archiveStart && date < archiveEnd,
    ),
  };
}
