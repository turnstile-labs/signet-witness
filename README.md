# Signet Witness

**The business record AI can't fake.**

CC `sealed@witnessed.cc` on your business emails. Signet verifies the DKIM
signature, records who you emailed and when, and discards everything else.

Live at **[witnessed.cc](https://witnessed.cc)**

---

## What this is

A Next.js app that:

1. Receives emails via a Cloudflare Worker → `/api/inbound`
2. Verifies the DKIM signature with `mailauth`
3. Records the sender domain, receiver domain, and timestamp in Postgres
4. Serves a public seal page at `/b/[domain]`

No auth. No payments. No setup required from users. The CC is the product.

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
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout + theme flash prevention
│   ├── globals.css               # Tailwind v4 + light/dark CSS variables
│   ├── components/
│   │   ├── NavBar.tsx            # Shared header with inline domain search
│   │   ├── Footer.tsx            # Shared footer with CC copy + links
│   │   ├── CopyableEmail.tsx     # Click-to-copy CTA for sealed@witnessed.cc
│   │   ├── CopyText.tsx          # Generic copy-to-clipboard (URLs, snippets)
│   │   ├── HeroBackdrop.tsx      # Subtle ascending-timeline SVG behind hero
│   │   ├── Sparkline.tsx         # 30-day activity bar chart for seal pages
│   │   └── ThemeToggle.tsx       # Light/dark mode toggle
│   ├── b/[domain]/page.tsx       # Seal page — the product
│   ├── privacy/page.tsx          # Privacy policy
│   ├── terms/page.tsx            # Terms of service
│   └── api/inbound/route.ts      # Email receiver + DKIM verify + DB write
├── lib/
│   └── db.ts                     # Neon SQL client + typed queries
├── workers/
│   └── email-router/
│       ├── index.ts              # Cloudflare Worker (~30 lines)
│       ├── wrangler.toml
│       ├── package.json
│       └── tsconfig.json
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
```

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
| `NEXT_PUBLIC_APP_URL` | `https://witnessed.cc` (used for metadata) |

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

## Docs

- `docs/PRODUCT.md` — Product vision, how it works, business model, GTM, competitive position
- `docs/VISION.md` — Phased roadmap and long-term Web3 path
