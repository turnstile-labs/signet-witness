# Signet

**AI can fake everything except yesterday.**

CC `witness@signet.id` on your business emails. Signet verifies the DKIM signature, records who you emailed and when, and discards everything else.

---

## What this is

A minimal Next.js app that:

1. Receives emails via a Cloudflare Worker → `/api/inbound`
2. Verifies the DKIM signature with `mailauth`
3. Records the sender domain, receiver domain, and timestamp in Postgres
4. Serves a public seal page at `/b/[domain]`

**No auth. No payments. No setup required from users. The CC is the product.**

---

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 14 (App Router) |
| Hosting | Vercel |
| Database | Vercel Postgres (Neon) |
| Email pipe | Cloudflare Worker |
| DKIM verification | `mailauth` |
| CSS | Tailwind |

---

## Project structure

```
signet-witness/
├── app/
│   ├── page.tsx                  # Homepage
│   ├── layout.tsx
│   ├── globals.css
│   ├── b/[domain]/page.tsx       # Seal page — the product
│   └── api/inbound/route.ts      # Email receiver + DKIM verify + DB write
├── lib/
│   └── db.ts                     # Neon SQL client + queries
├── workers/
│   └── email-router/
│       ├── index.ts              # Cloudflare Worker (~30 lines)
│       ├── wrangler.toml
│       ├── package.json
│       └── tsconfig.json
├── schema.sql                    # Run once to create tables
├── .env.example
└── docs/
    ├── SIGNET_MVP.md             # What we're building
    ├── SIGNET_WEB2.md            # MVP + full roadmap
    └── SIGNET_WITNESS.md         # Long-term vision (Web2 + Web3)
```

---

## Local setup

```bash
# 1. Clone and install
git clone https://github.com/you/signet-witness
cd signet-witness
npm install

# 2. Copy env
cp .env.example .env.local
# Fill in DATABASE_URL and INBOUND_SECRET

# 3. Create tables
# Paste schema.sql into your Vercel Postgres dashboard query runner
# or connect with psql:
# psql $DATABASE_URL -f schema.sql

# 4. Run locally
npm run dev
```

---

## Deploy

### Next.js app (Vercel)

```bash
# Push to GitHub, import in Vercel dashboard
# Add Postgres store: Vercel dashboard → Storage → Create → Postgres
# Set INBOUND_SECRET env var in Vercel project settings
```

### Cloudflare Worker

```bash
cd workers/email-router
npm install

# Set secrets
wrangler secret put INBOUND_URL     # https://signet.id/api/inbound
wrangler secret put INBOUND_SECRET  # must match Vercel env var

# Deploy
wrangler deploy
```

### Cloudflare Email Routing

In your Cloudflare dashboard for `signet.id`:
1. Enable **Email Routing**
2. Add a catch-all rule: `*@signet.id` → **Send to Worker** → `signet-email-router`

---

## Database schema

```sql
-- domains: one row per sender domain
CREATE TABLE domains (
  id          SERIAL PRIMARY KEY,
  domain      TEXT NOT NULL UNIQUE,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_count INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- events: one row per witnessed email
CREATE TABLE events (
  id               SERIAL PRIMARY KEY,
  domain_id        INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  receiver_domain  TEXT NOT NULL,
  dkim_hash        TEXT NOT NULL,
  witnessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## How DKIM verification works

Every email carries a `DKIM-Signature` header — a cryptographic signature from the sender's mail server using a private key. The corresponding public key is published in the sender's DNS. `mailauth` fetches that DNS record and verifies the signature automatically.

If verification fails, the event is silently discarded. Only DKIM-passing emails build history.

---

## Roadmap

See `docs/SIGNET_WEB2.md` for the full product roadmap (badge tiers, verification API, receipts, directory).

See `docs/SIGNET_WITNESS.md` for the long-term vision including the wallet-anchored path and unified attestation cache.

---

## Privacy

- **Stored:** sender domain, receiver domain, timestamp, DKIM signature hash
- **Discarded immediately:** email body, subject line, attachments, all personal content
- **Never stored, never read** by any human at Signet
- The CC is an explicit, voluntary act on each individual email
