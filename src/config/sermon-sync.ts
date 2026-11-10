import { z } from "astro/zod";
import { youtube } from "../lib/youtube";
import { parseSermon, seriesGap } from "./sermons";
import { youtubeChannelId } from "./youtube";

const streamsPlaylistId = `UULV${youtubeChannelId.slice(2)}`;

const playlistItemsResponse = z.object({
  items: z
    .array(
      z.object({
        snippet: z.object({
          title: z.string(),
          resourceId: z.object({ videoId: z.string() }),
        }),
      }),
    )
    .optional(),
});

const videosResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({
          title: z.string(),
          liveBroadcastContent: z.enum(["live", "upcoming", "none"]),
        }),
        contentDetails: z.object({ duration: z.string() }),
        liveStreamingDetails: z
          .object({ actualStartTime: z.iso.datetime().optional() })
          .optional(),
      }),
    )
    .optional(),
});

export async function syncSermons(db: D1Database, apiKey: string) {
  const playlist = await youtube("playlistItems", playlistItemsResponse, {
    key: apiKey,
    part: "snippet",
    playlistId: streamsPlaylistId,
    maxResults: "50",
    fields: "items/snippet(title,resourceId/videoId)",
  });
  const ids = (playlist.items ?? [])
    .filter(
      ({ snippet }) =>
        snippet.title !== "Private video" && snippet.title !== "Deleted video",
    )
    .map(({ snippet }) => snippet.resourceId.videoId);
  if (!ids.length) return;

  const videos = await youtube("videos", videosResponse, {
    key: apiKey,
    part: "snippet,contentDetails,liveStreamingDetails",
    id: ids.join(","),
    fields:
      "items(id,snippet(title,liveBroadcastContent),contentDetails/duration,liveStreamingDetails/actualStartTime)",
  });
  const rows = (videos.items ?? []).flatMap((video) => {
    const startedAt = video.liveStreamingDetails?.actualStartTime;
    if (video.snippet.liveBroadcastContent !== "none" || !startedAt) return [];
    return [
      parseSermon({
        id: video.id,
        title: video.snippet.title,
        startedAt,
        duration: toSeconds(video.contentDetails.duration),
      }),
    ];
  });
  if (!rows.length) return;

  // Each insert sees earlier inserts in the same D1 batch. Computing the part
  // in the insert also keeps overlapping cron runs from racing a separate read.
  rows.sort((a, b) => {
    const byStart = a.started_at.localeCompare(b.started_at);
    if (byStart || a.youtube_id === b.youtube_id) return byStart;
    // Match the database's YouTube ID tie-break in reverse (oldest first).
    return a.youtube_id > b.youtube_id ? -1 : 1;
  });
  const insert = db.prepare(`
    INSERT OR IGNORE INTO sermons (
      youtube_id, started_at, local_date, duration_seconds, raw_title, title, kind, series, part, speaker
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
      COALESCE(?9, (
        SELECT part + CASE WHEN local_date = ?3 THEN 0 ELSE 1 END
        FROM sermons
        WHERE series = ?8 AND status = 'published'
          AND (started_at < ?2 OR (started_at = ?2 AND youtube_id > ?1))
          AND local_date >= date(?3, '-${seriesGap} days')
        ORDER BY started_at DESC, youtube_id
        LIMIT 1
      ), CASE WHEN ?8 IS NOT NULL THEN 1 END),
      ?10
    )
  `);
  await db.batch(
    rows.map((row) =>
      insert.bind(
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
      ),
    ),
  );
}

/** ISO 8601 duration ("PT1H16M47S", "P0D") to seconds */
function toSeconds(duration: string): number {
  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
  );
  if (!match) return 0;
  const [days, hours, minutes, seconds] = match
    .slice(1)
    .map((n) => Number(n ?? 0));
  return ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
}
