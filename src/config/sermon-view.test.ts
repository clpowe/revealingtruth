import { describe, expect, it } from "vitest";
import { parseSermonsQuery, validDate } from "./sermon-view";

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

describe("parseSermonsQuery", () => {
  const parse = (query: string) => parseSermonsQuery(new URLSearchParams(query));

  it("keeps well-formed values", () => {
    expect(parse("v=dQw4w9WgXcQ&week=2026-11-08&year=2026")).toEqual({
      v: "dQw4w9WgXcQ",
      week: "2026-11-08",
      year: "2026",
    });
  });

  it("drops malformed values without failing the rest", () => {
    expect(parse("v=nope&week=2026-02-30&year=20x6")).toEqual({});
    expect(parse("v=nope&week=2026-11-08")).toEqual({ week: "2026-11-08" });
  });
});
