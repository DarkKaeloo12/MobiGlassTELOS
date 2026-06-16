import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://mobiglass-telos.com",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Récupère tous les joueurs approuvés
    const { data: store } = await supabase
      .from("telos_store")
      .select("value")
      .eq("key", "uex-players")
      .single();

    if (!store) {
      return new Response(JSON.stringify({ error: "Aucun joueur trouvé" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const players = JSON.parse(store.value);
    const approved = players.filter((p: any) => p.status === "approved");

    const results = { suspended: [] as string[], ok: [] as string[], errors: [] as string[] };
    const DISCORD_WEBHOOK = Deno.env.get("DISCORD_WEBHOOK_URL");

    for (const player of approved) {
      if (!player.rsi_handle) continue;

      try {
        // Vérifie le membre via verify-rsi
        const res = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-rsi`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: player.rsi_handle }),
          }
        );
        const data = await res.json();

        if (!data.valid) {
          // Suspend le joueur
          player.status = "suspended";
          player.suspendedAt = new Date().toISOString();
          player.suspendReason = data.error || "Non membre TELOS";
          results.suspended.push(player.name);
        } else {
          results.ok.push(player.name);
        }
      } catch {
        results.errors.push(player.name);
      }

      // Pause pour ne pas spammer RSI
      await new Promise(r => setTimeout(r, 1500));
    }

    // Sauvegarde les joueurs mis à jour
    await supabase
      .from("telos_store")
      .update({ value: JSON.stringify(players) })
      .eq("key", "uex-players");

    // Notification Discord si suspensions
    if (results.suspended.length > 0 && DISCORD_WEBHOOK) {
      await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "⚠️ Suspension automatique — MobiGlass TELOS",
            description: `${results.suspended.length} joueur(s) suspendu(s) car non membres de TELOS COVENANT sur RSI.`,
            color: 0xff4444,
            fields: [
              { name: "🔴 Suspendus", value: results.suspended.join(", ") || "—", inline: false },
              { name: "✅ Vérifiés OK", value: `${results.ok.length} joueur(s)`, inline: true },
            ],
            footer: { text: "MobiGlass TELOS — Vérification automatique RSI" },
            timestamp: new Date().toISOString(),
          }]
        }),
      });
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});