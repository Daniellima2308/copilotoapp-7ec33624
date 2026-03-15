import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_EMAIL = "contato.copiloto@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject_type, message } = await req.json();

    if (!subject_type || !message?.trim()) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store in database
    if (subject_type === "Sugestão") {
      await supabase.from("suggestions").insert({ user_id: user.id, suggestion: `[${subject_type}] ${message.trim()}` });
    } else {
      await supabase.from("support_messages").insert({ user_id: user.id, message: `[${subject_type}] ${message.trim()}` });
    }

    // Build mailto fallback URL for the frontend
    const mailtoSubject = encodeURIComponent(`[Copiloto - ${subject_type}] de ${user.email}`);
    const mailtoBody = encodeURIComponent(
      `Tipo: ${subject_type}\nDe: ${user.email}\n\nMensagem:\n${message.trim()}`
    );
    const mailtoUrl = `mailto:${ADMIN_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`;

    return new Response(
      JSON.stringify({ success: true, mailto_url: mailtoUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
