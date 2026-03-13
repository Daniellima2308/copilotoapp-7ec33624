import { useRef, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RadioKnobProps {
  totalPositions: number;
  currentPosition: number;
  onPositionChange: (pos: number) => void;
}

const RadioKnob = ({ totalPositions, currentPosition, onPositionChange }: RadioKnobProps) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef(0);
  const isDragging = useRef(false);

  const DOT_COUNT = Math.min(totalPositions, 24);
  const anglePerPos = 300 / Math.max(totalPositions - 1, 1);
  const rotation = -150 + currentPosition * anglePerPos;

  const tryVibrate = useCallback(() => {
    try {
      navigator.vibrate?.(10);
    } catch {
      // vibração pode não estar disponível no dispositivo/navegador
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    const rect = knobRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    startAngleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !knobRef.current) return;
    const rect = knobRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    const delta = angle - startAngleRef.current;
    if (Math.abs(delta) > (anglePerPos * 0.6)) {
      const dir = delta > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(totalPositions - 1, currentPosition + dir));
      if (next !== currentPosition) {
        onPositionChange(next);
        tryVibrate();
      }
      startAngleRef.current = angle;
    }
  }, [currentPosition, totalPositions, anglePerPos, onPositionChange, tryVibrate]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div className="flex flex-col items-center py-2">
      {/* Knob container with dots */}
      <div className="relative w-32 h-32">
        {/* Position dots */}
        {Array.from({ length: DOT_COUNT }).map((_, i) => {
          const dotAngle = -150 + (i / (DOT_COUNT - 1)) * 300;
          const rad = (dotAngle - 90) * (Math.PI / 180);
          const r = 58;
          const x = 64 + r * Math.cos(rad);
          const y = 64 + r * Math.sin(rad);
          const mappedPos = Math.round((i / (DOT_COUNT - 1)) * (totalPositions - 1));
          const isActive = mappedPos <= currentPosition;
          return (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full transition-all duration-150"
              style={{
                left: x - 3,
                top: y - 3,
                background: isActive
                  ? "hsl(30 100% 55%)"
                  : "hsl(220 10% 22%)",
                boxShadow: isActive
                  ? "0 0 4px hsl(30 100% 55% / 0.5)"
                  : "none",
              }}
            />
          );
        })}

        {/* Knob body */}
        <div
          ref={knobRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute inset-[14px] rounded-full cursor-grab active:cursor-grabbing select-none touch-none"
          style={{
            background:
              "radial-gradient(circle at 45% 40%, hsl(220 8% 28%), hsl(220 10% 14%) 70%)",
            boxShadow:
              "0 4px 15px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.06), inset 0 -2px 4px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)",
            transform: `rotate(${rotation}deg)`,
            transition: isDragging.current ? "none" : "transform 0.15s ease-out",
          }}
        >
          {/* Grip ridges */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * 360;
            return (
              <div
                key={i}
                className="absolute w-[2px] h-3 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  left: "50%",
                  top: 4,
                  transformOrigin: "center 48px",
                  transform: `translateX(-50%) rotate(${a}deg)`,
                }}
              />
            );
          })}

          {/* Indicator line */}
          <div
            className="absolute left-1/2 top-2 w-[3px] h-5 rounded-full -translate-x-1/2"
            style={{
              background:
                "linear-gradient(180deg, hsl(30 100% 55%), hsl(30 100% 40%))",
              boxShadow: "0 0 6px hsl(30 100% 50% / 0.4)",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default RadioKnob;
