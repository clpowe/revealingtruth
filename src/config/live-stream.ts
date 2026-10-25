// YouTube channel behind seo.social.youtube. The /live page embeds by video
// ID when one is found, because live chat can only be embedded per video.
export const youtubeChannelId = "UCLQfHqzkzdBwitvJcFqGYAA";

const liveURL = `https://www.youtube.com/channel/${youtubeChannelId}/live`;

// The channel's /live URL resolves to the current or next scheduled stream,
// and its canonical link names that video. Anything else (no stream
// scheduled, consent wall, timeout) returns undefined so the page falls back
// to the channel-level player.
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
