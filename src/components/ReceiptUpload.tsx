import { useState, useRef } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "@/hooks/use-toast";
import { isOnline } from "@/lib/offlineQueue";

interface ReceiptUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
}

export function ReceiptUpload({ value, onChange }: ReceiptUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máximo 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImage(file);

      if (!isOnline()) {
        // Store as base64 for offline
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
          toast({ title: "📷 Recibo salvo localmente", description: "Será enviado para a nuvem quando houver sinal." });
        };
        reader.readAsDataURL(compressed);
        setUploading(false);
        return;
      }

      const ext = "jpg";
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("receipts").upload(filePath, compressed, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(filePath);
      onChange(urlData.publicUrl);
      toast({ title: "Recibo anexado com sucesso!" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha no upload.";
      toast({ title: "Erro no upload", description: message, variant: "destructive" });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="Recibo" className="w-20 h-20 rounded-lg object-cover border border-border" />
          <button type="button" onClick={() => onChange(undefined)}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-expense flex items-center justify-center">
            <X className="w-3 h-3 text-expense-foreground" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-xs">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {uploading ? "Enviando..." : "📷 Anexar Recibo (Opcional)"}
        </button>
      )}
    </div>
  );
}
