import { z } from "astro/zod";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({
  FetchError: class extends Error {},
  ofetch: Object.assign(vi.fn(), { create: () => api }),
}));

const { youtube } = await import("./youtube");
const schema = z.object({ items: z.array(z.object({ id: z.string() })) });

describe("youtube", () => {
  it("returns data that fits the schema", async () => {
    api.mockResolvedValueOnce({ items: [{ id: "a" }] });
    await expect(youtube("videos", schema, {})).resolves.toEqual({ items: [{ id: "a" }] });
  });

  it("rejects data that doesn't, naming paths but no values", async () => {
    api.mockResolvedValueOnce({ items: [{ id: 42, secret: "key=abc" }] });
    const error = await youtube("videos", schema, {}).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("YouTube videos sent unexpected data at items.0.id");
  });
});
