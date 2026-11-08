import { describe, expect, it } from "vitest";
import {
  bannerStatus,
  isLiveState,
  liveMaxAge,
  normalizeLiveState,
  startGrace,
} from "./live-state";

const now = Date.parse("2026-11-08T14:00:00Z");
const checkedAt = new Date(now).toISOString();
const videoId = "dQw4w9WgXcQ";

describe("live state freshness", () => {
  it("treats missing and legacy records as unknown", () => {
    expect(normalizeLiveState(null, now)).toEqual({ status: "unknown" });
    expect(normalizeLiveState({ status: "live", videoId }, now)).toEqual({
      status: "unknown",
    });
  });

  it("returns a fresh broadcast without storage metadata", () => {
    expect(
      normalizeLiveState({ status: "live", videoId, checkedAt }, now),
    ).toEqual({ status: "live", videoId });
  });

  it.each([liveMaxAge, liveMaxAge + 1])(
    "expires a successful check after %i ms",
    (age) => {
      expect(
        normalizeLiveState({ status: "live", videoId, checkedAt }, now + age),
      ).toEqual({ status: "unknown" });
    },
  );

  it("does not trust future-dated checks", () => {
    expect(normalizeLiveState({ status: "none", checkedAt }, now - 1)).toEqual({
      status: "unknown",
    });
  });

  it("stops advertising abandoned upcoming services", () => {
    const startsAt = new Date(now - startGrace - 1).toISOString();
    expect(
      normalizeLiveState(
        { status: "upcoming", videoId, startsAt, checkedAt },
        now,
      ),
    ).toEqual({ status: "none" });
    expect(
      bannerStatus({ status: "upcoming", videoId, startsAt }, now),
    ).toBeUndefined();
  });

  it("opens the banner window at 15 minutes, including between status polls", () => {
    const startsAt = new Date(now + 15 * 60_000).toISOString();
    const state = { status: "upcoming", videoId, startsAt } as const;
    expect(bannerStatus(state, now - 1)).toBeUndefined();
    expect(bannerStatus(state, now)).toBe("upcoming");
    expect(bannerStatus({ status: "live", videoId }, now)).toBe("live");
    expect(bannerStatus({ status: "unknown" }, now)).toBeUndefined();
    expect(bannerStatus({ status: "none" }, now)).toBeUndefined();
  });
});

describe("public live state validation", () => {
  it.each([
    null,
    [],
    { status: "paused" },
    { status: "live", videoId: "bad" },
    { status: "upcoming", videoId, startsAt: "not a date" },
  ])("rejects malformed responses", (value) => {
    expect(isLiveState(value)).toBe(false);
  });
  it.each([
    { status: "none" },
    { status: "unknown" },
    { status: "live", videoId },
    { status: "upcoming", videoId, startsAt: checkedAt },
  ])("accepts supported states", (value) => {
    expect(isLiveState(value)).toBe(true);
  });
});
