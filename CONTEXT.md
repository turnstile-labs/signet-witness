# Signet Witness — Project Context

This document captures the full decision history, architecture rationale, and product vision for the `signet-witness` project. Read this before starting any new conversation in this workspace.

---

## What this project is

**Signet** is a business trust infrastructure product. The core mechanic: Bcc `seal@witnessed.cc` on any business email. Signet verifies the DKIM signature, records the sender domain, receiver domain, and timestamp, and discards everything else. Over time, a domain builds a verified communication history — passively, permanently, and impossible to manufacture.

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

## Anti-abuse invariants (read before touching `/api/inbound`, `lib/reputation.ts`, or `lib/scores.ts`)

DKIM proves "a mail server holding $domain's private key signed this message." It does not prove the receiver exists, that the receiver is a real counterparty, or that the sender is running real commerce. Without these checks, an attacker with a valid DKIM key can manufacture a pristine-looking record by blasting `seal@` with emails addressed to nonexistent, sinkholed, or simply low-value receivers.

The defense is layered:

**Layer 0 (shipped) — cheap structural gates at ingest.**

The inbound pipeline refuses to count any event that fails a structural check. Throttled events are written to `events_throttled` for forensics and **never** affect the sender's public `event_count` or `domain_scores`.

1. **MX existence.** The primary receiver domain must have at least one MX record. Cached 7d positive / 1d negative in `domain_reputation_cache`.
2. **Spamhaus DBL.** The receiver domain must not be on Spamhaus DBL. Cached 24h. Listed receivers go to `events_throttled` with reason `receiver_blocklist`. **Requires `SPAMHAUS_DQS_KEY`** — the public `dbl.spamhaus.org` zone refuses queries from serverless / open resolvers, so when the key is missing the DBL layer is skipped entirely and the remaining layers carry the anti-abuse load.
3. **Per-sender rate limit.** 500 events/hour or 5000 events/day trips the throttle. Both accepted and previously-throttled events count toward the window.

All three lookups fail-open on unclassified errors so transient DNS issues don't drop legitimate mail.

**Layer 1 (shipped) — quality-adjusted scoring.**

Raw `domains.event_count` is kept as the ingest counter, but the metric the product **exposes** is now the composite `trust_index` stored in `domain_scores`. The table is refreshed lazily: `insertEvent()` flips `stale = TRUE`, and `getDomainScore()` recomputes on read when stale or TTL-expired (24h). Five signals feed the index:

- `verified_event_count` — events toward non-free-mail receivers. Free-mail accounts (`gmail.com`, `outlook.com`, etc.) still produce `events` rows but never count toward this number. List lives in `lib/scores.ts#FREE_MAIL_DOMAINS`.
- `counterparty_count` — distinct receiver domains, all-time.
- `mutual_counterparties` — receivers that are **themselves** senders who sealed this domain back. The strongest anti-fake signal because it requires the counterparty to have its own DKIM-signing MTA and its own incentive to add `seal@` to their outbound. Computed via a self-join on `events ⋈ domains`.
- `diversity` — `1 − Gini(events per receiver)`. Prevents "pump one friendly receiver 500 times."
- `tenure_days` — `max(now − first_seen, now − first_cert_at)`. `first_cert_at` comes from Certificate Transparency logs via `crt.sh` and is cached forever once resolved. CT lookup is **cache-only** on the sync path (`cachedFirstCertAt`); network-backed `fetchFirstCertAt` is for deferred / admin backfill.

Weights are encoded in `lib/scores.ts#computeTrustIndex`: 35% activity (log-scaled), 25% mutuality, 20% tenure, 20% diversity. See the file for the math.

**Layer 2 (shipped) — trust index is the public metric + verified gating.**

- The `/b/[domain]` seal page displays the composite `trust_index` as the headline metric with a 0–100 bar tick-marked at the verified threshold. The three supporting stats are `verified_event_count`, `tenure`, and `mutual_counterparties`.
- Verified gating: `trust_index ≥ 65 AND mutual_counterparties ≥ 3` OR `domains.grandfathered_verified = TRUE`. The grandfather flag was set one-time for domains that met the pre-Layer-2 rule (90d + 10 events) so no user loses a badge when the metric changes. Operators can clear the flag per-domain for proven abusers.
- The badge (`/badge/[slug]`) uses the same gating via `trustTierFromScore()`. See the "Badge" section below for the full ETag key shape.
- The landing-page mock of `acmecorp.com`'s seal card is a 1:1 replica of the real `/b/<domain>` hero — same `StateBlock` (amber on-record tone), same stats grid, same `scoreBasis` and `trustLine` copy (reused verbatim from `seal.*`) — so the landing can't drift from the real page.
- Ops ranks top senders by `trust_index` and displays both `t<index>` and `m<mutuals>` inline next to raw event counts.

