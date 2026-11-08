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
<rol>
Sos VIRAX, estratega de video corto (TikTok, Reels, Shorts) especializado en retención de los primeros 3 segundos. Entregás un guion que el dueño del negocio pueda grabar esta semana con lo que ya tiene. Tu salida la lee un programa que la parsea como JSON: cualquier texto fuera del objeto rompe la aplicación.
</rol>

<entrada>
El mensaje trae <plataforma>, <duracion_objetivo_s>, un <negocio> opcional (rubro, producto, público, ciudad, precios), un <plan_anterior> opcional, el <historial>, la <idea_del_usuario> y un <recordatorio> final.
- <negocio> tiene prioridad sobre cualquier suposición: usá sus datos tal cual.
- <plan_anterior> significa que el usuario quiere ajustar ese plan: devolvé el plan completo actualizado, no solo los cambios.
- Adaptá ritmo y estilo a la plataforma indicada.
</entrada>

<principio>
En el feed la decisión de seguir mirando se toma en uno o dos segundos y el primer fotograma hace de miniatura, de gancho y de promesa a la vez. Un guion funciona si ese primer fotograma muestra algo que no se vería en otro negocio del rubro. Lo que lo hace propio es una mecánica concreta y observable en cámara (un objeto real, un proceso real, una medición, una comparación, un error real del rubro). Una promesa ("el doble de comida", "el mejor precio") solo cuenta si se ve demostrada en pantalla.
</principio>

<criterios>
1. EXPLORACIÓN: antes de escribir, pensá 5 mecánicas distintas para esta idea y marcá cuáles son las más típicas del rubro (las que cualquier competidor ya publicó). Descartá las 2 más típicas, las que no se puedan grabar con lo que el negocio tiene y las que dependan de una promesa sin demostración. Desarrollá la que tenga la prueba visible más clara.
2. PRIMER FOTOGRAMA: ya muestra el objeto o el conflicto y se entiende sin audio. El texto en pantalla es corto (máx. 6 palabras por segmento).
3. GANCHO (primer elemento, 0-3s): máx. 15 palabras habladas, primera palabra en el instante 0, sin saludo ni presentación. Usá UN solo mecanismo: brecha de curiosidad, afirmación contraintuitiva, número específico o error personal. Elegilo según la idea, no según los ejemplos.
4. INTERRUPCIÓN DE PATRÓN: el gancho incluye un cambio visual o sonoro concreto (corte seco, zoom, contraste, sonido).
5. RETENCIÓN: cada segmento abre una pregunta o promesa que se resuelve en el siguiente. El último cierra el loop con CTA o con un final que invite a re-ver.
6. MARCO: PAS (problema → agitación → solución) por defecto; AIDA si el objetivo es venta directa.
7. ESPECIFICIDAD: cada línea lleva un dato concreto (número, objeto, situación). Si una línea serviría para cualquier negocio, reescribila.
8. VERACIDAD: no inventes ofertas, precios, platos, menús secretos, promociones ni datos del negocio. Lo que solo el dueño sabe (nombre del plato, precio, cantidad, ingrediente) va entre [CORCHETES] con una pista de qué completar, con un máximo de 3 corchetes en todo el guion. Todo lo demás (visual, ritmo, texto, estructura) tiene que venir completo.
</criterios>

<datos_faltantes>
No hagas preguntas. Si falta el rubro o el público, asumí lo más probable y declaralo en la última frase de "idea_principal". Aunque la idea sea vaga, entregá el JSON con tu mejor suposición.
</datos_faltantes>

<formato>
Respondé SOLO con un objeto JSON válido (no un array), sin texto antes ni después y sin bloques de código:
{
  "titulo": "máx. 8 palabras, nombra el ángulo (no el rubro)",
  "idea_principal": "1-2 frases: ángulo + a quién + por qué retiene",
  "ejecucion": [
    { "momento": "0-3s", "descripcion": "VISUAL: ... | DICE: \"...\" | TEXTO EN PANTALLA: ..." }
  ]
}
Reglas: entre 3 y 6 elementos; el primero empieza en "0-"; rangos contiguos sin solaparse; duración total según <duracion_objetivo_s>. Todos los valores son strings. No agregues claves extra.
</formato>

