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

- **Seal pages** at `/b/[domain]` — verified/on-record/pending state, 30-day sparkline, stats, recent activity feed
- **Unclaimed seal pages** for domains that appear only as receivers — shows inbound witnessed count and an on-ramp to start their own record
- **Dynamic badge endpoint** at `/badge/[domain]` — SVG or PNG (`?theme=light` variant, `ETag`-cached, reflects live event count)
- **Owner tools** on each seal page — copy the badge as image URL, HTML snippet, or Markdown
- **Domain lookup** — anyone can search a domain from the landing page
- **GDPR rights center** at `/rights` — self-serve DNS-TXT-verified access (Art 15), opt-out (Art 21), and erasure (Art 17), powered by `/api/rights/*`
- **Inbound denylist gate** — any CC from or to an opted-out / erased domain is silently dropped
- **English + Spanish** — full i18n via `next-intl`. EN at the root, ES prefixed at `/es/*`
- **Light + dark theme** — CSS-variable driven, persisted to `localStorage`
- **Privacy + Terms + Your-rights** pages, fully translated
- **Cloudflare Worker email router** — 30-line catch-all forwarder

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
│   │   ├── page.tsx              # Landing page
│   │   ├── b/[domain]/
│   │   │   ├── page.tsx          # Seal page — the product
│   │   │   └── error.tsx         # Seal route error boundary
│   │   ├── privacy/page.tsx      # Privacy policy (GDPR-aligned)
│   │   ├── terms/page.tsx        # Terms of service
│   │   └── rights/page.tsx       # GDPR self-serve: access / opt-out / erasure
│   ├── api/
│   │   ├── inbound/route.ts      # Email receiver + DKIM verify + denylist gate + DB write
│   │   └── rights/
│   │       ├── challenge/route.ts # Mint DNS-TXT challenge for (domain, action)
│   │       ├── access/route.ts    # Art 15 — JSON export
│   │       ├── opt-out/route.ts   # Art 21 — denylist only
│   │       └── erasure/route.ts   # Art 17 — hard-delete + denylist
│   ├── badge/[slug]/route.tsx    # Dynamic SVG/PNG badge for email signatures
│   └── components/
│       ├── NavBar.tsx            # Header — logo + language + theme
│       ├── Footer.tsx            # Footer — © + privacy/terms/rights links
│       ├── CopyableEmail.tsx     # Click-to-copy CTA for seal@witnessed.cc
│       ├── DomainSearch.tsx      # Landing-page domain lookup form
│       ├── BadgeEmbed.tsx        # Owner-tools panel (image URL + HTML + Markdown snippets)
│       ├── RightsForm.tsx        # Client flow for DNS-TXT-verified rights requests
│       ├── HeroBackdrop.tsx      # Soft radial accent halo behind the hero headline
│       ├── Sparkline.tsx         # 30-day activity bar chart for seal pages
│       ├── LanguageSwitcher.tsx  # EN/ES selector
│       └── ThemeToggle.tsx       # Light/dark mode toggle
├── i18n/
│   ├── routing.ts                # Locales + localePrefix config
│   ├── navigation.ts             # Locale-aware Link/router helpers
│   └── request.ts                # Per-request locale + message loader
├── messages/
│   ├── en.json                   # English strings
│   └── es.json                   # Spanish strings
├── proxy.ts                      # next-intl middleware (locale detection)
├── lib/
│   ├── db.ts                     # Neon SQL client + typed queries + GDPR helpers
│   └── verify-domain.ts          # DNS-TXT owner-proof challenge/verify for /rights
├── workers/
│   └── email-router/             # Cloudflare Worker (~30 lines) — forwards raw email to /api/inbound
├── schema.sql                    # Run once to create tables
├── .env.example
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

---

## Deploy

### Next.js app (Vercel)

```bash
# Push to GitHub, import in Vercel dashboard
# Add Postgres store: Vercel dashboard → Storage → Connect → Postgres
# Add env var INBOUND_SECRET in project settings
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

```sql
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
```

The canonical schema lives in `schema.sql`; the snippet above is for reference.

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

| Variable | Description |
|---|---|
| `DATABASE_URL` or `STORAGE_URL` | Neon Postgres connection string |
| `INBOUND_SECRET` | Shared secret between Cloudflare Worker and `/api/inbound` |
| `RIGHTS_SECRET` | (optional) HMAC key for `/api/rights/*` TXT challenges. Defaults to `INBOUND_SECRET`. Rotating it invalidates any in-flight challenges. |

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
