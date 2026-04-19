import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Witnessed — The business record AI can't fake",
  description:
    "CC seal@witnessed.cc on your business emails. Build a verified communication history — passively, permanently, and impossible to manufacture.",
  openGraph: {
    title: "Witnessed",
    description: "The business record AI can't fake.",
    url: "https://witnessed.cc",
    siteName: "Witnessed",
  },
};

// The [locale] layout renders the actual <html>/<body> shell so
// the document's `lang` attribute tracks the user's locale.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
