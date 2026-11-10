import { format } from "@formkit/tempo";

export const sermonTimeZone = "America/New_York";
export const seriesGap = 35;

export type SermonKind = "sunday" | "wednesday" | "special";

export interface Sermon {
  id: string;
  kind: SermonKind;
  date: string;
  title: string;
  series?: string;
  part?: number;
  parts?: number;
  speaker?: string;
  gathering?: string;
}

interface Stream {
  id: string;
  startedAt: string;
  title: string;
  duration: number;
}

const specialTitle =
  /easter|sunrise|resurrection|good friday|christmas eve|watch ?night|new years? eve|night of (?:prayer|worship)|founders? day/i;

const separator = /\s*(?:\||\/\/|\s[-–—]\s)\s*/;
const speakerSegment =
  /^(?:pastors?|p\.|apostle|bishop|minister|elder|evangelist|prophet(?:ess)?|dr\.)\s/i;
/** Service labels rather than words worth showing */
const labelSegment =
  /gathering|service|full experience|round table|valuable wednesday|revealing truth|#rtm|^sunday|^\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?$|^\d{1,2}[./_-]\d{1,2}[./_-]\d{2,4}$/i;
/** "Art of War (Part 11): Title", "Every Generation Matters Part 2" */
const partSegment = /^(.*?)\s*\(?\b(?:pt\.?|part)\s*(\d+)\)?\s*(?::\s*(.+))?$/i;
export function parseSermon(stream: Stream, kind?: SermonKind) {
  const startedAt = new Date(stream.startedAt);
  const [date, time] = format({
    date: startedAt,
    format: "YYYY-MM-DDTHH:mm",
    tz: sermonTimeZone,
  }).split("T");
  kind ??= classifySermon(stream.title, date, time) ?? "special";

  const parsed = parseTitle(stream.title);
  return {
    youtube_id: stream.id,
    started_at: startedAt.toISOString(),
    local_date: date,
    duration_seconds: stream.duration,
    raw_title: stream.title,
    title: parsed.title ?? fallbackTitle(kind, stream.title),
    kind,
    series: parsed.series ?? null,
    part: parsed.part ?? null,
    speaker: parsed.speaker ?? null,
  };
}

export function classifySermon(
  title: string,
  date: string,
  time: string,
): SermonKind | undefined {
  if (specialTitle.test(title)) return "special";

  const weekday = format(date, "dddd", "en");
  const hour = Number(time.slice(0, 2));
  if (weekday === "Sunday" && hour >= 5 && hour < 14) return "sunday";
  if (weekday === "Wednesday" && hour >= 17) return "wednesday";
}

function parseTitle(raw: string) {
  let series: string | undefined;
  let part: number | undefined;
  let speaker: string | undefined;
  const words: string[] = [];

  for (const segment of raw.split(separator).map(unquote)) {
    if (!segment || labelSegment.test(segment)) continue;
    if (speakerSegment.test(segment)) {
      speaker ??= segment.replace(/^p\.\s*/i, "Pastor ");
      continue;
    }
    const numbered = segment.match(partSegment);
    if (numbered) {
      series ??= numbered[1] || undefined;
      part ??= Number(numbered[2]);
      if (numbered[3]) words.push(unquote(numbered[3]));
      continue;
    }
    words.push(segment);
  }

  return { title: words[0], series: series ?? words[1], part, speaker };
}

function unquote(text: string) {
  return text.trim().replace(/^["“”']+|["“”']+$/g, "");
}

function fallbackTitle(kind: SermonKind, raw: string) {
  if (kind === "sunday") return "Sunday Service";
  if (kind === "wednesday") return "Valuable Wednesday";
  // A special's own label: "Good Friday Service", "Sunrise Service 2026"
  return (
    raw
      .split(separator)
      .find((segment) => specialTitle.test(segment))
      ?.trim() ?? raw
  );
}
