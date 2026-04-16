# Signet — Proof of Business

**AI can fake everything except yesterday.**

Two entry points, one trust cache:

- **Domain anchor.** CC `witness@signet.id` on your business emails. Signet verifies the DKIM signature, records who you emailed and when, and discards everything else. Your domain builds a verified communication history.
- **Wallet anchor.** Connect your wallet. Signet indexes your on-chain activity — deployments, transactions, governance votes, multisig participation — and builds a verified operational history from what's already public.

Both paths feed the same cache. Both produce the same output: a verifiable record that proves you've been here, doing real work, for real time. When you need to prove you're real, the proof is already there.

---

## The Problem

### Web2: fabricated businesses

AI can generate a convincing business identity in minutes — a website, a LinkedIn page, an email that looks exactly like it came from your CFO. The tools are free and improving monthly.

No product today proves that a business has been operating for years. DMARC proves a domain controls its email. LinkedIn proves an account exists. A website proves a domain resolves. None of them answer the only question that matters: **how long has this entity actually been doing business?**

### Web3: anonymous actors

Crypto has the opposite problem. Anyone can deploy a token, launch a protocol, or raise funds from a fresh wallet created five minutes ago. Rug pulls, impersonation, and throwaway identities are the norm. On-chain history exists — contract deployments, transaction patterns, governance participation — but no product today packages that history into a credential that's instantly readable by a counterparty.

**The shared root cause:** history is the only remaining signal that separates a real operator from a fabrication, and nobody is packaging it.

---

## How It Works

### Domain path — for businesses with email

**One action. No account. No setup.**

Add `witness@signet.id` to the CC field on any business email you send.

Signet receives it, verifies the DKIM signature from your domain, records the sender domain, receiver domain, and timestamp. The email body and subject line are discarded immediately — never stored, never read.

Your domain gets a pulse of verified activity. You go back to work and forget about it. Every email you CC makes the record stronger.

The receiver sees `witness@signet.id` in the CC field. If they're curious, they search it and discover Signet. That's how the network grows — through the emails people are already sending.

### Wallet path — for crypto-native operators

**Connect wallet. History appears.**

Connect your wallet on `signet.id`. Signet reads your public on-chain activity — contract deployments, transaction history, governance votes, multisig signatures, protocol interactions — and computes a verified operational profile.

No new data is created. Everything Signet reads is already public on the blockchain. The value is in the packaging: a single, readable credential that answers "how long has this wallet been doing real work?"

The wallet path has zero friction — the history already exists. The user just claims it.

---

## What You Get

### Seal pages

Every anchor gets a public page after its first verified activity.

**Domain seal** at `signet.id/b/acme.com`:

> `acme.com` · First witnessed: March 2026 · 14 communications · 3 months active

**Wallet seal** at `signet.id/w/0xABC...` (or `signet.id/w/vitalik.eth`):

> `0xABC...1234` · First tx: January 2021 · 847 transactions · 312 unique counterparties · 5 contracts deployed

Both are live, shareable records. Put them in your email signature, your Linktree, your DAO profile, your grant application.

### After 90 days — Your badge

Consistent activity for 90 days earns a **Verified** badge — a live image you embed anywhere. It updates automatically as your history grows.

**Domain badge:**
> ✦ `acme.com` · Verified · 847 Days Active

**Wallet badge:**
> ✦ `0xABC...1234` · Verified · 1,204 Days Active · 5 Deployments

A scammer can copy the image. They can't copy the history. One click reveals the real record.

### The anti-fraud gate

90 days of consistent activity before any badge is the cost of entry. For the domain path, that means sustained CC behavior. For the wallet path, 90 days of on-chain activity with meaningful counterparties (not self-transfers or dust transactions).

A fraud operation willing to maintain real behavior for three months faces real economic cost. Most won't bother. The ones that try are detectable by the quality of their counterparties.

### Link your anchors

A business with both a domain and a wallet can link them on their seal page. One entity, two proofs, one combined credential.

> `acme.com` · Verified · 847 Days Active · Linked wallet: `0xABC...1234` (1,204 days on-chain)

The link is verified: domain ownership via DNS TXT record, wallet ownership via signed message. Neither side can be faked. The combined credential is stronger than either alone.

---

## What Signet Proves

Signet proves sustained operational presence — that an identity (domain or wallet) has been conducting real, verifiable activity with established counterparties over a meaningful period of time.

For domains: DKIM-signed emails to real businesses over months or years.
For wallets: on-chain transactions, deployments, and governance participation over months or years.

