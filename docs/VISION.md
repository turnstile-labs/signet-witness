# Signet Witness — Vision & Roadmap

This document describes where Signet is going: the phased product roadmap as
the email history cache grows, and the long-term vision of a unified trust
layer for both Web2 businesses and Web3 operators.

---

## Phase 1 — After 200 domains (Months 3–6)

### Timestamped email receipts

Every CC generates a unique receipt page at `witnessed.cc/r/[hash]` — a
permanent, verifiable record that this email was sent from this domain to this
recipient at this time, with a valid DKIM signature.

The receipt is what you attach to an invoice, append to a contract, or save
for a dispute. Every email you CC becomes a verifiable proof of sending.

The seal page remains free. Receipts as a standalone exportable artifact
(PDF, signed credential) are a candidate for a one-time fee — but the
underlying record is always publicly visible at no cost.

---

## Phase 2 — After 500 domains (Months 6–9)

### Badge tiers

Expand from one badge to three, earned through consistent activity:

| Badge | Requirement | What It Signals |
|---|---|---|
| **Verified** | 90 days + 10 emails | Real domain, active business |
| **Established** | 365 days | One year of verified communications |
| **Senior** | 3 years | Long-standing institutional presence |

Each tier is a visible upgrade on the seal page and the embedded badge. Tiers
create aspiration — "Established" is something you work toward — and a reason
to keep CCing long after the initial 90-day gate.

### Verified business directory

A public, searchable directory of all Witnessed-verified domains at
`witnessed.cc/directory` — sortable by seniority, activity, and counterparty
count.

Free to appear in. Featured placement is a candidate for paid positioning once
the directory has enough depth to be worth featuring in.

---

## Phase 3 — After 2,000 domains (Months 9–15)

### Priority verification ($99 one-time)

For domains that need a credential faster than 90 days — entering a
marketplace, responding to an enterprise procurement RFP, onboarding with a
financial institution — an accelerated path.

Signet cross-references the domain's WHOIS registration date, DNS history
(MX, SPF, DKIM record consistency), and TLS certificate transparency logs. If
external signals are strong enough (e.g. domain registered 5+ years ago with
stable DNS), a provisional Verified badge is issued immediately. The 90-day CC
requirement is supplemented, not bypassed — the badge upgrades to full Verified
after 90 days of CC activity.

### Tamper-proof history

Periodic cryptographic commitments of domain histories to an independent
audit log. This transforms the integrity guarantee from "trust Signet's
database" to "trust the math."

The seal page shows a subtle indicator: "History independently verifiable" —
no technical jargon, just the guarantee.

---

## Phase 4 — After the first API partner (Year 1–2)

### Verification API at scale

