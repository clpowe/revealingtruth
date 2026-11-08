import { z } from "astro/zod";
import { youtube, youtubeHtml } from "../lib/youtube";
import {
  normalizeLiveState,
  startGrace,
  type BroadcastState,
  type StoredLiveState,
} from "../lib/live-state";

export const youtubeChannelId = "UCLQfHqzkzdBwitvJcFqGYAA";
export const youtubeLiveURL = `https://www.youtube.com/channel/${youtubeChannelId}/live`;
export const liveKey = "live";

/** Undefined means a recognized channel page; unexpected HTML is a failed check. */
export async function getLiveVideoId(): Promise<string | undefined> {
  const html = await youtubeHtml(youtubeLiveURL, {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
    timeout: 3000,
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  for (const tag of html?.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1];
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (rel?.toLowerCase() !== "canonical" || !href) continue;
    let url: URL;
    try {
      url = new URL(href.replaceAll("&amp;", "&"));
    } catch {
      continue;
    }
    if (url.hostname !== "www.youtube.com" && url.hostname !== "youtube.com")
      continue;
    const id = url.searchParams.get("v");
    if (url.pathname === "/watch" && id && /^[\w-]{11}$/.test(id)) return id;
    const path = url.pathname.replace(/\/$/, "");
    if (
      path === `/channel/${youtubeChannelId}` ||
      path.toLowerCase() === "/@revealingtruth"
    ) {
      return undefined;
    }
  }
  throw new Error("YouTube live page did not identify a video or the channel");
}

const videoId = z.string().regex(/^[\w-]{11}$/);
const broadcastStateSchema: z.ZodType<BroadcastState> = z.discriminatedUnion(
  "status",
  [
    z.object({ status: z.literal("live"), videoId }),
    z.object({
      status: z.literal("upcoming"),
      videoId,
      startsAt: z.iso.datetime(),
    }),
    z.object({ status: z.literal("none") }),
  ],
);

const storedLiveStateSchema = z.intersection(
  broadcastStateSchema,
  z.object({ checkedAt: z.iso.datetime().optional() }),
);

export function parseLiveState(raw: string | null): StoredLiveState | null {
  if (!raw) return null;
  try {
    const parsed = storedLiveStateSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {}
  console.warn("live: ignoring malformed stored state");
  return null;
}

/** Pages and the status endpoint apply exactly the same freshness policy. */
export async function readLiveState(kv: Pick<KVNamespace, "get">) {
  try {
    return normalizeLiveState(parseLiveState(await kv.get(liveKey)));
  } catch {
    console.error("live: stored state could not be read");
    return { status: "unknown" } as const;
  }
}

const videosResponse = z.object({
  items: z.array(
    z.object({
      snippet: z.object({
        liveBroadcastContent: z.enum(["live", "upcoming", "none"]),
      }),
      liveStreamingDetails: z
        .object({ scheduledStartTime: z.iso.datetime().optional() })
        .optional(),
    }),
  ),
});

export async function fetchLiveState(
  apiKey: string,
  previous: StoredLiveState | null = null,
  now = Date.now(),
): Promise<BroadcastState> {
  let videoId: string | undefined;
  try {
    videoId = await getLiveVideoId();
  } catch (error) {
    // A failed discovery must not erase a broadcast we can still verify directly.
    if (!previous || previous.status === "none") throw error;
    videoId = previous.videoId;
  }
  // Even a channel redirect may lag behind an active broadcast.
  videoId ??=
    previous && previous.status !== "none" ? previous.videoId : undefined;
  if (!videoId) return { status: "none" };

  const data = await youtube(
    "videos",
    videosResponse,
    { part: "snippet,liveStreamingDetails", id: videoId, key: apiKey },
    5000,
  );
  const video = data.items[0];
  if (!video) return { status: "none" };
  switch (video.snippet.liveBroadcastContent) {
    case "live":
      return { status: "live", videoId };
    case "upcoming": {
      const startsAt = video.liveStreamingDetails?.scheduledStartTime;
      if (!startsAt)
        throw new Error("YouTube upcoming video has no scheduled start");
      if (now - Date.parse(startsAt) > startGrace) return { status: "none" };
      return { status: "upcoming", videoId, startsAt };
    }
    default:
      return { status: "none" };
  }
}
