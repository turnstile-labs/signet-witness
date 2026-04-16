# Signet

**AI can fake everything except yesterday.**

CC `witness@signet.id` on your business emails. Signet verifies the DKIM signature, records who you emailed and when, and discards everything else. Your domain builds a verified communication history — passively, permanently, and impossible to manufacture. When you need to prove you're real, the proof is already there.

---

## The Problem

AI can generate a convincing business identity in minutes — a website, a LinkedIn page, an email that looks exactly like it came from your CFO. The tools are free and improving monthly.

The one thing AI cannot generate: years of real business communication with real counterparties. History is the only remaining signal that separates a real business from a fabrication.

No product today proves that a business has been operating for years. DMARC proves a domain controls its email. LinkedIn proves an account exists. A website proves a domain resolves. None of them answer the only question that matters: **how long has this entity actually been doing business?**

---

## How It Works

**One action. No account. No setup.**

Add `witness@signet.id` to the CC field on any business email you send.

Signet receives it, verifies the DKIM signature from your domain, records the sender domain, receiver domain, and timestamp. The email body and subject line are discarded immediately — never stored, never read.

Your domain gets a pulse of verified activity. You go back to work and forget about it. Every email you CC makes the record stronger.

The receiver sees `witness@signet.id` in the CC field. If they're curious, they search it and discover Signet. That's how the network grows — through the emails people are already sending.

---

## What You Get

### From the first CC — Your seal page

Every domain gets a public page at `signet.id/b/yourdomain` after the first witnessed email.

> `acme.com` · First witnessed: March 2026 · 14 communications · 3 months active

It's a live, shareable record. Put it in your email signature, your Linktree, your invoice footer. Anyone can click it and see, in three seconds, whether this business is real.

### After 90 days — Your badge

Consistent CC activity for 90 days earns a **Verified** badge — a live image you embed anywhere. It updates automatically as your history grows.

> ✦ `acme.com` · Verified · 847 Days Active

A scammer can copy the image. They can't copy the history. One click reveals the real record.

You send a cold proposal to a procurement manager at a company you've never worked with. They see `✦ acme.com · Verified · 847 Days Active` in your email footer, click it, and see three years of real business communication with real counterparties. You don't need a reference call. The history speaks for itself.

### The anti-fraud gate

90 days of consistent activity before any badge is the cost of entry. A fraud operation willing to maintain real email behavior for three months to earn a basic seal faces real economic cost. Most won't bother. The ones that try are detectable by the quality of their counterparties.

---

## What Signet Proves

Signet proves one thing: that this domain has been operational. That it has been sending real, DKIM-signed email to established counterparties over a meaningful period of time — not legal standing, not financial solvency, just presence.

That single signal catches the vast majority of fraud that relies on impersonation and fabricated identity. Because the one thing a fabricated identity cannot have is a past.

---

## Privacy

**Stored:** sender domain, receiver domain, timestamp, DKIM signature hash.

**Discarded immediately:** email body, subject line, attachments, personal content. Never stored. Never logged. No human at Signet can read your emails.

**Consent model:** the CC is an explicit, voluntary act by the sender on each individual email. Nothing is collected without the user choosing to include Signet.

**Deletion:** any domain can request full deletion of their history at any time.

**Data residency:** all data stored in EU-based infrastructure, encrypted at rest and in transit.

---

## How the History Gets Stronger

Two signals, checked automatically. No action from the user.

**Receiver domain age.** An email to a domain registered in 2010 weighs more than one to a domain registered last month. Checked via public WHOIS data.

**Receiver Signet status.** A CC on an email to another Signet-verified domain carries a multiplier. Your history gets stronger when you communicate with other verified businesses.

This creates a natural incentive to bring counterparties onto Signet. Not altruism — self-interest. Their presence on the network directly improves your seal.

---

## Discovery and Growth

Two pull-based channels. No outbound spam.

**CC field.** Every CC'd email puts `witness@signet.id` in front of the receiver. Curiosity does the rest.

**Domain search.** Anyone can search any domain on Signet. If a domain appears as a receiver in witnessed emails but hasn't started its own history:

> `bigcorp.com` · Appears in 23 witnessed communications · No history claimed

The domain owner who searches themselves asks "why haven't I claimed this?" That's the pull.

---

## Business Model

The strategic business is the verification API. The seal page is how we build toward it.

### The target — Verification API ($0.05–0.10 per query)

Platforms that need to verify counterparties at scale — marketplaces, lenders, procurement tools — pay per query.

```
GET /verify/acme.com
→ { verified: true, since: "2022-03-14", days_active: 1098, counterparties: 214 }
```

A new vendor applies to a B2B marketplace. Today the team manually reviews documents, calls references, and guesses — a process that takes days and still fails regularly. With Signet, one API call. If the domain has a year of verified activity with 50+ distinct counterparties, auto-approve. If no history, manual queue. The API doesn't replace judgment. It removes the 80% that shouldn't need it.

