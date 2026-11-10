import { readFileSync, writeFileSync } from "node:fs";
import { diffDays, parse } from "@formkit/tempo";
import { z } from "astro/zod";
import {
  classifySermon,
  parseSermon,
  sermonTimeZone,
  seriesGap,
  type SermonKind,
} from "../src/config/sermons.ts";

// Snapshot of the overrides used by the KV archive at cutover.
const overrides: Record<
  string,
  {
    kind?: SermonKind | "hidden";
    title?: string;
    series?: string;
    part?: number;
    speaker?: string;
  }
> = {};

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error(
    "Usage: node scripts/import-sermons.ts <kv-export.json> <sermons.sql>",
  );
  process.exit(1);
}

const cache = z.object({
  streams: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      duration: z.number().int().nonnegative(),
    }),
  ),
});
const { streams } = cache.parse(JSON.parse(readFileSync(inputPath, "utf8")));

// The KV snapshot stores wall time without an offset. Parse in church time
// even when the script runs on a machine in a different timezone.
process.env.TZ = sermonTimeZone;

// The old cache was newest first. Number its services in reverse order.
const rows = streams.toReversed().map((stream) => {
  const [date, time] = stream.local.split("T");
  const override = overrides[stream.id];
  const classified = classifySermon(stream.title, date, time);
  const short = stream.duration < 35 * 60;
  const legacyKind = override?.kind ?? (short ? undefined : classified);
  const wasPublished = !!legacyKind && legacyKind !== "hidden";
  const status =
    legacyKind !== "hidden" && (wasPublished || short) ? "published" : "hidden";
  const startedAt = parse({
    date: stream.local,
    format: "YYYY-MM-DDTHH:mm",
    locale: "en",
    dateOverflow: "throw",
  }).toISOString();
  const row = parseSermon(
    {
      id: stream.id,
      title: stream.title,
      duration: stream.duration,
      startedAt,
    },
    (wasPublished ? legacyKind : classified) ?? "special",
  );
  row.title = override?.title ?? row.title;
  row.series = override?.series ?? row.series;
  row.part = override?.part ?? row.part;
  row.speaker = override?.speaker ?? row.speaker;
  return { row, status, wasPublished, short, local: stream.local };
});

// The old toSermons() assigned unnumbered parts by distinct service date,
// regardless of any explicit parts in the same run. Keep those assignments.
const runs = new Map<string, { date: string; days: number }>();
for (const { row, wasPublished } of rows) {
  if (!wasPublished || !row.series) continue;
  const key = row.series.toLowerCase();
  const previous = runs.get(key);
  const date = row.local_date;
  const days =
    !previous || diffDays(date, previous.date, "round") > seriesGap
      ? 1
      : previous.days + Number(date !== previous.date);
  row.part ??= days;
  runs.set(key, { date, days });
}

// Fill the newly visible rows from the most recent part in their series.
const latest = new Map<string, { date: string; part: number }>();
for (const { row, status } of rows) {
  if (status !== "published" || !row.series) continue;
  const key = row.series.toLowerCase();
  const previous = latest.get(key);
  const date = row.local_date;
  row.part ??=
    !previous || diffDays(date, previous.date, "round") > seriesGap
      ? 1
      : previous.part + Number(date !== previous.date);
  latest.set(key, { date, part: row.part });
}

const sql = rows.map(({ row, status }) => {
  const values = [
    row.youtube_id,
    row.started_at,
    row.local_date,
    row.duration_seconds,
    row.raw_title,
    row.title,
    row.kind,
    row.series,
    row.part,
    row.speaker,
    status,
  ]
    .map(sqlValue)
    .join(", ");
  return `INSERT OR IGNORE INTO sermons (youtube_id, started_at, local_date, duration_seconds, raw_title, title, kind, series, part, speaker, status) VALUES (${values});`;
});
writeFileSync(outputPath, `${sql.join("\n")}\n`);

const addedShorts = rows.filter(
  ({ short, wasPublished, status }) =>
    short && !wasPublished && status === "published",
);
console.log("Church time\tDuration (seconds)\tYouTube ID\tRaw title");
for (const { row, local } of addedShorts.toReversed()) {
  console.log(
    `${local}\t${row.duration_seconds}\t${row.youtube_id}\t${JSON.stringify(row.raw_title)}`,
  );
}
console.error(
  `Wrote ${rows.length} inserts to ${outputPath}, including ${addedShorts.length} newly published short streams.`,
);

function sqlValue(value: string | number | null): string {
  if (value === null) return "NULL";
  return typeof value === "number"
    ? String(value)
    : `'${value.replaceAll("'", "''")}'`;
}