```
GET /verify/acme.com
→ { verified: true, since: "2022-03-14", days_active: 1098, counterparties: 214 }

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

| Tier | What it returns | Price |
|---|---|---|
| Basic | verified, since, days_active | $0.05/query |
| Standard | + tier, counterparties | $0.10/query |
| Full | + two-sided, dns, credential hash | $0.25/query |
| Enterprise | Bulk, webhook, SLA | Custom |

At 10 million queries/month from five integration partners, the API alone
generates $500K–2.5M/month depending on tier mix. That's the infrastructure
business.

### On-demand credentials

The seal page is a live public record — free, always. But there are moments
when a business needs a formal, exportable artifact that stands on its own:
a court filing, a regulatory audit, a loan application, an enterprise
procurement RFP.

At those moments, the user generates a credential on demand:

- **Signed PDF certificate** — the full verified record, cryptographically
  signed, suitable for legal submission and compliance documentation
- **Verifiable Credential (VC)** — W3C-standard, machine-readable, independently
  verifiable without querying Witnessed's servers
- **On-chain attestation (NFT)** — the record anchored on a public chain as a
  permanent, tamper-evident proof

One-time fee per artifact ($50–200 depending on type). No subscription.
The willingness to pay is self-selecting: someone filing a legal dispute or
responding to enterprise procurement will pay. Someone just building their
passive record never needs to.

The claim flow:
1. Visit the seal page → "Export record"
2. Verify domain ownership via DNS TXT record
3. Choose artifact type
4. Pay → credential generated, signed, delivered

The record is always free. The formal proof of it is what costs money —
at the exact moment it matters most.

---

## Phase 5 — Year 2+

### Advanced history signals (background, invisible to users)

**DNS consistency.** Does the domain have stable MX, SPF, and DKIM records
over time? Frequent changes are a flag; stability is a positive signal.

**Certificate transparency.** Has the domain been issuing TLS certificates
consistently? Public record, free to check, adds corroboration.

**Two-sided witnessed exchanges.** When a receiver replies and also CCs
`sealed@witnessed.cc`, the exchange is marked as two-sided — significantly
harder to fake and carrying the highest weight.

**Cross-registry corroboration.** If a domain appears in external registries
(GLEIF, government business registries, industry directories), the seal page
notes it. Not required — just additive when present.

---

## The Long Game — Web3 Path

The email history cache is the Web2 entry point. The long-term vision extends
the same model to crypto-native operators via a wallet anchor path.

### The problem Web3 solves

Crypto has the opposite problem from Web2. Anyone can deploy a token, launch
a protocol, or raise funds from a fresh wallet created five minutes ago. Rug
pulls, impersonation, and throwaway identities are the norm. On-chain history
exists — contract deployments, transaction patterns, governance participation
— but no product today packages that history into a credential that's
instantly readable by a counterparty.

### Wallet path

Connect your wallet on Signet. We read your public on-chain activity —
contract deployments, transaction history, governance votes, multisig
signatures, protocol interactions — and compute a verified operational profile.

No new data is created. Everything Signet reads is already public on the
blockchain. The value is in the packaging: a single, readable credential that
answers "how long has this wallet been doing real work?"

**Wallet seal** at `witnessed.cc/w/0xABC...` (or ENS name):

> `0xABC...1234` · First tx: January 2021 · 847 transactions · 312 unique
> counterparties · 5 contracts deployed

The wallet path has zero friction — the history already exists. The user just
claims it.

### Cross-anchor link

A business with both a domain and a wallet links them on their seal page. One
entity, two proofs, one combined credential.

> `acme.com` · Verified · 847 Days Active · Linked wallet: `0xABC...1234`
> (1,204 days on-chain)

The link is verified: domain ownership via DNS TXT record, wallet ownership
via signed message. Neither side can be faked. The combined credential is
stronger than either alone.

### Wallet signals

**Counterparty reputation.** Transactions with established, long-lived wallets
and verified contracts weigh more than interactions with fresh wallets.

**Contract deployments.** Deploying and maintaining smart contracts that
attract real usage is a strong signal of sustained operational presence.

**Governance participation.** Consistent voting in established DAOs
demonstrates ongoing engagement.

**Protocol diversity.** Activity across multiple established protocols is
harder to fake than activity within a single system.

### On-chain anchoring

Merkle roots of all histories (domain and wallet) committed to Base on a
weekly batch schedule. The seal page shows: "History anchored on-chain" with
a link to the Base transaction. Invisible to the user — transforms the
integrity guarantee from "trust Signet" to "trust math."

---

## The Moat

Every day the cache grows, the moat deepens. Not because the technology is
hard — it isn't. Because the accumulated time is impossible to buy,
manufacture, or shortcut.

A competitor launching in Year 3 faces three years of real domain histories,
established counterparty networks, cryptographic proofs of history integrity,
and platform integrations built on the API. The technology is replicable in
six weeks. The data takes exactly as long as it takes.

The cache is the moat. Everything else is a feature.

---

## Competitive Position (long-term)

**On crypto identity:** Projects like Gitcoin Passport, Worldcoin, and ENS
prove *who you are* or *that you're human*. Signet proves *how long you've
been operating*. Different question, complementary answer. A wallet with a
Gitcoin Passport and a Signet Verified badge is the strongest possible crypto
identity.

**The unique position:** no one else combines Web2 domain history with Web3
wallet history in a single verifiable cache. The cross-anchor link is the
credential no competitor can offer.

---

*CC one address. Connect one wallet. History builds while you work.*

**AI can fake everything except yesterday.**
