import { z } from "astro/zod";
import { youtube, youtubeHtml } from "../lib/youtube";

export const youtubeChannelId = "UCLQfHqzkzdBwitvJcFqGYAA";

const liveURL = `https://www.youtube.com/channel/${youtubeChannelId}/live`;

export async function getLiveVideoId(): Promise<string | undefined> {
  const html = await youtubeHtml(liveURL, {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
    timeout: 3000,
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  return html?.match(
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/,
  )?.[1];
}

export const liveKey = "live";

const videoId = z.string().regex(/^[\w-]{11}$/);

const liveState = z.discriminatedUnion("status", [
  z.object({ status: z.literal("live"), videoId }),
  z.object({ status: z.literal("upcoming"), videoId, startsAt: z.iso.datetime() }),
  z.object({ status: z.literal("none") }),
]);

export type LiveState = z.infer<typeof liveState>;

/** The stored state, or null when it's missing or isn't one */
export function parseLiveState(raw: string | null): LiveState | null {
  if (!raw) return null;
  try {
    const parsed = liveState.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {}
  console.warn("live: ignoring malformed stored state");
  return null;
}

const startGrace = 2 * 60 * 60 * 1000;

const videosResponse = z.object({
  items: z
    .array(
      z.object({
        snippet: z.object({ liveBroadcastContent: z.enum(["live", "upcoming", "none"]) }),
        liveStreamingDetails: z.object({ scheduledStartTime: z.iso.datetime().optional() }).optional(),
      }),
    )
    .optional(),
});

export async function fetchLiveState(apiKey: string): Promise<LiveState> {
  const videoId = await getLiveVideoId();
  if (!videoId) return { status: "none" };

  const data = await youtube(
    "videos",
    videosResponse,
    { part: "snippet,liveStreamingDetails", id: videoId, key: apiKey },
    5000,
  );
  const video = data.items?.[0];
  if (!video) return { status: "none" };

  switch (video.snippet.liveBroadcastContent) {
    case "live":
      return { status: "live", videoId };
    case "upcoming": {
      const startsAt = video.liveStreamingDetails?.scheduledStartTime;
      if (!startsAt) return { status: "none" };
      // A broadcast that never went live stays "upcoming" indefinitely
      if (Date.now() - Date.parse(startsAt) > startGrace) return { status: "none" };
      return { status: "upcoming", videoId, startsAt };
    }
    // Ended streams still resolve at /live for a while
    default:
      return { status: "none" };
  }
}
