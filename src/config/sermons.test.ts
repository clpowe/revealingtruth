import { beforeEach, describe, expect, it, vi } from "vitest";
import { youtube } from "../lib/youtube";
import { syncSermons, type Stream } from "./sermons";

vi.mock("../lib/youtube", () => ({ youtube: vi.fn() }));

const now = new Date("2026-11-07T12:00:00Z");
const recent = "2026-11-01T15:00:00Z";

type Item = { id: string; title?: string };
type Page = { items: Item[]; next?: string };

/** Fakes the API: playlist pages keyed by page token ("" is the first) */
function playlist(pages: Record<string, Page>) {
  vi.mocked(youtube).mockImplementation((async (
    resource: string,
    query: Record<string, string>,
  ) => {
    if (resource === "playlistItems") {
      const page = pages[query.pageToken ?? ""];
      return {
        nextPageToken: page.next,
        items: page.items.map((item) => ({
          snippet: {
            title: item.title ?? `Service ${item.id}`,
            publishedAt: recent,
            resourceId: { videoId: item.id },
          },
        })),
      };
    }
    // videos: every id is a finished hour-long broadcast
    return {
      items: query.id.split(",").map((id) => ({
        id,
        snippet: { title: `Service ${id}`, liveBroadcastContent: "none" },
        contentDetails: { duration: "PT1H" },
        liveStreamingDetails: { actualStartTime: recent },
      })),
    };
  }) as typeof youtube);
}

const cached = (id: string): Stream => ({
  id,
  title: `Service ${id}`,
  local: "2026-10-25T11:00",
  duration: 3600,
});
const ids = (streams: Stream[]) => streams.map((stream) => stream.id).sort();

// Braces: a function returned from beforeEach runs as a cleanup hook
beforeEach(() => {
  vi.mocked(youtube).mockReset();
});

describe("syncSermons sweep", () => {
  it("keeps paging past a page of only private or deleted videos", async () => {
    playlist({
      "": { items: [{ id: "a" }], next: "p2" },
      p2: {
        items: [
          { id: "x", title: "Private video" },
          { id: "y", title: "Deleted video" },
        ],
        next: "p3",
      },
      p3: { items: [{ id: "b" }] },
    });
    const cache = await syncSermons("key", null, now);
    expect(ids(cache.streams)).toEqual(["a", "b"]);
    expect(cache.sweep).toBeUndefined();
  });

  it("keeps cached sermons that sit beyond a placeholder-only page", async () => {
    playlist({
      "": { items: [{ id: "a" }], next: "p2" },
      p2: { items: [{ id: "x", title: "Private video" }], next: "p3" },
      p3: { items: [{ id: "b" }] },
    });
    const cache = await syncSermons("key", { streams: [cached("b")] }, now);
    expect(ids(cache.streams)).toEqual(["a", "b"]);
  });

  it("removes nothing until a sweep spanning several runs finishes", async () => {
    // Seven pages: more than one run's five
    const pages: Record<string, Page> = {};
    for (let n = 0; n < 7; n++) {
      pages[n ? `p${n}` : ""] = {
        items: [{ id: `s${n}` }],
        next: n < 6 ? `p${n + 1}` : undefined,
      };
    }
    playlist(pages);

    const first = await syncSermons("key", { streams: [cached("gone")] }, now);
    expect(first.sweep).toBeDefined();
    expect(ids(first.streams)).toContain("gone");

    const second = await syncSermons("key", first, now);
    expect(second.sweep).toBeUndefined();
    expect(ids(second.streams)).not.toContain("gone");
  });

  it("doesn't wipe the cache when a complete pass sees no videos", async () => {
    playlist({ "": { items: [] } });
    const cache = await syncSermons("key", { streams: [cached("b")] }, now);
    expect(ids(cache.streams)).toEqual(["b"]);
  });
});
