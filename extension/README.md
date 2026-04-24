# Witnessed — browser extension

Two things in one tiny extension for Gmail:

1. **Auto-seal outgoing** — every new compose gets `seal@witnessed.cc`
   prefilled in Bcc, so your outbound business email builds a public,
   verifiable record on [witnessed.cc](https://witnessed.cc).
2. **Sender verification from the toolbar** — open the popup on any
   Gmail tab and it shows a Witnessed "proof of business" chip for
   **every** sender domain you can currently see: each participant in
   the open chat, or each unique sender in your inbox list. Every row
   is its own link to the full seal page at `/b/<domain>`.

The extension is fully local: no OAuth, no server-side mail access, no
tracking. Read-side lookups are simple GETs to the public
`/api/public/domain/<domain>` endpoint on witnessed.cc — cached for up
to 24 hours per domain in `chrome.storage.local` so repeated lookups
don't hammer the API.

## Status

**v0.3.1** — Gmail only. Write-side (auto-BCC on compose) and read-side
(multi-domain popup list) both shipped. State palette unified with the
site: traffic-light semantics across seal page, badge, popup (verified
green / onRecord amber / pending yellow / unclaimed gray / error red),
brand accent is a neutral trust blue — no purple anywhere. Firefox
build and Outlook/Fastmail/Proton content scripts are v0.4 / v0.5.

## Why a popup, not an inbox injection?

Earlier drafts of v0.2 rendered a tiny colored pill next to every sender
row. It worked, but it required fighting Gmail's DOM churn: Gmail
rebuilds the sender cell on hover, selection, new-mail arrival, and
preview-pane toggling, which wiped our element every few seconds. The
popup surface, by contrast, is ours — it pops up identically over the
inbox or a conversation, reflects exactly the sender in focus, and never
competes with Gmail's rendering.

## What it does

**Write-side**:
- Watches `mail.google.com` for new compose dialogs.
- Auto-expands the Bcc row (click path first, Cmd/Ctrl+Shift+B fallback
  if keyboard shortcuts are enabled) and inserts `seal@witnessed.cc`.
- Marks each compose as handled so removing the chip on a specific email
  sticks — we never re-inject on a dialog we've already touched.

**Read-side (via popup)**:
- When the user clicks the toolbar icon, the popup asks the active
  Gmail tab's content script for the list of every sender domain the
  user can currently see — each participant in the open conversation,
  or each unique sender in the visible inbox rows (capped at 25 to
  keep the popup snappy).
- For each domain, the popup fetches
  `witnessed.cc/api/public/domain/<domain>` (cross-origin JSON, wide
  CORS, 5-minute edge cache) and paints a compact row: domain, context
  (in chat / inbox row), state chip, trust index. Each row is a deep
  link to the full seal page.
- Uses `chrome.storage.local` as a TTL cache (24h for verified/onRecord,
  1h for pending/unclaimed) so repeated popup opens on the same senders
  return instantly. In-flight requests for the same domain are dedup'd,
  so a busy inbox doesn't fan out.

Nothing leaves your machine beyond the per-domain GET. The extension
never reads message bodies, never sends anything Gmail-related
off-device, and requires only `storage`, `activeTab`, and
`host_permissions` for `mail.google.com` and `witnessed.cc`.

## Development

```bash
cd extension
npm install
npm run dev        # starts Vite in watch mode, writes to dist/
```

Then load `extension/dist` as an unpacked extension:

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select `extension/dist`

Edit files in `src/` and Vite will rebuild; click the reload arrow on the
extension card to pick up changes.

## Production build

```bash
cd extension
npm install
npm run build
npm run zip        # creates witnessed-extension.zip ready for upload
```

Submit `witnessed-extension.zip` to the
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Layout

```
extension/
├── manifest.config.ts       # MV3 manifest, generated into dist/manifest.json
├── vite.config.ts           # Vite + @crxjs/vite-plugin
├── src/
│   ├── background.ts        # service worker (seeds defaults on install)
│   ├── content/gmail.ts     # Gmail write-side injector + visible-domains probe
│   ├── popup/               # toolbar popup (sender list + auto-seal toggle)
│   └── lib/                 # API client, chrome.storage cache, types
└── public/icons/            # 16/48/128 px PNG icons
```

## Debugging

Content scripts log a single `[witnessed] v0.3.1 booted` line on load.
For the full firehose, open Gmail's DevTools console and run:

```js
localStorage.witnessedDebug = "1";
```

Reload the tab and every compose we touch will log to the console.
Popup logs go to the popup's own DevTools: right-click the extension
icon → **Inspect popup**.

## Roadmap

- **v0.4** — Firefox build (WebExtensions API is ~95% source-compatible;
  mainly a polyfill + manifest tweak).
- **v0.5** — Outlook.com / Fastmail / Proton content scripts.
- **v0.6** — compose-time nudge: when drafting to a high-trust
  counterparty whose own domain is only Pending, suggest they also
  seal replies.

Native add-ons (Google Workspace Marketplace, Microsoft AppSource)
remain out of scope for now; they require different packaging and OAuth
review cycles that aren't justified until the browser extension has
traction.
