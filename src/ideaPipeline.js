// ideaPipeline.js — v8.4
// Cambios vs v8.3:
//  - SYSTEM_PROMPT: deja de pedir "ideas virales/dopamínicas" (activa fórmulas baratas).
//    Pasa a proceso: detectar MECANISMO de retención → abstraer → aplicar al negocio.
//    Sin fijar emoción (risa, shock, ASMR, etc.): cualquier forma vale si el mecanismo es fuerte.
//  - Filtro anti-demo: si se resume en "problema → producto → mejora", se descarta.
//  - SCHEMA + validPlan + return: soportan patron_origen (opcional pero preferido).
//  - fetchTrendSignals: busca mecanismos/estructuras de retención, no tips de marketing.
//  - Correcciones de typos y consistencia SYSTEM vs SCHEMA.
// Hereda de v8.3:
//  - trends con searchQueries reales o se descartan; includeThoughts solo con onThinking;
//    systemInstruction separado; generación sin search; retry con thinkingLevel low.

// ── System prompt (único) ────────────────────────────────────
const SYSTEM_PROMPT = `
Sos VIRAX, guionista de video corto orgánico (TikTok, Reels, Shorts) para negocios reales.

Tu trabajo no es inventar "algo que parezca viral". Es detectar por qué un formato retiene atención, abstraer ese mecanismo y aplicarlo al negocio del usuario. La forma puede ser cualquiera (humor, silencio, rareza, reconocimiento, dato, tensión): no hay un solo estilo correcto.

QUÉ PRODUCÍS
- Contenido de creador, no publicidad. Cero anuncios, spots, branding, embudos o estética de comercial.
- El negocio es contexto, no protagonista. Protagoniza una persona, una situación o una tensión. El producto aparece tarde, de costado o como consecuencia.
- Filmable con celular y con lo que el negocio ya tiene.
- Situación primero. Si el video sigue teniendo sentido sin nombrar el producto, la idea es buena.

PROCESO (en silencio, antes de responder)
1) MECANISMO, NO DISFRAZ
   A partir de las señales en <contexto> (o de patrones de short-form que conozcas), identificá 1 mecanismo de retención transferible.
   Mecanismo = la razón por la que alguien no scrollea (ej. mal diagnóstico con causa obvia; rutina muda que implica historia; pregunta que no se resuelve en 2s).
   No copies el tema ni el tono del ejemplo original: solo el mecanismo.

2) TRADUCCIÓN AL NEGOCIO
   Aplicá ese mecanismo al rubro del usuario con detalle concreto y creíble.
   Nichos similares sirven de puente, no de plantilla.

3) FILTRO DURO (si falla, descartá y regenerá)
   - ¿En los primeros 1.5–2s queda algo irresuelto o reconocible con fuerza, más allá de "se ve lindo"?
   - ¿Si saco el producto, el video sigue teniendo sentido?
   - ¿Se puede resumir como "se ve el problema → se aplica el producto → se ve la mejora"? Si sí, es demo/anuncio: DESCARTALA.
   - ¿Se filma con un celular y recursos reales del negocio?

4) DIVERSIDAD DE FORMA
   No fuerces risa, gritos, destrucción, ASMR ni "ángulo brutal".
   Elegí la forma que mejor transporte el mecanismo a este negocio.

SIN DATOS INVENTADOS
No cites métricas, % ni "datos de rendimiento". Las señales culturales vienen en <contexto>; si no hay, no las simules.

CÓMO DESCRIBÍS
Escenas concretas: qué se ve y qué se oye. Frases simples. El usuario tiene que poder imaginar cada plano.

EJEMPLO DE NIVEL (solo calidad de criterio; no copies el tema)
Negocio: panadería de barrio.
Mala: "Mostrá el proceso de las medialunas y su calidad." (anuncio)
También mala: "Dedo en la medialuna antes/después de manteca." (demo de beneficio)
Buena: título "El que pide sin hablar"; idea_principal "Entra alguien, hace un gesto mínimo y el panadero ya arma la bolsa; el espectador no sabe qué pidió hasta el final."
`.trim();

