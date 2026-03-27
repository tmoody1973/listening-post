import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AgentationDev } from "@/components/AgentationDev";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Listening Post — Milwaukee News",
  description: "AI-powered local news platform delivering twice-daily podcasts and a living newsroom for Milwaukee, Wisconsin.",
};

function Navbar() {
  return (
    <nav className="border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" className="flex items-baseline gap-1 text-lg tracking-tight">
          <span className="font-light">the listening</span>
          <span className="font-bold" style={{ color: "var(--color-coral)" }}>post</span>
        </a>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href="/topic/housing" className="hover:text-foreground transition-colors">Topics</a>
          <a href="/podcast" className="hover:text-foreground transition-colors">Podcast</a>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-3xl mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        <p>The Listening Post is an AI-generated news platform. All stories cite their sources.</p>
        <p className="mt-1">Built for the Cloudflare x ElevenLabs Hackathon — March 2026</p>
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
          {children}
        </main>
        <Footer />
        <AgentationDev />
      </body>
    </html>
  );
}
