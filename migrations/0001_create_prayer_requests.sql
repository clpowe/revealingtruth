CREATE TABLE prayer_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  phone TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 7 AND 20),
  message TEXT CHECK (message IS NULL OR length(trim(message)) BETWEEN 1 AND 4000),
  sms_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (sms_opt_in IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
