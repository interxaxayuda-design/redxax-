// ============================================================================
// ideaPipeline.js  (v4 — un solo prompt, salida JSON estricta)
//
// Una única llamada al modelo. El único prompt es buildSystemPrompt(), que
// incluye el formato de salida. El mensaje de usuario lleva SOLO datos.
// El resultado se parsea a { titulo, idea_principal, ejecucion[] }.
// ============================================================================

// ── Config ──────────────────────────────────────────────────
const CFG = { maxOutputTokens: 16384 };

// false = el system prompt se antepone al texto (funciona con cualquier proxy).
const SYSTEM_SEPARATE = false;

const MAX_INTENTOS = 2;
const MIN_CHARS_RESPUESTA = 30;
const MAX_PASOS = 8;

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

// ── EL prompt (tu texto + bloque de formato) ────────────────
const buildSystemPrompt = () =>
  `
Si fueras un asistente de IA que ayuda a un humano a generar un plan de acción para una idea de negocio para que su video se haga viral, ¿qué harías?

- Analizá la idea y el contexto del negocio.
- Generá un plan de acción con título, idea principal y pasos de ejecución.
- Trata que sea algo como los videos virales de ahora, no necesariamente de negocios, si no trata de tener una base de como son estos. Investiga en internet.

Respondé SOLO con un objeto JSON válido (no un array), sin texto antes ni después y sin bloques de código, con exactamente esta forma:
{
  "titulo": "string corto",
  "idea_principal": "string de 1 o 2 frases",
  "ejecucion": [
    { "momento": "rango de tiempo, ej: 0-3s", "descripcion": "qué se ve y qué se dice" }
  ]
}
Entre 3 y 6 elementos en "ejecucion". Todos los valores son strings. No agregues claves extra.
`.trim();

// ── Mensaje de usuario: solo datos, cero instrucciones ──────
const buildUserMessage = ({ idea, history, lastPlan, businessContext }) => {
  const prev = lastPlan
    ? `\n<plan_anterior>\n${JSON.stringify({
        titulo: lastPlan.titulo,
        idea_principal: lastPlan.idea_principal,
        ejecucion: lastPlan.ejecucion,
      })}\n</plan_anterior>\n`
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

// ── Parsing ─────────────────────────────────────────────────
const parseJson = (raw) => {
  if (!raw || typeof raw !== "string") return null;

  const s = raw.replace(/```json|```/g, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");

  if (a === -1 || b === -1) return null;

  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
};

const formatError = () => {
  const err = new Error("La IA devolvió un formato inesperado. Probá de nuevo.");
  err.retryable = true;
  return err;
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

// ── JSON del modelo -> plan para la UI ──────────────────────
// Si el JSON no tiene idea_principal o ejecucion, lanza error reintentable.
const toPlan = (rawText) => {
  const json = parseJson(rawText);
  const o = Array.isArray(json) ? json[0] : json;

  const ejecucion = (Array.isArray(o?.ejecucion) ? o.ejecucion : [])
    .map((e) =>
      typeof e === "string"
        ? { momento: "", descripcion: e.trim() }
        : {
            momento: String(e?.momento ?? "").trim(),
            descripcion: String(e?.descripcion ?? "").trim(),
          }
    )
    .filter((e) => e.descripcion)
    .slice(0, MAX_PASOS);

  const idea_principal = String(o?.idea_principal ?? "").trim();

  if (!idea_principal || !ejecucion.length) throw formatError();

  return {
    tipo: "plan",
    titulo: String(o.titulo ?? "").trim(),
    idea_principal,
    ejecucion,
    // Placeholders neutros: ya no hay etapa que genere análisis ni veredicto.
    analisis: null,
    veredicto: { nivel: "medio", razon: "" },
    pregunta_seguimiento: "",
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
  useSearch = true, // tu prompt dice "Investiga en internet": sin esto no busca
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
          useSearch,
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