export type BroadcastState =
  | { status: "live"; videoId: string }
  | { status: "upcoming"; videoId: string; startsAt: string }
  | { status: "none" };
export type LiveState = BroadcastState | { status: "unknown" };

/** Check the public response without shipping the server's schema library. */
export function isLiveState(value: unknown): value is LiveState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (state.status === "none" || state.status === "unknown") return true;
  if (typeof state.videoId !== "string" || !/^[\w-]{11}$/.test(state.videoId))
    return false;
  return (
    state.status === "live" ||
    (state.status === "upcoming" &&
      typeof state.startsAt === "string" &&
      Number.isFinite(Date.parse(state.startsAt)))
  );
}

// Optional only to read pre-migration values. They are unknown until rechecked.
export type StoredLiveState = BroadcastState & { checkedAt?: string };

export const liveMaxAge = 15 * 60 * 1000;
export const startGrace = 2 * 60 * 60 * 1000;
const soonWindow = 15 * 60 * 1000;

export function normalizeLiveState(
  stored: StoredLiveState | null,
  now = Date.now(),
): LiveState {
  const checkedAt = stored?.checkedAt ? Date.parse(stored.checkedAt) : NaN;
  if (
    !stored ||
    !Number.isFinite(checkedAt) ||
    checkedAt > now ||
    now - checkedAt >= liveMaxAge
  ) {
    return { status: "unknown" };
  }
  if (
    stored.status === "upcoming" &&
    now - Date.parse(stored.startsAt) > startGrace
  ) {
    return { status: "none" };
  }
  const { checkedAt: _, ...state } = stored;
  return state;
}

export function bannerStatus(state: LiveState, now = Date.now()) {
  if (state.status === "live") return "live";
  if (state.status !== "upcoming") return;
  const until = Date.parse(state.startsAt) - now;
  if (until <= soonWindow && until >= -startGrace) return "upcoming";
}
