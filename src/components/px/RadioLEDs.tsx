import { cn } from "@/lib/utils";

export type LedCategory = "GLB" | "PRV" | "LNK";

interface RadioLEDsProps {
  active: LedCategory;
  onChange: (cat: LedCategory) => void;
}

const LEDS: { key: LedCategory; label: string }[] = [
  { key: "GLB", label: "GLB" },
  { key: "PRV", label: "PRV" },
  { key: "LNK", label: "LNK" },
];

const RadioLEDs = ({ active, onChange }: RadioLEDsProps) => {
  return (
    <div className="flex items-center justify-center gap-6 py-3">
      {LEDS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex flex-col items-center gap-1.5 group"
          >
            {/* LED bulb */}
            <div
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-200",
                isActive && "animate-pulse-glow"
              )}
              style={{
                background: isActive
                  ? "radial-gradient(circle at 40% 35%, hsl(142 90% 70%), hsl(142 80% 45%))"
                  : "radial-gradient(circle at 40% 35%, hsl(220 10% 35%), hsl(220 10% 20%))",
                boxShadow: isActive
                  ? "0 0 8px hsl(142 80% 50% / 0.6), 0 0 20px hsl(142 80% 50% / 0.2), inset 0 -1px 2px rgba(0,0,0,0.3)"
                  : "inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.05)",
              }}
            />
            {/* Label engraved */}
            <span
              className="text-[9px] font-mono font-bold tracking-[0.2em]"
              style={{
                color: isActive
                  ? "hsl(142 60% 55%)"
                  : "hsl(220 10% 35%)",
                textShadow: isActive
                  ? "0 0 6px hsl(142 80% 50% / 0.3)"
                  : "none",
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default RadioLEDs;
