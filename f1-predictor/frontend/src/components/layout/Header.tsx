"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Predictions" },
  { href: "/races", label: "Races" },
  { href: "/drivers", label: "Drivers" },
  { href: "/model", label: "How It Works" },
];

// Set to true on race day. In production this would be derived from predictions.json
const IS_RACE_DAY = true;
const NEXT_RACE = "Australian Grand Prix";

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-carbon border-b border-border backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex items-center justify-center h-8 px-2 bg-f1-red rounded-sm">
              <span className="font-barlow font-900 text-white text-sm tracking-tighter leading-none">BOX</span>
            </div>
            <div className="flex items-center justify-center h-8 px-2 bg-white/10 rounded-sm">
              <span className="font-barlow font-900 text-platinum text-sm tracking-tighter leading-none">BOX</span>
            </div>
            <span className="font-barlow font-700 text-muted text-xs tracking-widest uppercase hidden sm:block ml-1">
              F1 Race Predictions
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "font-barlow font-600 text-sm uppercase tracking-widest transition-colors",
                  pathname === link.href
                    ? "text-f1-red"
                    : "text-muted hover:text-platinum"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Status pill */}
          <div className="hidden md:flex items-center">
            {IS_RACE_DAY ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-f1-red/30 bg-f1-red/10">
                <span className="live-dot" />
                <span className="font-barlow font-700 text-f1-red text-xs tracking-widest uppercase">
                  Race Day
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-border">
                <span className="font-inter text-xs text-muted">
                  Next:{" "}
                  <span className="text-platinum font-500">{NEXT_RACE}</span>
                </span>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-muted hover:text-platinum transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-surface">
          <nav className="flex flex-col py-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-6 py-3 font-barlow font-600 text-sm uppercase tracking-widest transition-colors",
                  pathname === link.href
                    ? "text-f1-red bg-f1-red/5"
                    : "text-muted hover:text-platinum hover:bg-surface-2"
                )}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {IS_RACE_DAY && (
              <div className="mx-4 mt-2 mb-1 flex items-center gap-2 px-3 py-2 rounded-sm border border-f1-red/30 bg-f1-red/10">
                <span className="live-dot" />
                <span className="font-barlow font-700 text-f1-red text-xs tracking-widest uppercase">
                  Race Live Today
                </span>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
