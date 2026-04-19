-- Signet witness schema
-- Run once in Vercel Postgres dashboard (or any Postgres client)

CREATE TABLE IF NOT EXISTS domains (
  id          SERIAL PRIMARY KEY,
  domain      TEXT NOT NULL UNIQUE,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_count INTEGER NOT NULL DEFAULT 0,
  tier        TEXT NOT NULL DEFAULT 'free',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id               SERIAL PRIMARY KEY,
  domain_id        INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  receiver_domain  TEXT NOT NULL,
  dkim_hash        TEXT NOT NULL,
  witnessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_domain_id_idx       ON events(domain_id);
CREATE INDEX IF NOT EXISTS events_receiver_domain_idx ON events(receiver_domain);

-- Denylist: domains that have exercised opt-out (Art 21) or erasure (Art 17).
-- Any inbound email whose sender or primary receiver appears here is
-- silently dropped. Controllers can re-enable by removing the row.
CREATE TABLE IF NOT EXISTS domain_denylist (
  domain     TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,            -- 'erasure' | 'opt_out'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
