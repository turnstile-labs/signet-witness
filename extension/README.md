# Witnessed — browser extension

Two things in one tiny extension for Gmail:

1. **Auto-seal outgoing** — every new compose gets `seal@witnessed.cc`
   prefilled in Bcc, so your outbound business email builds a public,
   verifiable record on [witnessed.cc](https://witnessed.cc).
2. **Sender status pill** — every inbox row gets a tiny colored dot
   showing whether the sender domain is **Verified** / **On record** /
   **Pending** / **Unclaimed** on Witnessed. Click the dot to open the
   sender's seal page.

The extension is fully local: no OAuth, no server-side mail access, no
tracking. Read-side lookups are simple GETs to the public
`/api/public/domain/<domain>` endpoint on witnessed.cc — cached for up
to 24 hours per domain in `chrome.storage.local` so a scrolled inbox
doesn't hammer the API.

## Status

**v0.2** — Gmail only. Both write-side (BCC injection) and read-side
(status pill) shipped. Firefox build and Outlook/Fastmail/Proton content
scripts are v0.4 / v0.5.

## What it does

**Write-side** (v0.1):
- Watches `mail.google.com` for new compose dialogs.
- Auto-expands the Bcc row and inserts `seal@witnessed.cc`.
- Marks each compose as handled so removing the chip on a specific email
  sticks — we never re-inject on a dialog we've already touched.

**Read-side** (v0.2):
- Observes the inbox list and extracts the sender domain from every row.
- Fetches state from `witnessed.cc/api/public/domain/<domain>`
  (cross-origin JSON, wide-open CORS, 5-minute edge cache).
- Renders a 8 × 8 px colored dot before the sender name: green for
  verified, amber for on-record, purple for pending, muted gray for
  unclaimed. Hover for `domain · score/100`. Click to open the seal page.
- Uses `chrome.storage.local` as a TTL cache (24h for verified/onRecord,
  1h for pending/unclaimed) and an in-memory in-flight map so the same
  domain is never fetched twice concurrently.
- The popup's **Refresh lookups** button wipes every cached entry in
  one click.

Nothing leaves your machine beyond the per-domain GET. The extension
never reads message bodies, never sends anything Gmail-related off-device,
and requires only `storage` + `host_permissions` for `mail.google.com`
and `witnessed.cc`.

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
│   ├── content/gmail.ts     # Gmail DOM watcher + BCC injector
│   ├── popup/               # toolbar popup (toggle + links)
│   └── lib/                 # shared constants + chrome.storage wrapper
└── public/icons/            # 16/48/128 px PNG icons
```

## Debugging

Content scripts log silently by default. In Gmail's DevTools console:

```js
localStorage.witnessedDebug = "1";
```

Reload the tab and every compose we touch will log to the console.

## Roadmap

- **v0.3** — compose-time nudge when drafting to a high-trust counterparty
  whose own domain is only Pending (suggest they also seal replies).
- **v0.4** — Firefox build (WebExtensions API is ~95% source-compatible;
  mainly a polyfill + manifest tweak).
- **v0.5** — Outlook.com / Fastmail / Proton content scripts.

Native add-ons (Google Workspace Marketplace, Microsoft AppSource) remain
out of scope for now; they require different packaging and OAuth review
cycles that aren't justified until the browser extension has traction.
