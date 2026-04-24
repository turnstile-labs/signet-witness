# Chrome Web Store listing — source of truth

Copy-paste ready. Every field below maps 1:1 to a field in the
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
Keep this file in sync with whatever is live on the store so we always
have a version-controlled record of what reviewers see.

## Basic info

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| Extension ID | `iaicdleiecpkmdnbhpaknphegkchpgaj`                 |
| Name         | Witnessed for Gmail                                |
| Short name   | Witnessed                                          |
| Category     | Productivity                                       |
| Language     | English (United States) — primary; Spanish (Spain) |
| Homepage     | https://witnessed.cc                               |
| Support URL  | https://witnessed.cc/rights                        |

Name fits within the 45-character limit (19 chars).

**Extension ID** is assigned by Chrome on first draft creation and is
stable for the life of the listing. Store URL once published will be
`https://chromewebstore.google.com/detail/iaicdleiecpkmdnbhpaknphegkchpgaj`.
Do **not** paste this into `lib/extension.ts` until the listing is
approved and live — until then the URL 404s, which would break the
Install button on `/setup` (where the extension recipe renders).

## Short summary (≤132 chars)

> Witnessed inside Gmail: auto-BCC every outbound email and verify any sender's proof of business at a glance.

(109 chars.)

## Detailed description

```
Witnessed is a public, verifiable record of every business email your
domain sends. This extension brings the two things you need inside
Gmail — without OAuth, without leaving your browser.

━━━ What it does ━━━

• Auto-seal outgoing mail. Every new Gmail compose gets
  seal@witnessed.cc silently added to Bcc. Your outbound business
  email builds a public, cryptographically-verifiable history that
  can't be backdated. Remove the address on any individual message
  if you ever need to — the extension won't re-inject on a thread
  you've already touched.

• Verify any sender with one click. Open the toolbar popup on any
  Gmail tab. It shows a proof-of-business chip for every sender
  domain you can currently see — whether you're in a thread with
  multiple participants or scanning an inbox. Each row deep-links
  to the full public page at witnessed.cc/b/<domain>.

━━━ How it connects to Witnessed ━━━

Witnessed is provider-agnostic. This extension is the easiest way
in if you use personal Gmail on Chrome. Admins running Google
Workspace or Microsoft 365 can set up the same behavior at the
server level — see https://witnessed.cc/setup. People on Proton,
Fastmail, or Apple Mail can simply paste seal@witnessed.cc into
Bcc on any business email. All three paths grow the same public
record.

━━━ Privacy ━━━

The extension is fully local. No OAuth. No server-side mail
access. No analytics. No tracking. The only network request
the popup ever makes is a GET to witnessed.cc's public JSON
endpoint for a single domain lookup, and even that is cached
locally for up to 24 hours per domain.

Full privacy policy: https://witnessed.cc/privacy

━━━ Open source ━━━

Source, issue tracker, and roadmap live on GitHub. Audit what
runs in your browser before installing.
```

## Permission justifications

One sentence per permission. These get asked for individually on
submission.

- **`storage`** — Persist a single user setting (auto-seal on/off) and a
  short-lived cache of public domain-lookup results, so repeated
  popup opens on the same senders don't re-hit the public API.
- **`activeTab`** — When the user clicks the toolbar icon, we ask the
  active Gmail tab's content script to list every sender email address
  currently visible. The domain halves of those addresses are looked
  up against witnessed.cc's public endpoint. No message bodies are
  read.
- **`host_permissions: https://mail.google.com/*`** — Runs the auto-BCC
  content script that watches for new compose dialogs, expands the
  Bcc row, and inserts seal@witnessed.cc. Also serves the
  visible-sender probe described above.
- **`host_permissions: https://witnessed.cc/*`** — Fetches
  `/api/public/domain/<domain>` for each sender domain the popup
  displays. Public, CORS-enabled JSON endpoint; no credentials sent.
- **`externally_connectable: https://witnessed.cc/*`** — Lets
  witnessed.cc/setup ask the extension "are you installed?" via
  `chrome.runtime.sendMessage`, so the extension recipe on that page
  renders a correct "Installed ✓" badge instead of a dead Install
  button. Scoped narrowly to our own origin.