**Layer 3 (not built, not planned).** Real-time domain-reputation partners and human review are deliberately out of scope — Layers 0–2 cover the realistic attacker economics at current and near-term scale.

---

### Ops-only tables

`events_throttled`, `domain_reputation_cache`, and `domain_scores` are operational / forensic state. They are never joined to the public seal page, badge, or landing-page stats. `domain_scores` is the sole exception: its derived fields (trust_index, mutual_counterparties, diversity, verified_event_count) ARE surfaced — but only as aggregates, never as joins that expose receiver identities.

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

### Certificate Transparency, not WHOIS, for tenure

Domain age *is* a signal — but WHOIS is a poor way to get it: rate-limited, inconsistent across TLDs, often privacy-masked. The Layer-1 scoring path uses Certificate Transparency logs (free via crt.sh) instead. Earliest observed cert gives us a lower bound on "this domain has been public-facing since …" that is more reliable than WHOIS and stored forever once resolved. WHOIS is no longer on the roadmap.

### No search at MVP

Discovery happens through direct URL sharing (`witnessed.cc/b/acme.com`), the embeddable badge in email signatures, and the browser extension's inbox pill surfacing sender state inline. The URL is the search. Add search when users ask for it.

### Canonical trust-state system

Trust has three active tiers plus a null state. They're resolved from `(domain, score)` by `lib/scores.ts#trustTierFromScore()` and then rendered identically everywhere — seal page, landing mock, badge, ops — so state can't drift between surfaces. One definition, one palette, one icon per tier:

| Tier | Criteria | Color | Icon | Label |
|------|----------|-------|------|-------|
| **Verified** | `trust_index ≥ 65 AND mutuals ≥ 3`, OR grandfathered | green (`#16a34a` / `--verified`) | ✓ check | "Verified" |
| **Building** | has `verified_event_count > 0` but not verified | amber (`#d97706` / `--amber`) | ● filled dot | "Building" |
| **Pending** | exists but no verified events yet | outline gray | ○ hollow circle | "Warming up" |
| **Unclaimed** | no `domains` row at all | dim gray | ○ hollow circle | "No record yet" (different page) |

Unclaimed is rendered on its own page (the Unclaimed flow that turns receiver-only activity into a sign-up). The other three live on `/b/[domain]`.

On why only three active states and no "red": a newly-registered domain with zero history is not *dangerous*, it's *unknown*. Red would scare users away from every legitimate domain on its first day. Green / amber / gray honestly maps to "trust / building / too early." That's the correct shape of our data.

### Seal-page hero is a state block, not a score

The hero on `/b/[domain]` is `StateBlock` — a colored frame + icon + label + one-line subtitle. The subtitle carries the 0–100 trust index as technical detail under the verdict ("Trust index 41 / 100 · building toward 65"), so readers get the headline at a glance and the precise number within a glance. No bar, no tick, no big number competing with the label. The `PathToVerified` component below it is a two-item checklist ("Trust index of 65+ — you're at 26" / "3+ mutual counterparties — you have 0") so the two non-commensurable requirements stop looking like a single delta sum. Reading from the root: a citizen visitor wants a verdict first and a measurement second, so the component order is `[verdict] → [supporting stats] → [path, if below threshold]`.

### Dynamic badge (implemented)

`/badge/[slug]` serves both SVG and PNG (PNG via `next/og`/Satori). Layout is a single pill:

```
[ icon ]  [ domain ]
```

State *is* the badge's identity — a verified domain renders a **solid green pill** with a white check, on-record is **solid amber** with a white dot, pending is an **outlined gray pill** with a hollow circle. No progress ring, no 0–100 readout, no theme variance — the color does all the work, and badges in email signatures need to read on any client bg anyway. The precise 0–100 number lives on the seal page where there's room for the detail.