It does not prove legal standing, financial solvency, or ethics. It proves persistence. That single signal catches the vast majority of fraud that relies on impersonation and fabricated identity, because the one thing a fabricated identity cannot have is a past.

---

## Privacy

### Domain path

**Stored:** sender domain, receiver domain, timestamp, DKIM signature hash.

**Discarded immediately:** email body, subject line, attachments, personal content. Never stored. Never logged. No human at Signet can read your emails.

**Consent model:** the CC is an explicit, voluntary act by the sender on each individual email.

### Wallet path

**Stored:** wallet address, indexed activity summary (transaction counts, counterparty addresses, deployment addresses, governance participation). All derived from public chain data.

**No new data collected.** Signet reads what's already on the public blockchain. The wallet path adds no privacy exposure beyond what already exists on-chain.

**Consent model:** the user explicitly connects their wallet and claims their profile.

### Both paths

**Deletion:** any domain or wallet can request full deletion of their off-chain profile at any time.

**Data residency:** all data stored in EU-based infrastructure, encrypted at rest and in transit.

---

## How the History Gets Stronger

Signals are checked automatically. No action from the user.

### Domain signals

**Receiver domain age.** An email to a domain registered in 2010 weighs more than one to a domain registered last month. Checked via public WHOIS data.

**Receiver Signet status.** A CC on an email to another Signet-verified domain carries a multiplier.

### Wallet signals

**Counterparty reputation.** Transactions with established, long-lived wallets and verified contracts weigh more than interactions with fresh wallets.

**Contract deployments.** Deploying and maintaining smart contracts that attract real usage is a strong signal of sustained operational presence.

**Governance participation.** Consistent voting in established DAOs demonstrates ongoing engagement, not a one-time interaction.

**Protocol diversity.** Activity across multiple established protocols (DEXs, lending, governance) is harder to fake than activity within a single system.

### Cross-anchor signal

When a domain and wallet are linked, both histories reinforce each other. A wallet backed by a 3-year domain history, or a domain backed by 2 years of on-chain activity, carries more weight than either alone. This is the unique signal only Signet can produce.

---

## Discovery and Growth

### Domain discovery

**CC field.** Every CC'd email puts `witness@signet.id` in front of the receiver. Curiosity does the rest.

**Domain search.** Anyone can search any domain. Unclaimed domains that appear as receivers in witnessed emails create pull:

> `bigcorp.com` · Appears in 23 witnessed communications · No history claimed

### Wallet discovery

**On-chain visibility.** Wallet seal pages are shareable links. Crypto founders put them in Twitter bios, Discord profiles, grant applications, and DAO proposals.

**Wallet search.** Anyone can look up any wallet or ENS name. If the wallet has significant on-chain history but hasn't claimed its Signet profile:

> `0xABC...1234` · 1,204 transactions since 2021 · 5 contract deployments · Profile unclaimed

The wallet owner who finds this asks "why haven't I claimed this?" Same pull mechanic as the domain path.

**Existing crypto communities.** Signet's existing gated-access product (Signet Pass) already serves crypto communities. Every user of that product is a candidate for the wallet path — they already have a wallet and understand the value of verified identity.

---

## Business Model

Three revenue streams for the MVP. Everything else is roadmap.

### Stream 1 — Seal page and badge ($9/month per anchor)

Claim your seal page. Add your logo and details. Get the embeddable badge. Works for both domains and wallets.

Free tier: basic seal page with history visible. No customization, no badge embed.

### Stream 2 — Verification API ($0.05–0.10 per query)

Platforms that need to verify counterparties at scale — marketplaces, lenders, procurement tools, DAO tooling, DeFi protocols — pay per query.

```
GET /verify/acme.com
→ { anchor: "domain", verified: true, since: "2022-03-14", days_active: 1098, counterparties: 214 }

GET /verify/0xABC...1234
→ { anchor: "wallet", verified: true, since: "2021-01-08", days_active: 1904, txs: 847, deployments: 5 }
```

**Domain story:** a new vendor applies to a B2B marketplace. One API call. Year of verified activity with 50+ counterparties? Auto-approve. No history? Manual queue.

**Wallet story:** a new protocol applies for a DeFi integration or grant. One API call. Two years of on-chain activity with real deployments? Fast-track. Fresh wallet? Extra review.

The API launches when the cache has enough depth — likely 6–12 months after launch.

### Stream 3 — Gated access (existing product)

Signet Pass — the existing crypto community gating product — generates revenue from communities that require verified credentials for access. The wallet path makes this stronger: instead of just proving you hold a token, you prove your wallet has real operational history.

