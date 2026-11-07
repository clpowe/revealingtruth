import { handle } from "@astrojs/cloudflare/handler";
import { fetchLiveState } from "./config/live-stream";

export default {
  fetch: handle,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refresh(env));
  },
} satisfies ExportedHandler<Env>;

async function refresh(env: Env) {
  try {
    const state = await fetchLiveState(env.YOUTUBE_API_KEY);
    await env.LIVE_KV.put("live", JSON.stringify(state));
  } catch (error) {
    console.error("live: refresh failed", error instanceof Error ? error.message : error);
  }
}
