import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseLiveState } from "./live-stream";

vi.mock("../lib/youtube", () => ({ youtube: vi.fn(), youtubeHtml: vi.fn() }));

describe("parseLiveState", () => {
  it.each([
    { status: "none" },
    { status: "live", videoId: "dQw4w9WgXcQ" },
    {
      status: "upcoming",
      videoId: "dQw4w9WgXcQ",
      startsAt: "2026-11-08T14:00:00Z",
    },
  ])("reads %j", (state) => {
    expect(parseLiveState(JSON.stringify(state))).toEqual(state);
  });

  it.each([
    ["missing", null],
    ["not JSON", "live"],
    ["unknown status", JSON.stringify({ status: "paused" })],
    ["live without a video", JSON.stringify({ status: "live" })],
    ["bad video id", JSON.stringify({ status: "live", videoId: "<script>" })],
    [
      "upcoming without a start",
      JSON.stringify({ status: "upcoming", videoId: "dQw4w9WgXcQ" }),
    ],
  ])("treats a %s state as absent", (_, raw) => {
    expect(parseLiveState(raw)).toBeNull();
  });
});

import {
  fetchLiveState,
  getLiveVideoId,
  readLiveState,
  youtubeChannelId,
} from "./live-stream";
import { youtube, youtubeHtml } from "../lib/youtube";

const videoId = "dQw4w9WgXcQ";
const checkedAt = "2026-11-08T14:00:00Z";
const previous = { status: "live", videoId, checkedAt } as const;
const watchPage = `<link rel="canonical" href="https://www.youtube.com/watch?v=${videoId}">`;

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("YouTube discovery", () => {
  it.each([
    watchPage,
    `<link href='https://www.youtube.com/watch?v=${videoId}&amp;feature=share' rel='canonical'>`,
  ])("accepts canonical attributes in either order", async (html) => {
    vi.mocked(youtubeHtml).mockResolvedValue(html);
    expect(await getLiveVideoId()).toBe(videoId);
  });

  it("recognizes the channel without a featured broadcast", async () => {
    vi.mocked(youtubeHtml).mockResolvedValue(
      `<link rel="canonical" href="https://www.youtube.com/channel/${youtubeChannelId}">`,
    );
    expect(await fetchLiveState("key")).toEqual({ status: "none" });
    expect(youtube).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    "<html>Consent required</html>",
    '<link rel="canonical" href="https://example.org/watch?v=dQw4w9WgXcQ">',
  ])("does not call unexpected HTML offline", async (html) => {
    vi.mocked(youtubeHtml).mockResolvedValue(html);
    await expect(fetchLiveState("key")).rejects.toThrow("did not identify");
  });

  it("verifies the last known video when discovery fails", async () => {
    vi.mocked(youtubeHtml).mockRejectedValue(new Error("timeout"));
    vi.mocked(youtube).mockResolvedValue({
      items: [{ snippet: { liveBroadcastContent: "live" } }],
    });
    expect(await fetchLiveState("key", previous)).toEqual({
      status: "live",
      videoId,
    });
    expect(youtube).toHaveBeenCalledWith(
      "videos",
      expect.anything(),
      expect.objectContaining({ id: videoId }),
      5000,
    );
  });

  it("accepts a confirmed end after discovery fails", async () => {
    vi.mocked(youtubeHtml).mockResolvedValue("unexpected HTML");
    vi.mocked(youtube).mockResolvedValue({
      items: [{ snippet: { liveBroadcastContent: "none" } }],
    });
    expect(await fetchLiveState("key", previous)).toEqual({ status: "none" });
  });

  it("propagates an API outage instead of claiming offline", async () => {
    vi.mocked(youtubeHtml).mockResolvedValue(watchPage);
    vi.mocked(youtube).mockRejectedValue(new Error("API unavailable"));
    await expect(fetchLiveState("key", previous)).rejects.toThrow(
      "API unavailable",
    );
  });

  it("requires a schedule for upcoming broadcasts", async () => {
    vi.mocked(youtubeHtml).mockResolvedValue(watchPage);
    vi.mocked(youtube).mockResolvedValue({
      items: [{ snippet: { liveBroadcastContent: "upcoming" } }],
    });
    await expect(fetchLiveState("key")).rejects.toThrow("no scheduled start");
  });

  it("preserves rescheduled starts and drops abandoned upcoming videos", async () => {
    vi.mocked(youtubeHtml).mockResolvedValue(watchPage);
    const startsAt = "2026-11-08T14:00:00Z";
    vi.mocked(youtube).mockResolvedValue({
      items: [
        {
          snippet: { liveBroadcastContent: "upcoming" },
          liveStreamingDetails: { scheduledStartTime: startsAt },
        },
      ],
    });
    expect(await fetchLiveState("key", null, Date.parse(startsAt))).toEqual({
      status: "upcoming",
      videoId,
      startsAt,
    });
    expect(
      await fetchLiveState(
        "key",
        null,
        Date.parse(startsAt) + 2 * 60 * 60_000 + 1,
      ),
    ).toEqual({ status: "none" });
  });
});

describe("stored live reads", () => {
  it("retains and validates freshness metadata", () => {
    expect(parseLiveState(JSON.stringify(previous))).toEqual(previous);
    expect(
      parseLiveState(JSON.stringify({ ...previous, checkedAt: "yesterday" })),
    ).toBeNull();
  });

  it("returns unknown when a KV read fails", async () => {
    const kv = { get: vi.fn().mockRejectedValue(new Error("KV unavailable")) };
    expect(
      await readLiveState(kv as unknown as Pick<KVNamespace, "get">),
    ).toEqual({ status: "unknown" });
  });

  it("applies expiry on every read", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(checkedAt));
    const kv = { get: vi.fn().mockResolvedValue(JSON.stringify(previous)) };
    expect(
      await readLiveState(kv as unknown as Pick<KVNamespace, "get">),
    ).toEqual({ status: "live", videoId });
    vi.setSystemTime(new Date(Date.parse(checkedAt) + 15 * 60_000));
    expect(
      await readLiveState(kv as unknown as Pick<KVNamespace, "get">),
    ).toEqual({ status: "unknown" });
  });
});
