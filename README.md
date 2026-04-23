# Signet Witness

**The business record AI can't fake.**

CC `seal@witnessed.cc` on your business emails. Signet verifies the DKIM
signature, records who you emailed and when, and discards everything else.

Live at **[witnessed.cc](https://witnessed.cc)**

---

## What this is

A Next.js app that:

1. Receives emails via a Cloudflare Worker → `/api/inbound`
2. Verifies the DKIM signature with `mailauth`
3. Records the sender domain, receiver domain, and timestamp in Postgres
4. Serves a public seal page at `/b/[domain]` plus a dynamic SVG/PNG badge at `/badge/[domain]`

No auth. No payments. No setup required from users. The CC is the product.

---

## What's live

- **Seal pages** at `/b/[domain]` — trust-index hero (0–100, tick at the verified threshold), quality-adjusted event count, tenure, mutual counterparties, 30-day sparkline, embeddable badge, and `PathToVerified` callout when on-record but not yet verified
- **Unclaimed seal pages** for domains that appear only as receivers — inbound witnessed count + an on-ramp to start their own record
- **Dynamic badge** at `/badge/[domain]` — SVG or PNG (`?theme=light` variant, `ETag`-cached, `?preview=...&t=...` for marketing surfaces) with a state-colored mark, a 0–100% trust-index progress ring, the domain, and a muted `N/100` numeric readout
- **Trust index** (`lib/scores.ts`) — composite 0–100 score from quality-adjusted activity, mutuality, CT-log tenure, and counterparty diversity; lazy-refreshed into `domain_scores` on seal-page read
- **Anti-abuse gate** (`lib/reputation.ts`) — MX existence check, Spamhaus DBL lookup (gated on `SPAMHAUS_DQS_KEY`), per-sender rate limits. Throttled events land in `events_throttled` and never affect public metrics
- **Outbound viral loop** (`lib/viral.ts`) — after an inbound email is accepted, transactional "you were sealed" invites go out via Resend to unregistered / non-free-mail / non-denylisted recipients. Gated on `RESEND_API_KEY`
- **GDPR rights center** at `/rights` — self-serve DNS-TXT-verified access (Art 15), opt-out (Art 21), erasure (Art 17), powered by `/api/rights/*`
- **Inbound denylist gate** — any CC from or to an opted-out / erased domain is silently dropped
- **Setup wizard** at `/setup` — one-time mail-flow rules for Google Workspace, Microsoft 365, and Outlook so "always CC seal@" becomes automatic
- **Ops dashboard** at `/ops/<STATS_TOKEN>` — activity, top senders (ranked by trust), receivers, anti-abuse throttles, viral invite status, denylist
- **Admin CT warm-up** at `/api/admin/warm-ct` (auth: `STATS_TOKEN`) — batch backfill `first_cert_at` for stale rows in `domain_reputation_cache`
- **Domain lookup** on the landing page
- **English + Spanish** — full i18n via `next-intl`. EN at the root, ES prefixed at `/es/*`
- **Light + dark theme** — CSS-variable driven, persisted to `localStorage`
- **Privacy + Terms + Your-rights** pages, fully translated
- **Cloudflare Worker email router** — ~30-line catch-all forwarder
- **Test suite** — Vitest, 100% / 100% / 100% / 95%+ floor on the anti-abuse surface (`lib/scores.ts`, `lib/reputation.ts`, `lib/viral.ts`, `lib/badge-state.ts`, `lib/badge-dimensions.ts`, `app/api/inbound/route.ts`)

---

## Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router) |
| Hosting | Vercel |
| Database | Vercel Postgres (Neon) |
| Email pipe | Cloudflare Worker |
| DKIM verification | `mailauth` |
| CSS | Tailwind CSS v4 |

---

## Project structure

```
signet-witness/
├── app/
│   ├── layout.tsx                # Root shell (inherited by every locale)
│   ├── globals.css               # Tailwind v4 + light/dark CSS variables
│   ├── [locale]/
│   │   ├── layout.tsx            # Locale shell + theme flash prevention + NextIntlClientProvider
│   │   ├── page.tsx              # Landing page (mock seal card 1:1 with /b/<domain>)
│   │   ├── b/[domain]/
│   │   │   ├── page.tsx          # Seal page — the product
│   │   │   └── error.tsx         # Seal route error boundary
│   │   ├── setup/page.tsx        # One-time mail-flow-rule setup (Workspace / M365 / Outlook)
│   │   ├── privacy/page.tsx      # Privacy policy (GDPR-aligned)
│   │   ├── terms/page.tsx        # Terms of service
│   │   └── rights/page.tsx       # GDPR self-serve: access / opt-out / erasure
│   ├── api/
│   │   ├── inbound/route.ts      # Email receiver + DKIM verify + anti-abuse gates + DB write + after-hooks
│   │   ├── admin/warm-ct/route.ts # Admin batch CT-log backfill (auth: STATS_TOKEN)
│   │   └── rights/
│   │       ├── challenge/route.ts # Mint DNS-TXT challenge for (domain, action)
│   │       ├── access/route.ts    # Art 15 — JSON export
│   │       ├── opt-out/route.ts   # Art 21 — denylist only
│   │       └── erasure/route.ts   # Art 17 — hard-delete + denylist
│   ├── badge/[slug]/route.tsx    # Dynamic SVG/PNG badge with trust-index ring + N/100 readout
│   ├── ops/[token]/page.tsx      # Internal dashboard — activity, top senders, anti-abuse, viral
│   └── components/               # NavBar, Footer, CopyableEmail, BadgeEmbed, Sparkline, RightsForm, …
├── i18n/
│   ├── routing.ts                # Locales + localePrefix config
│   ├── navigation.ts             # Locale-aware Link/router helpers
│   └── request.ts                # Per-request locale + message loader
├── messages/
│   ├── en.json                   # English strings
│   └── es.json                   # Spanish strings
├── proxy.ts                      # next-intl middleware (locale detection)
├── lib/
│   ├── db.ts                     # Neon SQL client + typed queries + GDPR helpers + ops aggregates
│   ├── scores.ts                 # Trust-index math + free-mail list + verified gating
│   ├── reputation.ts             # MX / DBL / rate-limit gates + CT-log lookup cache
│   ├── viral.ts                  # Outbound invite loop (Resend)
│   ├── badge-state.ts            # Pure helpers for badge state + ring + cache bucket
│   ├── badge-dimensions.ts       # Shared layout math for SVG/PNG + BadgeEmbed
│   └── verify-domain.ts          # DNS-TXT owner-proof challenge/verify for /rights
├── tests/                        # Vitest suite + helpers + programmable neon stub
├── workers/
│   └── email-router/             # Cloudflare Worker (~30 lines) — forwards raw email to /api/inbound
├── schema.sql                    # Run once to create tables (idempotent — safe to re-run)
├── vitest.config.ts
├── .env.example
├── CONTEXT.md                    # Architecture + invariants + current build state
└── docs/
    ├── PRODUCT.md                # What it is, why it matters, business model
    └── VISION.md                 # Roadmap + long-term Web3 path
```

---

## Local setup

```bash
# 1. Clone and install
git clone https://github.com/turnstile-labs/signet-witness
cd signet-witness
npm install

# 2. Copy env
cp .env.example .env.local
# Fill in DATABASE_URL (or STORAGE_URL) and INBOUND_SECRET

# 3. Create tables
psql $DATABASE_URL -f schema.sql
# or paste schema.sql into the Vercel Postgres dashboard query runner

# 4. Run locally
npm run dev
```

Available scripts:

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` — pure type check, no emit |
| `npm test` | Vitest — runs the full suite once |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest + v8 coverage report |

---

## Deploy

### Next.js app (Vercel)

```bash
# Push to GitHub, import in Vercel dashboard
# Add Postgres store: Vercel dashboard → Storage → Connect → Postgres
# Add env vars in project settings: INBOUND_SECRET (required), plus
#   any of STATS_TOKEN / SPAMHAUS_DQS_KEY / RESEND_API_KEY you want
#   to enable
# Run schema.sql via the Vercel Postgres query runner (idempotent —
#   safe to re-run after pulling new migrations)
```

### Cloudflare Worker

```bash
cd workers/email-router
npm install

# Set secrets
wrangler secret put INBOUND_URL     # https://witnessed.cc/api/inbound
wrangler secret put INBOUND_SECRET  # must match Vercel env var

# Deploy
wrangler deploy
```

### Cloudflare Email Routing

In your Cloudflare dashboard for `witnessed.cc`:

1. Enable **Email Routing**
2. Add a catch-all rule: `*@witnessed.cc` → **Send to Worker** → `signet-email-router`

---

## Database schema

The canonical schema lives in `schema.sql` and is idempotent — run it once
on a fresh database, and safely re-run it after pulling new changes to
pick up migrations. Current tables:

| Table | Purpose |
|---|---|
| `domains` | Sender registry (`id`, `domain`, `first_seen`, `event_count`, `tier`, `grandfathered_verified`) |
| `events` | DKIM-verified witnessed emails (`domain_id`, `receiver_domain`, `dkim_hash`, `witnessed_at`) |
| `domain_denylist` | GDPR opt-outs and erasures — consulted on every inbound email |
| `domain_reputation_cache` | Anti-abuse: MX status, DBL status, CT-log `first_cert_at`, per-signal TTLs |
| `events_throttled` | Forensic-only log of dropped inbound events (never read by the seal page) |
| `domain_scores` | Lazy-refreshed trust-index row per domain (the number users see) |
| `viral_invites` | Idempotency + status log for the outbound "you were sealed" loop |

---

## How DKIM verification works

Every email carries a `DKIM-Signature` header — a cryptographic signature
from the sender's mail server. The corresponding public key is published in
the sender's DNS. `mailauth` fetches that DNS record and verifies the
signature automatically.

If verification fails, the event is silently discarded. Only DKIM-passing
emails build history. History built this way cannot be backdated or forged.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` (or `STORAGE_URL`) | yes | Neon Postgres connection string |
| `INBOUND_SECRET` | yes | Shared secret between the Cloudflare Worker and `/api/inbound` |
| `STATS_TOKEN` | optional | Enables the internal `/ops/<token>` dashboard and the admin CT warm-up endpoint. Must be ≥ 16 chars. Rotate to revoke |
| `SPAMHAUS_DQS_KEY` | optional | Spamhaus Data Query Service key. When unset, the DBL layer is skipped (the public zone refuses queries from serverless resolvers) |
| `RESEND_API_KEY` | optional | Resend API key for the outbound viral-invite loop. When unset, the viral layer is skipped |
| `RIGHTS_SECRET` | optional | HMAC key for `/api/rights/*` TXT challenges. Defaults to `INBOUND_SECRET`. Rotating it invalidates any in-flight challenges |

See `.env.example` for a copy-pasteable template.

---

## Privacy

| What | Status |
|---|---|
| Sender domain | Stored |
| Receiver domain | Stored |
| Timestamp | Stored |
| DKIM signature hash | Stored |
| Email body | Discarded immediately — never touches disk |
| Subject line | Discarded immediately |
| Attachments | Discarded immediately |
| Personal content | Never stored, never read |

The CC is an explicit, voluntary act on each individual email.

---

## GDPR rights (self-serve)

Anyone who controls a domain — as sender or as recipient — can exercise
their GDPR rights at **[/rights](https://witnessed.cc/rights)** without
contacting us. Ownership is proven with a single DNS TXT record; the
same trust primitive the rest of the service is built on.

| Right | Endpoint | Effect |
|---|---|---|
| **Access** (Art 15) | `POST /api/rights/access` | Returns a full JSON dump of everything we hold about the domain |
| **Opt out** (Art 21) | `POST /api/rights/opt-out` | Adds the domain to the denylist; future inbound CCs involving it are dropped |
| **Erasure** (Art 17) | `POST /api/rights/erasure` | Hard-deletes the domain + every event where it appears as sender or receiver, then denylists it |

All three require a DNS TXT record at `_witnessed.<domain>` containing
a per-action, per-day HMAC challenge minted by `POST /api/rights/challenge`.
The `/rights` page handles the whole flow end-to-end.

---

## Docs

- `docs/PRODUCT.md` — Product vision, how it works, business model, GTM, competitive position
- `docs/VISION.md` — Phased roadmap and long-term Web3 path
