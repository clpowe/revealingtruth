import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@astrojs/cloudflare/handler", () => ({ handle: vi.fn() }));
vi.mock("./config/sermons", () => ({
  parseSermonsCache: vi.fn(),
  syncSermons: vi.fn(),
  sermonsKey: "sermons",
}));
vi.mock("./config/live-stream", async (original) => ({
  ...(await original<typeof import("./config/live-stream")>()),
  fetchLiveState: vi.fn(),
}));
import { refreshLive } from "./workers";
import { fetchLiveState } from "./config/live-stream";

const stored = {
  status: "live",
  videoId: "dQw4w9WgXcQ",
  checkedAt: "2026-11-08T14:00:00Z",
};
const get = vi.fn();
const put = vi.fn();
const env = { LIVE_KV: { get, put }, YOUTUBE_API_KEY: "key" } as unknown as Env;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-08T14:05:00Z"));
  get.mockResolvedValue(JSON.stringify(stored));
  vi.mocked(fetchLiveState).mockResolvedValue({
    status: "live",
    videoId: stored.videoId,
  });
});
afterEach(() => vi.useRealTimers());

describe("live refresh job", () => {
  it("renews checkedAt even when the broadcast is unchanged", async () => {
    await refreshLive(env);
    expect(put).toHaveBeenCalledWith(
      "live",
      JSON.stringify({ ...stored, checkedAt: "2026-11-08T14:05:00.000Z" }),
    );
  });
  it("does not renew freshness when YouTube is unavailable", async () => {
    vi.mocked(fetchLiveState).mockRejectedValue(new Error("unavailable"));
    await refreshLive(env);
    expect(put).not.toHaveBeenCalled();
  });
  it("discovers broadcasts during formerly excluded afternoon hours", async () => {
    vi.setSystemTime(new Date("2026-11-08T20:00:00Z"));
    get.mockResolvedValue(JSON.stringify({ status: "none" }));
    await refreshLive(env);
    expect(fetchLiveState).toHaveBeenCalled();
    expect(put).toHaveBeenCalled();
  });
});