---

## Architecture

The MVP is two parallel ingestion systems feeding one unified cache.

### Domain side

An email ingestion service at `witness@signet.id`. DKIM verification on every incoming email. WHOIS lookups for receiver domain age. A database storing domain-level metadata.

### Wallet side

An on-chain activity indexer reading public data from Base (and optionally Ethereum mainnet). Transaction history, contract deployments, governance events, and multisig participation are computed into an activity profile. No private keys, no signing, no wallet custody — read-only indexing of public chain data.

### Shared

A web app serving seal pages and badge images for both anchor types. A unified verification API. A linking system that connects domain and wallet anchors via DNS TXT + signed message verification.

Standard web infrastructure. No exotic dependencies. The wallet indexer leverages existing RPC and indexing services (Alchemy, The Graph, or similar).

---

## Go-to-Market

### Month 1 — Build and seed both paths

Ship the email ingestion, the wallet indexer, the seal pages, and the badge. Start using it yourself — CC `witness@signet.id` on every business email, and claim your own wallet's seal page. Content about the AI impersonation problem and the rug-pull epidemic. No product pitch yet.

### Months 2–4 — First users on both sides

**Domain:** Direct outreach to 50 founders and small business owners. "CC one address, see what happens." Goal: 200 domains actively CCing.

**Wallet:** Leverage Signet Pass's existing user base. Every wallet that's used the gating product gets an invite to claim their seal page — zero friction, their history is already there. Outreach to crypto founders with strong on-chain histories. Goal: 500 wallet profiles claimed.

The wallet path seeds faster because the history already exists on-chain. No behavior change required — just claim what's yours.

### Months 4–8 — Organic growth

Domain seals circulate in email signatures. Wallet seals circulate in Twitter bios and DAO profiles. Cross-anchor links create a new class of "fully verified" businesses. First Verified badges at 90 days. Target: 2,000 domains + 5,000 wallets.

### Months 8–12 — Platform conversations

The cache has depth on both sides. Demo to B2B marketplaces (domain API) and DeFi protocols / DAO tooling (wallet API). One signed partnership on either side validates the model.

---

## Competitive Position

The technology is simple. Any team could build the email ingestion or wallet indexer in six weeks. The moat is the accumulated history in the cache — and that takes exactly as long to build as it takes.

**On Big Tech:** Google has DKIM data for most business email already. But using it commercially means admitting they analyze email metadata at scale — a PR and regulatory disaster. Signet's advantage is the consent model.

**On crypto identity:** Projects like Gitcoin Passport, Worldcoin, and ENS prove *who you are* or *that you're human*. Signet proves *how long you've been operating*. Different question, complementary answer. A wallet with a Gitcoin Passport and a Signet Verified badge is the strongest possible crypto identity.

**The unique position:** no one else combines Web2 domain history with Web3 wallet history in a single verifiable cache. The cross-anchor link is the credential no competitor can offer.

---

## Risks

**Adoption (domain path).** The CC requires behavior change. If nobody starts, the cache is empty.
*Mitigation:* The seal page and badge provide immediate value. The wallet path seeds the cache faster with zero behavior change, creating social proof that pulls domain users in.

**Adoption (wallet path).** Crypto users may not see the value of packaging public data they already have.
*Mitigation:* The seal page makes scattered on-chain history readable in three seconds. Grant applications, DAO proposals, and DeFi integrations that require "prove your history" create immediate demand.

**Gaming.** Networks of controlled domains or wallets building fake history.
*Mitigation:* Domain side — receiver domain age weighting and circular communication detection. Wallet side — self-transfer and dust transaction filtering, counterparty quality scoring, and protocol diversity requirements. Flagged anchors are silently downgraded.

**Regulatory.** Processing email metadata at scale may draw scrutiny.
*Mitigation:* The CC is explicit per-email consent. Body is discarded. Only domain-level metadata is retained. Wallet data is already public. Hash-only storage is GDPR-compatible by design.

---

# Roadmap — What the Cache Unlocks

Everything above is the MVP. Everything below is what becomes possible as the cache grows and adoption proves the model. Each item is triggered by a specific milestone, not a calendar date.

---

## Phase 1 — After 200 domains + 500 wallets (Months 3–6)

### Timestamped email receipts

Every CC generates a unique receipt page at `signet.id/r/[hash]` — a permanent, verifiable record that this email was sent from this domain to this recipient at this time, with a valid DKIM signature.

**Monetization:** $1 per individual receipt or $29/month for unlimited receipts.

### Customization tiers

Split the $9/month plan into two tiers:

