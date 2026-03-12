import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Heart, Truck, Plus, Send, X, Loader2, Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface MuralPost {
  id: string;
  user_id: string;
  display_name: string;
  image_url: string;
  caption: string;
  likes: number;
  created_at: string;
}

interface FeedDoTrechoProps {
  posts: MuralPost[];
  setPosts: React.Dispatch<React.SetStateAction<MuralPost[]>>;
  likedPosts: Set<string>;
  setLikedPosts: React.Dispatch<React.SetStateAction<Set<string>>>;
  userId?: string;
  displayName: string;
  activeChannelName?: string;
}

const FeedDoTrecho = ({
  posts,
  setPosts,
  likedPosts,
  setLikedPosts,
  userId,
  displayName,
  activeChannelName,
}: FeedDoTrechoProps) => {
  const [showNew, setShowNew] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const handleLike = async (postId: string) => {
    if (!userId) return;
    const liked = likedPosts.has(postId);
    if (liked) {
      await supabase.from("mural_likes").delete().eq("post_id", postId).eq("user_id", userId);
      setLikedPosts((p) => { const n = new Set(p); n.delete(postId); return n; });
      setPosts((p) => p.map((x) => x.id === postId ? { ...x, likes: Math.max(0, x.likes - 1) } : x));
      await supabase.rpc("increment_post_likes" as any, { post_id: postId, amount: -1 });
    } else {
      await supabase.from("mural_likes").insert({ post_id: postId, user_id: userId });
      setLikedPosts((p) => new Set(p).add(postId));
      setPosts((p) => p.map((x) => x.id === postId ? { ...x, likes: x.likes + 1 } : x));
      await supabase.rpc("increment_post_likes" as any, { post_id: postId, amount: 1 });
    }
  };

  const handlePost = async () => {
    if (!file || !userId) return;
    setUploading(true);
    try {
      const fileName = `mural/${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("px-media").upload(fileName, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("px-media").getPublicUrl(fileName);
      const { data: post, error } = await supabase.from("mural_posts").insert({
        user_id: userId, display_name: displayName, image_url: urlData.publicUrl, caption,
      }).select().single();
      if (error) throw error;
      if (post) setPosts((p) => [post as MuralPost, ...p]);
      setShowNew(false);
      setCaption("");
      setFile(null);
      toast({ title: "Foto publicada! 📸" });
    } catch {
      toast({ title: "Erro no upload", variant: "destructive" });
    }
    setUploading(false);
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3 relative">
      {/* Mini PX indicator */}
      {activeChannelName && (
        <div
          className="sticky top-0 z-10 flex items-center gap-2 py-1.5 px-3 rounded-lg mx-auto w-fit"
          style={{
            background: "hsl(220 15% 8% / 0.9)",
            border: "1px solid hsl(220 12% 18%)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="text-[9px] font-mono" style={{ color: "hsl(142 60% 50%)" }}>🔊</span>
          <span className="text-[9px] font-mono tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>
            {activeChannelName.toUpperCase()}
          </span>
        </div>
      )}

      {posts.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Truck className="w-16 h-16 mx-auto" style={{ color: "hsl(220 10% 20%)" }} />
          <p className="text-sm font-mono" style={{ color: "hsl(220 10% 35%)" }}>
            Nenhuma foto no trecho.
          </p>
        </div>
      )}

      {posts.map((post) => (
        <div
          key={post.id}
          className="rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, hsl(220 15% 10%), hsl(220 18% 8%))",
            border: "1px solid hsl(220 12% 14%)",
          }}
        >
          <div className="px-3 py-2 flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono"
              style={{ background: "hsl(30 100% 50% / 0.15)", color: "hsl(30 100% 55%)" }}
            >
              {post.display_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{post.display_name}</p>
              <p className="text-[10px] text-muted-foreground">{formatTime(post.created_at)}</p>
            </div>
          </div>
          <img src={post.image_url} alt={post.caption} className="w-full aspect-square object-cover" />
          <div className="px-3 py-2 space-y-1">
            <button
              onClick={() => handleLike(post.id)}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                likedPosts.has(post.id) ? "text-expense" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Heart className={cn("w-5 h-5", likedPosts.has(post.id) && "fill-current")} />
              <span className="text-sm font-bold">{post.likes}</span>
            </button>
            {post.caption && (
              <p className="text-sm">
                <span className="font-bold">{post.display_name}</span> {post.caption}
              </p>
            )}
          </div>
        </div>
      ))}

      {/* FAB */}
      <button
        onClick={() => setShowNew(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 transition-transform"
        style={{
          background: "radial-gradient(circle at 45% 40%, hsl(30 100% 55%), hsl(24 100% 42%))",
          boxShadow: "0 4px 15px hsl(24 100% 50% / 0.3)",
        }}
      >
        <Plus className="w-7 h-7 text-white" />
      </button>

      {/* New Post Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setShowNew(false)}>
          <div className="bg-card rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">📸 Nova Foto</h3>
              <button onClick={() => setShowNew(false)}><X className="w-5 h-5" /></button>
            </div>
            <label className="block w-full border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-px-orange/50 transition-colors">
              <Image className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{file ? file.name : "Toque para escolher"}</p>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <input placeholder="Legenda (opcional)" value={caption} onChange={(e) => setCaption(e.target.value)} className="input-field w-full py-3" />
            <button
              onClick={handlePost}
              disabled={!file || uploading}
              className="w-full bg-px-orange text-px-orange-foreground rounded-xl py-3 font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {uploading ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedDoTrecho;
