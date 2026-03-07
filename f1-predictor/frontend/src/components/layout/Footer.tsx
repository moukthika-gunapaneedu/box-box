import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-24 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center h-6 px-1.5 bg-f1-red rounded-sm">
              <span className="font-barlow font-900 text-white text-xs tracking-tight">BOX</span>
            </div>
            <div className="flex items-center justify-center h-6 px-1.5 bg-white/10 rounded-sm">
              <span className="font-barlow font-900 text-platinum text-xs tracking-tight">BOX</span>
            </div>
            <span className="font-barlow font-700 text-muted text-xs tracking-widest uppercase ml-1">
              F1 Race Predictions
            </span>
          </div>

          <p className="font-inter text-xs text-muted text-center">
            Predictions powered by XGBoost + LightGBM ensemble. Data from{" "}
            <a href="https://openf1.org" target="_blank" rel="noopener noreferrer" className="text-platinum hover:text-f1-red transition-colors">
              OpenF1
            </a>{" "}
            &{" "}
            <a href="https://api.jolpi.ca" target="_blank" rel="noopener noreferrer" className="text-platinum hover:text-f1-red transition-colors">
              Jolpica
            </a>
            . Not affiliated with Formula 1.
          </p>

          <nav className="flex items-center gap-4">
            {[
              { href: "/", label: "Predictions" },
              { href: "/races", label: "Races" },
              { href: "/model", label: "Model" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-barlow font-600 text-xs uppercase tracking-widest text-muted hover:text-platinum transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
