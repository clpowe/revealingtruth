import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { z } from "astro/zod";
import { describe, expect, it, vi } from "vitest";
import { youtube } from "../lib/youtube";
import { syncSermons } from "./sermon-sync";
import { parseSermon } from "./sermons";

vi.mock("../lib/youtube", () => ({ youtube: vi.fn() }));

describe("parseSermon", () => {
  it("parses a short Sunday stream into a stored sermon", () => {
    expect(
      parseSermon({
        id: "example",
        title:
          "Sunday Gathering 11 AM | New Life (Part 3): A Leap of Faith | P. Bryan Powe",
        startedAt: "2026-11-01T16:00:00Z",
        duration: 1200,
      }),
    ).toEqual({
      youtube_id: "example",
      started_at: "2026-11-01T16:00:00.000Z",
      local_date: "2026-11-01",
      duration_seconds: 1200,
      raw_title:
        "Sunday Gathering 11 AM | New Life (Part 3): A Leap of Faith | P. Bryan Powe",
      title: "A Leap of Faith",
      kind: "sunday",
      series: "New Life",
      part: 3,
      speaker: "Pastor Bryan Powe",
    });
  });

  it.each([
    ["2026-11-05T00:00:00Z", "Valuable Wednesday", "wednesday", "2026-11-04"],
    ["2026-11-01T10:00:00Z", "Sunrise Service", "special", "2026-11-01"],
    ["2026-11-06T16:00:00Z", "A Short Message", "special", "2026-11-06"],
  ])("classifies %s %s as %s", (startedAt, title, kind, date) => {
    const sermon = parseSermon({
      id: "example",
      title,
      startedAt,
      duration: 300,
    });
    expect(sermon).toMatchObject({ kind, local_date: date, title });
  });
});

it("syncs the newest page oldest first and preserves edited rows on repeat", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../../migrations/0002_create_sermons.sql", import.meta.url),
      "utf8",
    ),
  );
  const db = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        bind:
          (...values: SQLInputValue[]) =>
          () =>
            statement.run(...values),
      };
    },
    async batch(statements: (() => unknown)[]) {
      return statements.map((execute) => execute());
    },
  } as unknown as D1Database;

  const videos = [
    ["reset", "2027-01-17T16:00:00Z", "none"],
    ["same-day", "2026-12-06T16:00:00Z", "none"],
    ["later", "2026-12-06T14:00:00Z", "none"],
    ["earlier", "2026-11-01T16:00:00Z", "none"],
    ["on-air", "2026-11-08T16:00:00Z", "live"],
    ["upcoming", undefined, "upcoming"],
    ["not-a-stream", undefined, "none"],
  ];
  vi.mocked(youtube).mockImplementation((async (
    resource: string,
    schema: z.ZodType,
  ) =>
    schema.parse(
      resource === "playlistItems"
        ? {
            nextPageToken: "ignored",
            items: [...videos, ["removed"]].map(([id]) => ({
              snippet: {
                title: id === "removed" ? "Deleted video" : "Service",
                resourceId: { videoId: id },
              },
            })),
          }
        : {
            items: videos.map(([id, startedAt, state]) => ({
              id,
              snippet: {
                title:
                  id === "earlier"
                    ? "New Life Part 3: First"
                    : "A Message | new life",
                liveBroadcastContent: state,
              },
              contentDetails: { duration: "PT10M" },
              liveStreamingDetails: { actualStartTime: startedAt },
            })),
          },
    )) as typeof youtube);

  await syncSermons(db, "test");
  const rows = sqlite.prepare(
    "SELECT youtube_id, part, status FROM sermons ORDER BY started_at",
  );
  expect(rows.all()).toEqual([
    { youtube_id: "earlier", part: 3, status: "published" },
    { youtube_id: "later", part: 4, status: "published" },
    { youtube_id: "same-day", part: 4, status: "published" },
    { youtube_id: "reset", part: 1, status: "published" },
  ]);
  expect(
    sqlite
      .prepare(
        "SELECT local_date, parts FROM sermon_series_parts ORDER BY local_date",
      )
      .all(),
  ).toEqual([
    { local_date: "2026-11-01", parts: 4 },
    { local_date: "2026-12-06", parts: 4 },
    { local_date: "2027-01-17", parts: 1 },
  ]);
  expect(youtube).toHaveBeenCalledTimes(2);
  expect(vi.mocked(youtube).mock.calls[1][2].id).not.toContain("removed");

  sqlite.exec(
    "UPDATE sermons SET title = 'Edited', status = 'hidden' WHERE youtube_id = 'earlier'",
  );
  await syncSermons(db, "test");
  expect(rows.all()).toHaveLength(4);
  expect(
    sqlite
      .prepare("SELECT title, status FROM sermons WHERE youtube_id = 'earlier'")
      .get(),
  ).toEqual({ title: "Edited", status: "hidden" });
  sqlite.close();
});
