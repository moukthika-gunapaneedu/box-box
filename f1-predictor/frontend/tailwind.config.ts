import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        carbon: "#0A0A0A",
        surface: "#111111",
        "surface-2": "#1A1A1A",
        border: "#2A2A2A",
        "f1-red": "#E10600",
        platinum: "#E8E8E8",
        muted: "#888888",
        gold: "#FFD700",
        silver: "#C0C0C0",
        bronze: "#CD7F32",
        // Team colors
        "team-redbull": "#3671C6",
        "team-ferrari": "#E8002D",
        "team-mercedes": "#27F4D2",
        "team-mclaren": "#FF8000",
        "team-aston": "#229971",
        "team-alpine": "#FF87BC",
        "team-williams": "#64C4FF",
        "team-rb": "#6692FF",
        "team-haas": "#B6BABD",
        "team-sauber": "#52E252",
        "team-cadillac": "#B40000",
      },
      fontFamily: {
        "barlow": ["Barlow Condensed", "sans-serif"],
        "inter": ["Inter", "sans-serif"],
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-red": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        "pulse-red": "pulse-red 1.5s ease-in-out infinite",
        "slide-up": "slide-up 0.4s ease-out forwards",
        "fade-in": "fade-in 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