| | Free | Pro ($9/month) |
|---|---|---|
| Seal page | Basic — history visible | Custom — logo, description, links |
| Badge embed | No | Yes — live image for signatures |
| Receipt pages (domain) | No | Included (unlimited) |
| Cross-anchor link | No | Yes |

The free tier keeps accumulation frictionless. The paid tier captures users who want to actively display their credential.

---

## Phase 2 — After 500 domains + 2,000 wallets (Months 6–9)

### Badge tiers

Expand from one badge to three, earned through consistent activity:

| Badge | Requirement | What It Signals |
|---|---|---|
| **Verified** | 90 days | Real operator, active presence |
| **Established** | 365 days | One year of verified activity |
| **Senior** | 3 years | Long-standing operational presence |

Same tiers apply to both domain and wallet anchors. Tier thresholds are revisited once real data shows natural breakpoints in user behavior.

### Verified directory

A public, searchable directory of all Signet-verified anchors at `signet.id/directory` — filterable by type (domain/wallet), sortable by seniority, activity, and counterparty count.

Free to appear in. Paid for featured placement ($29/month).

---

## Phase 3 — After 2,000 domains + 5,000 wallets (Months 9–15)

### On-chain anchoring

Merkle roots of all histories (domain and wallet) are committed to Base on a weekly batch schedule. Invisible to the user but transforms the integrity guarantee from "trust Signet" to "trust math."

The seal page shows: "History anchored on-chain" with a link to the Base transaction.

### Priority verification ($99 one-time)

For domains: cross-references WHOIS, DNS history, and certificate transparency to issue a provisional badge before 90 days.

For wallets: cross-references on-chain history depth, counterparty quality, and protocol diversity to issue a provisional badge for wallets with strong existing history but less than 90 days since claiming.

---

## Phase 4 — After first API partner (Year 1–2)

### Full on-chain attestation

The complete verifiable record — domain or wallet — committed on-chain as a standalone attestation. Independently verifiable without querying Signet's servers.

**Monetization:** $199 one-time or included in an enterprise tier.

### The claim flow

1. Visit your seal page and click "Claim credential"
2. Verify ownership (DNS TXT for domains, signed message for wallets)
3. Choose output: shareable badge, PDF certificate, or on-chain attestation
4. Pay — the credential is issued and permanently anchored

### Recoverability

Encrypted backups stored independently of Signet's infrastructure. On-chain Merkle roots prove integrity. Together they guarantee the history survives even if Signet disappears.

---

## Phase 5 — Year 2+

### Advanced history signals

Additional background signals, all invisible to the user:

**Domain:** DNS consistency, certificate transparency, two-sided witnessed exchanges, cross-registry corroboration (GLEIF, government registries).

**Wallet:** MEV behavior analysis (negative signal), token holding patterns, NFT provenance chains, cross-chain activity consistency.

**Cross-anchor:** correlation between domain email activity and wallet transaction patterns strengthens both profiles.

### API at scale

The verification API supports richer queries across both anchor types:

```
GET /verify/acme.com?detail=full
→ {
    anchor: "domain",
    verified: true,
    since: "2019-03-14",
    days_active: 2580,
    tier: "senior",
    counterparties: 847,
    linked_wallet: "0xABC...1234",
    on_chain: "0xdef...789"
  }

GET /verify/0xABC...1234?detail=full
→ {
    anchor: "wallet",
    verified: true,
    since: "2021-01-08",
    days_active: 1904,
    tier: "established",
    txs: 847,
    deployments: 5,
    governance_votes: 142,
    linked_domain: "acme.com",
    on_chain: "0xdef...789"
  }
```

| Tier | What it returns | Price |
|---|---|---|
| Basic | verified, since, days_active | $0.05/query |
| Standard | + tier, counterparties/txs | $0.10/query |
| Full | + linked anchors, on-chain hash, signals | $0.25/query |
| Enterprise | Bulk, webhook, SLA | Custom |

---

## The Moat

Every day the cache grows, the moat deepens. Not because the technology is hard — it isn't. Because the accumulated time is impossible to buy, manufacture, or shortcut.

A competitor launching in Year 3 faces three years of real histories on both sides, established cross-anchor links, on-chain Merkle roots, and platform integrations built on the API. The technology is replicable in six weeks. The data takes exactly as long as it takes.

No one else has both Web2 domain history and Web3 wallet history in the same cache. The cross-anchor credential is the moat within the moat.

---

*CC one address. Connect one wallet. History builds while you work. The proof is there when you need it.*

**AI can fake everything except yesterday.**
