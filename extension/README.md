# Witnessed — browser extension

One-click "always-BCC" for Gmail. Every new compose window gets
`seal@witnessed.cc` prefilled in the Bcc field, so your outbound business
email builds a public, verifiable record on [witnessed.cc](https://witnessed.cc).

The extension is fully local: no OAuth, no server-side mail access, no
tracking, nothing beyond a DOM tweak inside Gmail.

## Status

**v0.1** — Gmail only, write-side only (inject BCC on compose). Read-side
features (verified-sender pill, per-thread ops) are tracked for v0.2.

## What it does

- Watches `mail.google.com` for new compose dialogs.
- Auto-expands the Bcc row and inserts `seal@witnessed.cc`.
- Marks each compose as handled so removing the chip on a specific email
  sticks — we never re-inject on a dialog we've already touched.
- Popup gives you a global on/off toggle and a running count of sealed
  emails from this browser.

Nothing leaves your machine. The extension never reads message bodies,
never talks to our servers, and requires only `storage` +
`host_permissions: mail.google.com`.

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

- **v0.2** — verified-sender pill on incoming thread list. Queries
  `witnessed.cc/api/badge/<domain>` client-side, caches per domain.
- **v0.3** — compose warning when drafting to a high-trust counterparty
  whose own record is pending (nudge to seal the reply).
- **v0.4** — Firefox build (WebExtensions API is ~95% source-compatible;
  mainly a polyfill + manifest tweak).
- **v0.5** — Outlook.com / Fastmail / Proton content scripts.

Native add-ons (Google Workspace Marketplace, Microsoft AppSource) remain
out of scope for now; they require different packaging and OAuth review
cycles that aren't justified until the browser extension has traction.
