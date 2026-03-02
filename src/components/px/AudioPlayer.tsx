import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  isMe?: boolean;
}

const AudioPlayer = ({ src, isMe }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onLoaded = () => setDuration(a.duration || 0);
    const onTime = () => {
      if (a.duration) setProgress((a.currentTime / a.duration) * 100);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const handleBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * a.duration;
    setProgress(pct * 100);
  }, []);

  // Generate static waveform bars
  const bars = useRef(
    Array.from({ length: 28 }, () => 0.2 + Math.random() * 0.8)
  ).current;

  return (
    <div className="flex items-center gap-2 min-w-[180px] max-w-[240px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
        style={{
          background: isMe
            ? "hsl(30 100% 50% / 0.25)"
            : "hsl(220 15% 18%)",
          color: isMe ? "hsl(30 100% 60%)" : "hsl(210 15% 70%)",
        }}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      {/* Waveform + duration */}
      <div className="flex-1 flex flex-col gap-1">
        {/* Waveform bars */}
        <div
          className="flex items-end gap-[1.5px] h-5 cursor-pointer"
          onClick={handleBarClick}
        >
          {bars.map((h, i) => {
            const barPct = (i / bars.length) * 100;
            const isPlayed = barPct < progress;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-colors duration-100"
                style={{
                  height: `${h * 100}%`,
                  minHeight: 2,
                  background: isPlayed
                    ? isMe
                      ? "hsl(30 100% 55%)"
                      : "hsl(210 15% 65%)"
                    : isMe
                    ? "hsl(30 100% 50% / 0.25)"
                    : "hsl(220 12% 22%)",
                }}
              />
            );
          })}
        </div>

        {/* Duration */}
        <span
          className="text-[9px] font-mono tabular-nums"
          style={{ color: isMe ? "hsl(30 100% 50% / 0.6)" : "hsl(220 10% 40%)" }}
        >
          {playing && audioRef.current
            ? formatTime(audioRef.current.currentTime)
            : duration
            ? formatTime(duration)
            : "0:00"}
        </span>
      </div>
    </div>
  );
};

export default AudioPlayer;
