// ============================================================================
// ideaPipeline.js  (v5 — un solo prompt, salida JSON estricta)
//
// Una única llamada al modelo. El único prompt es SYSTEM_PROMPT. El mensaje de
// usuario lleva SOLO datos. El resultado se parsea a { titulo, idea_principal,
// ejecucion[] } y se adapta al formato que espera ChatScreen.
// ============================================================================

// ── Config ──────────────────────────────────────────────────
const CFG = { maxOutputTokens: 16384 };

// false = el system prompt se antepone al texto (funciona con cualquier proxy).
const SYSTEM_SEPARATE = false;

// true = pide al proxy responseMimeType "application/json" (solo se envía
// cuando useSearch es false, porque Gemini no permite JSON mode con búsqueda).
// Si tu gemini-proxy rechaza ese campo, ponelo en false.
const JSON_MODE = true;

const MAX_INTENTOS = 2;
const MIN_CHARS_RESPUESTA = 30;
const MAX_PASOS = 8;

const PLATFORM_LABELS = {
  tiktok: "TikTok",
  reels: "Instagram Reels",
  shorts: "YouTube Shorts",
};

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

const historyBlock = (history = []) =>
  history.length
    ? history
        .map((m) => `${m.role === "user" ? "USUARIO" : "VIRAX"}: ${m.text}`)
        .join("\n")
    : "(primera interacción)";

// Versión compacta del plan anterior (para no gastar tokens de más).
const compactPlan = (plan) => {
  if (!plan) return null;
  return JSON.stringify({
    titulo: plan.titulo,
    idea_principal: plan.idea_principal,
    ejecucion: plan.ejecucion,
  });
};

// ── Prompt (estático → va primero y es cacheable) ───────────
const SYSTEM_PROMPT = `
Lee esto con atención: 
"1. Generadores de hooks de texto
Son los más comunes. Vos ponés tu tema y te devuelven 10-20 frases de apertura.

Cómo lo hacen:

Vos ingresás: tema, nicho, a quién le hablás, qué vendés / enseñás, y a veces el guion que ya tenés.
La app aplica fórmulas probadas: no inventa de cero. Usa más de 50 fórmulas que se repiten en videos virales, como afirmación audaz, dolor identificable, "antes/después", error común, curiosidad abierta, prueba rápida, etc. 
Un modelo de IA completa la fórmula: por ejemplo, toma la fórmula "Nadie te dice esto sobre [tema], pero..." y la adapta a tu tema, tu tono y tu plataforma.
Te explica por qué funciona: cada opción viene con la razón psicológica, por ejemplo "genera tensión rápida" o "primero el resultado, luego el cómo". 
En TikTok suelen ser más cortos y directos, 1-2 segundos, y en Reels un poco más visuales, 1-3 segundos, con subtítulos o lista de pasos. 

Ejemplo de flujo:

Tema: "cómo ahorrar en Berisso" -> Fórmula: Error común -> Hook: "Estás pagando de más en el súper por estos 3 errores"

2. Creadores de hooks visuales con IA
Estos no solo te dan la frase, te crean el video del gancho.

Cómo lo hacen:

Modo UGC: escribís un guion, elegís un avatar y la app genera un video de una persona hablando tu gancho, sin que grabes vos. 
Modo Visual Hook Maker: subís un video que ya tenés y la app le agrega al inicio un efecto en tendencia, texto animado, zoom, o una introducción visual que detiene el scroll. 
Usan texto a video: convertís una indicación de texto en un video corto para TikTok, Reels, anuncios o demostración de producto. 
Acá el "cómo" es más técnico: el modelo analiza tu video, detecta dónde cortar, agrega captions, música, efectos y genera el avatar con voz sincronizada con los labios.

3. Bibliotecas de hooks transicionales
Son apps tipo Transitional Hooks. No usan IA para escribir, son una biblioteca de introducciones listas.

Cómo lo hacen:

Tienen cientos de clips cortos animados: gráficos, efectos de sonido, cortes rápidos, transiciones.
Vos descargás el gancho que te gusta, lo importás en CapCut, Premiere o tu editor, y lo ponés al principio de tu video. 
La idea es conectar segmentos sin que se sienta cortado, y que se vea pulido y profesional. 
Entonces, ¿qué pasa "por detrás"?
En resumen, la mayoría combina 3 cosas:

Base de datos de patrones virales: qué frases, estructuras y efectos retienen más en cada plataforma.
Tu input como contexto: sin eso, el hook es genérico y no vende.
IA generativa: para adaptar la fórmula a tu tema, o para crear el video/avatar.
Algunas más avanzadas dicen usar ciencia cognitiva para generar ganchos que no dependan de la suerte, sino de cómo funciona la atención. 

Lo que NO hacen
No te garantizan viralidad. El hook te da el clic, pero si el resto del video no cumple la promesa del hook, la gente se va y el algoritmo te castiga.
No conocen a tu audiencia mejor que vos. Si les das un tema vago, te dan hooks vagos"


Una vez que hayas leído esto con atención, generá un plan de ejecución para la idea que el usuario te dará.
`.trim();

