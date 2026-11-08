import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchLiveState } from "./live-refresh";

class TestDocument extends EventTarget {
  visibilityState = "visible";
  setVisibility(value: string) {
    this.visibilityState = value;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

let document: TestDocument;
const fetchMock = vi.fn();
let stop: (() => void) | undefined;
const response = (body: unknown) => ({ ok: true, json: async () => body });

beforeEach(() => {
  vi.useFakeTimers();
  document = new TestDocument();
  vi.stubGlobal("document", document);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(response({ status: "none" }));
});
afterEach(() => {
  stop?.();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("watchLiveState", () => {
  it("checks immediately and discovers early starts without waiting for startsAt", async () => {
    const update = vi.fn();
    fetchMock.mockResolvedValueOnce(
      response({
        status: "upcoming",
        videoId: "dQw4w9WgXcQ",
        startsAt: "2026-11-09T14:00:00Z",
      }),
    );
    stop = watchLiveState(update);
    await vi.advanceTimersByTimeAsync(0);
    fetchMock.mockResolvedValueOnce(
      response({ status: "live", videoId: "dQw4w9WgXcQ" }),
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update.mock.calls.map(([state]) => state.status)).toEqual([
      "upcoming",
      "live",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/live",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("pauses hidden tabs and checks immediately when they return", async () => {
    document.setVisibility("hidden");
    stop = watchLiveState(vi.fn());
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchMock).not.toHaveBeenCalled();
    document.setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    document.setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["network", "http", "schema"])(
    "reports unknown on %s failure and recovers",
    async (failure) => {
      if (failure === "network")
        fetchMock.mockRejectedValueOnce(new Error("offline"));
      if (failure === "http") fetchMock.mockResolvedValueOnce({ ok: false });
      if (failure === "schema")
        fetchMock.mockResolvedValueOnce(
          response({ status: "live", videoId: "invalid" }),
        );
      const update = vi.fn();
      stop = watchLiveState(update);
      await vi.advanceTimersByTimeAsync(0);
      expect(update).toHaveBeenLastCalledWith({ status: "unknown" });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(update).toHaveBeenLastCalledWith({ status: "none" });
    },
  );

  it("times out a hung request and resumes polling", async () => {
    fetchMock.mockImplementationOnce(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const update = vi.fn();
    stop = watchLiveState(update);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(update).toHaveBeenLastCalledWith({ status: "unknown" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).toHaveBeenLastCalledWith({ status: "none" });
  });

  it("stops timers, listeners, and in-flight updates on disconnect", async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const update = vi.fn();
    stop = watchLiveState(update);
    const signal = fetchMock.mock.calls[0][1].signal;
    stop();
    expect(signal.aborted).toBe(true);
    resolve(response({ status: "none" }));
    await vi.advanceTimersByTimeAsync(120_000);
    document.setVisibility("visible");
    expect(update).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
