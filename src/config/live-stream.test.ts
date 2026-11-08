import { describe, expect, it, vi } from "vitest";
import { parseLiveState } from "./live-stream";

vi.mock("../lib/youtube", () => ({ youtube: vi.fn(), youtubeHtml: vi.fn() }));

describe("parseLiveState", () => {
  it.each([
    { status: "none" },
    { status: "live", videoId: "dQw4w9WgXcQ" },
    { status: "upcoming", videoId: "dQw4w9WgXcQ", startsAt: "2026-11-08T14:00:00Z" },
  ])("reads %j", (state) => {
    expect(parseLiveState(JSON.stringify(state))).toEqual(state);
  });

  it.each([
    ["missing", null],
    ["not JSON", "live"],
    ["unknown status", JSON.stringify({ status: "paused" })],
    ["live without a video", JSON.stringify({ status: "live" })],
    ["bad video id", JSON.stringify({ status: "live", videoId: "<script>" })],
    ["upcoming without a start", JSON.stringify({ status: "upcoming", videoId: "dQw4w9WgXcQ" })],
  ])("treats a %s state as absent", (_, raw) => {
    expect(parseLiveState(raw)).toBeNull();
  });
});
