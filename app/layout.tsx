import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signet — AI can fake everything except yesterday",
  description:
    "CC signet@witnessed.cc on your business emails. Build a verified communication history — passively, permanently, and impossible to manufacture.",
  openGraph: {
    title: "Signet",
    description: "AI can fake everything except yesterday.",
    url: "https://witnessed.cc",
    siteName: "Signet",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
