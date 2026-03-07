import Pill from "@/components/ui/Pill";
import { Clock, CheckCircle2, Radio, Calendar } from "lucide-react";

const CONFIG = {
  "post-qualifying": {
    icon: CheckCircle2,
    label: "Post Qualifying",
    description: "Includes qualifying times — most accurate",
    variant: "post-qualifying" as const,
  },
  "post-fp": {
    icon: Clock,
    label: "Post Practice",
    description: "Based on FP2/FP3 pace data",
    variant: "post-fp" as const,
  },
  "pre-weekend": {
    icon: Calendar,
    label: "Pre-Weekend",
    description: "Based on historical data only",
    variant: "pre-weekend" as const,
  },
  "race-day": {
    icon: Radio,
    label: "Race Day",
    description: "Final pre-race prediction",
    variant: "live" as const,
  },
};

interface DataFreshnessBadgeProps {
  freshness: string;
  predictedAt: string;
}

export default function DataFreshnessBadge({ freshness, predictedAt }: DataFreshnessBadgeProps) {
  const config = CONFIG[freshness as keyof typeof CONFIG] ?? CONFIG["pre-weekend"];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 p-3 glass-card">
      <Icon size={14} className="text-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Pill label={config.label} variant={config.variant} />
        </div>
        <p className="font-inter text-xs text-muted">{config.description}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-inter text-[10px] text-muted">Updated</p>
        <p className="font-barlow font-600 text-xs text-muted">
          {new Date(predictedAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
