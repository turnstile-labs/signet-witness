# Signet Witness — Product

**The business record AI can't fake.**

CC `sealed@witnessed.cc` on your business emails. Signet verifies the DKIM
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

Add `sealed@witnessed.cc` to the CC field on any business email you send.

Signet receives it, verifies the DKIM signature from your domain, records the
sender domain, receiver domain, and timestamp. The email body and subject line
are discarded immediately — never stored, never read.

Your domain gets a pulse of verified activity. You go back to work and forget
about it. Every email you CC makes the record stronger.

The receiver sees `sealed@witnessed.cc` in the CC field. If they're curious,
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

### After 90 days — Verified status

Consistent CC activity for 90 days (with at least 10 witnessed emails) earns
a **Verified** badge — a live image you embed anywhere that updates
automatically as your history grows.

> ✦ `acme.com` · Verified · 847 Days Active

A scammer can copy the image. They can't copy the history. One click reveals
the real record.

You send a cold proposal to a procurement manager at a company you've never
worked with. They see the badge in your email footer, click it, and see years
of real business communication with real counterparties. You don't need a
reference call. The history speaks for itself.

### The anti-fraud gate

90 days of consistent activity before any badge is the cost of entry. A fraud
operation willing to maintain real email behavior for three months to earn a
basic seal faces real economic cost. Most won't bother. The ones that try are
detectable by the quality of their counterparties.

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

**Deletion:** any domain can request full deletion of their history at any time.

---

## How the History Gets Stronger

Two signals, checked automatically. No action from the user.

**Receiver domain age.** An email to a domain registered in 2010 weighs more
than one to a domain registered last month. Checked via public WHOIS data.
*(Planned — not yet in MVP.)*

**Receiver Signet status.** A CC on an email to another Signet-verified domain
carries a multiplier. Your history gets stronger when you communicate with
other verified businesses. *(Planned — not yet in MVP.)*

---

## Discovery and Growth

Two pull-based channels. No outbound spam.

**CC field.** Every CC'd email puts `sealed@witnessed.cc` in front of the
receiver. Curiosity does the rest.

**Domain search.** Anyone can search any domain on Signet. If a domain appears
as a receiver in witnessed emails but hasn't started its own history:

> `bigcorp.com` · Appears in 23 witnessed communications · No history claimed

The domain owner who searches themselves asks "why haven't I claimed this?"
That's the pull.

---

## Business Model

The seal page is always free — no tiers, no credit card, no paid upgrade for
end users. The business is the attestation cache it builds.

### Revenue — Verification API ($0.05–0.25 per query)

Platforms that need to verify counterparties at scale — marketplaces, lenders,
procurement tools, compliance teams — pay to query the cache. End users never pay.

```
GET /verify/acme.com
→ { verified: true, since: "2022-03-14", days_active: 1098, counterparties: 214 }
```

A new vendor applies to a B2B marketplace. Today the team manually reviews
documents, calls references, and guesses — a process that takes days and still
fails regularly. With Witnessed, one API call. If the domain has a year of
verified activity with 50+ distinct counterparties, auto-approve. If no
history, manual queue. The API doesn't replace judgment. It removes the 80%
that shouldn't need it.

The API requires cache depth to be useful. Early partnership conversations
start on day one; the API goes live when the data justifies it — likely 6–12
months after launch.

### Why free for senders

Every business that CCs `sealed@witnessed.cc` is adding a verified data point
to the cache. The intake is the product. Charging for it would slow the
accumulation that makes the API valuable. Free intake, paid queries — the
model only works if the cache grows fast.

---

## Go-to-Market

### Month 1 — Build, ship, and eat your own cooking

CC `sealed@witnessed.cc` on every outgoing business email from day one.
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
mentioned but unclaimed. First Verified badges at 90 days create visible
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
