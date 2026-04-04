import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseFromHeader(from: string): { name: string; email: string } {
  const trimmed = from.trim();
  const m = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) {
    return { name: m[1].trim().replace(/^["']|["']$/g, ""), email: m[2].trim() };
  }
  return { name: "SAPAS", email: trimmed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const to = typeof body.email === "string" ? body.email.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const html = typeof body.html === "string" ? body.html : "";

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing email, subject, or html" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "BREVO_API_KEY is not set. Add it in Supabase → Project Settings → Edge Functions → Secrets.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const fromRaw = Deno.env.get("EMAIL_FROM")?.trim();
    if (!fromRaw) {
      return new Response(
        JSON.stringify({
          error:
            'Set EMAIL_FROM to a Brevo-verified sender, e.g. SAPAS <you@example.com>',
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { name, email } = parseFromHeader(fromRaw);

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name, email },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = (await res.json()) as { message?: string };
        if (err.message) msg = err.message;
      } catch {
        /* ignore */
      }
      console.error("Brevo error:", msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("send-email:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
