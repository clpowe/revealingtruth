import { handle } from "@astrojs/cloudflare/handler";
import { fetchLiveState, type LiveState } from "./config/live-stream";
import { sermonsKey, syncSermons, type SermonsCache } from "./config/sermons";

/* Pages ----------------------------------------------------------------
   These read KV but look the same to everyone (theater and wide player
   live in each browser), so each data center keeps a rendered copy. The
   request still counts, but skips the KV read and the render. TTLs follow
   the 5-minute cron: nothing they show changes faster */
const cachedPages: Record<string, number> = {
  "/sermons": 5 * 60,
  "/live": 60,
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
    if (response.status !== 200 || response.headers.has("Set-Cookie")) return response;

    const fresh = new Response(response.body, response);
    // The edge keeps it; browsers check back each visit
    fresh.headers.set("Cache-Control", `public, max-age=0, s-maxage=${ttl}`);
    fresh.headers.set("X-Rendered-At", new Date().toISOString());
    ctx.waitUntil(edgeCache().put(key, fresh.clone()));
    return fresh;
  },

  // One trigger (wrangler.jsonc) runs both jobs: one run, one subrequest budget
  async scheduled(controller, env, ctx) {
    const now = new Date(controller.scheduledTime);
    ctx.waitUntil(Promise.all([refreshLive(env, now), refreshSermons(env)]));
  },
} satisfies ExportedHandler<Env>;

/* Live -----------------------------------------------------------------
   Church-local hours with no stream live or about to start across the year
   to November 2026: late night and mid-afternoon. A stream that's live, or
   due within two hours, is still followed through them */
const quietHours = new Set([22, 23, 0, 1, 2, 3, 4, 14, 15, 16]);
const dueSoon = 2 * 60 * 60 * 1000;

const churchHour = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  hourCycle: "h23",
});

async function refreshLive(env: Env, now: Date) {
  try {
    const previous = await env.LIVE_KV.get("live");
    const state = previous ? (JSON.parse(previous) as LiveState) : null;

    const active =
      state?.status === "live" ||
      (state?.status === "upcoming" && Date.parse(state.startsAt) - now.getTime() < dueSoon);
    if (!active && quietHours.has(Number(churchHour.format(now)))) return;

    const next = JSON.stringify(await fetchLiveState(env.YOUTUBE_API_KEY));
    // The state rarely changes; KV Free allows 1,000 writes a day
    if (next !== previous) await env.LIVE_KV.put("live", next);
  } catch (error) {
    console.error("live: refresh failed", error instanceof Error ? error.message : error);
  }
}

/* Sermons --------------------------------------------------------------- */
async function refreshSermons(env: Env) {
  try {
    const previous = await env.LIVE_KV.get(sermonsKey);
    const cache = await syncSermons(
      env.YOUTUBE_API_KEY,
      previous ? (JSON.parse(previous) as SermonsCache) : null,
    );
    const next = JSON.stringify(cache);
    // Most runs find nothing new
    if (next !== previous) await env.LIVE_KV.put(sermonsKey, next);
  } catch (error) {
    console.error("sermons: refresh failed", error instanceof Error ? error.message : error);
  }
}
