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
        className={cn(
          "absolute left-1/2 -translate-x-1/2 px-2 py-1.5 rounded bg-[#1c1c1c] border border-border text-[11px] text-platinum font-inter leading-snug opacity-0 group-hover/tt:opacity-100 transition-opacity duration-150 pointer-events-none z-50 w-max max-w-[170px] text-center shadow-xl",
          position === "top" ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        {text}
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 w-0 h-0",
            position === "top"
              ? "top-full border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#1c1c1c]"
              : "bottom-full border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-[#1c1c1c]"
          )}
        />
      </div>
    </div>
  );
}
