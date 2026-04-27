-- 003 · drop personal-seal infrastructure
--
-- Closes the personal-seal experiment shipped under PRs #1–#7. After
-- four weeks of beta we cut the feature: free-mail addresses can't
-- carry a publicly-defensible "proof of business" because the inbox
-- isn't bound to a verifiable real-world entity, and the policing
-- around impersonation / abuse pulled focus from the domain-level
-- product that does work. We're back to one thing — domain seals —
-- and the SQL surface should reflect that.
--
-- This migration:
--
--   * DROPS the two personal-seal tables (`personal_seals`,
--     `pending_personal_seals`) plus their indexes and FKs.
--   * DROPS the `events.sender_email_hash` column we added to attribute
--     events to a specific person inside a free-mail provider. With
--     personal seals gone there's no consumer for the column, and
--     keeping it would make the inbound webhook look like it still
--     hashes sender addresses (it doesn't — see lib/trust.ts header).
--
-- Idempotent — every DROP is `IF EXISTS`. Safe to run against a fresh
-- DB that never had the personal-seal schema (no-ops cleanly), and
-- safe to re-run if a prior attempt was interrupted.
--
-- Run it once, against the live DB, before (or alongside) deploying
-- the code change that takes the personal-seal surfaces down:
--
--   psql "$DATABASE_URL" -f migrations/003-drop-personal-seals.sql
--
-- Wrapped in a single transaction so we never end up half-dropped.
-- The DROPs themselves take an ACCESS EXCLUSIVE lock for the duration
-- — measured in milliseconds for empty/tiny tables, microseconds for
-- the column drop (Postgres marks the column dead, no row rewrite).
--
-- Rollback: there isn't one. Re-running 002-personal-seals.sql (now
-- removed from the repo, but recoverable from git history at f63a70e)
-- would re-create empty tables, but every personal_seals row written
-- between launch and takedown is gone for good once this runs. That
-- is intentional — partial rollback would re-expose URLs that we've
-- told claimants are dead.

BEGIN;

DROP TABLE IF EXISTS pending_personal_seals;
DROP TABLE IF EXISTS personal_seals;

ALTER TABLE events DROP COLUMN IF EXISTS sender_email_hash;

COMMIT;
