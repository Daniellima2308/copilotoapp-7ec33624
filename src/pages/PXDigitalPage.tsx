import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { toast } from "@/hooks/use-toast";
import { Radio, Image, Send, Mic, Plus, Heart, Truck, Lock, Clock, Link2, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";

interface PxChannel {
  id: string;
  name: string;
  type: "public" | "private";
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

const DURATION_OPTIONS = [
  { label: "2 horas", value: 2 },
  { label: "12 horas", value: 12 },
  { label: "24 horas", value: 24 },
  { label: "Permanente", value: 0 },
];

const PXDigitalPage = () => {
  const { user } = useAuth();
  const [view, setView] = useState<"radio" | "mural">("radio");
  const [channels, setChannels] = useState<PxChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PxMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [displayName, setDisplayName] = useState("Motorista");
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDuration, setNewChannelDuration] = useState(0);
  const [muralPosts, setMuralPosts] = useState<MuralPost[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostFile, setNewPostFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const channelScrollRef = useRef<HTMLDivElement>(null);

  // Fetch profile display name
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.display_name) setDisplayName(data.display_name); });
  }, [user]);

  // Fetch channels
  useEffect(() => {
    const fetchChannels = async () => {
      const { data } = await supabase.from("px_channels").select("*").order("created_at", { ascending: true });
      if (data) {
        setChannels(data as PxChannel[]);
        // Check for invite
        const inviteId = sessionStorage.getItem("px_invite_channel");
        if (inviteId && data.some((c: any) => c.id === inviteId)) {
          setActiveChannelId(inviteId);
          sessionStorage.removeItem("px_invite_channel");
        } else if (!activeChannelId && data.length > 0) {
          setActiveChannelId(data[0].id);
        }
      }
    };
    fetchChannels();
  }, []);

  // Fetch messages for active channel
  useEffect(() => {
    if (!activeChannelId) return;
    const fetchMessages = async () => {
      const { data } = await supabase.from("px_messages").select("*")
        .eq("channel_id", activeChannelId).order("created_at", { ascending: true }).limit(100);
      if (data) setMessages(data as PxMessage[]);
    };
    fetchMessages();

    // Realtime subscription
    const channel = supabase.channel(`px-${activeChannelId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "px_messages",
        filter: `channel_id=eq.${activeChannelId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as PxMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannelId]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch mural posts
  useEffect(() => {
    if (view !== "mural") return;
    const fetchPosts = async () => {
      const { data } = await supabase.from("mural_posts").select("*").order("created_at", { ascending: false }).limit(50);
      if (data) setMuralPosts(data as MuralPost[]);
    };
    fetchPosts();

    // Fetch user likes
    if (user) {
      supabase.from("mural_likes").select("post_id").eq("user_id", user.id)
        .then(({ data }) => {
          if (data) setLikedPosts(new Set(data.map((l: any) => l.post_id)));
        });
    }
  }, [view, user]);

  const sendTextMessage = async () => {
    if (!textInput.trim() || !activeChannelId || !user) return;
    const msg = textInput.trim();
    setTextInput("");
    await supabase.from("px_messages").insert({
      channel_id: activeChannelId, user_id: user.id, display_name: displayName, text: msg,
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadAudio(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar o microfone.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadAudio = async (blob: Blob) => {
    if (!user || !activeChannelId) return;
    const fileName = `audio/${user.id}/${Date.now()}.webm`;
    const { error: uploadErr } = await supabase.storage.from("px-media").upload(fileName, blob);
    if (uploadErr) { toast({ title: "Erro no upload", variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("px-media").getPublicUrl(fileName);
    await supabase.from("px_messages").insert({
      channel_id: activeChannelId, user_id: user.id, display_name: displayName, audio_url: urlData.publicUrl,
    });
  };

  const createPrivateChannel = async () => {
    if (!newChannelName.trim() || !user) return;
    const expiresAt = newChannelDuration > 0
      ? new Date(Date.now() + newChannelDuration * 3600 * 1000).toISOString()
      : null;
    const { data, error } = await supabase.from("px_channels").insert({
      name: newChannelName.trim(), type: "private", creator_id: user.id, expires_at: expiresAt,
    }).select().single();
    if (error) { toast({ title: "Erro", variant: "destructive" }); return; }
    if (data) {
      setChannels(prev => [...prev, data as PxChannel]);
      setActiveChannelId(data.id);
      const inviteUrl = `${window.location.origin}/px/convite/${data.id}`;
      navigator.clipboard?.writeText(inviteUrl);
      toast({ title: "Comboio criado!", description: `Link copiado: ${inviteUrl}` });
    }
    setShowCreateChannel(false);
    setNewChannelName("");
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const alreadyLiked = likedPosts.has(postId);
    if (alreadyLiked) {
      await supabase.from("mural_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      setLikedPosts(prev => { const n = new Set(prev); n.delete(postId); return n; });
      setMuralPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: Math.max(0, p.likes - 1) } : p));
      await supabase.from("mural_posts").update({ likes: Math.max(0, (muralPosts.find(p => p.id === postId)?.likes || 1) - 1) }).eq("id", postId);
    } else {
      await supabase.from("mural_likes").insert({ post_id: postId, user_id: user.id });
      setLikedPosts(prev => new Set(prev).add(postId));
      setMuralPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
      await supabase.from("mural_posts").update({ likes: (muralPosts.find(p => p.id === postId)?.likes || 0) + 1 }).eq("id", postId);
    }
  };

  const handleNewMuralPost = async () => {
    if (!newPostFile || !user) return;
    setUploading(true);
    try {
      const fileName = `mural/${user.id}/${Date.now()}-${newPostFile.name}`;
      const { error: upErr } = await supabase.storage.from("px-media").upload(fileName, newPostFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("px-media").getPublicUrl(fileName);
      const { data: post, error: insErr } = await supabase.from("mural_posts").insert({
        user_id: user.id, display_name: displayName, image_url: urlData.publicUrl, caption: newPostCaption,
      }).select().single();
      if (insErr) throw insErr;
      if (post) setMuralPosts(prev => [post as MuralPost, ...prev]);
      setShowNewPost(false);
      setNewPostCaption("");
      setNewPostFile(null);
      toast({ title: "Foto publicada! 📸" });
    } catch {
      toast({ title: "Erro no upload", variant: "destructive" });
    }
    setUploading(false);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-background pb-24 flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-3">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Copiloto" className="h-9 w-auto" />
          <div className="flex-1">
            <h1 className="text-lg font-black tracking-tight">PX Digital</h1>
            <p className="text-[10px] text-muted-foreground">comunicação entre parceiros</p>
          </div>
          <ConnectionIndicator />
          <HamburgerMenu />
        </div>
      </header>

      {/* Toggle */}
      <div className="px-4 pb-3">
        <div className="flex bg-secondary rounded-xl p-1">
          <button
            onClick={() => setView("radio")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
              view === "radio" ? "bg-px-orange text-px-orange-foreground" : "text-muted-foreground")}
          >
            <Radio className="w-4 h-4" /> Rádio PX
          </button>
          <button
            onClick={() => setView("mural")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
              view === "mural" ? "bg-px-orange text-px-orange-foreground" : "text-muted-foreground")}
          >
            <Image className="w-4 h-4" /> Mural Meu Bruto
          </button>
        </div>
      </div>

      {view === "radio" ? (
        <div className="flex-1 flex flex-col min-h-0 px-4">
          {/* Channel Carousel */}
          <div className="flex items-center gap-2 mb-3">
            <div ref={channelScrollRef} className="flex-1 flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannelId(ch.id)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
                    activeChannelId === ch.id
                      ? "bg-px-orange text-px-orange-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                    ch.type === "private" && "border border-warning/40"
                  )}
                >
                  {ch.type === "private" && <Lock className="w-3 h-3 inline mr-1" />}
                  {ch.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateChannel(true)}
              className="shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
              title="Criar Comboio Privado"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0 mb-3 rounded-xl bg-secondary/30 p-3">
            {messages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-10">
                Nenhuma mensagem ainda. Seja o primeiro a falar! 🎙️
              </p>
            )}
            {messages.map(msg => {
              const isMe = msg.user_id === user?.id;
              return (
                <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 space-y-1",
                    isMe ? "bg-px-orange/20 rounded-br-md" : "bg-secondary rounded-bl-md"
                  )}>
                    {!isMe && <p className="text-[10px] font-bold text-px-orange">{msg.display_name}</p>}
                    {msg.text && <p className="text-sm">{msg.text}</p>}
                    {msg.audio_url && (
                      <audio controls src={msg.audio_url} className="w-full max-w-[200px] h-8" />
                    )}
                    <p className="text-[9px] text-muted-foreground text-right">{formatTime(msg.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex items-center gap-2 pb-2">
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
              placeholder="Digite sua mensagem..."
              className="flex-1 input-field py-3"
            />
            <button onClick={sendTextMessage} disabled={!textInput.trim()}
              className="w-11 h-11 rounded-full bg-px-orange flex items-center justify-center disabled:opacity-40 transition-opacity">
              <Send className="w-5 h-5 text-px-orange-foreground" />
            </button>
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
                recording
                  ? "bg-expense animate-pulse scale-110 shadow-[0_0_25px_hsl(var(--expense)/0.5)]"
                  : "bg-px-orange hover:scale-105"
              )}
            >
              <Mic className="w-7 h-7 text-px-orange-foreground" />
            </button>
          </div>
        </div>
      ) : (
        /* MURAL VIEW */
        <div className="flex-1 px-4 overflow-y-auto space-y-4 pb-4 relative">
          {muralPosts.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <Truck className="w-16 h-16 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">Nenhuma foto no mural ainda.</p>
              <p className="text-xs text-muted-foreground/60">Seja o primeiro a mostrar seu bruto! 🚛</p>
            </div>
          )}
          {muralPosts.map(post => (
            <div key={post.id} className="gradient-card rounded-xl overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-px-orange/20 flex items-center justify-center text-xs font-bold text-px-orange">
                  {post.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{post.display_name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatTime(post.created_at)}</p>
                </div>
              </div>
              <img src={post.image_url} alt={post.caption} className="w-full aspect-square object-cover" />
              <div className="px-3 py-2 space-y-1">
                <div className="flex items-center gap-3">
                  <button onClick={() => handleLike(post.id)}
                    className={cn("flex items-center gap-1.5 transition-colors", likedPosts.has(post.id) ? "text-expense" : "text-muted-foreground hover:text-foreground")}>
                    <Heart className={cn("w-5 h-5", likedPosts.has(post.id) && "fill-current")} />
                    <span className="text-sm font-bold">{post.likes}</span>
                  </button>
                </div>
                {post.caption && (
                  <p className="text-sm"><span className="font-bold">{post.display_name}</span> {post.caption}</p>
                )}
              </div>
            </div>
          ))}

          {/* FAB */}
          <button
            onClick={() => setShowNewPost(true)}
            className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-px-orange shadow-lg flex items-center justify-center z-30 hover:scale-105 transition-transform"
          >
            <Plus className="w-7 h-7 text-px-orange-foreground" />
          </button>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowCreateChannel(false)}>
          <div className="bg-card rounded-xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><Lock className="w-5 h-5 text-warning" /> Criar Comboio Privado</h3>
              <button onClick={() => setShowCreateChannel(false)}><X className="w-5 h-5" /></button>
            </div>
            <input placeholder="Nome do comboio" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} className="input-field w-full py-3" />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Validade</p>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setNewChannelDuration(opt.value)}
                    className={cn("py-2 rounded-lg text-sm font-bold transition-all",
                      newChannelDuration === opt.value ? "bg-px-orange text-px-orange-foreground" : "bg-secondary text-muted-foreground")}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={createPrivateChannel} disabled={!newChannelName.trim()}
              className="w-full bg-px-orange text-px-orange-foreground rounded-xl py-3 font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              <Link2 className="w-4 h-4" /> Criar e Copiar Link
            </button>
          </div>
        </div>
      )}

      {/* New Mural Post Modal */}
      {showNewPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowNewPost(false)}>
          <div className="bg-card rounded-xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">📸 Nova Foto</h3>
              <button onClick={() => setShowNewPost(false)}><X className="w-5 h-5" /></button>
            </div>
            <label className="block w-full border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-px-orange/50 transition-colors">
              <Image className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{newPostFile ? newPostFile.name : "Toque para escolher uma foto"}</p>
              <input type="file" accept="image/*" className="hidden" onChange={e => setNewPostFile(e.target.files?.[0] || null)} />
            </label>
            <input placeholder="Legenda (opcional)" value={newPostCaption} onChange={e => setNewPostCaption(e.target.value)} className="input-field w-full py-3" />
            <button onClick={handleNewMuralPost} disabled={!newPostFile || uploading}
              className="w-full bg-px-orange text-px-orange-foreground rounded-xl py-3 font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {uploading ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PXDigitalPage;
