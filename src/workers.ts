import { handle } from "@astrojs/cloudflare/handler";
import { syncSermons } from "./config/sermon-sync";

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
    if (response.status !== 200 || response.headers.has("Set-Cookie")) return response;

    const fresh = new Response(response.body, response);
    // The edge keeps it; browsers check back each visit
    fresh.headers.set("Cache-Control", `public, max-age=0, s-maxage=${ttl}`);
    fresh.headers.set("X-Rendered-At", new Date().toISOString());
    ctx.waitUntil(edgeCache().put(key, fresh.clone()));
    return fresh;
  },

  // Keep the sermon archive up to date.
  async scheduled(_controller, env) {
    try {
      await syncSermons(env.PRAYER_DB, env.YOUTUBE_API_KEY);
    } catch (error) {
      console.error("sermons: refresh failed", error instanceof Error ? error.message : error);
    }
  },
} satisfies ExportedHandler<Env>;