// true  -> body.systemInstruction (proxy debe reenviarlo)
// false -> se antepone al texto del prompt
const SYSTEM_SEPARATE = true;

const CFG = {
  thinkingLevel: "high",
  temperature: 1.0,
  maxOutputTokens: 24576,
};

export const MAX_PREGUNTAS = 2;
const MIN_CHARS_IDEA_SUFICIENTE = 25;
const MAX_INTENTOS = 2;

// ── Conteo de preguntas ──────────────────────────────────────
const countQuestions = (history) =>
  history.filter((m) => {
    if (m.role === "user") return false;
    const t = String(m.text ?? "").trim();
    return t.length <= 300 && /\?\s*$/.test(t);
  }).length;

const puedePreguntar = ({ asked, lastPlan, idea, businessContext }) => {
  if (asked >= MAX_PREGUNTAS) return false;
  if (lastPlan) return false;
  const ideaTexto = String(idea ?? "").trim();
  const tieneContexto = Boolean(businessContext && String(businessContext).trim());
  if (tieneContexto && ideaTexto.length >= MIN_CHARS_IDEA_SUFICIENTE) return false;
  if (ideaTexto.length >= MIN_CHARS_IDEA_SUFICIENTE * 3) return false;
  return true;
};

// ── Prompt Builder ───────────────────────────────────────────
const historyBlock = (history) =>
  history.length
    ? history.map((m) => `${m.role === "user" ? "USUARIO" : "VIRAX"}: ${m.text}`).join("\n")
    : "(primera interacción)";

const SCHEMA_PREGUNTA = `
A) Imposible avanzar: no se entiende qué producto, negocio o tema es el video:
{
  "tipo":"pregunta",
  "mensaje":"una sola pregunta concreta"
}
`;

const SCHEMA_RESTO = `
B) El usuario pide un ajuste/cambio pero no hay plan previo:
{
  "tipo":"ajuste_sin_plan"
}

C) Idea:
{
  "tipo":"plan",
  "patron_origen":{
    "nicho_similar":"nichos de donde salió el mecanismo (breve)",
    "patron_2026":"el mecanismo de retención en una frase (no el tema decorativo)",
    "por_que_encaja":"por qué ese mecanismo tiene sentido en ESTE negocio (1 frase)"
  },
  "titulo":"",
  "idea_principal":"",
  "ejecucion":[
    { "momento":"", "descripcion":"" }
  ],
  "analisis":{
    "por_que_detiene_scroll":"",
    "por_que_alguien_haria_scroll":"",
    "momento_mas_fuerte":"",
    "momento_mas_debil":""
  },
  "veredicto":{
    "nivel":"alto|medio|bajo",
    "razon":""
  },
  "pregunta_seguimiento":""
}

Reglas:
- "patron_origen": obligatorio en tipo plan. Habla del MECANISMO, no de marcas ni de tips de marketing.
- "ejecucion": de 1 a 4 momentos. Cada "descripcion" es lo que se ve y se oye, en una o dos frases cortas. Sin intención estratégica y sin explicar qué comunica.
- El primer momento no puede ser el problema del producto seguido de la acción que lo resuelve.
- "titulo": cómo lo recordaría alguien que lo vio. Si podría ser el nombre de una pieza publicitaria, reescribilo.
- "idea_principal": la razón por la que un desconocido se queda. Si el beneficio aparece antes que la situación, reescribila.
- "por_que_detiene_scroll": qué queda irresuelto o reconocido antes de cualquier claim.
- "por_que_alguien_haria_scroll": en qué instante esto se vuelve un anuncio, o qué tensión se agota.
- "momento_mas_fuerte": el segundo que obliga a ver el siguiente.
- "momento_mas_debil": donde la idea se pone a demostrar.
- Ningún campo habla de eficacia, metáforas visuales ni de "romper la lógica". Hablan de la persona que mira.
- "veredicto.nivel" es "alto" solo si el video sigue teniendo sentido sin el beneficio. "medio" si depende mucho del contexto. "bajo" si es una demo. No premies la idea por ser vistosa.
- "veredicto.razon": una o dos frases sobre el mecanismo de atención, no sobre el producto.
- "pregunta_seguimiento": vacía salvo que el usuario ya esté iterando un plan.
- Cada campo de análisis y la razón: máximo 2 frases. Cerrá siempre el JSON.
`;

