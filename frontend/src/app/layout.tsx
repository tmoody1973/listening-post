import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { PlayerBar } from "@/components/PlayerBar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Listening Post — Milwaukee News",
  description: "AI-powered local news platform delivering twice-daily podcasts and a living newsroom for Milwaukee, Wisconsin.",
};

const TOPICS = [
  { label: "Housing", href: "/topic/housing" },
  { label: "Politics", href: "/topic/politics" },
  { label: "Economy", href: "/topic/economy" },
  { label: "Safety", href: "/topic/safety" },
  { label: "Education", href: "/topic/education" },
  { label: "Health", href: "/topic/health" },
  { label: "Transit", href: "/topic/transit" },
  { label: "Environment", href: "/topic/environment" },
];

function Navbar() {
  return (
    <nav>
      <div className="max-w-6xl mx-auto px-4">
        {/* Logo row */}
        <div className="flex items-center justify-between py-4">
          <a href="/" className="flex items-baseline gap-1.5">
            <span className="text-sm font-light uppercase tracking-[0.3em]">the listening</span>
            <span className="text-sm font-black uppercase tracking-[0.3em]" style={{ color: "var(--color-coral)" }}>post</span>
          </a>
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <a href="/city-hall" className="hover:text-foreground transition-colors">City Hall</a>
            <a href="/podcast" className="hover:text-foreground transition-colors">Podcast</a>
          </div>
        </div>
        {/* Thin rule */}
        <div className="h-px bg-white/20" />
        {/* Topic nav */}
        <div className="flex items-center justify-center gap-6 py-3 overflow-x-auto">
          {TOPICS.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              {t.label}
            </a>
          ))}
        </div>
        {/* Thin rule */}
        <div className="h-px bg-white/20" />
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-16">
      <div className="h-px bg-white/20" />
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          The Listening Post is an AI-generated civic news platform ◆ All stories cite their sources
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
          Built for the Cloudflare × ElevenLabs Hackathon — March 2026
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        <Suspense fallback={<div className="h-[52px] bg-zinc-900 border-b border-white/10" />}>
          <PlayerBar />
        </Suspense>
        <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
