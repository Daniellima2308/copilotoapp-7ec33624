import { cn } from "@/lib/utils";
import { Mic } from "lucide-react";

interface RadioPTTProps {
  isRecording: boolean;
  isBlocked: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
}

const RadioPTT = ({ isRecording, isBlocked, onPressStart, onPressEnd }: RadioPTTProps) => {
  return (
    <div className="flex flex-col items-center gap-2 pb-2">
      {/* TX indicator */}
      <div className="flex items-center gap-2">
        <div
          className={cn("w-2 h-2 rounded-full transition-all", isRecording && "animate-led-blink")}
          style={{
            background: isRecording
              ? "radial-gradient(circle, hsl(0 90% 65%), hsl(0 80% 50%))"
              : "hsl(220 10% 22%)",
            boxShadow: isRecording ? "0 0 8px hsl(0 80% 55% / 0.6)" : "none",
          }}
        />
        <span
          className="text-[9px] font-mono tracking-[0.25em] font-bold"
          style={{
            color: isRecording ? "hsl(0 80% 60%)" : "hsl(220 10% 35%)",
          }}
        >
          {isRecording ? "TX ON" : "TX OFF"}
        </span>
      </div>

      {/* Wave animation rings */}
      <div className="relative">
        {isRecording && (
          <>
            <div
              className="absolute inset-0 rounded-full animate-radio-wave"
              style={{ background: "hsl(0 80% 55% / 0.15)" }}
            />
            <div
              className="absolute inset-0 rounded-full animate-radio-wave"
              style={{ background: "hsl(0 80% 55% / 0.1)", animationDelay: "0.3s" }}
            />
          </>
        )}

        {/* PTT Button */}
        <button
          onMouseDown={!isBlocked ? onPressStart : undefined}
          onMouseUp={onPressEnd}
          onTouchStart={!isBlocked ? onPressStart : undefined}
          onTouchEnd={onPressEnd}
          disabled={isBlocked}
          className={cn(
            "relative w-20 h-20 rounded-full flex items-center justify-center select-none touch-none transition-all duration-150",
            isBlocked && "opacity-40 cursor-not-allowed"
          )}
          style={{
            background: isRecording
              ? "radial-gradient(circle at 45% 40%, hsl(0 70% 55%), hsl(0 80% 35%) 80%)"
              : "radial-gradient(circle at 45% 40%, hsl(220 10% 30%), hsl(220 12% 16%) 80%)",
            boxShadow: isRecording
              ? "0 0 25px hsl(0 80% 50% / 0.4), 0 6px 20px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -3px 6px rgba(0,0,0,0.4)"
              : "0 6px 20px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -3px 6px rgba(0,0,0,0.4)",
            transform: isRecording ? "scale(0.95)" : "scale(1)",
          }}
        >
          {/* Metal grille overlay */}
          <div
            className="absolute inset-3 rounded-full overflow-hidden pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 3px)",
            }}
          />
          <Mic
            className="w-8 h-8 relative z-10"
            style={{
              color: isRecording ? "hsl(0 0% 100%)" : "hsl(30 100% 55%)",
              filter: isRecording ? "drop-shadow(0 0 6px hsl(0 0% 100% / 0.4))" : "none",
            }}
          />
        </button>
      </div>

      <p
        className="text-[9px] font-mono tracking-[0.15em]"
        style={{ color: "hsl(220 10% 40%)" }}
      >
        {isBlocked ? "CANAL EM USO" : "SEGURE PARA TRANSMITIR"}
      </p>
    </div>
  );
};

export default RadioPTT;
