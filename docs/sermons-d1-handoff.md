# Handoff: move the sermon archive from KV to D1

You are picking up a planned refactor of the sermon archive on the Revealing Truth church website. The design decisions below are already made with the owner. Your job is to implement Phase 1 on a branch and stop for review before touching any remote database.

## Project context

- Repo: `odd-night-8d07/` (Astro site on Cloudflare Workers, package manager pnpm). Worker entry is `src/workers.ts`. Read `AGENTS.md` first.
- Branches: `staging` (work here), `production` (live). Staging deploys as a Worker Preview using the `previews` block in `wrangler.jsonc`, which has its own KV and D1.
- D1: binding `PRAYER_DB` (`revealingtruth-prayer` in production, `revealingtruth-prayer-staging` in previews), migrations in `migrations/`. Only `0001_create_prayer_requests.sql` exists.
- KV: binding `LIVE_KV`. It holds the sermon archive blob and also live-stream state written by a separate Worker in the sibling folder `youtube-worker/`. Do not change `youtube-worker/` and do not remove the `LIVE_KV` binding.
- Secret: `YOUTUBE_API_KEY`.

## How the archive works today

Descriptions here come from an earlier review; confirm each against the code before relying on it.

- A cron (`*/5 * * * *`) calls `refreshSermons` in `src/workers.ts`, which calls `syncSermons` in `src/config/sermons.ts` (389 lines). It reads the channel's live-streams playlist from the YouTube API, re-reads every page once a day to catch renames and deletions, keeps three calendar years, and stores everything as one JSON blob in KV under `sermonsKey`.
- On every page render, `toSermons()` derives each sermon's details: kind (Sunday, Wednesday, special) from stream day, time and length; title, series, part and speaker from the YouTube title with regexes; series part numbers from date gaps (a 35-day gap ends a series). Streams under 35 minutes are excluded.
- Wrong guesses are corrected in `src/config/sermon-overrides.ts`, which requires a deploy.
- `src/pages/sermons.astro` and `src/config/sermon-view.ts` render the archive. `src/workers.ts` edge-caches `/sermons` for 5 minutes.
- Tests: `src/config/sermons.test.ts`, `src/config/sermon-view.test.ts`.

## Decisions already made

1. D1 becomes the source of truth for sermons. Reuse the existing `PRAYER_DB` database; do not create a new database or binding.
2. Sync stays automatic but becomes insert-only: fetch the newest playlist page and `INSERT OR IGNORE` finished streams. It never updates an existing row, so hand-edited rows are safe. Remove the daily full re-read, page tokens, "seen" tracking and the three-year prune.
3. Title and kind parsing runs once, at insert, and the results are stored as columns. Render-time inference goes away.
4. New streams are published automatically, not held as drafts.
5. Schema is one flat table. Series is a text column; there is no separate series table and no gathering column.
6. Corrections are row edits with `wrangler d1 execute`. No admin page in this work.
7. Deleted or private videos are hidden by hand with `status = 'hidden'`. No automated check.
8. The 5-minute edge cache stays as is. Edits appearing within 5 minutes is acceptable.
9. Streams shorter than 35 minutes are included and published, a change from today's behavior.

## Constraints from the owner

- Do not add new components or CSS. Reuse what exists. If you believe a new component is unavoidable, stop and ask.
- Work step by step and keep changes reviewable.
- The player (`SermonPlayer.astro`), week navigation and archive markup should not change. Existing `?v=<youtube id>` links must keep working.
- Do not run migrations or imports against remote D1 (staging or production), do not deploy, and do not push to `production`. Those steps need the owner's go-ahead.

## Phase 0: prep

`staging` has uncommitted edits in `src/components/SermonPlayer.astro`, `src/config/youtube.ts` and `src/pages/live.astro`. They belong to other work. Ask the owner whether to commit or stash them; do not discard them. Then create `feat/sermons-d1` from `staging`.

## Phase 1: build

1. Add `migrations/0002_create_sermons.sql` creating `sermons`:
   - `youtube_id` TEXT PRIMARY KEY
   - `started_at` TEXT NOT NULL (UTC ISO 8601 stream start)
   - `duration_seconds` INTEGER
   - `raw_title` TEXT NOT NULL (YouTube title as fetched, for reference)
   - `title` TEXT NOT NULL (display title)
   - `kind` TEXT NOT NULL, one of `sunday`, `wednesday`, `special` (match the values the code already uses)
   - `series` TEXT, `part` INTEGER, `speaker` TEXT
   - `status` TEXT NOT NULL DEFAULT `'published'`, one of `published`, `hidden`
   - `created_at`, `updated_at` TEXT NOT NULL
   - Indexes on `started_at` and on `series`.
   Add any column the current `Sermon` type needs that is missing here, and say so in your summary.
2. In `src/config/sermons.ts`, keep the parsing as a pure function that turns one stream into one row. Delete the KV cache format, the sweep and the prune. Keep the parsing tests passing; rewrite tests that covered deleted code.
3. Part numbering at insert: when a new row has a series but no explicit part in its title, set the part from the most recent earlier row in the same series, applying the same 35-day rule the current code uses. Rows are inserted oldest first.
4. Streams under 35 minutes: today these are excluded. The owner wants them included. Remove the length cutoff: insert them like any other finished stream, with `status = 'published'`. If the current code uses length for anything else (for example deciding kind), keep that use and say so in your summary. The one-time import in step 7 must include them too, so it cannot rely on `toSermons()` dropping them; list the short streams it adds in your summary so the owner can hide any that are test or aborted streams.
5. Replace `refreshSermons` in `src/workers.ts` with the D1 sync. Keep the cron schedule. Failures should log and not throw, as now.
6. Change `sermons.astro` and `sermon-view.ts` to query D1 by week or year with `status = 'published'`, in place of loading the KV blob.
7. Add a one-time import script in `scripts/` that reads the current KV sermon blob, runs the existing `toSermons()` with the overrides applied, and writes a `.sql` file of inserts. Write this before deleting `toSermons()` and the overrides, so the current corrections are carried into the rows.
8. Delete `src/config/sermon-overrides.ts` and all reads and writes of `sermonsKey`.

## Verification before you report back

- `pnpm` typecheck, tests and build pass. State the exact commands and results.
- Apply the migration and the import to local D1 only (`wrangler d1 ... --local`), then run the site locally and compare `/sermons` for several weeks, including a week with a series and a week with an overridden sermon, against the current staging output. They should match except for the newly included short streams.
- Run the sync locally once and confirm it inserts nothing new on a second run.

## Report back with

- What changed, file by file, in a few lines.
- Anything in the "how it works today" section that turned out to be wrong, and how you handled it.
- Any difference between old and new `/sermons` output.
- The exact commands the owner needs for the later phases.

## Later phases, not yours unless asked

- Phase 2: apply migration and import to staging D1, deploy to staging, watch one real stream arrive, test a row edit.
- Phase 3: same on production, then delete the sermon key from production KV after a clean week.
- Optional: backfill sermons older than three years, a protected admin form, a weekly check for removed videos.
