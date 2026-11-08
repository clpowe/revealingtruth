import { isLiveState, type LiveState } from "./live-state";

const interval = 60_000;

/** Refresh only data, never the document or a playing iframe. */
export function watchLiveState(update: (state: LiveState) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let stopped = false;

  async function check() {
    if (stopped || document.visibilityState !== "visible" || controller) return;
    controller = new AbortController();
    const request = controller;
    const timeout = setTimeout(() => request.abort(), 10_000);
    try {
      const response = await fetch("/api/live", {
        cache: "no-store",
        signal: request.signal,
      });
      if (!response.ok) throw new Error("Live status unavailable");
      const state: unknown = await response.json();
      if (!isLiveState(state)) throw new Error("Invalid live status");
      if (!stopped) update(state);
    } catch {
      if (!stopped) update({ status: "unknown" });
    } finally {
      clearTimeout(timeout);
      controller = undefined;
      if (!stopped && document.visibilityState === "visible")
        timer = setTimeout(check, interval);
    }
  }

  function visibilityChanged() {
    clearTimeout(timer);
    if (document.visibilityState === "visible") void check();
  }
  document.addEventListener("visibilitychange", visibilityChanged);
  void check();

  return () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
    document.removeEventListener("visibilitychange", visibilityChanged);
  };
}
