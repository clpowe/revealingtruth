CREATE TABLE sermons (
  youtube_id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  duration_seconds INTEGER,
  raw_title TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sunday', 'wednesday', 'special')),
  series TEXT COLLATE NOCASE,
  part INTEGER,
  speaker TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX sermons_started_at ON sermons (started_at DESC, youtube_id);
CREATE INDEX sermons_series ON sermons (series, started_at DESC, youtube_id);
CREATE INDEX sermons_local_date ON sermons (local_date) WHERE status = 'published';

-- The displayed total stays current as a series grows or rows are hidden.
-- Multiple gatherings on one church-local date count as one service date.
CREATE VIEW sermon_series_parts AS
WITH series_days AS (
  SELECT series, local_date, MAX(part) AS day_part,
    LAG(local_date) OVER (PARTITION BY series ORDER BY local_date) AS previous_date
  FROM sermons
  WHERE status = 'published' AND series IS NOT NULL
  GROUP BY series, local_date
), series_runs AS (
  SELECT series, local_date, day_part,
    SUM(CASE WHEN julianday(local_date) - julianday(previous_date) <= 35 THEN 0 ELSE 1 END)
      OVER (PARTITION BY series ORDER BY local_date) AS run
  FROM series_days
)
SELECT series, local_date,
  MAX(COUNT(*) OVER series_run, COALESCE(MAX(day_part) OVER series_run, 0)) AS parts
FROM series_runs
WINDOW series_run AS (PARTITION BY series, run);
