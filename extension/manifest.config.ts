import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Witnessed — Auto-seal Gmail",
  short_name: "Witnessed",
  description:
    "Auto-BCC seal@witnessed.cc on every Gmail compose so your outbound mail builds a public, verifiable record.",
  version: pkg.version,

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

  permissions: ["storage"],
  host_permissions: ["https://mail.google.com/*"],
});
