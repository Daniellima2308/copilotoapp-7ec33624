import { cn } from "@/lib/utils";

interface RadioDisplayProps {
  categoryLabel: string;
  channelName: string;
  onlineCount: number;
  isTransmitting: boolean;
  transmitterName?: string;
}

const RadioDisplay = ({
  categoryLabel,
  channelName,
  onlineCount,
  isTransmitting,
  transmitterName,
}: RadioDisplayProps) => {
  return (
    <div className="relative mx-4">
      {/* Metallic bezel */}
      <div
        className="rounded-xl p-[2px]"
        style={{
          background:
            "linear-gradient(145deg, hsl(220 8% 35%), hsl(220 8% 15%), hsl(220 8% 25%))",
        }}
      >
        {/* Inner shadow frame */}
        <div
          className="rounded-[10px] p-[3px]"
          style={{
            background: "hsl(220 15% 6%)",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          {/* LCD Screen */}
          <div
            className="rounded-lg px-4 py-3 relative overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, hsl(220 20% 4%) 0%, hsl(220 25% 3%) 100%)",
              boxShadow: "inset 0 1px 4px rgba(0,0,0,0.6)",
            }}
          >
            {/* Scanline effect */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,165,0,0.1) 2px, rgba(255,165,0,0.1) 4px)",
              }}
            />

            {/* Category label */}
            <p
              className="text-[10px] font-mono tracking-[0.3em] text-center mb-1"
              style={{
                color: "hsl(30 100% 50% / 0.5)",
                textShadow: "0 0 6px hsl(30 100% 50% / 0.2)",
              }}
            >
              {categoryLabel}
            </p>

            {/* Channel name */}
            <p
              className="text-lg font-mono font-bold text-center tracking-wider leading-tight"
              style={{
                color: "hsl(30 100% 55%)",
                textShadow:
                  "0 0 10px hsl(30 100% 50% / 0.6), 0 0 30px hsl(30 100% 50% / 0.2)",
              }}
            >
              {channelName.toUpperCase()}
            </p>

            {/* Online / transmitting info */}
            <div className="flex items-center justify-center gap-3 mt-1.5">
              {isTransmitting ? (
                <p
                  className="text-[10px] font-mono tracking-wider animate-led-blink"
                  style={{
                    color: "hsl(0 80% 60%)",
                    textShadow: "0 0 8px hsl(0 80% 55% / 0.6)",
                  }}
                >
                  ● TX — {transmitterName || "TRANSMITINDO"}
                </p>
              ) : (
                <p
                  className="text-[10px] font-mono tracking-wider"
                  style={{
                    color: "hsl(30 100% 50% / 0.4)",
                    textShadow: "0 0 4px hsl(30 100% 50% / 0.1)",
                  }}
                >
                  {onlineCount} MOTORISTA{onlineCount !== 1 ? "S" : ""} ONLINE
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RadioDisplay;
