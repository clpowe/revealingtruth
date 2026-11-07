import { describe, expect, it } from "vitest";
import { validDate } from "./sermon-view";

describe("validDate", () => {
  it.each(["2026-11-08", "2024-02-29"])("accepts %s", (value) => {
    expect(validDate(value)).toBe(value);
  });

  it.each([
    null,
    "",
    "abc",
    "2026-13-01",
    "2026-02-30",
    "2025-02-29",
    "2026-11-8",
    "2026-11-08T00:00",
    " 2026-11-08",
  ])("rejects %j", (value) => {
    expect(validDate(value)).toBeUndefined();
  });
});
