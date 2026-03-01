import { cn } from "@/lib/utils";

interface ModeToggleProps {
  mode: "radio" | "feed";
  onChange: (m: "radio" | "feed") => void;
}

const ModeToggle = ({ mode, onChange }: ModeToggleProps) => {
  return (
    <div className="flex justify-center py-2 px-4">
      <div
        className="inline-flex rounded-lg p-[2px] gap-0"
        style={{
          background:
            "linear-gradient(145deg, hsl(220 8% 22%), hsl(220 10% 12%))",
          boxShadow:
            "inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 1px rgba(255,255,255,0.03)",
        }}
      >
        {(["radio", "feed"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => onChange(m)}
              className={cn(
                "px-5 py-2 text-[10px] font-mono font-bold tracking-[0.2em] rounded-md transition-all"
              )}
              style={{
                background: active
                  ? "linear-gradient(145deg, hsl(220 10% 18%), hsl(220 12% 12%))"
                  : "transparent",
                color: active ? "hsl(30 100% 55%)" : "hsl(220 10% 35%)",
                boxShadow: active
                  ? "inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.03)"
                  : "none",
                textShadow: active ? "0 0 6px hsl(30 100% 50% / 0.3)" : "none",
              }}
            >
              {m === "radio" ? "📻 RÁDIO" : "🚛 FEED"}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ModeToggle;
