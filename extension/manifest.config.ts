import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Witnessed for Gmail",
  short_name: "Witnessed",
  description:
    "Auto-BCC seal@witnessed.cc on every Gmail compose, and look up any sender's proof-of-business record at a click.",
  version: pkg.version,

  // Surfaces on the store listing under "Visit website". Also lets
  // witnessed.cc's install-detection component ask the extension
  // "are you installed?" via chrome.runtime.sendMessage without any
  // prior user interaction.
  homepage_url: "https://witnessed.cc",

  icons: {
    "16": "public/icons/icon-16.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png",
  },

  action: {
    default_title: "Witnessed",
    default_popup: "src/popup/popup.html",
    default_icon: {
      "16": "public/icons/icon-16.png",
      "48": "public/icons/icon-48.png",
      "128": "public/icons/icon-128.png",
    },
  },

  background: {
    service_worker: "src/background.ts",
    type: "module",
  },

  content_scripts: [
    {
      matches: ["https://mail.google.com/*"],
      js: ["src/content/gmail.ts"],
      run_at: "document_idle",
      all_frames: false,
    },
  ],

  permissions: ["storage", "activeTab"],
  host_permissions: [
    "https://mail.google.com/*",
    "https://witnessed.cc/*",
  ],

  // Lets witnessed.cc (and only witnessed.cc) talk to the extension
  // from regular page script via `chrome.runtime.sendMessage`. This
  // powers the site's "Installed ✓" / "Install" swap on the /extension
  // landing page without needing to inject a content script into our
  // own marketing pages. Reviewers see one targeted origin, not a
  // blanket opt-in.
  externally_connectable: {
    matches: ["https://witnessed.cc/*"],
  },
});
