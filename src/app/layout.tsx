import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import "./globals.css";

// Clean sans-serif for body text.
const bodyFont = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

// Serif for headings, as the temple's pages usually do.
const headingFont = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sharad Utsav 2026 | Book your tickets",
  description:
    "Book entry tickets, dinner and workshops for Sharad Utsav 2026 at Radha Krishna Temple, Allen, Texas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
