import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { BrandWordmark } from "@/components/branding/BrandWordmark";

import RadioDisplay from "@/components/px/RadioDisplay";
import RadioLEDs, { type LedCategory } from "@/components/px/RadioLEDs";
import RadioKnob from "@/components/px/RadioKnob";
import RadioPTT from "@/components/px/RadioPTT";
import RadioMessages from "@/components/px/RadioMessages";
import ModeToggle from "@/components/px/ModeToggle";
import FeedDoTrecho from "@/components/px/FeedDoTrecho";

interface PxChannel {
  id: string;
  name: string;
  type: "public" | "private";
  category: string;
  region: string | null;
  creator_id: string | null;
  expires_at: string | null;
}

interface PxMessage {
  id: string;
  channel_id: string;
  user_id: string;
  display_name: string;
  text: string | null;
  audio_url: string | null;
  created_at: string;
}

interface MuralPost {
  id: string;
  user_id: string;
  display_name: string;
  image_url: string;
  caption: string;
  likes: number;
  created_at: string;
}

const PXDigitalPage = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<"radio" | "feed">("radio");
  const [ledCategory, setLedCategory] = useState<LedCategory>("GLB");
  const [channels, setChannels] = useState<PxChannel[]>([]);
  const [knobPosition, setKnobPosition] = useState(0);
  const [messages, setMessages] = useState<PxMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [displayName, setDisplayName] = useState("Motorista");
  const [muralPosts, setMuralPosts] = useState<MuralPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Filter channels by current LED category
  const filteredChannels = channels.filter((ch) => {
    if (ledCategory === "GLB") return ch.category === "global";
    if (ledCategory === "PRV") return ch.type === "private" && ch.creator_id === user?.id;
    if (ledCategory === "LNK") return ch.type === "private" && ch.creator_id !== user?.id;
    return false;
  });

  const activeChannel = filteredChannels[knobPosition] || null;
  const activeChannelId = activeChannel?.id;

  // Fetch profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  // Fetch channels
  useEffect(() => {
    const fetchChannels = async () => {
      const { data } = await supabase
        .from("px_channels")
        .select("*")
        .order("created_at", { ascending: true });
      if (data) {
        setChannels(data as unknown as PxChannel[]);
        // Check invite
        const inviteId = sessionStorage.getItem("px_invite_channel");
        if (inviteId) {
          sessionStorage.removeItem("px_invite_channel");
          const ch = data.find((c: { id: string }) => c.id === inviteId);
          if (ch) {
            setLedCategory("LNK");
            // knob position will be set after filter
          }
        }
      }
    };
    fetchChannels();
  }, []);

  // Reset knob when category changes
  useEffect(() => {
    setKnobPosition(0);
  }, [ledCategory]);

  // Fetch messages for active channel
  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      return;
    }
    const fetchMessages = async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("px_messages")
        .select("*")
        .eq("channel_id", activeChannelId)
        .gte("created_at", twoHoursAgo)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data as PxMessage[]);
    };
    fetchMessages();

    const channel = supabase
      .channel(`px-${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "px_messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as PxMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId]);

  // Fetch mural posts (today only) + realtime
  useEffect(() => {
    if (mode !== "feed") return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    supabase
      .from("mural_posts")
      .select("*")
      .gte("created_at", todayISO)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setMuralPosts(data as MuralPost[]);
      });
    if (user) {
      supabase
        .from("mural_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (data) setLikedPosts(new Set(data.map((l: { post_id: string }) => l.post_id)));
        });
    }

    // Realtime subscription for new mural posts
    const muralChannel = supabase
      .channel("mural-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mural_posts" },
        (payload) => {
          setMuralPosts((prev) => [payload.new as MuralPost, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mural_posts" },
        (payload) => {
          setMuralPosts((prev) =>
            prev.map((p) => (p.id === (payload.new as MuralPost).id ? (payload.new as MuralPost) : p))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(muralChannel);
    };
  }, [mode, user]);

  // Send text message
  const sendTextMessage = async () => {
    if (!textInput.trim() || !activeChannel || !user) return;
    const msg = textInput.trim();
    setTextInput("");
    await supabase.from("px_messages").insert({
      channel_id: activeChannel.id,
      user_id: user.id,
      display_name: displayName,
      text: msg,
    });
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadAudio(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadAudio = async (blob: Blob) => {
    if (!user || !activeChannel) return;
    const fileName = `audio/${user.id}/${Date.now()}.webm`;
    const { error: uploadErr } = await supabase.storage
      .from("px-media")
      .upload(fileName, blob);
    if (uploadErr) {
      toast({ title: "Erro no upload", variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("px-media").getPublicUrl(fileName);
    await supabase.from("px_messages").insert({
      channel_id: activeChannel.id,
      user_id: user.id,
      display_name: displayName,
      audio_url: urlData.publicUrl,
    });
  };

  // Category label for display
  const categoryLabel =
    ledCategory === "GLB"
      ? "CANAL GLOBAL"
      : ledCategory === "PRV"
      ? "CANAL PRIVADO"
      : "CANAL COMPARTILHADO";

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, hsl(220 18% 7%) 0%, hsl(220 20% 5%) 100%)",
      }}
    >
      {/* Header — fixed */}
      <header className="flex-shrink-0 px-4 pt-5 pb-2">
        <div className="flex items-center gap-3">
          <BrandWordmark theme="light" className="h-auto w-[136px] opacity-90" />
          <div className="flex-1">
            <h1
              className="text-sm font-mono font-bold tracking-[0.15em]"
              style={{ color: "hsl(30 100% 55%)" }}
            >
              PX DIGITAL
            </h1>
          </div>
          <ConnectionIndicator />
          <HamburgerMenu />
        </div>
      </header>

      {/* Mode Toggle — fixed */}
      <div className="flex-shrink-0">
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {mode === "radio" ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Radio panel — sticky top, never scrolls */}
          <div className="flex-shrink-0">
            <RadioDisplay
              categoryLabel={categoryLabel}
              channelName={activeChannel?.name || "SEM CANAL"}
              onlineCount={0}
              isTransmitting={recording}
            />
            <RadioLEDs active={ledCategory} onChange={setLedCategory} />
            {filteredChannels.length > 0 && (
              <RadioKnob
                totalPositions={filteredChannels.length}
                currentPosition={knobPosition}
                onPositionChange={setKnobPosition}
              />
            )}
          </div>

          {/* Messages — independent scrollable area */}
          <RadioMessages messages={messages} currentUserId={user?.id} />

          {/* Input + PTT — fixed bottom */}
          <div
            className="flex-shrink-0 px-3 py-2 flex items-center gap-2"
            style={{
              background: "hsl(220 15% 6%)",
              borderTop: "1px solid hsl(220 12% 12%)",
            }}
          >
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
              placeholder="Mensagem..."
              className="flex-1 text-xs font-mono py-2.5 px-3 rounded-lg outline-none"
              style={{
                background: "hsl(220 15% 10%)",
                color: "hsl(210 15% 75%)",
                border: "1px solid hsl(220 12% 16%)",
              }}
            />
            <button
              onClick={sendTextMessage}
              disabled={!textInput.trim()}
              className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-30 transition-opacity"
              style={{
                background: "hsl(30 100% 50% / 0.15)",
                border: "1px solid hsl(30 100% 50% / 0.2)",
              }}
            >
              <Send className="w-4 h-4" style={{ color: "hsl(30 100% 55%)" }} />
            </button>

            <RadioPTT
              isRecording={recording}
              isBlocked={false}
              onPressStart={startRecording}
              onPressEnd={stopRecording}
            />
          </div>
        </div>
      ) : (
        <FeedDoTrecho
          posts={muralPosts}
          setPosts={setMuralPosts}
          likedPosts={likedPosts}
          setLikedPosts={setLikedPosts}
          userId={user?.id}
          displayName={displayName}
          activeChannelName={activeChannel?.name}
        />
      )}
    </div>
  );
};

export default PXDigitalPage;