## Single-purpose statement

> Use Witnessed inside Gmail: auto-BCC the seal address on outbound
> composes and verify inbound senders' proof-of-business record.

(Both features serve the same umbrella purpose — they're two facets
of "use the Witnessed service inside Gmail," not two independent
features.)

## Data-handling disclosure

On the Privacy tab, declare:

- **Personally identifiable information**: None collected by the
  extension. (The service behind witnessed.cc stores sender and
  recipient **domain** names, not personal addresses — covered in
  the main privacy policy.)
- **Website content**: Yes. The content script reads sender email
  addresses from the active Gmail tab's DOM when the popup opens.
  The domain portion of each address is sent to witnessed.cc's
  public API for a lookup. The local part (the mailbox) is
  discarded before any network call.
- **User activity**: None.
- **Financial / health / auth / personal comms / location**: None.

Then check all three certification boxes:

- [x] Not sold to third parties.
- [x] Not used or transferred for purposes unrelated to the single
      purpose.
- [x] Not used or transferred to determine creditworthiness or for
      lending purposes.

## Listing assets

Live in [`./assets/`](./assets/), pre-sized to the exact pixel
dimensions the Developer Dashboard expects. Every file below uploads
as-is; no cropping or resizing needed on upload.

| Asset            | File                                               | Dimensions | Required      |
| ---------------- | -------------------------------------------------- | ---------- | ------------- |
| Store icon       | `../public/icons/icon-128.png`                     | 128×128    | Yes           |
| Small promo tile | `assets/small-promo-440x280.png`                   | 440×280    | Yes           |
| Marquee tile     | `assets/marquee-1400x560.png`                      | 1400×560   | Recommended   |
| Screenshot 1     | `assets/screenshot-1-popup-over-inbox-1280x800.png`| 1280×800   | ≥1 required   |
| Screenshot 2     | `assets/screenshot-2-toggle-closeup-1280x800.png`  | 1280×800   | —             |
| Screenshot 3     | `assets/screenshot-3-compose-bcc-1280x800.png`     | 1280×800   | —             |

Screenshot content, in order:

1. **Popup over Gmail inbox** — the toolbar popup open on a Gmail
   tab, showing three sender rows with the three main states
   (verified / on record / unclaimed) and the auto-seal toggle
   visible at the bottom.
2. **Auto-seal toggle close-up** — the popup scaled up so the
   `Auto-seal outgoing` card is the hero, with the
   `seal@witnessed.cc` code chip and the toggle in the on state
   clearly visible, plus two callouts explaining the per-message
   override.
3. **Gmail compose with BCC filled** — a compose dialog with
   `seal@witnessed.cc` already populated in the Bcc row, plus a
   small `added by Witnessed` helper badge so reviewers
   immediately see what the extension does.

**Important:** the screenshots shipped in `assets/` are high-fidelity
**placeholder mockups** generated to match the real popup UI exactly.
Chrome Web Store reviewers occasionally flag generated imagery; for
the cleanest possible review, replace them with real captures of the
extension running in Gmail before hitting "Publish". Dimensions and
composition are designed so a 1:1 drop-in of real screenshots at
1280×800 works without further layout changes.

## Submission checklist

- [ ] `package.json` version bumped (Chrome Web Store rejects
      re-uploads at the same version).
- [ ] `npm run build && npm run zip` produces a clean
      `witnessed-extension.zip`.
- [ ] Icons 16/48/128 present under `public/icons/`.
- [ ] No remote code fetched at runtime (fonts self-hosted, no
      eval / Function / innerHTML from remote sources).
- [ ] Privacy policy URL resolves (`https://witnessed.cc/privacy`).
- [ ] `EXTENSION_ID` in `lib/extension.ts` updated once Chrome
      assigns it (enables the "Installed ✓" swap on /setup's
      extension recipe).

## Review timeline

Typical: 1–3 business days for a first publish. Extensions that
touch `mail.google.com` often see an extended manual-review cycle
(5–10 business days). Plan accordingly.
