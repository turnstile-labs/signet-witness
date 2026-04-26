-- 001 · domain_scores → domain_trust
--
-- The product surface and the lib/trust.ts module both speak in
-- "trust index" — the SQL table was the last holdover of the old
-- "score" vocabulary. This rename closes that gap.
--
-- Schema is unchanged: same columns, same FKs, same indexes — only
-- names move. Wrapped in a single transaction so we never end up
-- half-renamed; the rename itself is metadata-only in Postgres
-- (no row rewrite, no dependent statistics rebuild), so the lock
-- window on the table is microseconds.
--
-- Run it once, against the live DB, before deploying the matching
-- code change:
--
--   psql "$DATABASE_URL" -f migrations/001-domain-scores-to-domain-trust.sql
--
-- The matching `schema.sql` already reflects the new name — fresh
-- installs skip this migration entirely and create `domain_trust`
-- directly. This file exists only to bring an existing DB across.
--
-- Rollback: ALTER TABLE domain_trust RENAME TO domain_scores; ditto
-- for the indexes and the pkey constraint. No data is touched.

BEGIN;

ALTER TABLE domain_scores RENAME TO domain_trust;
ALTER INDEX domain_scores_trust_idx RENAME TO domain_trust_index_idx;
ALTER INDEX domain_scores_stale_idx RENAME TO domain_trust_stale_idx;
ALTER TABLE domain_trust RENAME CONSTRAINT domain_scores_pkey TO domain_trust_pkey;

COMMIT;
