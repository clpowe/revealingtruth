import { describe, expect, it } from "vitest";
import { reloadDelay } from "./live-refresh";

const at = Date.parse;
const minutes = (n: number) => n * 60 * 1000;

describe("reloadDelay", () => {
  it("never reloads while a stream is live", () => {
    expect(reloadDelay("live", at("2026-11-08T14:00:30Z"))).toBeUndefined();
  });

  it("checks back each cron cycle while nothing is live", () => {
    // The 14:00 run is still settling, so the next check is 14:01:10
    expect(reloadDelay("none", at("2026-11-08T14:00:30Z"))).toBe(40_000);
  });

  it("waits a full cycle after landing on a check, so it can't loop", () => {
    expect(reloadDelay("none", at("2026-11-08T14:01:10Z"))).toBe(minutes(5));
  });

  it("waits for the first check after an upcoming start", () => {
    const now = at("2026-11-08T14:00:30Z");
    const start = at("2026-11-08T15:00:00Z");
    expect(reloadDelay("upcoming", now, start)).toBe(at("2026-11-08T15:01:10Z") - now);
  });

  it("caps far-off starts at a day", () => {
    const now = at("2026-11-08T14:00:00Z");
    expect(reloadDelay("upcoming", now, now + minutes(60 * 24 * 30))).toBe(minutes(60 * 24));
  });
});
