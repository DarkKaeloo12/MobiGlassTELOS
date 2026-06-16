import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://mobiglass-telos.com",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ valid: false, error: "Pseudo manquant" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch la page RSI du joueur
    const url = `https://robertsspaceindustries.com/citizens/${encodeURIComponent(username)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (res.status === 404) {
      return new Response(JSON.stringify({ valid: false, error: "Profil RSI introuvable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await res.text();

    // Cherche TELOS COVENANT dans le HTML
    const isMember = html.includes("TELOS") && html.includes("COVENANT");

    // Extrait le nom exact affiché sur RSI
    const handleMatch = html.match(/<div class="info">\s*<p class="entry"><span class="label">Handle name<\/span><span class="value">([^<]+)<\/span>/);
    const handle = handleMatch ? handleMatch[1].trim() : username;

    return new Response(
      JSON.stringify({
        valid: isMember,
        handle,
        error: isMember ? null : "Vous n'êtes pas membre de TELOS COVENANT sur RSI",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    return new Response(JSON.stringify({ valid: false, error: "Erreur serveur" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
