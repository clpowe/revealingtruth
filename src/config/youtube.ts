export const youtubeChannelId = "UCLQfHqzkzdBwitvJcFqGYAA";

/** The youtube-worker's status endpoint, polled by the header's live banner.
    Staging and production share the one deployed worker; local dev reads
    the worker under `wrangler dev`, with its own local KV */
export const liveStatusUrl = import.meta.env.DEV
  ? "http://localhost:8787"
  : "https://youtube-worker.clpowe.workers.dev";

/** The broadcast on air now, as the youtube-worker's cron last saw it */
export type LiveStream = { videoId: string; title: string };

/** Read straight from the KV the worker writes ("live"), so /live can render
    the player server-side. Null when off air, unset, or malformed. Staging
    has its own KV the worker never writes, so it's always off air there */
export async function getLiveStream(
  kv: KVNamespace,
): Promise<LiveStream | null> {
  try {
    const status = JSON.parse((await kv.get("live")) ?? "null");
    if (status?.isLive === true && typeof status.videoId === "string") {
      return { videoId: status.videoId, title: String(status.title ?? "") };
    }
  } catch {}
  return null;
}
