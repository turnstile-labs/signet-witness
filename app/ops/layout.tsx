// Ops route owns its own <html>/<body> shell because it lives
// outside the [locale]/ tree (the dashboard is intentionally not
// localised — see app/ops/[token]/page.tsx). Keeping the no-flash
// theme script here and reading from the same `theme` localStorage
// key as the rest of the app means the operator's choice persists
// across surfaces (landing → ops → extension popup all stay in
// sync), without dragging next-intl into a route that doesn't need
// it.
//
// Owning the <head> means we also lose Next.js's auto-injected
// viewport meta, so we add it explicitly below — without it mobile
// browsers render the page at desktop width and force pinch-zoom on
// every interaction.

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        {/* Prevent flash of wrong theme — runs before render. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.classList.add("light")}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-txt antialiased">{children}</body>
    </html>
  );
}