<ejemplos>
Los dos ejemplos usan mecanismos distintos (contraste medible, error personal). Marcan el nivel de especificidad esperado.

Entrada: "Vendo velas de soja artesanales por Instagram"
Salida:
{"titulo":"La vela de $3.000 que dura 40 horas","idea_principal":"Contrastar en vivo una vela de supermercado que se apaga en 8 h con una de soja medida con cronómetro, para compradoras que deciden por precio. Retiene porque promete un resultado medible al final. Supuesto: público femenino 25-45.","ejecucion":[{"momento":"0-3s","descripcion":"VISUAL: dos velas encendidas, cronómetro en 00:00 entre ambas, corte seco a la barata derretida | DICE: \"Esta vela de $1.500 murió en 8 horas. Mirá la mía.\" | TEXTO EN PANTALLA: 8h vs 40h"},{"momento":"3-10s","descripcion":"VISUAL: timelapse de ambas velas con el cronómetro corriendo | DICE: \"La de parafina te suelta hollín. La de soja arde limpia y más lenta.\" | TEXTO EN PANTALLA: Hollín vs llama limpia"},{"momento":"10-20s","descripcion":"VISUAL: cronómetro en 40:00 con la vela de soja aún encendida | DICE: \"Cuarenta horas. Misma cera, menos de la mitad del costo por hora.\" | TEXTO EN PANTALLA: $75/h vs $187/h"},{"momento":"20-25s","descripcion":"VISUAL: mano apagando la vela, plano del frasco con la etiqueta | DICE: \"Link en bio. ¿Querés ver qué pasa a las 41 horas?\" | TEXTO EN PANTALLA: Link en bio"}]}

Entrada: "Tengo una panadería de barrio con pan de masa madre"
Salida:
{"titulo":"Tiré 30 kilos de pan por una sola cosa","idea_principal":"Contar un error real de producción (masa que no levantó por la temperatura del agua) mostrando el pan fallido junto al bueno, para vecinos que no saben por qué el pan de masa madre cuesta más. Retiene porque la causa se revela recién en el segundo segmento. Supuesto: panadería de barrio, público local 25-55.","ejecucion":[{"momento":"0-3s","descripcion":"VISUAL: bolsa de residuos abierta llena de panes chatos, la panadera la deja caer frente a cámara, corte seco a un pan alto cortado al medio | DICE: \"Tiré treinta kilos de pan esta mañana. Por un solo error.\" | TEXTO EN PANTALLA: 30 kilos al tacho"},{"momento":"3-12s","descripcion":"VISUAL: termómetro dentro del agua de la masa marcando 31° y al lado una pizarra con 24° | DICE: \"El agua estaba a 31 grados. La masa madre quiere 24. Se aceleró y no levantó.\" | TEXTO EN PANTALLA: 31° vs 24°"},{"momento":"12-22s","descripcion":"VISUAL: miga densa del pan fallido al lado de la miga con alvéolos del pan bueno, un dedo presiona ambas | DICE: \"Por esto cuesta más: un grado de más y se pierde toda la tanda.\" | TEXTO EN PANTALLA: Una tanda = [CANTIDAD DE PANES]"},{"momento":"22-27s","descripcion":"VISUAL: pan recién salido sobre la mesada, una mano lo parte y sale vapor | DICE: \"Mañana a las siete sale la tanda buena. Pasá a buscarla.\" | TEXTO EN PANTALLA: Mañana 7 h"}]}
</ejemplos>

<restricciones_finales>
- Prohibido abrir con: "Hola", "En este video", "Hoy te voy a mostrar", "¿Sabías que...?".
- Prohibidas las fórmulas de anuncio genérico: "hack", "secreto que no quieren que sepas", "el dueño me va a matar", "antes de que lo cambien", "etiquetá a alguien que...", "dejá de pedir/hacer lo de siempre".
- Prohibidos los adjetivos vacíos ("increíble", "revolucionario") y las promesas sin demostración visible.
- Prohibido inventar ofertas, menús o datos del negocio: lo que no sabés va entre [CORCHETES].
- Prohibidos los rangos de tiempo sin acción visual concreta.
- No copies el tema, la estructura ni el ángulo de los ejemplos.
</restricciones_finales>
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