const buildSchema = (canAsk) =>
  `Respondé SOLO con JSON válido, sin texto antes ni después, sin bloques de código.\n` +
  (canAsk ? SCHEMA_PREGUNTA : "") +
  SCHEMA_RESTO;

const preguntasBlock = (asked, canAsk) =>
  canAsk
    ? `
<limite_preguntas>
Preguntas ya hechas: ${asked} de ${MAX_PREGUNTAS} permitidas.
Cada pregunta le cuesta tiempo al usuario. LA RESPUESTA POR DEFECTO ES UN PLAN, NO UNA PREGUNTA.

Solo podés preguntar si NO se entiende qué producto, negocio o tema es el video, y sin eso es imposible proponer algo concreto.

NUNCA preguntes por:
- formato, duración, estilo, tono, voz, texto, música o CTA (decidilo vos)
- plataforma (ya la tenés en <contexto>)
- público objetivo, objetivos o métricas
- presupuesto, recursos, equipo o equipamiento
- datos que podés inferir del negocio, del historial o del mensaje
- preferencias del usuario ("¿preferís A o B?"): elegí vos la mejor opción

Ante cualquier duda, asumí lo más razonable y entregá el plan; si hiciste una suposición importante, mencionala en "razon" del veredicto.
Si preguntás: una sola pregunta, corta y concreta.
</limite_preguntas>`
    : `
<limite_preguntas>
PROHIBIDO preguntar en este turno.
Usá todo lo que ya sabés, asumí lo que falte con criterio y respondé SIEMPRE con un plan (tipo "plan").
Si hay datos faltantes, resolvelos con la mejor suposición y mencionala brevemente en "razon" del veredicto.
Si hay un plan anterior y el usuario pide un cambio, aplicalo y devolvé el plan completo actualizado.
</limite_preguntas>`;

const buildPrompt = ({
  idea,
  history,
  platform,
  lastPlan,
  businessContext = null,
  trendContext = null,
  questionsAsked = 0,
  canAsk = true,
}) => {
  return `
<contexto>
Plataforma: ${platform}

Negocio:
${businessContext ?? "(no informado)"}

Señales culturales:
${trendContext ?? "(no disponibles)"}
</contexto>

<historial>
${historyBlock(history)}
</historial>

<plan_anterior>
${lastPlan ? JSON.stringify(lastPlan) : "(ninguno)"}
</plan_anterior>

<mensaje_usuario>
${idea}
</mensaje_usuario>
${preguntasBlock(questionsAsked, canAsk)}

${buildSchema(canAsk)}`.trim();
};

// ── Parsing ──────────────────────────────────────────────────
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

// ── Llamada streaming ────────────────────────────────────────
const callGeminiStream = async (supabase, body, { onThinking } = {}) => {
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
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    const err = new Error(`gemini-proxy stream ${res.status}: ${msg.slice(0, 200)}`);
    err.retryable = res.status >= 500;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let jsonText = "";
  let tokens = 0;
  let usedSearch = false;
  let searchQueries = [];
  let modelUsed = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      let chunk;
      try {
        chunk = JSON.parse(line.slice(6));
      } catch {
        continue;
      }

      if (chunk.type === "thinking" && chunk.text) {
        onThinking?.(chunk.text);
      } else if (chunk.type === "text" && chunk.text) {
        jsonText += chunk.text;
      } else if (chunk.type === "done") {
        tokens = chunk.tokens ?? 0;
        usedSearch = chunk.usedSearch === true;
        searchQueries = Array.isArray(chunk.searchQueries) ? chunk.searchQueries : [];
        modelUsed = typeof chunk.model === "string" ? chunk.model : null;
      } else if (chunk.type === "error") {
        throw new Error(chunk.message ?? "Error en el stream de Gemini");
      }
    }
  }

  const json = parseJson(jsonText);
  if (!json) {
    console.warn("Stream: JSON no parseable. Texto acumulado:", jsonText.slice(0, 500));
    const err = new Error("La IA devolvió un formato inesperado. Probá de nuevo.");
    err.tokens = tokens;
    err.retryable = true;
    throw err;
  }

  return { json, tokens, usedSearch, searchQueries, modelUsed };
};

