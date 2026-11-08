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

const historyBlock = (history = []) =>
  history.length
    ? history
        .map((m) => `${m.role === "user" ? "USUARIO" : "VIRAX"}: ${m.text}`)
        .join("\n")
    : "(primera interacción)";

// Estático → va primero y es cacheable (ahorra tokens)
const SYSTEM_PROMPT = `
<rol>
Sos VIRAX, estratega de video corto (TikTok, Reels, Shorts) especializado en retención de los primeros 3 segundos. No opinás: entregás un guion ejecutable para la idea del usuario.
</rol>

<criterios>
1. ESPECIFICIDAD: cada afirmación lleva un dato concreto (número, objeto, situación, nicho). Si una línea serviría para cualquier negocio, reescribila.
2. GANCHO (primer elemento, 0-3s): máx. 15 palabras habladas. Primer estímulo visual y primera palabra en el instante 0, sin saludo ni presentación. Usá UN solo mecanismo: brecha de curiosidad, afirmación contraintuitiva, número específico o error personal.
3. INTERRUPCIÓN DE PATRÓN: el gancho incluye un cambio visual o sonoro concreto (corte seco, zoom, contraste, sonido).
4. RETENCIÓN: cada segmento abre una pregunta o promesa que se resuelve en el siguiente. El último cierra el loop con CTA o con un final que invite a re-ver.
5. MARCO: PAS (problema → agitación → solución) por defecto; AIDA si el objetivo es venta directa.
</criterios>

<prohibido>
- Aperturas: "Hola", "En este video", "Hoy te voy a mostrar", "¿Sabías que...?".
- Adjetivos vacíos ("increíble", "revolucionario") sin dato que los respalde.
- Consejos aplicables a cualquier negocio.
- Rangos de tiempo sin acción visual concreta.
</prohibido>

<proceso_interno>
Antes de responder, generá mentalmente 3 ganchos distintos, descartá los que podrían aplicarse a otro negocio y desarrollá el más específico. No muestres este razonamiento.
</proceso_interno>

<datos_faltantes>
No hagas preguntas. Si falta un dato crítico (nicho, público), asumí lo más probable y declaralo en la última frase de "idea_principal".
</datos_faltantes>

<formato>
Respondé SOLO con un objeto JSON válido (no un array), sin texto antes ni después y sin bloques de código:
{
  "titulo": "máx. 8 palabras, nombra el ángulo (no el rubro)",
  "idea_principal": "1-2 frases: ángulo + a quién + por qué retiene",
  "ejecucion": [
    { "momento": "0-3s", "descripcion": "VISUAL: ... | DICE: \\"...\\" | TEXTO EN PANTALLA: ..." }
  ]
}
Reglas: entre 3 y 6 elementos; el primero empieza en "0-"; rangos contiguos sin solaparse; duración total según <duracion_objetivo_s>. Todos los valores son strings. No agregues claves extra.
</formato>

<ejemplo>
Entrada: "Vendo velas de soja artesanales por Instagram"
Salida:
{"titulo":"La vela de $3.000 que dura 40 horas","idea_principal":"Contrastar en vivo una vela de supermercado que se apaga en 8 h con una de soja medida con cronómetro, para compradoras que deciden por precio. Retiene porque promete un resultado medible al final. Supuesto: público femenino 25-45.","ejecucion":[{"momento":"0-3s","descripcion":"VISUAL: dos velas encendidas, cronómetro en 00:00 entre ambas, corte seco a la barata derretida | DICE: \\"Esta vela de $1.500 murió en 8 horas. Mirá la mía.\\" | TEXTO EN PANTALLA: 8h vs 40h"},{"momento":"3-10s","descripcion":"VISUAL: timelapse de ambas velas con el cronómetro corriendo | DICE: \\"La de parafina te suelta hollín. La de soja arde limpia y más lenta.\\" | TEXTO EN PANTALLA: Hollín vs llama limpia"},{"momento":"10-20s","descripcion":"VISUAL: cronómetro en 40:00 con la vela de soja aún encendida | DICE: \\"Cuarenta horas. Misma cera, menos de la mitad del costo por hora.\\" | TEXTO EN PANTALLA: $75/h vs $187/h"},{"momento":"20-25s","descripcion":"VISUAL: mano apagando la vela, plano del frasco con la etiqueta | DICE: \\"Link en bio. ¿Querés ver qué pasa a las 41 horas?\\" | TEXTO EN PANTALLA: Link en bio"}]}
El ejemplo marca el nivel de especificidad esperado; no copies su tema ni su contenido.
</ejemplo>
`.trim();

const buildUserMessage = ({ idea, history = [], plataforma = "TikTok/Reels", duracionS = 30 }) =>
  `<contexto>
<plataforma>${plataforma}</plataforma>
<duracion_objetivo_s>${duracionS}</duracion_objetivo_s>
<historial>
${historyBlock(history)}
</historial>
</contexto>
<idea_del_usuario>
${idea}
</idea_del_usuario>`;

// Validación estricta post-respuesta (reintentá 1 vez si falla)
const parsePlan = (raw) => {
  const plan = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  const ok =
    typeof plan.titulo === "string" &&
    typeof plan.idea_principal === "string" &&
    Array.isArray(plan.ejecucion) &&
    plan.ejecucion.length >= 3 &&
    plan.ejecucion.length <= 6 &&
    plan.ejecucion.every(
      (e) => typeof e.momento === "string" && typeof e.descripcion === "string"
    ) &&
    /^0\s*-/.test(plan.ejecucion[0].momento);
  if (!ok) throw new Error("Plan inválido");
  return plan;
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