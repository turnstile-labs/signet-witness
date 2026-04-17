import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Witnessed — The business record AI can't fake",
  description:
    "CC sealed@witnessed.cc on your business emails. Build a verified communication history — passively, permanently, and impossible to manufacture.",
  openGraph: {
    title: "Witnessed",
    description: "The business record AI can't fake.",
    url: "https://witnessed.cc",
    siteName: "Witnessed",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.classList.add("light")}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen bg-bg text-txt antialiased">
        {children}
      </body>
    </html>
  );
}
