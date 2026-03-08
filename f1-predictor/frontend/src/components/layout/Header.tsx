"use client";

import { useState, useEffect } from "react";
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

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRaceDay, setIsRaceDay] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [nextRaceName, setNextRaceName] = useState("Next Race");

  useEffect(() => {
    fetch("/data/predictions.json")
      .then((r) => r.json())
      .then((data: any) => {
        const raceDate = new Date(data.race_date);
        const now = new Date();
        // Same calendar day in UTC = race day
        const todayUTC = now.toISOString().slice(0, 10);
        const raceDayUTC = raceDate.toISOString().slice(0, 10);
        const raceDay = todayUTC === raceDayUTC;
        // Live = race started and within 3 hours
        const diffSec = (now.getTime() - raceDate.getTime()) / 1000;
        const live = diffSec > 0 && diffSec < 3 * 3600;
        setIsRaceDay(raceDay);
        setIsLive(live);
        setNextRaceName(data.race);
      })
      .catch(() => {});
  }, []);

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
            {isRaceDay ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-f1-red/30 bg-f1-red/10">
                <span className={cn("live-dot", !isLive && "opacity-50")} />
                <span className="font-barlow font-700 text-f1-red text-xs tracking-widest uppercase">
                  {isLive ? "Race Live" : "Race Day"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-border">
                <span className="font-inter text-xs text-muted">
                  Next:{" "}
                  <span className="text-platinum font-500">{nextRaceName}</span>
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
            {isRaceDay && (
              <div className="mx-4 mt-2 mb-1 flex items-center gap-2 px-3 py-2 rounded-sm border border-f1-red/30 bg-f1-red/10">
                <span className={cn("live-dot", !isLive && "opacity-50")} />
                <span className="font-barlow font-700 text-f1-red text-xs tracking-widest uppercase">
                  {isLive ? "Race Live" : "Race Day"}
                </span>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
