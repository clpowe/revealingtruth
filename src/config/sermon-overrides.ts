import type { SermonKind } from "./sermons";

export interface SermonOverride {
  /** "hidden" leaves the stream off the page; a kind adds it or moves it */
  kind?: SermonKind | "hidden";
  title?: string;
  series?: string;
  part?: number;
  speaker?: string;
}

/**
 * Hand fixes for what the YouTube titles leave out or get wrong, keyed by
 * video id (the `v=` in the watch URL). Only the fields given replace the
 * parsed ones.
 *
 * "RJWOWwlitGo": { speaker: "Pastor Bryan Powe" },
 */
export const sermonOverrides: Record<string, SermonOverride> = {};
