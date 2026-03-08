"use client";

import { cn } from "@/lib/utils";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  className?: string;
  position?: "top" | "bottom";
}

export default function Tooltip({ text, children, className, position = "top" }: TooltipProps) {
  return (
    <div className={cn("relative group/tt inline-flex items-center", className)}>
      {children}
      <div
        role="tooltip"
        className={cn(
          "absolute left-1/2 -translate-x-1/2 w-48 px-3 py-2 rounded-sm bg-[#222] border border-white/10 text-[11px] text-white/80 font-inter leading-relaxed text-center",
          "opacity-0 group-hover/tt:opacity-100 transition-opacity duration-150 pointer-events-none z-[100] shadow-2xl",
          position === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
        )}
      >
        {text}
      </div>
    </div>
  );
}
