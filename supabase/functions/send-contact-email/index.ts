import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_EMAIL = "contato.copiloto@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { subject_type, message } = await req.json();

    if (!subject_type || !message?.trim()) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
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
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
