import "@supabase/functions-js/edge-runtime.d.ts";

console.log("Starting gemini-proxy (REDxax Vision)");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function callLLMWithLogging(url: string, options: RequestInit) {
  console.log("--- DEBUG START ---");
  try {
    const resp = await fetch(url, options);
    const text = await resp.text();
    console.log("LLM status:", resp.status, "| preview:", text.slice(0, 500));

    try {
      const json = JSON.parse(text);
      const finishReason = json?.candidates?.[0]?.finishReason ?? null;
      if (finishReason === "MAX_TOKENS") {
        console.warn("⚠️ Respuesta cortada por MAX_TOKENS.");
      }
      return { ok: resp.ok, status: resp.status, json, raw: text };
    } catch {
      console.error("JSON.parse failed, intentando rescate por regex...");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const json2 = JSON.parse(match[0]);
          return { ok: resp.ok, status: resp.status, json: json2, raw: text };
        } catch {
          console.error("Rescate por regex también falló.");
        }
      }
      return { ok: resp.ok, status: resp.status, error: "invalid_llm_response", raw: text };
    }
  } catch (err) {
    console.error("Error de red llamando a LLM:", err);
    return { ok: false, error: "fetch_error", detail: String(err) };
  } finally {
    console.log("--- DEBUG END ---");
  }
}

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const apiKey = Deno.env.get("GEN_API_KEY") || "";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing_gen_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET /list-models ──────────────────────────────────────────────────────
    if (url.pathname.endsWith("/list-models")) {
      const listModelsUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
      const result = await callLLMWithLogging(listModelsUrl, { method: "GET" });
      return new Response(JSON.stringify(result.ok ? result.json : result), {
        status: result.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST (análisis principal) ─────────────────────────────────────────────
    if (req.method === "POST") {
      // Modelo: usá la variable de entorno MODEL_ID en Supabase,
      // o el fallback gemini-2.0-flash-001 que soporta grounding + v1beta
      const modelId = Deno.env.get("MODEL_ID") || "models/gemini-2.0-flash-001";

      const incoming = await req.json().catch(() => null);
      if (!incoming) {
        return new Response(JSON.stringify({ error: "invalid_request_body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Armar parts: texto + frames opcionales
      const parts: any[] = [
        { text: incoming.text ?? "Analiza este contenido para REDxax Vision" },
      ];

      if (incoming.frames && Array.isArray(incoming.frames)) {
        incoming.frames.forEach((base64Data: string) => {
          if (typeof base64Data === "string" && base64Data.length > 0) {
            parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
          }
        });
      }

      // maxOutputTokens: respeta lo que mande el frontend, default 8192
      const maxOutputTokens =
        typeof incoming.maxOutputTokens === "number" && incoming.maxOutputTokens > 0
          ? incoming.maxOutputTokens
          : 8192;

      const temperature =
        typeof incoming.temperature === "number" ? incoming.temperature : 0.2;

      console.log(
        `📤 Gemini | modelo: ${modelId} | maxTokens: ${maxOutputTokens} | ` +
        `temp: ${temperature} | frames: ${incoming.frames?.length ?? 0}`
      );

      // v1beta requerido para Google Search Grounding
      const genUrl = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts }],
        generationConfig: { maxOutputTokens, temperature },
        tools: [{ googleSearch: {} }], // Search Grounding activado
      };

      const result = await callLLMWithLogging(genUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        const errBody = {
          error: "llm_error",
          llm_status: result.status ?? null,
          message: result.error ?? null,
          raw: result.raw ?? null,
        };
        console.error("LLM error:", errBody);
        return new Response(JSON.stringify(errBody), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const finishReason = result.json?.candidates?.[0]?.finishReason ?? "UNKNOWN";
      if (finishReason === "MAX_TOKENS") {
        console.warn("⚠️ Respuesta cortada — subí maxOutputTokens o simplificá el prompt.");
      } else {
        console.log(`✅ finishReason: ${finishReason}`);
      }

      return new Response(JSON.stringify(result.json), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Default ───────────────────────────────────────────────────────────────
    return new Response(JSON.stringify({ message: "REDxax Vision API Online ✅" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error global:", err);
    return new Response(JSON.stringify({ error: "internal", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

