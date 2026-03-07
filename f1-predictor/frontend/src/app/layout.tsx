import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Box Box | F1 Race Predictions",
  description:
    "AI-powered Formula 1 race winner predictions using real-time qualifying data, historical performance, and machine learning. Built for the 2026 season.",
  keywords: ["F1", "Formula 1", "race prediction", "2026", "winner prediction", "AI", "box box"],
  openGraph: {
    title: "Box Box | F1 Race Predictions",
    description: "AI-powered Formula 1 predictions for every race weekend.",
    type: "website",
    siteName: "Box Box",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlowCondensed.variable} ${inter.variable}`}>
      <body className="bg-carbon text-platinum min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
