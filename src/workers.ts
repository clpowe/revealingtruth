import { handle } from "@astrojs/cloudflare/handler";
import { fetchLiveState, liveKey, parseLiveState } from "./config/live-stream";
import { parseSermonsCache, sermonsKey, syncSermons } from "./config/sermons";

/* Pages ----------------------------------------------------------------
   These read KV but look the same to everyone (theater and wide player
   live in each browser), so each data center keeps a rendered copy. The
   request still counts, but skips the KV read and the render. TTLs follow
   the 5-minute cron: nothing they show changes faster */
const cachedPages: Record<string, number> = {
  "/sermons": 5 * 60,
};

// The DOM lib's CacheStorage (pulled in by Astro's tsconfig) lacks Workers' `default`
const edgeCache = () => (caches as unknown as { default: Cache }).default;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ttl = cachedPages[url.pathname.replace(/\/$/, "")];
    if (request.method !== "GET" || !ttl) return handle(request, env, ctx);

    // Keyed by URL alone: ?v=, ?week= and ?year= each get their own copy
    const key = new Request(url.toString());
    const cached = await edgeCache().match(key);
    if (cached) return cached;

    const response = await handle(request, env, ctx);
    // A cookie may mean the page was personal
    if (response.status !== 200 || response.headers.has("Set-Cookie"))
      return response;

    const fresh = new Response(response.body, response);
    // The edge keeps it; browsers check back each visit
    fresh.headers.set("Cache-Control", `public, max-age=0, s-maxage=${ttl}`);
    fresh.headers.set("X-Rendered-At", new Date().toISOString());
    ctx.waitUntil(edgeCache().put(key, fresh.clone()));
    return fresh;
  },

  // One trigger (wrangler.jsonc) runs both jobs: one run, one subrequest budget
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(Promise.all([refreshLive(env), refreshSermons(env)]));
  },
} satisfies ExportedHandler<Env>;

/* Live -----------------------------------------------------------------
   Check all day, including unscheduled services. A successful check renews
   freshness even if the broadcast hasn't changed (288 writes per day). */
export async function refreshLive(env: Env) {
  try {
    const previous = parseLiveState(await env.LIVE_KV.get(liveKey));
    const state = await fetchLiveState(env.YOUTUBE_API_KEY, previous);
    await env.LIVE_KV.put(
      liveKey,
      JSON.stringify({
        ...state,
        checkedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    // Keep the last successful check; readers stop trusting it after 15 minutes.
    console.error(
      "live: refresh failed",
      error instanceof Error ? error.message : error,
    );
  }
}

/* Sermons --------------------------------------------------------------- */
async function refreshSermons(env: Env) {
  try {
    const previous = await env.LIVE_KV.get(sermonsKey);
    // A malformed cache is rebuilt from scratch rather than trusted
    const cache = await syncSermons(
      env.YOUTUBE_API_KEY,
      parseSermonsCache(previous),
    );
    const next = JSON.stringify(cache);
    // Most runs find nothing new
    if (next !== previous) await env.LIVE_KV.put(sermonsKey, next);
  } catch (error) {
    console.error(
      "sermons: refresh failed",
      error instanceof Error ? error.message : error,
    );
  }
}
