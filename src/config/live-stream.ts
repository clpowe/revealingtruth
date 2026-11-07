export const youtubeChannelId = "UCLQfHqzkzdBwitvJcFqGYAA";

const liveURL = `https://www.youtube.com/channel/${youtubeChannelId}/live`;

export async function getLiveVideoId(): Promise<string | undefined> {
  try {
    const response = await fetch(liveURL, {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(3000),
      // Share one lookup per minute across visitors at each edge location
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!response.ok) return undefined;

    const html = await response.text();
    return html.match(
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/,
    )?.[1];
  } catch {
    return undefined;
  }
}

export type LiveState =
  | { status: "live"; videoId: string }
  | { status: "upcoming"; videoId: string; startsAt: string }
  | { status: "none" };

const startGrace = 2 * 60 * 60 * 1000;

interface VideosResponse {
  items?: {
    snippet: { liveBroadcastContent: "live" | "upcoming" | "none" };
    liveStreamingDetails?: { scheduledStartTime?: string };
  }[];
}

export async function fetchLiveState(apiKey: string): Promise<LiveState> {
  const videoId = await getLiveVideoId();
  if (!videoId) return { status: "none" };

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({
      part: "snippet,liveStreamingDetails",
      id: videoId,
      key: apiKey,
    })}`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok) throw new Error(`YouTube videos responded ${response.status}`);

  const video = ((await response.json()) as VideosResponse).items?.[0];
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
