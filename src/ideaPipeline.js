// src/viraxPipeline.js
// Conecta ChatScreen con viraxPrompt.js y la Edge Function "gemini-proxy".
//
// Contrato (lo que ChatScreen ya espera):
//   runIdeaPipeline({ supabase, model, idea, history, platform, lastPlan, signal, onThinking })
//     → { plan, tokens }
//   Los errores pueden traer err.tokens (ChatScreen los suma al límite de sesión).

import { buildChatRequest, parsePlan } from "./viraxPrompt.js";

const PROXY_FN = "gemini-proxy";

const PLATFORM_LABELS = {
  tiktok: "TikTok",
  reels: "Instagram Reels",
  shorts: "YouTube Shorts",
};

const estimateTokens = (s) => Math.ceil(String(s ?? "").length / 4);

// ── Último plan completo ─────────────────────────────────────
// ChatScreen resume los planes viejos en una línea ("(Plan entregado: …)").
// Para iterar ("hazlo más corto") el modelo necesita el último plan completo.
const slimPlan = (p) => ({
  titulo: p.titulo,
  idea_principal: p.idea_principal,
  ejecucion: (p.ejecucion ?? []).map(({ momento, descripcion }) => ({ momento, descripcion })),
});

const withLastPlan = (history, lastPlan) => {
  if (!lastPlan?.idea_principal) return history;
  const json = JSON.stringify(slimPlan(lastPlan));
  const idx = history.findLastIndex((m) => m.role !== "user");
  if (idx === -1) return [...history, { role: "bot", text: json }];
  return history.map((m, i) => (i === idx ? { ...m, text: json } : m));
};

// ── Parser del stream ────────────────────────────────────────
// Acepta SSE estilo Gemini:  data: {"candidates":[{"content":{"parts":[{"text","thought"}]}}]}
// Si el proxy devuelve texto plano, usa el texto completo como respuesta.
function createStreamParser(onThinking) {
  let buffer = "";
  let raw = "";
  let answer = "";
  let sawSSE = false;
  let tokens = 0;

  const handleEvent = (evt) => {
    const usage = evt?.usageMetadata;
    if (usage?.totalTokenCount) tokens = usage.totalTokenCount;
    const parts = evt?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (typeof part?.text !== "string" || !part.text) continue;
      if (part.thought) onThinking?.(part.text);
      else answer += part.text;
    }
  };

  const handleLine = (line) => {
    const l = line.trim();
    if (!l.startsWith("data:")) return;
    sawSSE = true;
    const data = l.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      handleEvent(JSON.parse(data));
    } catch {
      /* evento parcial o no-JSON */
    }
  };

  return {
    push(chunk) {
      raw += chunk;
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      lines.forEach(handleLine);
    },
    end() {
      if (buffer) handleLine(buffer);
      return { answer: sawSSE ? answer : raw, tokens };
    },
  };
}

async function readStream(stream, parser, signal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
  } finally {
    reader.cancel().catch(() => {});
  }
}

// ── Llamada al proxy ─────────────────────────────────────────
// supabase.functions.invoke devuelve: Response (si es text/event-stream),
// string (texto plano), Blob o un objeto (JSON). Se cubren todos.
async function callProxy(supabase, body, { signal, onThinking }) {
  const { data, error } = await supabase.functions.invoke(PROXY_FN, { body, signal });
  if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
  if (error) throw error; // mensaje "non-2xx…" → friendlyError de ChatScreen lo traduce

  const parser = createStreamParser(onThinking);

  if (data instanceof Response && data.body) await readStream(data.body, parser, signal);
  else if (data instanceof ReadableStream) await readStream(data, parser, signal);
  else if (data instanceof Blob) parser.push(await data.text());
  else if (typeof data === "string") parser.push(data);
  else if (data && typeof data === "object") {
    const text = typeof data.text === "string" ? data.text : JSON.stringify(data);
    return { answer: text, tokens: Number(data.tokens ?? data.usage?.totalTokens) || 0 };
  } else {
    throw new Error("Respuesta vacía del proxy");
  }
  return parser.end();
}

// ── API pública ──────────────────────────────────────────────
export async function runIdeaPipeline({
  supabase,
  model,
  idea,
  history = [],
  platform = "tiktok",
  lastPlan = null,
  signal,
  onThinking,
}) {
  const body = {
    ...buildChatRequest({
      idea,
      history: withLastPlan(history, lastPlan),
      plataforma: PLATFORM_LABELS[platform], // undefined → default de buildUserMessage
    }),
    ...(model ? { model } : {}),
  };

  const inputTokens = estimateTokens(body.systemInstruction + body.text);
  let tokens = 0;

  // Máx. 2 intentos, SOLO si la respuesta llegó pero no valida.
  // Errores de red/HTTP/cancelación suben directo (no se reintenta un 402).
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await callProxy(supabase, body, {
        signal,
        onThinking: attempt === 0 ? onThinking : undefined, // el reintento no duplica el pensamiento en la UI
      });
    } catch (err) {
      if (tokens && err && typeof err === "object") err.tokens = tokens;
      throw err;
    }

    tokens += res.tokens || inputTokens + estimateTokens(res.answer);

    try {
      return { plan: parsePlan(res.answer), tokens };
    } catch (err) {
      console.warn(`[viraxPipeline] intento ${attempt + 1} inválido: ${err.message}`, res.answer.slice(0, 300));
    }
  }

  const err = new Error("La IA devolvió un formato inesperado. Inténtalo de nuevo.");
  err.tokens = tokens;
  throw err;
}