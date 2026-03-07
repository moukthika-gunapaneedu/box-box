import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("shimmer-bg rounded-sm", className)} />
  );
}

export function PredictionGridSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 glass-card">
          <Skeleton className="w-8 h-6" />
          <Skeleton className="w-1 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-36 h-5" />
            <Skeleton className="w-24 h-3" />
          </div>
          <Skeleton className="w-32 h-3 hidden sm:block" />
          <Skeleton className="w-20 h-3 hidden md:block" />
          <Skeleton className="w-16 h-5" />
        </div>
      ))}
    </div>
  );
}

export function HeroBannerSkeleton() {
  return (
    <div className="h-96 shimmer-bg" />
  );
}
