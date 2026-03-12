import { supabase } from "@/integrations/supabase/client";

function isDataUrl(value: string): boolean {
  return value.startsWith("data:");
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

function getFileExtensionFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export async function resolveReceiptUrl(userId: string, receiptUrl?: string | null): Promise<string | null> {
  if (!receiptUrl) return null;
  if (!isDataUrl(receiptUrl)) return receiptUrl;

  const mimeMatch = receiptUrl.match(/^data:([^;]+);base64,/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const ext = getFileExtensionFromMime(mime);

  const blob = await dataUrlToBlob(receiptUrl);
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(filePath, blob, { upsert: false, contentType: mime });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("receipts").getPublicUrl(filePath);
  return data.publicUrl;
}
