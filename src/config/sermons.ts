import { diffDays, format } from "@formkit/tempo";
import { youtubeChannelId } from "./live-stream";
import { sermonOverrides } from "./sermon-overrides";
import { youtube } from "../lib/youtube";

/* Sync ----------------------------------------------------------------
   The cron keeps a cache of every past broadcast from the channel's
   auto-generated live-streams playlist (UULV…), the same list as its
   /streams tab: no uploads or Shorts. Pages turn it into sermons with
   toSermons(), so rule and override changes apply on the next deploy
   without refetching anything. */

export const sermonsKey = "sermons";

const streamsPlaylistId = `UULV${youtubeChannelId.slice(2)}`;
const timeZone = "America/New_York";
/** Calendar years kept, counting the current one */
const yearsKept = 3;
/** How often every page is re-read to catch edited titles and removed videos */
const sweepInterval = 24 * 60 * 60 * 1000;
/** Each page costs up to two subrequests; Workers Free allows 50 a run */
const sweepPagesPerRun = 5;

export interface Stream {
  id: string;
  title: string;
  /** Start in church-local wall time, "2026-11-01T11:22" */
  local: string;
  /** Length in seconds */
  duration: number;
}

export interface SermonsCache {
  /** Newest first */
  streams: Stream[];
  /** When the last full sweep finished */
  sweptAt?: string;
  /** A sweep in progress: where it resumes and which ids it has seen */
  sweep?: { pageToken: string; seen: string[] };
}

export async function syncSermons(
  apiKey: string,
  cache: SermonsCache | null,
  now = new Date(),
): Promise<SermonsCache> {
  const streams = new Map(cache?.streams.map((stream) => [stream.id, stream]));
  const cutoff = `${Number(format({ date: now, format: "YYYY", tz: timeZone })) - yearsKept + 1}-01-01`;
  let { sweptAt, sweep } = cache ?? {};

  // The newest page every run, so a finished service shows within minutes
  const first = await fetchPage(apiKey);
  await merge(apiKey, streams, first.items);

  if (!sweep && (!sweptAt || now.getTime() - Date.parse(sweptAt) > sweepInterval)) {
    sweep = { pageToken: first.nextPageToken ?? "", seen: [] };
  }

  if (sweep) {
    const seen = new Set([...sweep.seen, ...first.items.map((item) => item.id)]);
    let pageToken: string | undefined = sweep.pageToken || undefined;

    for (let read = 0; pageToken && read < sweepPagesPerRun; read++) {
      const page = await fetchPage(apiKey, pageToken);
      await merge(apiKey, streams, page.items);
      for (const item of page.items) seen.add(item.id);
      // Newest first, so once a whole page predates the window the rest does too.
      // A page of only private or deleted videos is empty after filtering and
      // says nothing about dates, so the sweep keeps going
      const pastWindow =
        page.items.length > 0 && page.items.every((item) => item.publishedAt < cutoff);
      pageToken = pastWindow ? undefined : page.nextPageToken;
    }

    if (pageToken) {
      sweep = { pageToken, seen: [...seen] };
    } else {
      // Missing from a complete pass: deleted or made private. A pass that saw
      // nothing at all is more likely a bad response than an empty channel
      if (seen.size > 0) {
        for (const id of streams.keys()) if (!seen.has(id)) streams.delete(id);
      }
      sweep = undefined;
      sweptAt = now.toISOString();
    }
  }

  return {
    // Sorted so an unchanged cache serialises identically and skips the write
    streams: [...streams.values()]
      .filter((stream) => stream.local >= cutoff)
      .sort((a, b) => b.local.localeCompare(a.local) || a.id.localeCompare(b.id)),
    sweptAt,
    sweep,
  };
}

/** Adds unseen streams and refreshes the titles of known ones */
async function merge(apiKey: string, streams: Map<string, Stream>, items: PlaylistItem[]) {
  const unseen: string[] = [];
  for (const item of items) {
    const known = streams.get(item.id);
    if (known) known.title = item.title;
    else unseen.push(item.id);
  }
  for (const stream of await fetchStreams(apiKey, unseen)) {
    streams.set(stream.id, stream);
  }
}

interface PlaylistItem {
  id: string;
  title: string;
  publishedAt: string;
}

interface PlaylistItemsResponse {
  nextPageToken?: string;
  items?: {
    snippet: { title: string; publishedAt: string; resourceId: { videoId: string } };
  }[];
}

async function fetchPage(apiKey: string, pageToken?: string) {
  const data = await youtube<PlaylistItemsResponse>("playlistItems", {
    key: apiKey,
    part: "snippet",
    playlistId: streamsPlaylistId,
    maxResults: "50",
    fields: "nextPageToken,items/snippet(title,publishedAt,resourceId/videoId)",
    ...(pageToken && { pageToken }),
  });

  const items: PlaylistItem[] = (data.items ?? [])
    // Placeholders left behind in the playlist; dropping them lets a sweep remove them
    .filter(({ snippet }) => snippet.title !== "Private video" && snippet.title !== "Deleted video")
    .map(({ snippet }) => ({
      id: snippet.resourceId.videoId,
      title: snippet.title,
      publishedAt: snippet.publishedAt,
    }));
  return { items, nextPageToken: data.nextPageToken };
}

