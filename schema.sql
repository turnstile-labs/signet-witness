-- ────────────────────────────────────────────────────────────────
-- Witnessed · database schema
-- ────────────────────────────────────────────────────────────────
-- Idempotent. Safe to run repeatedly against an existing database.
--
-- Run against prod:
--   psql "$DATABASE_URL" -f schema.sql
-- or paste the contents into the Neon / Vercel Postgres SQL editor.
-- ────────────────────────────────────────────────────────────────

-- Every domain we've ever witnessed as a sender.
-- `event_count` is denormalised for cheap list/seal reads and is
-- maintained by lib/db.ts#insertEvent and lib/db.ts#eraseDomain.
CREATE TABLE IF NOT EXISTS domains (
  id          SERIAL PRIMARY KEY,
  domain      TEXT NOT NULL UNIQUE,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_count INTEGER NOT NULL DEFAULT 0,
  tier        TEXT NOT NULL DEFAULT 'free',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per DKIM-verified inbound email. `dkim_hash` is a SHA-256
-- of the signature — stored as forensic proof, never queried.
CREATE TABLE IF NOT EXISTS events (
  id               SERIAL PRIMARY KEY,
  domain_id        INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  receiver_domain  TEXT NOT NULL,
  dkim_hash        TEXT NOT NULL,
  witnessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot query paths:
--   seal page       → WHERE domain_id = ? ORDER BY witnessed_at DESC
--   receiver lookup → WHERE receiver_domain = ?
--   ops/daily       → WHERE witnessed_at >= NOW() - INTERVAL '...'
CREATE INDEX IF NOT EXISTS events_domain_id_witnessed_idx
  ON events(domain_id, witnessed_at DESC);
CREATE INDEX IF NOT EXISTS events_receiver_domain_idx
  ON events(receiver_domain);
CREATE INDEX IF NOT EXISTS events_witnessed_at_idx
  ON events(witnessed_at);

-- GDPR denylist (Art 17 erasure / Art 21 objection).
-- Any inbound email whose sender or primary receiver appears here is
-- silently dropped by /api/inbound. Controllers can re-enable a
-- domain by deleting its row. Managed via /api/rights/*.
CREATE TABLE IF NOT EXISTS domain_denylist (
  domain     TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,            -- 'erasure' | 'opt_out'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- Anti-abuse (Layer 0+). Never public.
--
-- Background: the witness cache is DKIM-authenticated, but DKIM only
-- proves "a mail server using $domain's key signed this." It does
-- not prove the receiver is real, nor that the traffic is genuine.
-- Without counter-measures, a spammer with a valid DKIM key can
-- manufacture a pristine-looking history by blasting seal@ with
-- DKIM-signed emails addressed to nonexistent receivers.
--
-- The tables below are the substrate for the full anti-abuse stack
-- (MX checks, rate limits, reputation scoring, trust index). They are
-- additive and never surfaced on public render paths.
-- ────────────────────────────────────────────────────────────────

-- Cached DNS / reputation lookups per domain. Populated lazily by the
-- inbound route and by Layer 1+ background refreshes. Used to avoid
-- hammering DNS / external services on high-frequency senders.
CREATE TABLE IF NOT EXISTS domain_reputation_cache (
  domain          TEXT PRIMARY KEY,
  mx_exists       BOOLEAN,
  mx_checked_at   TIMESTAMPTZ,
  dbl_listed      BOOLEAN,
  dbl_checked_at  TIMESTAMPTZ,
  first_cert_at   TIMESTAMPTZ,
  cert_checked_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events we refused to count toward a sender's public record. Retained
-- for forensics and ops review; never joined to public render paths.
-- Reasons (Layer 0): 'receiver_no_mx', 'rate_limit'.
-- Reasons (Layer 1+): 'receiver_blocklist', 'concentration'.
CREATE TABLE IF NOT EXISTS events_throttled (
  id               SERIAL PRIMARY KEY,
  sender_domain    TEXT NOT NULL,
  receiver_domain  TEXT NOT NULL,
  dkim_hash        TEXT NOT NULL,
  reason           TEXT NOT NULL,
  witnessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_throttled_sender_idx
  ON events_throttled(sender_domain, witnessed_at DESC);
CREATE INDEX IF NOT EXISTS events_throttled_witnessed_idx
  ON events_throttled(witnessed_at DESC);
