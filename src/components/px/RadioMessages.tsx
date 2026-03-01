import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  user_id: string;
  display_name: string;
  text: string | null;
  audio_url: string | null;
  created_at: string;
}

interface RadioMessagesProps {
  messages: Message[];
  currentUserId?: string;
}

const RadioMessages = ({ messages, currentUserId }: RadioMessagesProps) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p
          className="text-[11px] font-mono tracking-wider"
          style={{ color: "hsl(220 10% 30%)" }}
        >
          — CANAL SILENCIOSO —
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-1.5 px-3 py-2 min-h-0 no-scrollbar">
      {messages.map((msg) => {
        const isMe = msg.user_id === currentUserId;
        return (
          <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
            <div
              className="max-w-[85%] rounded px-2.5 py-1.5 space-y-0.5"
              style={{
                background: isMe
                  ? "hsl(30 100% 50% / 0.08)"
                  : "hsl(220 15% 10%)",
                border: `1px solid ${isMe ? "hsl(30 100% 50% / 0.15)" : "hsl(220 12% 16%)"}`,
              }}
            >
              {!isMe && (
                <p
                  className="text-[9px] font-mono font-bold tracking-wider"
                  style={{ color: "hsl(30 100% 55% / 0.7)" }}
                >
                  {msg.display_name.toUpperCase()}
                </p>
              )}
              {msg.text && (
                <p className="text-xs font-mono" style={{ color: "hsl(210 15% 75%)" }}>
                  {msg.text}
                </p>
              )}
              {msg.audio_url && (
                <audio
                  controls
                  src={msg.audio_url}
                  className="w-full max-w-[200px] h-7"
                  style={{ filter: "sepia(0.3) hue-rotate(-10deg)" }}
                />
              )}
              <p
                className="text-[8px] font-mono text-right"
                style={{ color: "hsl(220 10% 30%)" }}
              >
                {formatTime(msg.created_at)}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

export default RadioMessages;