// ── Señales de tendencia (búsqueda aislada + caché) ──────────
const TREND_TTL_MS = 6 * 60 * 60 * 1000;
const trendCache = new Map();

const rubroDe = (businessContext) =>
  String(businessContext ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

const fetchTrendSignals = async ({ supabase, model, platform, businessContext }) => {
  const rubro = rubroDe(businessContext);
  const key = `${platform}|${rubro}`;
  const hit = trendCache.get(key);
  if (hit && Date.now() - hit.at < TREND_TTL_MS) return { ...hit, tokens: 0, cached: true };

  const text = `
Tarea: detectar MECANISMOS de retención que estén vivos ahora en ${platform} (estructuras de video, no tips de marketing). Sirven de inspiración para un negocio de este rubro: ${rubro || "(rubro no informado)"}.

Qué buscáis:
- Patrones de formato y narrativa de creadores/comunidades (cómo arranca el video, qué queda irresuelto, qué tipo de giro o reconocimiento usa).
- Estructuras transferibles entre nichos (no el tema superficial).

Ignorá:
- Notas de marketing, ads, casos de marca, "cómo hacer crecer tu negocio", rankeos de hooks genéricos.

Cada señal = una frase que nombra el MECANISMO (ej. "problema que todos culpan a X y la causa era Y obvia"), no un producto ni una marca.

Respondé SOLO con JSON válido, sin bloques de código: {"senales":["...","..."]} con 3 a 5 señales.`.trim();

  const r = await callGeminiStream(supabase, {
    ...CFG,
    thinkingLevel: "low",
    maxOutputTokens: 2048,
    useSearch: true,
    model,
    text,
  });

  if (!r.searchQueries.length) {
    console.warn("[trends] no hubo búsqueda real; descarto señales");
    return {
      text: null,
      tokens: r.tokens,
      queries: [],
      modelUsed: r.modelUsed,
      cached: false,
    };
  }

  const senales = Array.isArray(r.json?.senales)
    ? r.json.senales.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
    : [];

  const entry = {
    text: senales.length ? senales.map((s) => `- ${s}`).join("\n") : null,
    tokens: r.tokens,
    queries: r.searchQueries,
    modelUsed: r.modelUsed,
    at: Date.now(),
  };
  if (entry.text) trendCache.set(key, entry);
  return { ...entry, cached: false };
};

// ── Validación ───────────────────────────────────────────────
const NIVELES = ["alto", "medio", "bajo"];

const validPlan = (o) =>
  o?.tipo === "plan" &&
  typeof o.idea_principal === "string" &&
  o.idea_principal.trim().length > 0 &&
  Array.isArray(o.ejecucion) &&
  o.ejecucion.length > 0;

function norm(s) {
  return String(s ?? "").toLowerCase().trim();
}

// ── Pipeline ─────────────────────────────────────────────────
export const runIdeaPipeline = async ({
  supabase,
  model,
  idea,
  history = [],
  platform = "tiktok",
  lastPlan = null,
  businessContext = null,
  trendContext = null,
  questionsAsked = null,
  onThinking = null,
  useSearch = true,
}) => {
  const trace = [];
  const total = () => trace.reduce((s, t) => s + t.tokens, 0);

  const asked = questionsAsked ?? countQuestions(history);
  const canAsk = puedePreguntar({ asked, lastPlan, idea, businessContext });

  let signals = trendContext;
  if (!signals && useSearch) {
    try {
      const t = await fetchTrendSignals({ supabase, model, platform, businessContext });
      signals = t.text;
      trace.push({
        stage: "trends",
        tokens: t.tokens,
        cached: t.cached,
        queries: t.queries,
        model: t.modelUsed ?? null,
      });
      console.info("[trends] queries:", t.queries, t.cached ? "(caché)" : "");
    } catch (e) {
      trace.push({ stage: "trends_fail", tokens: 0 });
      console.warn("[trends] falló, sigo sin señales:", e.message);
    }
  }

  const ask = async (stage, { note = "", cfg = {} } = {}) => {
    try {
      const prompt = buildPrompt({
        idea,
        history,
        platform,
        lastPlan,
        businessContext,
        trendContext: signals,
        questionsAsked: asked,
        canAsk,
      });
      const r = await callGeminiStream(
        supabase,
        {
          ...CFG,
          ...cfg,
          useSearch: false,
          includeThoughts: typeof onThinking === "function",
          model,
          ...(SYSTEM_SEPARATE ? { systemInstruction: SYSTEM_PROMPT } : {}),
          text: (SYSTEM_SEPARATE ? "" : `${SYSTEM_PROMPT}\n\n`) + prompt + note,
        },
        { onThinking }
      );
      trace.push({ stage, tokens: r.tokens, usedSearch: r.usedSearch, model: r.modelUsed });
      return r.json;
    } catch (e) {
      trace.push({ stage: `${stage}_fail`, tokens: e.tokens ?? 0 });
      e.tokens = 0;
      throw e;
    }
  };

  const NOTA_REINTENTO =
    "\n\nIMPORTANTE: tu respuesta anterior se cortó o fue inválida. " +
    'Respondé con UN solo JSON completo y MÁS CONCISO: máximo 4 momentos en "ejecucion", ' +
    "descripciones de una sola frase.";

  try {
    let out = null;
    let lastErr = null;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      try {
        out =
          intento === 0
            ? await ask("coach")
            : await ask("coach_retry", { note: NOTA_REINTENTO, cfg: { thinkingLevel: "low" } });

        if (!canAsk && (out.tipo === "pregunta" || out.tipo === "ajuste_sin_plan")) {
          out = await ask("coach_force_plan", {
            note: '\n\nIMPORTANTE: no podés hacer más preguntas. Respondé ahora con un objeto de tipo "plan".',
          });
        }

        if (out.tipo === "pregunta" && canAsk) {
          return {
            plan: { tipo: "pregunta", mensaje: out.mensaje },
            tokens: total(),
            trace,
          };
        }
        if (out.tipo === "ajuste_sin_plan" && canAsk) {
          return {
            plan: {
              tipo: "pregunta",
              mensaje: "¿Sobre qué video querés trabajar? Contame la idea y armo el plan.",
            },
            tokens: total(),
            trace,
          };
        }
        if (validPlan(out)) break;

        console.warn("Plan inválido, JSON recibido:", JSON.stringify(out).slice(0, 800));
        lastErr = new Error("La IA devolvió un formato inesperado. Probá de nuevo.");
        out = null;
      } catch (e) {
        lastErr = e;
        out = null;
        if (!e.retryable) break;
      }
    }

    if (!out) throw lastErr ?? new Error("La IA devolvió un formato inesperado. Probá de nuevo.");

    const nivel = NIVELES.includes(norm(out.veredicto?.nivel))
      ? norm(out.veredicto.nivel)
      : "medio";

    return {
      plan: {
        tipo: "plan",
        patron_origen: out.patron_origen ?? null,
        titulo: out.titulo,
        idea_principal: out.idea_principal,
        ejecucion: out.ejecucion.slice(0, 8),
        analisis: out.analisis ?? null,
        veredicto: {
          nivel,
          razon: out.veredicto?.razon ?? out.veredicto?.["razón"],
        },
        pregunta_seguimiento: out.pregunta_seguimiento,
      },
      tokens: total(),
      trace,
    };
  } catch (e) {
    e.tokens = (e.tokens ?? 0) + total();
    throw e;
  }
};