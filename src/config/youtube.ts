export const youtubeChannelId = "UCLQfHqzkzdBwitvJcFqGYAA";

/** The youtube-worker's status endpoint, polled by the header's live banner.
    Staging and production share the one deployed worker; local dev reads
    the worker under `wrangler dev`, with its own local KV */
export const liveStatusUrl = import.meta.env.DEV
  ? "http://localhost:8787"
  : "https://youtube-worker.clpowe.workers.dev";