The API requires cache depth to be useful. Early partnership conversations start on day one; the API goes live when the data justifies it — likely 6–12 months after launch.

### The engine — Seal page and badge ($9/month per domain)

The seal page is what fills the cache. Every domain that claims one is a domain actively CCing — generating the data the API will eventually sell.

Claim your seal page. Add your logo and business details. Get the embeddable badge for email signatures, invoices, proposals. The badge is a live image that updates automatically — every email you send carries your verified history. The product pays for itself the first time a prospect clicks the badge instead of ignoring your cold email.

Free tier: basic seal page with history visible. No customization, no badge embed.

---

## Architecture

The MVP is simple infrastructure.

An email ingestion service at `witness@signet.id`. DKIM verification on every incoming email. WHOIS lookups for receiver domain age. Domain-level records stored in a Postgres-compatible database — no email content ever reaches disk. A web app serving seal pages and badge images.

Deployable in weeks.

---

## Go-to-Market

### Month 1 — Build, ship, and eat your own cooking

Ship the email ingestion, the seal pages, and the badge. The founder CCs `witness@signet.id` on every outgoing business email from day one — investor updates, vendor negotiations, partnership threads. Signet's own seal page becomes the first proof that the product works. Publish 2–3 pieces of content on the AI impersonation problem. No product pitch. Plant the thesis: "time is the only thing AI can't fake."

### Months 2–4 — First 200 domains

Direct, personal outreach to 50 founders and small business operators — people who send real email daily and care about credibility. Indie SaaS founders, agency owners, consultants, freelancers with custom domains. The ask is low: "CC one address on emails you're already sending. See what happens." Goal: 200 domains actively CCing. First $9/month conversions from the subset that wants the badge in their email signature.

### Months 4–8 — Organic pull

Seals circulate in email signatures. Recipients discover Signet by seeing the CC. The domain search creates pull for receiver domains who see themselves mentioned but unclaimed. First Verified badges at 90 days create visible social proof. Target: 2,000 domains. Begin outreach to 3–5 B2B marketplaces and procurement platforms to start API partnership conversations before the API launches.

### Months 8–12 — First API partner

The cache has enough depth to demo real verification value. One signed API partnership validates the entire model. This is the inflection point — the moment Signet transitions from a SaaS tool to an infrastructure business.

---

## Competitive Position

The technology is simple. Any team could build the email ingestion and seal pages in six weeks. The moat is the accumulated history in the cache — and that takes exactly as long to build as it takes. A competitor launching two years after Signet needs two years to have comparable depth. Five years, five years.

**On Big Tech:** Google has DKIM data for most business email already. But using it commercially means admitting they analyze email metadata at scale — a PR and regulatory disaster. Signet's advantage is the consent model. The CC is an explicit opt-in act. That's a structural difference, not a speed difference.

---

## Risks

**Adoption.** The CC requires behavior change. If nobody starts, the cache is empty.
*Mitigation:* The seal page and badge provide immediate, tangible value. Organic CC field discovery creates passive acquisition at zero cost.

**Gaming.** Networks of controlled domains CCing each other to build fake history.
*Mitigation:* Receiver domain age weighting makes young/suspicious domains ineffective as counterparties. Pattern analysis flags circular communication. Flagged domains are silently downgraded.

**Regulatory.** Processing email metadata at scale may draw scrutiny.
*Mitigation:* The CC is explicit per-email consent. Body is discarded. Only domain-level metadata is retained — no personal data. Hash-only storage is GDPR-compatible by design.

---

# Roadmap — What the Cache Unlocks

Everything above is the MVP. Everything below is what becomes possible as the cache grows and adoption proves the model. Each item is triggered by a specific milestone, not a calendar date.

---

## Phase 1 — After 200 domains (Months 3–6)

### Timestamped email receipts

Every CC generates a unique receipt page at `signet.id/r/[hash]` — a permanent, verifiable record that this email was sent from this domain to this recipient at this time, with a valid DKIM signature.

The receipt is what you attach to an invoice, append to a contract, or save for a dispute. Every email you CC becomes a verifiable proof of sending.

**Monetization:** $1 per individual receipt or $29/month for unlimited receipts.

### Customization tiers

Split the $9/month plan into two tiers:

| | Free | Pro ($9/month) |
|---|---|---|
| Seal page | Basic — history visible | Custom — logo, description, links |
| Badge embed | No | Yes — live image for signatures |
| Receipt pages | No | Included (unlimited) |

The free tier keeps accumulation frictionless. The paid tier captures users who want to actively display their credential.

---

## Phase 2 — After 500 domains (Months 6–9)

### Badge tiers

Expand from one badge to three, earned through consistent activity:

| Badge | Requirement | What It Signals |
|---|---|---|
| **Verified** | 90 days | Real domain, active business |
| **Established** | 365 days | One year of verified communications |
| **Senior** | 3 years | Long-standing institutional presence |

