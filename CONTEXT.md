# Signet Witness — Project Context

This document captures the full decision history, architecture rationale, and product vision for the `signet-witness` project. Read this before starting any new conversation in this workspace.

---

## What this project is

**Signet** is a business trust infrastructure product. The core mechanic: CC `seal@witnessed.cc` on any business email. Signet verifies the DKIM signature, records the sender domain, receiver domain, and timestamp, and discards everything else. Over time, a domain builds a verified communication history — passively, permanently, and impossible to manufacture.

The output: a public seal page at `witnessed.cc/b/yourdomain` that proves a domain has been doing real business with real counterparties over time. This is the one signal AI cannot fake: history.

---

## Product documents (in /docs)

| File | What it covers |
|---|---|
| `PRODUCT.md` | What this repo builds — Web2 only, freemium, how it works, business model, GTM |
| `VISION.md` | Phased roadmap and long-term Web3/wallet path |

**The relationship between the two:** MVP ships first and proves demand. Phase 1+ features in `VISION.md` activate as milestones are hit. The Web3/wallet path is a separate future product that will eventually connect to this one via a unified attestation cache.

---

## GDPR invariants (read before touching the seal page or `lib/db.ts`)

These are non-negotiable. Changing any of them requires a DPA review, not a code review.

1. **Receiver domain identities are never public.** The `/b/[domain]` render path consumes aggregates only. `lib/db.ts` exposes `getSealAggregates()` for that purpose — there is no public helper that returns a list of `receiver_domain` values. Do not add one back. Receiver-domain rows are only reachable via `exportDomainData()`, which is called by the authenticated Art 15 endpoint at `/api/rights/access` and requires DNS TXT ownership proof.
2. **The public activity feed stays gone.** No per-email rows with timestamps + receiver on the seal page, even if truncated or obfuscated. Triangulation risk is real for small-counterparty domains.
3. **Inbound re-checks the denylist on every email.** `isDenylisted()` is the gate. It is checked in `app/api/inbound/route.ts` before any write. A denylisted domain never enters the cache as sender *or* receiver.
4. **Erasure is a hard delete.** `eraseDomain()` purges rows across `domains` and `events` and decrements affected sender counts. No tombstones on the public surface.
5. **Data minimisation at ingest.** Only the DKIM-verified sender domain, receiver domain, signature hash, and timestamp are written. Headers, body, subject, attachments are discarded before the DB insert.
6. **The anti-abuse tables are ops-only.** `events_throttled` and `domain_reputation_cache` are forensic / operational state. They are never joined to the public seal page, badge, or landing-page stats. They surface only on `/ops/<token>`.

If you're about to surface receiver domains, historical receiver lists, or per-email timelines on a public page, stop and re-read this section.

---

## Anti-abuse invariants (read before touching `/api/inbound` or `lib/reputation.ts`)

DKIM proves "a mail server holding $domain's private key signed this message." It does not prove the receiver exists, nor that the sender is running real commerce. Without these checks, an attacker with a valid DKIM key can manufacture a pristine record by blasting `seal@` with emails addressed to nonexistent receivers.

The inbound pipeline refuses to count any event that fails a structural check. Throttled events are written to `events_throttled` for forensics and **never** affect the sender's public `event_count`.

**Layer 0 (shipped):**

1. **MX existence.** The primary receiver domain must have at least one MX record. Cached 7d positive / 1d negative in `domain_reputation_cache`. Lookup failures that can't be classified fail-open so transient DNS issues don't drop legitimate mail.
2. **Per-sender rate limit.** 500 events/hour or 5000 events/day trips the throttle. Both accepted and previously-throttled events count toward the window — an attacker can't burn through by blasting past their own limit. Enterprise senders brushing the ceiling should become paid-tier conversations, not silent drops.

Every throttle decision is recorded in `events_throttled (sender_domain, receiver_domain, dkim_hash, reason)` so ops can review patterns and so any false-positive is auditable. The ops dashboard shows 24h / 7d throttle counts and the top offenders when there's anything to see; it stays silent on clean days.

---

## Architecture decisions and why

### New repo, not built on signet-pass

The existing `signet-pass` repo (`/Users/buitre/code/2026/signet-pass`) is a ZK email gating product — it uses Circom circuits, Solidity smart contracts, wagmi, and ConnectKit. Every dependency and abstraction layer assumes wallet-connected users. Building Signet Witness on top of it would mean fighting the existing assumptions at every turn. The two products are siblings, not parent/child.

`signet-pass` stays alive as-is — it becomes the Web3 gating product that connects to this one in the long-term roadmap.

### Cloudflare Email Routing → Worker → /api/inbound

Cloudflare Email Routing receives all mail at `*@witnessed.cc`, routes to a Worker (`workers/email-router/`), which POSTs the raw RFC 2822 email to `/api/inbound`. The Worker is ~30 lines and has one job: forward the email.

Chosen over Postmark because: free, no third-party mail dependency, `witnessed.cc` is on Cloudflare.

### mailauth for DKIM verification

`mailauth` handles both MIME parsing and DKIM signature verification in one library call. It fetches the sender domain's DNS public key automatically and verifies the cryptographic signature. If verification fails, the event is silently discarded.

### Vercel Postgres (Neon under the hood)

Serverless Postgres that scales to zero. Created in one click from the Vercel dashboard with env vars auto-injected. No separate account needed.

