import { cn } from "@/lib/utils";
import { Mic, Loader2 } from "lucide-react";
import { useState } from "react";

interface RadioPTTProps {
  isRecording: boolean;
  isBlocked: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
}

const RadioPTT = ({ isRecording, isBlocked, onPressStart, onPressEnd }: RadioPTTProps) => {
  const [sending, setSending] = useState(false);

  const handleStart = () => {
    if (isBlocked) return;
    onPressStart();
  };

  const handleEnd = () => {
    if (!isRecording) return;
    setSending(true);
    onPressEnd();
    // Clear sending state after a short delay
    setTimeout(() => setSending(false), 1500);
  };

  return (
    <div className="flex flex-col items-center gap-2 pb-2">
      {/* TX indicator */}
      <div className="flex items-center gap-2">
        <div
          className={cn("w-2 h-2 rounded-full will-change-transform")}
          style={{
            background: isRecording
              ? "radial-gradient(circle, hsl(0 90% 65%), hsl(0 80% 50%))"
              : "hsl(220 10% 22%)",
            boxShadow: isRecording ? "0 0 8px hsl(0 80% 55% / 0.6)" : "none",
            animation: isRecording ? "led-blink 0.8s ease-in-out infinite" : "none",
          }}
        />
        <span
          className="text-[9px] font-mono tracking-[0.25em] font-bold"
          style={{
            color: isRecording ? "hsl(0 80% 60%)" : sending ? "hsl(30 100% 55%)" : "hsl(220 10% 35%)",
          }}
        >
          {isRecording ? "TX ON" : sending ? "ENVIANDO..." : "TX OFF"}
        </span>
      </div>

      {/* Wave animation rings — GPU accelerated */}
      <div className="relative">
        {isRecording && (
          <>
            <div
              className="absolute inset-0 rounded-full will-change-transform"
              style={{
                background: "hsl(0 80% 55% / 0.15)",
                animation: "radio-wave 1.2s ease-out infinite",
              }}
            />
            <div
              className="absolute inset-0 rounded-full will-change-transform"
              style={{
                background: "hsl(0 80% 55% / 0.1)",
                animation: "radio-wave 1.2s ease-out infinite 0.4s",
              }}
            />
          </>
        )}

        {/* PTT Button — GPU accelerated transforms */}
        <button
          onMouseDown={handleStart}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchEnd={handleEnd}
          disabled={isBlocked}
          className={cn(
            "relative w-20 h-20 rounded-full flex items-center justify-center select-none touch-none will-change-transform",
            isBlocked && "opacity-40 cursor-not-allowed"
          )}
          style={{
            background: isRecording
              ? "radial-gradient(circle at 45% 40%, hsl(0 70% 55%), hsl(0 80% 35%) 80%)"
              : "radial-gradient(circle at 45% 40%, hsl(220 10% 30%), hsl(220 12% 16%) 80%)",
            boxShadow: isRecording
              ? "0 0 25px hsl(0 80% 50% / 0.4), 0 6px 20px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -3px 6px rgba(0,0,0,0.4)"
              : "0 6px 20px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -3px 6px rgba(0,0,0,0.4)",
            transform: isRecording ? "scale(0.93)" : "scale(1)",
            transition: "transform 0.1s ease-out, box-shadow 0.15s ease-out",
            animation: isRecording ? "ptt-pulse 1.5s ease-in-out infinite" : "none",
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
          {sending ? (
            <Loader2
              className="w-7 h-7 relative z-10 animate-spin"
              style={{ color: "hsl(30 100% 55%)" }}
            />
          ) : (
            <Mic
              className="w-8 h-8 relative z-10"
              style={{
                color: isRecording ? "hsl(0 0% 100%)" : "hsl(30 100% 55%)",
                filter: isRecording ? "drop-shadow(0 0 6px hsl(0 0% 100% / 0.4))" : "none",
              }}
            />
          )}
        </button>
      </div>

      <p
        className="text-[9px] font-mono tracking-[0.15em]"
        style={{ color: "hsl(220 10% 40%)" }}
      >
        {isBlocked ? "CANAL EM USO" : sending ? "ENVIANDO ÁUDIO..." : "SEGURE PARA TRANSMITIR"}
      </p>
    </div>
  );
};

export default RadioPTT;
