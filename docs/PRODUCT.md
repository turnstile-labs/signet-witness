# Signet Witness — Product

**The business record AI can't fake.**

CC `seal@witnessed.cc` on your business emails. Signet verifies the DKIM
signature, records who you emailed and when, and discards everything else.
Your domain builds a verified communication history — passively, permanently,
and impossible to manufacture. When you need to prove you're real, the proof
is already there.

---

## The Problem

AI can generate a convincing business identity in minutes — a website, a
LinkedIn page, an email that looks exactly like it came from your CFO. The
tools are free and improving monthly.

The one thing AI cannot generate: years of real business communication with
real counterparties. History is the only remaining signal that separates a
real business from a fabrication.

No product today proves that a business has been operating for years. DMARC
proves a domain controls its email. LinkedIn proves an account exists. A
website proves a domain resolves. None of them answer the only question that
matters: **how long has this entity actually been doing business?**

---

## How It Works

**One action. No account. No setup.**

Add `seal@witnessed.cc` to the CC field on any business email you send.

Signet receives it, verifies the DKIM signature from your domain, records the
sender domain, receiver domain, and timestamp. The email body and subject line
are discarded immediately — never stored, never read.

Your domain gets a pulse of verified activity. You go back to work and forget
about it. Every email you CC makes the record stronger.

The receiver sees `seal@witnessed.cc` in the CC field. If they're curious,
they search it and discover Signet. That's how the network grows — through the
emails people are already sending.

---

## What You Get

### From the first CC — Your seal page

Every domain gets a public page at `witnessed.cc/b/yourdomain` after the
first witnessed email.

> `acme.com` · First witnessed: March 2026 · 14 communications · 3 months active

It's a live, shareable record. Put it in your email signature, your Linktree,
your invoice footer. Anyone can visit and see, in three seconds, whether this
business is real.

### Verified status — the trust index

Every sender domain has a public **trust index** on a 0–100 scale, computed
from five signals a legitimate business naturally accumulates: quality-adjusted
activity, tenure, mutual counterparties (domains that CC each other —
bidirectional edges are the strongest anti-fake signal), counterparty
diversity, and corroborating Certificate Transparency history.

A domain earns the **Verified** badge when the trust index crosses 65 *and*
it has at least 3 mutual counterparties. The badge renders at `/badge/[domain]`
in SVG or PNG as a single state-colored pill — green for verified, amber for
on-record, outline gray for pending:

> `[ ✓ acme.com ]`  ← solid green pill, white text

