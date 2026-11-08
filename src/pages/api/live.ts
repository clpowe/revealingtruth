import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { readLiveState } from "../../config/live-stream";

export const prerender = false;

export const GET: APIRoute = async () =>
  Response.json(await readLiveState(env.LIVE_KV), {
    // KV already caches reads. Don't add another stale copy at the browser or edge.
    headers: { "Cache-Control": "no-store" },
  });