interface VideosResponse {
  items?: {
    id: string;
    snippet: { title: string; liveBroadcastContent: "live" | "upcoming" | "none" };
    contentDetails: { duration: string };
    liveStreamingDetails?: { actualStartTime?: string };
  }[];
}

/** Details for finished broadcasts; live and upcoming ones are left for a later run */
async function fetchStreams(apiKey: string, ids: string[]): Promise<Stream[]> {
  const streams: Stream[] = [];
  for (let start = 0; start < ids.length; start += 50) {
    const data = await youtube<VideosResponse>("videos", {
      key: apiKey,
      part: "snippet,contentDetails,liveStreamingDetails",
      id: ids.slice(start, start + 50).join(","),
      fields:
        "items(id,snippet(title,liveBroadcastContent),contentDetails/duration,liveStreamingDetails/actualStartTime)",
    });
    for (const video of data.items ?? []) {
      const startedAt = video.liveStreamingDetails?.actualStartTime;
      if (video.snippet.liveBroadcastContent !== "none" || !startedAt) continue;
      streams.push({
        id: video.id,
        title: video.snippet.title,
        local: toLocal(new Date(startedAt)),
        duration: toSeconds(video.contentDetails.duration),
      });
    }
  }
  return streams;
}

function toLocal(date: Date): string {
  return format({ date, format: "YYYY-MM-DDTHH:mm", tz: timeZone });
}

/** ISO 8601 duration ("PT1H16M47S", "P0D") to seconds */
function toSeconds(duration: string): number {
  const match = duration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return 0;
  const [days, hours, minutes, seconds] = match.slice(1).map((n) => Number(n ?? 0));
  return ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
}

/* Sermons --------------------------------------------------------------
   Services are recognised by when they streamed, since title formats
   change from year to year; titles only supply the words shown. Anything
   the rules get wrong is fixed per video in sermon-overrides.ts */

export type SermonKind = "sunday" | "wednesday" | "special";

export interface Sermon {
  /** YouTube video id */
  id: string;
  kind: SermonKind;
  /** Church-local date, "2026-11-01" */
  date: string;
  /** Church-local start, "11:22" */
  time: string;
  title: string;
  series?: string;
  /** Place in the series, counted by service date */
  part?: number;
  /** Services in the series so far */
  parts?: number;
  speaker?: string;
  /** Sunday gathering named in the title, "9:00 AM" */
  gathering?: string;
  /** Length in seconds */
  duration: number;
}

/** Devotionals and clips run well under this; services well over */
const minDuration = 35 * 60;
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
const gatheringTime = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b/i;
/** Days between services before a series counts as starting over */
const seriesGap = 35;

export async function getSermons(kv: KVNamespace): Promise<Sermon[]> {
  const cache = await kv.get<SermonsCache>(sermonsKey, "json");
  return toSermons(cache?.streams ?? []);
}

/** Newest first, like the streams */
export function toSermons(streams: Stream[]): Sermon[] {
  const sermons: Sermon[] = [];

  for (const stream of streams) {
    const [date, time] = stream.local.split("T");
    const override = sermonOverrides[stream.id];
    const kind = override?.kind ?? classify(stream, date, time);
    if (!kind || kind === "hidden") continue;

    const parsed = parseTitle(stream.title);
    sermons.push({
      id: stream.id,
      kind,
      date,
      time,
      title: override?.title ?? parsed.title ?? fallbackTitle(kind, stream.title),
      series: override?.series ?? parsed.series,
      part: override?.part ?? parsed.part,
      speaker: override?.speaker ?? parsed.speaker,
      gathering: kind === "sunday" ? toGathering(stream.title) : undefined,
      duration: stream.duration,
    });
  }

  numberSeries(sermons);
  return sermons;
}

function classify(stream: Stream, date: string, time: string): SermonKind | undefined {
  if (stream.duration < minDuration) return;
  if (specialTitle.test(stream.title)) return "special";

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

function toGathering(raw: string) {
  const match = raw.match(gatheringTime);
  if (!match) return;
  const [, hour, minute = "00", meridiem] = match;
  return `${hour}:${minute} ${meridiem.toUpperCase()}M`;
}

/** Numbers each run of services sharing a series, oldest first */
function numberSeries(sermons: Sermon[]) {
  const runs = new Map<string, { dates: string[]; sermons: Sermon[] }>();
  const finished: { dates: string[]; sermons: Sermon[] }[] = [];

  for (const sermon of [...sermons].reverse()) {
    if (!sermon.series) continue;
    const key = sermon.series.toLowerCase();
    let run = runs.get(key);
    const last = run?.dates.at(-1);
    if (!run || !last || daysBetween(last, sermon.date) > seriesGap) {
      run = { dates: [], sermons: [] };
      runs.set(key, run);
      finished.push(run);
    }
    if (run.dates.at(-1) !== sermon.date) run.dates.push(sermon.date);
    run.sermons.push(sermon);
  }

  for (const run of finished) {
    const parts = Math.max(run.dates.length, ...run.sermons.map((sermon) => sermon.part ?? 0));
    for (const sermon of run.sermons) {
      sermon.part ??= run.dates.indexOf(sermon.date) + 1;
      sermon.parts = parts;
    }
  }
}

function daysBetween(from: string, to: string) {
  // Rounded: a DST change makes a local-time day 23 or 25 hours
  return diffDays(to, from, "round");
}