Chosen over: Supabase (always-on, pauses after 7 days inactivity on free tier, bundle too large), Turso/D1 (SQLite, would need migration later), plain Prisma/Drizzle (unnecessary abstraction for two tables and five queries).

### No ORM — raw SQL via @neondatabase/serverless

Two tables, four query types. An ORM adds bundle size, code generation steps, and migration tooling for no benefit at this scale. Direct tagged template SQL is cleaner and more readable.

### No Stripe at MVP

Freemium with no payment infrastructure. Pro features (badge embed, custom seal page) are visually present but locked with "coming soon." The `domains` table has a `tier` column (default: `free`) ready for when Stripe is added — it's a one-column flip, not a migration.

### No WHOIS scoring at MVP

WHOIS is a signal that makes history *stronger* but isn't required for history to *exist*. Dropped for MVP because: rate limits, unreliable data across TLDs, adds async job complexity. Add in Phase 2 when there's real data to validate the scoring model against.

### No search at MVP

Discovery happens through the CC field (receivers see `seal@witnessed.cc`) and direct URL sharing (`witnessed.cc/b/acme.com`). The URL is the search. Add search when users ask for it.

### Dynamic badge (implemented)

`/badge/[slug]` now serves both SVG and PNG badges (PNG via `next/og`/Satori). Layout is `[ ✓ ]  [ domain ]  [ witnessed.cc ]` — a state-colored mark on the left (`verified` / `onRecord` / `pending`), the domain at 13px semibold as the focal point, and a muted `witnessed.cc` attribution on the right ("almost hidden" but legible on close inspection). Canvas **width adapts to the domain length** (clamped 180–360px) so the badge feels tailored rather than stretched; height stays fixed at 32px for signature compatibility. Dimension math lives in `lib/badge-dimensions.ts` and is shared by the route, `BadgeEmbed`, and the landing-page demo so the rendered image and the `<img>` tag's advertised size stay in lockstep. Dark and light themes via `?theme=light`. The live event count lives on the seal page — the badge stays intentionally quiet so it teases the click rather than summarizing the data in the signature. Cached at the edge with an `ETag` keyed on `(state, theme, format)` so caches only invalidate on threshold transitions, not on every +1 email.

### Internationalization (EN + ES)

Routing is handled by `next-intl` (`i18n/`, `proxy.ts`, `messages/`). `localePrefix: "as-needed"` — English stays at the root (`/b/witnessed.cc`), Spanish is prefixed (`/es/b/witnessed.cc`). All user-facing strings flow through `messages/{en,es}.json`.

---

## Current build state

**Build:** passing (`npm run build` exits 0)

**Routes:**
- `GET /` (and `/es`) — homepage explaining the CC mechanic
- `GET /b/[domain]` — seal page (claimed: shows history; unclaimed: shows receiver count + badge preview)
- `GET /privacy`, `GET /terms` — legal pages (fully translated)
- `GET /badge/[slug]` — dynamic SVG/PNG badge for email signatures (`?theme=light` for light mode)
- `POST /api/inbound` — receives raw email, verifies DKIM, writes to DB

**DB schema** (run `schema.sql` once in Vercel Postgres dashboard):
```sql
domains (id, domain, first_seen, event_count, tier, updated_at)
events  (id, domain_id, receiver_domain, dkim_hash, witnessed_at)
```

**Cloudflare Worker:** `workers/email-router/` — deploy with `wrangler deploy`

---

## Deploy checklist

1. Push repo to GitHub
2. Import in Vercel dashboard
3. Add Postgres store: Vercel → Storage → Create → Postgres (env vars auto-set)
4. Set `INBOUND_SECRET` env var in Vercel project settings (generate: `openssl rand -hex 32`)
5. Run `schema.sql` in Vercel Postgres query runner
6. `cd workers/email-router && npm install && wrangler deploy`
7. Set Worker secrets: `wrangler secret put INBOUND_URL` + `wrangler secret put INBOUND_SECRET`
8. In Cloudflare dashboard for `witnessed.cc`: Email Routing → catch-all → Send to Worker → `signet-email-router`

---

## What comes next

The operating plan is phased by distribution, not feature count. See
`docs/PRODUCT.md#business-model` for the full tier matrix.

**Months 1–3 — Free tier only.** Goal: 1,000 active domains. No pricing.

**Months 3–6 — Pro + signed PDF certificate.**
- Pro subscription ($9–19/mo) via Stripe: custom badge styling, no
  attribution, anomaly alerts, higher API rate limits. The `domains.tier`
  column is already in place — enabling Pro is one Stripe webhook + one
  column flip, not a migration.
- Signed PDF tenure certificate ($29 one-off).
- WHOIS receiver-age scoring as a quiet signal multiplier.

**Months 6–12 — Platform API.** Launched only after two prospective
buyers ask unprompted. Monthly subscription tiers ($99–999/mo), not
per-query micro-billing. See `docs/VISION.md` Phase 4 for the tier shape.

**Later candidates (unscheduled):** directory / discovery surface,
Verifiable Credentials, on-chain attestations, wallet path. Each ships
when a specific buyer or use case pulls for it.

---

## Related project

`/Users/buitre/code/2026/signet-pass` — the original ZK email gating product (Signet Pass). Separate product, separate repo. Will eventually connect to this one via the unified attestation cache described in `docs/VISION.md`.
