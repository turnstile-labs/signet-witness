import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // `/extension` and `/integrations` used to be standalone landing pages.
  // They collapsed into `/setup` (one hub, one URL, five recipes). These
  // redirects keep pre-existing links working — including the test
  // instructions URL we submitted to the Chrome Web Store, which pointed
  // to /extension. Next.js redirects run before locale middleware, so
  // matching both the bare path and the locale-prefixed form covers
  // direct hits as well as clicks from external sites that already use
  // the canonical /en/... form.
  //
  // `/extension/welcome` is NOT affected — it's a path-segment deeper
  // and still serves the post-install welcome screen the extension
  // opens after a fresh install.
  async redirects() {
    return [
      { source: "/extension", destination: "/setup", permanent: true },
      { source: "/integrations", destination: "/setup", permanent: true },
      {
        source: "/:locale(en|es)/extension",
        destination: "/:locale/setup",
        permanent: true,
      },
      {
        source: "/:locale(en|es)/integrations",
        destination: "/:locale/setup",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