The badge answers the categorical question ("does this domain have a sealed
history?"). The precise 0–100 number and the supporting stats live on the
seal page at `witnessed.cc/b/<domain>`, where there's room to show the
verdict as a state block, the trust index as technical detail, and a
checklist of what's needed to get Verified if you're not there yet.

A scammer can copy the image. They can't copy the history. One click reveals
the real record — trust index, verified events, tenure, mutual counterparties.

You send a cold proposal to a procurement manager at a company you've never
worked with. They see the badge in your email footer, click it, and see years
of real business communication with real counterparties. You don't need a
reference call. The history speaks for itself.

### The anti-fraud gate

Mutuality is the cost-of-entry. An attacker with a DKIM key can pump activity,
but cannot cheaply manufacture bidirectional edges with other DKIM-signing
domains running real commerce. The trust index grows slowly on merit and
quickly on mutuality — so the shape of a faked history is visible in the
shape of the score, not just the raw count.

The inbound pipeline also drops receivers with no MX record and receivers
listed on Spamhaus DBL before they ever reach the counter, and rate-limits
senders past 500/hour or 5000/day into a forensic-only throttled queue. See
`CONTEXT.md → Anti-abuse invariants` for the full layered defense.

---

## What Signet Proves

Signet proves one thing: that this domain has been operational. That it has
been sending real, DKIM-signed email to established counterparties over a
meaningful period of time — not legal standing, not financial solvency, just
presence.

That single signal catches the vast majority of fraud that relies on
impersonation and fabricated identity. Because the one thing a fabricated
identity cannot have is a past.

---

## Privacy

**Stored:** sender domain, receiver domain, timestamp, DKIM signature hash.

**Discarded immediately:** email body, subject line, attachments, all personal
content. Never stored. Never logged. No human at Signet can read your emails.

**Consent model:** the CC is an explicit, voluntary act by the sender on each
individual email. Nothing is collected without the user choosing to include
Signet.

**Self-serve rights:** anyone who controls a domain — sender or receiver —
can exercise GDPR rights at `witnessed.cc/rights` without contacting us.
Ownership is proven via a DNS TXT record. The flow supports **access**
(download everything we hold, Art 15), **opt-out** (denylist future
ingestion, Art 21), and **erasure** (purge every record referencing the
domain, Art 17). Opt-out and erasure take effect immediately; our inbound
pipeline re-checks the denylist on every email.

---

## How the History Gets Stronger

Four signals feed the trust index automatically. No action from the user.

**Mutual counterparties.** A receiver that's *itself* a sender who CCs
`seal@` back is the strongest anti-fake edge: it requires the counterparty
to run its own DKIM-signing MTA and its own record. The trust index weights
mutuality at 25%.

**Diversity.** `1 − Gini(events per receiver)` — pumping one friendly
counterparty 500 times yields near-zero diversity and a weak index.

**Quality-adjusted activity.** Events toward free-mail accounts
(`gmail.com`, `outlook.com`, etc.) still land in the raw event count but
never in the quality-adjusted number that the index reads.

**Tenure.** `first_cert_at` via Certificate Transparency logs (`crt.sh`) —
a public, free lower bound on "this domain has been operating since …,"
more reliable than WHOIS (rate-limited, privacy-masked, TLD-inconsistent)
and backfilled in the background so the first-seen clock is corroborated
by real-world history from day one.

---

## Discovery and Growth

Two pull-based channels. No outbound spam.

**CC field.** Every CC'd email puts `seal@witnessed.cc` in front of the
receiver. Curiosity does the rest.

**Domain search.** Anyone can search any domain on Signet. If a domain appears
as a receiver in witnessed emails but hasn't started its own history:

> `bigcorp.com` · Appears in 23 witnessed communications · No history claimed

The domain owner who searches themselves asks "why haven't I claimed this?"
That's the pull.

---

## Business Model

Freemium for domain owners, paid API for platforms that consume the data.
Standard two-sided B2B SaaS — the boring shape on purpose, because the
product's differentiation is the accumulated history in the cache, not the
billing mechanic.

### The three tiers

| Tier | Who it serves | Price | What they get |
|---|---|---|---|
| **Free** | Any domain owner | $0, forever | Seal page, default badge, email CC ingestion, GDPR rights, domain lookup |
| **Pro** | Serious domain owners | **$9 – 19 / mo** | Custom badge styling (brand colors, alternate layouts), PDF tenure certificate, anomaly alerts, owner analytics, higher API rate limits |
| **API** | Platforms (KYB, marketplaces, procurement, ad networks) | **$99 – 999 / mo** usage-tiered | Bulk lookups, webhooks on state change, velocity/anomaly signals, historical deltas, SLA, dedicated support |

The seal page and CC ingestion are free forever. Charging owners to
participate would slow cache growth, which is the only thing that makes the
API valuable.

### Revenue — Pro subscription ($9–19 / mo)

A small subset of domain owners — founders with public signatures, agencies
with prospects to impress, freelancers working high-stakes contracts — want
premium presentation (brand-matched badge colors, alternate layouts, PDF
tenure certificates on demand) and owner-facing signals (anomaly alerts,
detailed analytics). Pro is the gentle upgrade path.

Realistic conversion: 2–5% of active free domains. At 1,000 domains, that's
$180–950 MRR. Not the business, but the first signal of willingness to pay.

### Revenue — Platform API ($99–999 / mo)

Platforms that need to verify counterparties at scale — marketplaces,
lenders, KYB onboarding tools, procurement platforms, ad-network trust
teams — subscribe to the API. Monthly subscriptions, not per-query
micro-pricing: per-query invites Sybil abuse, billing friction, and a cold
public funnel where checkers screenshot the free seal page to avoid the
meter.

```
GET /api/v1/trust/acme.com
→ {
    verified: true,
    since: "2022-03-14",
    days_active: 1098,
    counterparties: 214,
    velocity_anomaly_30d: false
  }
```

A new vendor applies to a B2B marketplace. Today the team manually reviews
documents, calls references, and guesses — a process that takes days and
still fails regularly. With Witnessed, one API call. If the domain has a
year of verified activity with 50+ distinct counterparties, auto-approve.
If no history, manual queue.

The API goes live once the cache has enough depth to be useful — likely
6–12 months after the first 1,000 active domains. One signed design partner
validates the entire model.

### Revenue — On-demand credentials ($29 one-off)

The seal page is a live public record — always free to view. But when
someone needs to present their history in a high-stakes context — a court
filing, a regulatory audit, a loan application, an enterprise procurement
RFP — they need a tamper-evident, exportable artifact that stands on its
own.

A signed PDF certificate captures the full verified record with a
timestamped cryptographic signature, suitable for legal filings and
compliance documentation. Priced at **$29 one-off**. No subscription — the
willingness to pay is self-selecting. Someone filing a legal dispute or
responding to procurement pays without thinking. Someone just building
their passive record never needs to.

Verifiable Credentials (W3C VC) and on-chain attestations are candidates
for later — once there's demand from a specific partner or buyer. Not
launching with them.

### Why free for senders

Every business that CCs `seal@witnessed.cc` is adding a verified data point
to the cache. The intake is the product. Charging for it would slow the
accumulation that makes the API valuable. Free intake, paid premium and
paid API — the model only works if the cache grows fast.

### Phased rollout

Monetisation follows distribution, not the other way around:

| Phase | Milestone | What's priced |
|---|---|---|
| Months 1–3 | Free tier only | Nothing. Goal: 1,000 active domains. |
| Months 3–6 | Ship Pro + PDF certificate | $9/mo Pro, $29 PDF. Goal: 50 paying = signal of PMF. |
| Months 6–12 | Ship Platform API | Launched only after two prospective buyers ask for it unprompted. |

Do not build the Enterprise API before someone asks for it. Do not ship
Pro before the free tier has real usage. Anything more exotic (revshare to
domain owners, tokenization, per-query royalties) stays in v2 territory.

---

## Go-to-Market

### Month 1 — Build, ship, and eat your own cooking

CC `seal@witnessed.cc` on every outgoing business email from day one.
Signet's own seal page at `witnessed.cc/b/witnessed.cc` becomes the first
proof that the product works. Publish 2–3 pieces of content on the AI
impersonation problem. No product pitch. Plant the thesis: "time is the only
thing AI can't fake."

### Months 2–4 — First 200 domains

Direct, personal outreach to 50 founders and small business operators — indie
SaaS founders, agency owners, consultants, freelancers with custom domains.
The ask is low: "CC one address on emails you're already sending. See what
happens." Goal: 200 domains actively CCing. First $9/month conversions from
the subset that wants the badge in their email signature.

### Months 4–8 — Organic pull

Seals circulate in email signatures. Recipients discover Signet by seeing the
CC. The domain search creates pull for receiver domains who see themselves
mentioned but unclaimed. First Verified badges (trust index ≥ 65 with ≥ 3
mutual counterparties) create visible
social proof. Target: 2,000 domains. Begin outreach to 3–5 B2B marketplaces
and procurement platforms for early API partnership conversations.

### Months 8–12 — First API partner

The cache has enough depth to demo real verification value. One signed API
partnership validates the entire model. This is the inflection point — the
moment Signet transitions from a SaaS tool to an infrastructure business.

---

## Competitive Position

The technology is simple. Any team could build the email ingestion and seal
pages in six weeks. The moat is the accumulated history in the cache — and
that takes exactly as long to build as it takes. A competitor launching two
years after Signet needs two years to have comparable depth.

**On Big Tech:** Google has DKIM data for most business email already. But
using it commercially means admitting they analyze email metadata at scale —
a PR and regulatory disaster. Signet's advantage is the consent model. The CC
is an explicit opt-in act. That's a structural difference, not a speed
difference.

---

## Risks

**Adoption.** The CC requires behavior change. If nobody starts, the cache is
empty.
*Mitigation:* The seal page and badge provide immediate, tangible value.
Organic CC field discovery creates passive acquisition at zero cost.

**Gaming.** Networks of controlled domains CCing each other to build fake
history.
*Mitigation:* Receiver domain age weighting makes young/suspicious domains
ineffective as counterparties. Pattern analysis flags circular communication.
Flagged domains are silently downgraded.

**Regulatory.** Processing email metadata at scale may draw scrutiny.
*Mitigation:* The CC is explicit per-email consent. Body is discarded. Only
domain-level metadata is retained — no personal data. Hash-only storage is
GDPR-compatible by design.

---

*CC one address. History builds while you work. The proof is there when you
need it.*

**AI can fake everything except yesterday.**