Each tier is a visible upgrade on the seal page and the embedded badge. Tiers create aspiration — "Established" is something you work toward — and a reason to keep CCing long after the initial 90-day gate.

Tier thresholds are revisited once real data shows natural breakpoints in user behavior.

### Verified business directory

A public, searchable directory of all Signet-verified domains at `signet.id/directory` — sortable by seniority, activity, and counterparty count.

Free to appear in. Paid for featured placement and enhanced profile ($29/month featured listing).

The directory is useful to anyone evaluating a vendor, partner, or service provider. It gives the cache a public face and creates another discovery channel.

---

## Phase 3 — After 2,000 domains (Months 9–15)

### Priority verification ($99 one-time)

For domains that need a credential faster than 90 days — entering a marketplace, responding to an enterprise procurement RFP, onboarding with a financial institution — an accelerated path:

Signet cross-references the domain's WHOIS registration date, DNS history (MX, SPF, DKIM record consistency), and TLS certificate transparency logs. If external signals are strong enough (e.g., domain registered 5+ years ago with stable DNS), a provisional Verified badge is issued immediately. The 90-day CC requirement is supplemented, not bypassed — the badge is marked as "provisionally verified" and upgrades to full Verified after 90 days of CC activity.

This captures revenue from the highest-intent users — the ones who need the credential for a specific, time-sensitive purpose.

### Tamper-proof history

Periodic cryptographic commitments of domain histories to an independent audit log, periodically published and publicly verifiable. This transforms the integrity guarantee from "trust Signet's database" to "trust the math." The seal page shows a subtle indicator: "History independently verifiable." No technical jargon. Just the guarantee that the record is permanent and tamper-proof.

---

## Phase 4 — After first API partner signed

### Portable credential

When a domain needs a credential that's independently verifiable without querying Signet's servers — for legal disputes, regulatory compliance, enterprise procurement — the full verifiable record is issued as a standalone, cryptographically signed credential. Domain, first witnessed date, total communications, counterparty count, badge tier — all independently verifiable.

This is the credential you attach to a legal filing, a loan application, or a compliance audit. It survives even if Signet ceases to exist.

**Monetization:** $199 one-time or included in an enterprise tier.

### The claim flow

1. Visit `signet.id/b/yourdomain` and click "Claim credential"
2. Verify domain ownership via DNS TXT record
3. Choose output: shareable badge, PDF certificate, or portable credential
4. Pay — the credential is issued and permanently anchored

### Recoverability

Encrypted backups of the history index are stored independently of Signet's infrastructure (geographically distributed encrypted backups). Cryptographic commitments prove integrity. Together they make "even if Signet disappears, your history survives" a true statement rather than a marketing claim.

---

## Phase 5 — After API revenue exceeds subscription revenue

### Advanced history signals

Additional background signals, all invisible to the user, all checked automatically:

**DNS consistency.** Does the domain have stable MX, SPF, and DKIM records over time, or do they change frequently? Frequent changes are a flag; stability is a positive signal.

**Certificate transparency.** Has the domain been issuing TLS certificates consistently? Public record, free to check, adds corroboration.

**Two-sided witnessed exchanges.** When a receiver replies and also CCs `witness@signet.id`, the exchange is marked as two-sided. Two-sided interactions are significantly harder to fake and carry the highest weight. This becomes meaningful organically as Signet adoption grows — no feature to build, just a scoring upgrade.

**Cross-registry corroboration.** If a domain appears in external registries (GLEIF, government business registries, established industry directories), the seal page notes it. Not required — just additive when present.

None of these change the user experience. The CC stays the same. The weight varies invisibly as the intelligence layer deepens.

### API at scale

At sufficient cache depth, the verification API supports richer queries:

```
GET /verify/acme.com?detail=full
→ {
    verified: true,
    since: "2019-03-14",
    days_active: 2580,
    tier: "senior",
    counterparties: 847,
    two_sided_exchanges: 312,
    dns_stable: true,
    credential_hash: "sha256:abc...def"
  }
```

Pricing tiers by query depth:

| Tier | What it returns | Price |
|---|---|---|
| Basic | verified, since, days_active | $0.05/query |
| Standard | + tier, counterparties | $0.10/query |
| Full | + two-sided, dns, credential hash | $0.25/query |
| Enterprise | Bulk, webhook, SLA | Custom |

At 10 million queries per month from five integration partners, the API alone generates $500K–2.5M/month depending on tier mix. That's the infrastructure business.

---

## The Moat

Every day the cache grows, the moat deepens. Not because the technology is hard — it isn't. Because the accumulated time is impossible to buy, manufacture, or shortcut.

A competitor launching in Year 3 faces three years of real domain histories, established counterparty networks, cryptographic proofs of history integrity, and platform integrations built on the API. The technology is replicable in six weeks. The data takes exactly as long as it takes.

The cache is the moat. Everything else is a feature.

---

*CC one address. History builds while you work. The proof is there when you need it.*

**AI can fake everything except yesterday.**
