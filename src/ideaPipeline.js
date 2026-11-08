// ============================================================================
// ideaPipeline.js  (v3 — un solo prompt)
//
// Una única llamada al modelo. El único prompt del archivo es
// buildSystemPrompt(); el mensaje de usuario lleva SOLO datos (material,
// historial, plan anterior, pedido), sin instrucciones.
//
// Se mantiene la firma de runIdeaPipeline y el shape { plan, tokens, trace }.
// Parámetros aceptados pero ignorados: judgeModel, platform, trendContext,
// outliers, questionsAsked, useSearch.
// ============================================================================

// ── Config ──────────────────────────────────────────────────
const CFG = { maxOutputTokens: 16384 };

// false = el system prompt se antepone al texto (funciona con cualquier proxy).
const SYSTEM_SEPARATE = false;

const MAX_INTENTOS = 2;
const MIN_CHARS_RESPUESTA = 30;

// ── Utilidades ──────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isAbort = (e) =>
  e?.name === "AbortError" || e?.code === 20 || /aborted/i.test(e?.message ?? "");

// businessContext puede venir como string u objeto del perfil del negocio.
const formatBusinessContext = (raw) => {
  if (!raw) return null;

  if (typeof raw === "string") {
    const t = raw.trim();
    return t || null;
  }

  if (typeof raw === "object") {
    const lines = Object.entries(raw)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => {
        const val = Array.isArray(v)
          ? v.join(", ")
          : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
        return `${k.replace(/_/g, " ")}: ${val}`;
      });

    return lines.length ? lines.join("\n") : null;
  }

  return String(raw);
};

const historyBlock = (history) =>
  history.length
    ? history
        .map((m) => `${m.role === "user" ? "USUARIO" : "VIRAX"}: ${m.text}`)
        .join("\n")
    : "(primera interacción)";

// ── EL prompt ───────────────────────────────────────────────
const buildSystemPrompt = () =>
  `
Si fueras un asistente de IA que ayuda a un humano a generar un plan de acción para una idea de negocio para que su video se haga viral, ¿qué harías?

- Analizá la idea y el contexto del negocio.
- Generá un plan de acción con título, idea principal y pasos de ejecución.

`.trim();

// ── Mensaje de usuario: solo datos, cero instrucciones ──────
const buildUserMessage = ({ idea, history, lastPlan, businessContext }) => {
  const prev = lastPlan
    ? `\n<plan_anterior>\n${lastPlan.guion_texto ?? JSON.stringify(lastPlan)}\n</plan_anterior>\n`
    : "";

  return `
<material>
${businessContext ?? "(no informado)"}
</material>

<historial>
${historyBlock(history)}
</historial>
${prev}
<pedido>
${idea}
</pedido>`.trim();
};

// ── Streaming (solo texto) ──────────────────────────────────
const callGeminiStream = async (supabase, body, { onThinking, signal } = {}) => {
  const projectUrl = supabase.supabaseUrl;
  const session = await supabase.auth.getSession();
  const token = session?.data?.session?.access_token ?? "";

  const res = await fetch(`${projectUrl}/functions/v1/gemini-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabase.supabaseKey,
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    const err = new Error(`gemini-proxy stream ${res.status}: ${msg.slice(0, 200)}`);
    err.retryable = res.status >= 500 || res.status === 429 || res.status === 408;
    throw err;
  }

  if (!res.body) {
    const err = new Error("La conexión no devolvió datos. Probá de nuevo.");
    err.retryable = true;
    throw err;
  }

  let text = "";
  let tokens = 0;
  let usedSearch = false;

  const handleLine = (line) => {
    if (!line.startsWith("data:")) return;

    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    let chunk;

    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }

    if (chunk.type === "thinking" && chunk.text) {
      onThinking?.(chunk.text);
    } else if (chunk.type === "text" && chunk.text) {
      text += chunk.text;
    } else if (chunk.type === "done") {
      tokens = chunk.tokens ?? 0;
      usedSearch = chunk.usedSearch === true;
    } else if (chunk.type === "error") {
      throw new Error(chunk.message ?? "Error en el stream de Gemini");
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) handleLine(line.replace(/\r$/, ""));
  }

  buf += decoder.decode();

  if (buf.trim()) handleLine(buf.replace(/\r$/, ""));

  if (text.trim().length < MIN_CHARS_RESPUESTA) {
    const err = new Error("La IA devolvió una respuesta vacía. Probá de nuevo.");
    err.tokens = tokens;
    err.retryable = true;
    throw err;
  }

  return { text, tokens, usedSearch };
};

// ── Texto libre -> plan (sin segunda llamada al modelo) ─────
// Envuelve la respuesta en el shape que consume la UI. Los campos de
// análisis/veredicto quedan neutros porque ya no hay etapa que los genere.
const toPlan = (rawText) => {
  const clean = String(rawText ?? "").replace(/```[a-z]*|```/g, "").trim();

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const titulo = (paragraphs[0] ?? "")
    .split("\n")[0]
    .replace(/^[#>*_\-\s]+|[*_\s]+$/g, "")
    .slice(0, 100);

  return {
    tipo: "plan",
    titulo,
    idea_principal: paragraphs[0] ?? clean,
    ejecucion: paragraphs.map((descripcion) => ({ momento: "", descripcion })),
    analisis: null,
    veredicto: { nivel: "medio", razon: "" },
    pregunta_seguimiento: "",
    guion_texto: clean,
  };
};

// ── Pipeline ────────────────────────────────────────────────
export const runIdeaPipeline = async ({
  supabase,
  model,
  idea,
  history = [],
  lastPlan = null,
  businessContext: businessContextRaw = null,
  onThinking = null,
  signal = null,
}) => {
  const trace = [];
  const total = () => trace.reduce((s, t) => s + t.tokens, 0);

  const system = buildSystemPrompt();
  const userMessage = buildUserMessage({
    idea,
    history,
    lastPlan,
    businessContext: formatBusinessContext(businessContextRaw),
  });

  let lastErr = null;

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    try {
      const r = await callGeminiStream(
        supabase,
        {
          ...CFG,
          ...(intento > 0 ? { thinkingLevel: "low" } : {}),
          useSearch: false,
          model,
          ...(SYSTEM_SEPARATE ? { systemInstruction: system } : {}),
          text: (SYSTEM_SEPARATE ? "" : `${system}\n\n`) + userMessage,
        },
        { onThinking, signal }
      );

      trace.push({
        stage: intento === 0 ? "idea" : "idea_retry",
        tokens: r.tokens,
        usedSearch: r.usedSearch,
      });

      return { plan: toPlan(r.text), tokens: total(), trace };
    } catch (e) {
      trace.push({ stage: "idea_fail", tokens: e.tokens ?? 0 });
      lastErr = e;
      console.warn(`[idea] intento ${intento + 1} falló:`, e?.message);

      if (isAbort(e) || !e.retryable) break;
      await sleep(700 * (intento + 1));
    }
  }

  const err = lastErr ?? new Error("La IA no pudo generar la idea. Probá de nuevo.");
  err.tokens = total();
  throw err;
};