const buildSystemPrompt = () => SYSTEM_PROMPT;

// El mensaje de usuario lleva SOLO datos.
const buildUserMessage = ({
  idea,
  history = [],
  platform = "TikTok/Reels",
  duracionS = 30,
  businessContext = null,
  lastPlan = null,
}) => {
  const negocio = businessContext ? `<negocio>\n${businessContext}\n</negocio>\n` : "";
  const previo = lastPlan ? `<plan_anterior>\n${compactPlan(lastPlan)}\n</plan_anterior>\n` : "";

  return `<contexto>
<plataforma>${platform}</plataforma>
<duracion_objetivo_s>${duracionS}</duracion_objetivo_s>
${negocio}${previo}<historial>
${historyBlock(history)}
</historial>
</contexto>
<idea_del_usuario>
${idea}
</idea_del_usuario>`;
};

// ── Parsing ─────────────────────────────────────────────────
// Tolera bloques de código, texto antes/después y arrays con un objeto.
const parseJson = (raw) => {
  if (!raw || typeof raw !== "string") return null;

  const s = raw.replace(/```(?:json)?/gi, "").trim();

  try {
    return JSON.parse(s);
  } catch {
    /* sigue */
  }

  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a !== -1 && b > a) {
    try {
      return JSON.parse(s.slice(a, b + 1));
    } catch {
      /* sigue */
    }
  }

  const c = s.indexOf("[");
  const d = s.lastIndexOf("]");
  if (c !== -1 && d > c) {
    try {
      return JSON.parse(s.slice(c, d + 1));
    } catch {
      /* sigue */
    }
  }

  return null;
};

const formatError = (rawText = "") => {
  const err = new Error("La IA devolvió un formato inesperado. Probá de nuevo.");
  err.retryable = true;
  err.raw = rawText;
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
// Valida la estructura. Si falta idea_principal o ejecucion, lanza un error
// reintentable que lleva la respuesta cruda para poder diagnosticar.
const toPlan = (rawText) => {
  const json = parseJson(rawText);
  const o = Array.isArray(json) ? json[0] : json;

  if (!o || typeof o !== "object") {
    console.warn("[idea] sin JSON en la respuesta:", String(rawText).slice(0, 600));
    throw formatError(rawText);
  }

  const ejecucion = (Array.isArray(o.ejecucion) ? o.ejecucion : [])
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

  const idea_principal = String(o.idea_principal ?? "").trim();

  if (!idea_principal || !ejecucion.length) {
    console.warn("[idea] JSON incompleto:", String(rawText).slice(0, 600));
    throw formatError(rawText);
  }

  return {
    tipo: "plan",
    titulo: String(o.titulo ?? "").trim(),
    idea_principal,
    ejecucion,
    // Sin etapa de análisis ni veredicto: null para que la UI no dibuje esas tarjetas.
    analisis: null,
    veredicto: null,
    pregunta_seguimiento: "",
  };
};

// ── Pipeline ────────────────────────────────────────────────
export const runIdeaPipeline = async ({
  supabase,
  model,
  idea,
  history = [],
  platform = "tiktok", // id ("tiktok" | "reels" | "shorts") o texto libre
  duracionS = 30,
  lastPlan = null,
  businessContext: businessContextRaw = null,
  onThinking = null,
  signal = null,
  // Con búsqueda activa Gemini no admite JSON mode y tiende a responder en prosa.
  // Dejalo en false salvo que realmente necesites datos de internet.
  useSearch = false,
}) => {
  const trace = [];
  const total = () => trace.reduce((s, t) => s + (t.tokens || 0), 0);

  const system = buildSystemPrompt();
  const userMessage = buildUserMessage({
    idea,
    history,
    platform: PLATFORM_LABELS[platform] ?? platform,
    duracionS,
    lastPlan,
    businessContext: formatBusinessContext(businessContextRaw),
  });

  let lastErr = null;

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const recordatorio =
      intento > 0
        ? "\n\nRECORDATORIO: respondé SOLO con el objeto JSON, sin texto adicional ni bloques de código."
        : "";

    try {
      const r = await callGeminiStream(
        supabase,
        {
          ...CFG,
          ...(intento > 0 ? { thinkingLevel: "low" } : {}),
          useSearch,
          ...(JSON_MODE && !useSearch ? { responseMimeType: "application/json" } : {}),
          model,
          ...(SYSTEM_SEPARATE ? { systemInstruction: system } : {}),
          text: (SYSTEM_SEPARATE ? "" : `${system}\n\n`) + userMessage + recordatorio,
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