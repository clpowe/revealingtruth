# Live stream status

The five-minute Worker cron discovers the current YouTube broadcast and validates
its status with the YouTube Data API. It checks all day, including unscheduled
services. Pages never call YouTube's API directly.

## Stored state and failures

The `live` KV record has `status`, the relevant `videoId` / `startsAt`, and a
`checkedAt` ISO timestamp. Every successful check renews `checkedAt`, even when
the broadcast is unchanged. This writes up to 288 live-state records per day
under the configured five-minute schedule, plus the existing sermon-cache writes.

An unrecognized YouTube HTML response is a failed discovery, not proof of an
offline channel. If there is a previously known video, its status is checked
through the API. A failed check leaves the previous record and timestamp intact.
After 15 minutes without a successful check, readers return `unknown`. A fresh
upcoming stream more than two hours overdue is treated as no current broadcast.

Old records without `checkedAt` remain usable for video discovery but render as
unknown until the first successful cron check after deployment. No KV migration
or new binding is required. Keep `YOUTUBE_API_KEY` configured in the deployed
Worker. Preview namespaces need their own populated state; production cron does
not populate a separate preview KV namespace.

## Rendering and refresh

`/live` renders an initial state on the server, with a readable Eastern Time
start date when scheduled. The browser localizes that date and adds a countdown.
The banner is a static, initially hidden shell, so prerendered pages need no
server island. Both use `/api/live`, which reads and normalizes the same KV record.
The endpoint and live page use `Cache-Control: no-store`; KV handles read caching.

Visible tabs check immediately and then once a minute, independent of the cron
clock or scheduled start. Hidden tabs pause polling and check on return. A failed
status request shows unknown; subsequent polls recover automatically. Countdown
ticks do not announce every second to screen readers.

Updates never reload the document. A newly live stream appears automatically if
there is no player yet. Once a player exists, status changes preserve its iframe,
chat visibility preference, and any unfinished Connect form. A different live
video offers an explicit switch button; an ended or unconfirmed stream keeps
playing with a status message. The banner appears, changes, and disappears as
status changes.

This is not real-time detection: discovery can take one five-minute cron interval,
followed by KV propagation and up to one browser polling interval. Shorten the
cron only after considering YouTube quota and KV writes; polling faster alone
will not make discovery faster.

## Verification

Run `pnpm test` for state parsing, freshness boundaries, discovery failures,
known-video fallback, all-day checks, and polling lifecycle coverage.

Before release, exercise these states in a preview:

- No broadcast → upcoming → live → ended; confirm the banner follows each change.
- Start early or change the scheduled start while `/live` is open.
- Keep a video playing while refreshing state, then publish a different video:
  playback must continue until the viewer selects the switch button.
- Hide chat and type into Connect, then let status refresh. Both must persist.
- Fail YouTube checks long enough to expire the KV record, then recover.
- Disable JavaScript: the initial scheduled date and YouTube link remain usable.