Canvas **width adapts to the domain length** (clamped 140–320px); height stays fixed at 32px (signature-compatible). Dimension math lives in `lib/badge-dimensions.ts` and is shared by the route, `BadgeEmbed`, and the landing-page demo so the rendered image and the `<img>` tag's advertised size stay in lockstep. State resolution lives in `lib/badge-state.ts#resolveSnapshot` so tests can import it without loading `next/og`. Cached at the edge with an `ETag` keyed on `(state, format, layout-version)` — the only thing that changes the pixels now is a real state transition, so cache hit rates are effectively perfect per domain until the state moves. The `?preview=verified|onRecord|pending` query short-circuits the DB lookup for marketing surfaces; it never mutates data.

### Internationalization (EN + ES)

Routing is handled by `next-intl` (`i18n/`, `proxy.ts`, `messages/`). `localePrefix: "as-needed"` — English stays at the root (`/b/witnessed.cc`), Spanish is prefixed (`/es/b/witnessed.cc`). All user-facing strings flow through `messages/{en,es}.json`.

---

## Current build state

**Build:** passing (`npm run build` exits 0)

**Routes:**
- `GET /` (and `/es`) — homepage explaining the Bcc mechanic
- `GET /b/[domain]` — seal page (claimed: shows history; unclaimed: shows receiver count + badge preview)
- `GET /privacy`, `GET /terms` — legal pages (fully translated)
- `GET /badge/[slug]` — dynamic SVG/PNG badge for email signatures (`?theme=light` for light mode)
- `POST /api/inbound` — receives raw email, verifies DKIM, writes to DB

**DB schema** (run `schema.sql` — it is idempotent, safe to re-run for migrations):
```sql
domains                   (id, domain, first_seen, event_count, tier, grandfathered_verified, updated_at)
events                    (id, domain_id, receiver_domain, dkim_hash, witnessed_at)
domain_denylist           (domain, reason, created_at)                                  -- GDPR
domain_reputation_cache   (domain, mx_*, dbl_*, first_cert_*, updated_at)               -- anti-abuse
events_throttled          (id, sender_domain, receiver_domain, dkim_hash, reason, ...)  -- anti-abuse
domain_scores             (domain_id, verified_event_count, mutual_counterparties, diversity, tenure_days, trust_index, stale, computed_at)
```

**Post-response work in `/api/inbound`.** After the event is accepted and persisted, one job runs inside Next's `after()` hook — it does not block the 200 going back to the Cloudflare Worker:
1. **CT-log warm-up.** `fetchFirstCertAt(senderDomain)` populates `domain_reputation_cache.first_cert_at`. Idempotent via its own 30-day-TTL cache. The next score recompute picks up real tenure instead of the system's `first_seen`.

Note: there is no outbound email layer. Witnessed never initiates contact with a recipient — the record is built passively from the stream of sealed emails (silent Bcc) we receive.

**Cloudflare Worker:** `workers/email-router/` — deploy with `wrangler deploy`

**Badge.** See `Dynamic badge (implemented)` above for the full rendering contract. Short surface: `GET /badge/[slug]` renders SVG or PNG (format from the slug suffix); `?theme=light` toggles palette; `?preview=verified|onRecord|pending` short-circuits the DB lookup for marketing surfaces; `?t=0..100` overrides the ring fraction in preview mode. Bump the trailing `v8` layout fingerprint in `cacheHeaders()` whenever the visual output changes so in-the-wild 304s don't serve stale pixels.

**Tests.** `npm test` runs the Vitest suite; `npm run test:coverage` emits a v8 report. Coverage is scoped to the anti-abuse surface (`lib/scores.ts`, `lib/reputation.ts`, `lib/badge-state.ts`, `lib/badge-dimensions.ts`, `app/api/inbound/route.ts`) with a 100% lines / 100% statements / 100% functions / 95% branches floor. Framework glue and presentational components are explicitly out of scope — chasing 100% on those pays for tests that catch no defects. The suite mocks `@neondatabase/serverless` via a programmable queue (`tests/helpers/sql.ts`), mocks `dns.promises.resolveMx/resolve4`, and spies on global `fetch` so every external side-effect is assertable. Cold-start / env-toggle paths (`SPAMHAUS_DQS_KEY`, `DATABASE_URL`) are covered via `vi.resetModules()` + dynamic import.

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
- Pro subscription ($9–19/mo) via Stripe: custom badge styling
  (brand-matched colors, alternate layouts), anomaly alerts, owner
  analytics, higher API rate limits. The `domains.tier` column is
  already in place — enabling Pro is one Stripe webhook + one column
  flip, not a migration.
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
