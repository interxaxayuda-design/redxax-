import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────
// Costos fijos por motivo — validados SIEMPRE del lado del
// servidor. El frontend puede mandar cualquier "amount", pero
// acá se ignora y se usa el expectedAmount definido abajo.
// Esto evita que alguien manipule el cliente para pagar menos.
// ─────────────────────────────────────────────────────────────
function getExpectedAmount(reason: string): number | null {
  if (reason === "script") return 50;
  if (reason?.startsWith("video:")) return 100;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId, amount, reason } = await req.json();

    if (!userId || !reason) {
      return new Response(
        JSON.stringify({ error: "Faltan datos (userId o reason)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expectedAmount = getExpectedAmount(reason);
    if (expectedAmount === null) {
      return new Response(
        JSON.stringify({ error: "Motivo inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amount !== expectedAmount) {
      return new Response(
        JSON.stringify({ error: "Monto inválido", expected: expectedAmount, received: amount }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Leer balance actual
    const { data, error } = await supabase
      .from("user_gems")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data.balance < expectedAmount) {
      return new Response(
        JSON.stringify({ success: false, error: "Saldo insuficiente", balance: data.balance }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newBalance = data.balance - expectedAmount;

    const { error: updateError } = await supabase
      .from("user_gems")
      .update({ balance: newBalance })
      .eq("user_id", userId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Error actualizando balance", detail: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, newBalance }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("deduct-gems: FATAL ERROR", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});