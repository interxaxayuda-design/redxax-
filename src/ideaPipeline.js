// ============================================================================
// ideaPipeline.js  (v7 — generación libre + diagnóstico completo)
//
// Tres etapas, cada una con un único prompt y salida JSON estricta:
//   1. GENERAR      (temperatura alta, N llamadas en paralelo)  → conceptos
//   2. SELECCIONAR  (temperatura baja)                          → ranking + elegido
//   3. PLANIFICAR   (temperatura media)                         → { titulo, idea_principal, ejecucion[] }
//
// Cambios de la v7:
//   - Pozo obvio APAGADO por defecto (USAR_POZO = false). Generación y selección
//     sin reglas que limiten al modelo. Con usarPozo = true vuelve la versión anterior.
//   - Diagnóstico: cada llamada guarda el prompt exacto, el pensamiento del modelo,
//     la salida cruda y lo que el modelo cuenta sobre cómo leyó las instrucciones.
//     Sale en result.diagnostico, en la consola y en window.__ultimoDiagnostico.
//
// Si ya hay un plan anterior (modo "refinar") se saltean 1 y 2.
// ============================================================================

// ── Config ──────────────────────────────────────────────────
const CFG = { maxOutputTokens: 16384 };

// Temperatura por etapa. El proxy tiene que reenviar "temperature" a Gemini.
const TEMP = { generar: 1.2, seleccionar: 0.3, plan: 0.7 };

const GEN_PARALLEL = 2;
const CONCEPTOS_POR_LLAMADA = 12;

// false = generación libre. true = versión anterior con "pozo obvio" y reglas.
const USAR_POZO = false;

// true = arma y publica el diagnóstico de cada corrida.
const DIAG = true;

// false = el system prompt se antepone al texto (funciona con cualquier proxy).
const SYSTEM_SEPARATE = false;

// true = pide al proxy responseMimeType "application/json".
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

const str = (v) => String(v ?? "").trim();

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

const compactPlan = (plan) => {
  if (!plan) return null;
  return JSON.stringify({
    titulo: plan.titulo,
    idea_principal: plan.idea_principal,
    ejecucion: plan.ejecucion,
  });
};

// ═════════════════════════════════════════════════════════════
// PROMPTS
// ═════════════════════════════════════════════════════════════

// Párrafo común: pide al modelo que cuente cómo leyó las instrucciones. Va SIEMPRE
// al final del JSON para que escribirlo no condicione las decisiones anteriores.
const PEDIDO_LECTURA = `En el campo final "lectura_de_las_instrucciones", completado después de todo lo demás, contá con honestidad cómo interpretaste lo que se te pidió y si algo de estas instrucciones o del mensaje te limitó, te empujó o te condicionó. Si no notaste nada de eso, decilo.`;

// ── 1a. GENERAR — libre ─────────────────────────────────────
const GENERATOR_LIBRE = `
Sos un director creativo de contenido audiovisual de formato corto, con años de experiencia observando qué hace que la gente se quede mirando un video en TikTok, Reels y Shorts.

Tu objetivo es idear conceptos de video para el negocio, producto, lugar o idea que indique el usuario. Un concepto es una premisa filmable completa: qué se ve y se escucha en el primer segundo, qué se pregunta quien lo ve y cómo se resuelve.

Pensá con total libertad. No hay fórmulas, formatos ni categorías que debas seguir o evitar. Usá todo lo que sabés sobre cultura de internet, humor, narrativa, comportamiento humano y contenido que se difunde de forma orgánica, de cualquier nicho y época. Elegí las ideas que, a tu criterio, sean las mejores, sean conocidas o no.

Generá ${CONCEPTOS_POR_LLAMADA} conceptos.

${PEDIDO_LECTURA}

Respondé SOLO con un objeto JSON con esta forma exacta:
{
  "conceptos": [
    {
      "primer_segundo": "...",
      "pregunta_del_espectador": "...",
      "resolucion": "...",
      "porque": "por qué creés que este concepto retiene a la gente"
    }
  ],
  "lectura_de_las_instrucciones": "..."
}
`.trim();

// ── 1b. GENERAR — con pozo (versión anterior) ───────────────
const GENERATOR_CON_POZO = `
Sos un director creativo de contenido audiovisual de formato corto, con años de experiencia en negocios pequeños y medianos.

Tu tarea es idear conceptos de video para el negocio, producto, lugar o idea que indique el usuario.

Un hook es lo que la persona ve y escucha en el primer segundo y la obliga a quedarse, porque el resto del video responde algo que ese primer segundo dejó abierto. Cada concepto es una premisa filmable completa, con apertura y resolución.

El video no tiene que demostrar ni probar ninguna cualidad del producto. Lo que retiene a la gente es la situación, no el atributo. El negocio puede aparecer de forma incidental o recién cuando la premisa ya hizo su trabajo, pero tiene que estar presente.

Seguí este proceso, en este orden, y respetá ese mismo orden en el JSON:

1. "pozo_obvio": escribí las 15 ideas que cualquier creador o cualquier modelo de lenguaje propondría primero para este caso. Una línea por idea. Incluí en esta lista toda idea cuya premisa sea mostrar, probar o poner a prueba una característica del producto, aunque venga disfrazada de test, desafío o pregunta. Esta lista es la zona prohibida.

2. "conceptos": generá ${CONCEPTOS_POR_LLAMADA} conceptos que no pertenezcan al pozo obvio ni sean una variante suya. Cambiar las palabras, el orden o el formato de una idea del pozo no la convierte en una idea distinta.

3. Cada concepto declara su "familia": en pocas palabras, el mecanismo que lo hace funcionar. No puede haber más de 2 conceptos de la misma familia.

4. Cada concepto tiene que poder filmarlo el propio negocio con un celular y lo que tiene a mano, sin actores, sin producción ni gastos relevantes.

5. La resolución tiene que existir realmente en el video. No se puede abrir una pregunta que el video no responde.

${PEDIDO_LECTURA}

Respondé SOLO con un objeto JSON con esta forma exacta:
{
  "pozo_obvio": ["...", "..."],
  "conceptos": [
    {
      "familia": "el mecanismo en pocas palabras",
      "primer_segundo": "qué se ve y qué se escucha en el primer segundo",
      "pregunta_del_espectador": "qué se pregunta quien lo ve",
      "resolucion": "cómo y cuándo la responde el video",
      "porque": "por qué creés que este concepto retiene a la gente"
    }
  ],
  "lectura_de_las_instrucciones": "..."
}
`.trim();

// ── 2. SELECCIONAR ──────────────────────────────────────────
const SELECTOR_BASE = `
Sos un analista experto en difusión de contenido audiovisual y comportamiento de audiencias en internet.

Vas a evaluar conceptos de video corto que todavía no fueron filmados. Tu objetivo es estimar cuál tiene mayor potencial de difusión orgánica, considerando el contenido de cada concepto y cualquier contexto cultural, social, emocional o audiovisual relevante que reconozcas.

Evaluá como si tuvieras experiencia acumulada viendo grandes cantidades de contenido de distintas plataformas, comunidades y épocas. Considerá cualquier patrón, referencia, dinámica, formato o fenómeno cultural que pueda influir en cómo reacciona la audiencia.

Diferenciá claramente:
- Lo que se desprende directamente del concepto.
- Lo que inferís por comparación con contenido similar.
- Lo que depende de contexto externo o tendencias que no podés verificar.

No apliques reglas generales de forma automática. Evaluá cada concepto según sus características concretas y la audiencia que probablemente lo consumiría.
`.trim();

const SELECTOR_POZO = `
Recibís además un "pozo_obvio": las ideas que cualquiera propondría primero para este caso. Descartá los conceptos que se parezcan a ese pozo, los que se parezcan entre sí (quedate con el mejor de cada grupo) y los que no pueda filmar el propio negocio con un celular.
`.trim();

const SELECTOR_CIERRE = `
Pensá en silencio durante varias etapas antes de responder. Contrastá hipótesis alternativas y evitá la explicación más obvia cuando haya una más sólida.

${PEDIDO_LECTURA}

Respondé SOLO con un objeto JSON con esta forma exacta, con los 3 mejores conceptos en "ranking" ordenados de mayor a menor potencial:
{
  "ranking": [
    {
      "id": "c3",
      "probabilidad": 0,
      "confianza": "baja | media | alta",
      "por_que_funciona": "...",
      "por_que_podria_fallar": "...",
      "comparable": "contenido similar que haya funcionado, aunque sea de otro nicho"
    }
  ],
  "elegido": "c3",
  "por_que_este_y_no_otros": "...",
  "descartados_destacados": [
    { "id": "c7", "motivo": "..." }
  ],
  "lectura_de_las_instrucciones": "..."
}
En "descartados_destacados" incluí hasta 5 conceptos que consideraste seriamente y no quedaron entre los 3 primeros.
`.trim();

const buildSelectorPrompt = (usarPozo) =>
  [SELECTOR_BASE, usarPozo ? SELECTOR_POZO : "", SELECTOR_CIERRE].filter(Boolean).join("\n\n");

// ── 3. PLANIFICAR ───────────────────────────────────────────
const PLAN_PROMPT = `
Sos un director de producción de video corto. Convertís una premisa de video en un plan de ejecución que el propio negocio pueda filmar con un celular.

Recibís uno de estos dos casos:
- <concepto_elegido>: una premisa nueva. Armá el plan completo a partir de ella.
- <plan_anterior> junto con <cambio_pedido>: un plan existente al que el usuario le pidió un cambio. Aplicá exactamente ese cambio y conservá todo lo demás, incluida la premisa, salvo que el cambio pida modificarla.

Reglas:
- No suavices, generalices ni reemplaces la premisa. El mecanismo del concepto es la idea; tu trabajo es bajarlo a pasos filmables.
- Si algo del concepto es imposible para este negocio, adaptá la forma de filmarlo sin tocar el mecanismo.
- "idea_principal" resume la premisa en una o dos oraciones.
- El primer paso de "ejecucion" tiene que ser exactamente lo que ocurre en el primer segundo del concepto.
- Cada paso indica qué se ve y qué se escucha. El último paso es la resolución.
- La duración objetivo es un tope, no una meta. El video dura lo que necesita la premisa: si se resuelve antes, el plan es más corto. No agregues pasos de relleno ni de explicación que la premisa no necesite. Máximo ${MAX_PASOS} pasos.
- Usá el contexto del negocio para que el plan hable de este negocio y no de uno cualquiera.

${PEDIDO_LECTURA}

Respondé SOLO con un objeto JSON con esta forma exacta:
{
  "titulo": "...",
  "idea_principal": "...",
  "ejecucion": [
    { "momento": "0-1s", "descripcion": "..." }
  ],
  "lectura_de_las_instrucciones": "..."
}
`.trim();

// ── Mensajes de usuario (solo datos) ────────────────────────
const contextoBlock = ({ platform, duracionS, businessContext, history }) => {
  const negocio = businessContext ? `<negocio>\n${businessContext}\n</negocio>\n` : "";
  return `<contexto>
<plataforma>${platform}</plataforma>
<duracion_objetivo_s>${duracionS}</duracion_objetivo_s>
${negocio}<historial>
${historyBlock(history)}
</historial>
</contexto>`;
};

const buildGeneratorMessage = (ctx, idea) =>
  `${contextoBlock(ctx)}
<idea_del_usuario>
${idea}
</idea_del_usuario>`;

// El selector recibe solo la premisa de cada concepto: sin "porque" ni "familia",
// para que no lo influya la defensa que cada concepto hace de sí mismo.
const buildSelectorMessage = (ctx, idea, pozo, conceptos) =>
  `${contextoBlock(ctx)}
<idea_del_usuario>
${idea}
</idea_del_usuario>
${pozo?.length ? `<pozo_obvio>\n${JSON.stringify(pozo)}\n</pozo_obvio>\n` : ""}<conceptos>
${JSON.stringify(
    conceptos.map((c) => ({
      id: c.id,
      primer_segundo: c.primer_segundo,
      pregunta_del_espectador: c.pregunta_del_espectador,
      resolucion: c.resolucion,
    }))
  )}
</conceptos>`;

const buildPlanMessageNuevo = (ctx, idea, concepto) =>
  `${contextoBlock(ctx)}
<idea_del_usuario>
${idea}
</idea_del_usuario>
<concepto_elegido>
${JSON.stringify(concepto)}
</concepto_elegido>`;

const buildPlanMessageRefinar = (ctx, idea, lastPlan) =>
  `${contextoBlock(ctx)}
<plan_anterior>
${compactPlan(lastPlan)}
</plan_anterior>
<cambio_pedido>
${idea}
</cambio_pedido>`;

// ═════════════════════════════════════════════════════════════
// PARSING Y VALIDACIÓN
// ═════════════════════════════════════════════════════════════
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

const asObject = (rawText, label) => {
  const json = parseJson(rawText);
  const o = Array.isArray(json) ? json[0] : json;

  if (!o || typeof o !== "object") {
    console.warn(`[idea:${label}] sin JSON en la respuesta:`, String(rawText).slice(0, 600));
    throw formatError(rawText);
  }

  return o;
};

const parseGeneracion = (rawText) => {
  const o = asObject(rawText, "generar");

  const conceptos = (Array.isArray(o.conceptos) ? o.conceptos : [])
    .map((c) => ({
      primer_segundo: str(c?.primer_segundo),
      familia: str(c?.familia),
      pregunta_del_espectador: str(c?.pregunta_del_espectador),
      resolucion: str(c?.resolucion),
      porque: str(c?.porque),
    }))
    .filter((c) => c.primer_segundo && c.resolucion);

  const pozo_obvio = (Array.isArray(o.pozo_obvio) ? o.pozo_obvio : [])
    .map(str)
    .filter(Boolean);

  if (!conceptos.length) {
    console.warn("[idea:generar] sin conceptos:", String(rawText).slice(0, 600));
    throw formatError(rawText);
  }

  return { conceptos, pozo_obvio, lectura: str(o.lectura_de_las_instrucciones) };
};

const parseSeleccion = (rawText, idsValidos) => {
  const o = asObject(rawText, "seleccionar");

  const ranking = (Array.isArray(o.ranking) ? o.ranking : [])
    .map((r) => ({
      id: str(r?.id),
      probabilidad: Number(r?.probabilidad) || 0,
      confianza: str(r?.confianza),
      por_que_funciona: str(r?.por_que_funciona),
      por_que_podria_fallar: str(r?.por_que_podria_fallar),
      comparable: str(r?.comparable),
    }))
    .filter((r) => idsValidos.has(r.id));

  if (!ranking.length) {
    console.warn("[idea:seleccionar] ranking vacío:", String(rawText).slice(0, 600));
    throw formatError(rawText);
  }

  const elegido = idsValidos.has(str(o.elegido)) ? str(o.elegido) : ranking[0].id;

  const descartados = (Array.isArray(o.descartados_destacados) ? o.descartados_destacados : [])
    .map((d) => ({ id: str(d?.id), motivo: str(d?.motivo) }))
    .filter((d) => idsValidos.has(d.id) && d.motivo);

  return {
    ranking,
    elegido,
    por_que_este_y_no_otros: str(o.por_que_este_y_no_otros),
    descartados_destacados: descartados,
    lectura: str(o.lectura_de_las_instrucciones),
  };
};

const parsePlan = (rawText) => {
  const o = asObject(rawText, "plan");

  const ejecucion = (Array.isArray(o.ejecucion) ? o.ejecucion : [])
    .map((e) =>
      typeof e === "string"
        ? { momento: "", descripcion: e.trim() }
        : { momento: str(e?.momento), descripcion: str(e?.descripcion) }
    )
    .filter((e) => e.descripcion)
    .slice(0, MAX_PASOS);

  const idea_principal = str(o.idea_principal);

  if (!idea_principal || !ejecucion.length) {
    console.warn("[idea:plan] JSON incompleto:", String(rawText).slice(0, 600));
    throw formatError(rawText);
  }

  return {
    titulo: str(o.titulo),
    idea_principal,
    ejecucion,
    lectura: str(o.lectura_de_las_instrucciones),
  };
};

// ═════════════════════════════════════════════════════════════
// STREAMING (solo texto)
// ═════════════════════════════════════════════════════════════
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

// Una etapa = una llamada con reintentos + parseo. Cada intento queda registrado
// en `diag` con el prompt exacto, el pensamiento y la salida cruda.
const runStage = async ({
  supabase,
  model,
  system,
  userMessage,
  temperature,
  stage,
  label,
  parse,
  trace,
  diag,
  signal,
  onThinking,
}) => {
  let lastErr = null;

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const recordatorio =
      intento > 0
        ? "\n\nRECORDATORIO: respondé SOLO con el objeto JSON, sin texto adicional ni bloques de código."
        : "";

    const userMsg = userMessage + recordatorio;
    let pensamiento = "";
    let r = null;
    const t0 = Date.now();

    const registrar = (err) => {
      if (!diag) return;
      diag.push({
        etapa: label ?? stage,
        intento: intento + 1,
        temperatura: temperature ?? null,
        ms: Date.now() - t0,
        tokens: r?.tokens ?? err?.tokens ?? 0,
        system,
        userMessage: userMsg,
        pensamiento,
        salida_cruda: r?.text ?? err?.raw ?? "",
        error: err ? String(err.message ?? err) : null,
      });
    };

    try {
      r = await callGeminiStream(
        supabase,
        {
          ...CFG,
          ...(intento > 0 ? { thinkingLevel: "low" } : {}),
          useSearch: false,
          ...(JSON_MODE ? { responseMimeType: "application/json" } : {}),
          ...(temperature != null ? { temperature } : {}),
          model,
          ...(SYSTEM_SEPARATE ? { systemInstruction: system } : {}),
          text: (SYSTEM_SEPARATE ? "" : `${system}\n\n`) + userMsg,
        },
        {
          signal,
          onThinking: (t) => {
            pensamiento += t;
            onThinking?.(t);
          },
        }
      );

      trace.push({
        stage: intento === 0 ? stage : `${stage}_retry`,
        tokens: r.tokens,
        usedSearch: r.usedSearch,
      });

      const parsed = parse(r.text);
      registrar(null);
      return parsed;
    } catch (e) {
      trace.push({ stage: `${stage}_fail`, tokens: e.tokens ?? 0 });
      registrar(e);
      lastErr = e;
      console.warn(`[idea:${stage}] intento ${intento + 1} falló:`, e?.message);

      if (isAbort(e) || !e.retryable) break;
      await sleep(700 * (intento + 1));
    }
  }

  throw lastErr ?? new Error("La IA no pudo completar la etapa. Probá de nuevo.");
};

// ═════════════════════════════════════════════════════════════
// DIAGNÓSTICO
// ═════════════════════════════════════════════════════════════
const bloque = (t) => "```\n" + (t || "(vacío)") + "\n```";

const conceptoLinea = (c) =>
  `**${c.id}** — 1er segundo: ${c.primer_segundo}\n  Pregunta: ${c.pregunta_del_espectador}\n  Resolución: ${c.resolucion}` +
  (c.familia ? `\n  Familia: ${c.familia}` : "") +
  (c.porque ? `\n  Por qué (según el generador): ${c.porque}` : "");

const diagnosticoMarkdown = (d) => {
  const L = [];

  L.push("# Diagnóstico de la idea");
  L.push(`- Fecha: ${d.fecha}`);
  L.push(`- Modo: ${d.modo}`);
  L.push(`- Modelo: ${d.config.model ?? "(no indicado)"}`);
  L.push(`- Pozo obvio: ${d.config.usarPozo ? "ACTIVADO" : "apagado (generación libre)"}`);
  L.push(
    `- Temperaturas: generar ${d.config.temperaturas.generar}, seleccionar ${d.config.temperaturas.seleccionar}, plan ${d.config.temperaturas.plan}`
  );
  L.push(`- Idea del usuario: ${d.idea}`);

  if (d.lecturasGenerador.length) {
    L.push("\n## 1. Cómo dice el generador que leyó las instrucciones");
    d.lecturasGenerador.forEach((t, i) => L.push(`Corrida ${i + 1}: ${t || "(sin respuesta)"}`));
  }

  if (d.pozo.length) {
    L.push("\n## Pozo obvio generado");
    d.pozo.forEach((p) => L.push(`- ${p}`));
  }

  if (d.conceptos.length) {
    L.push(`\n## 2. Conceptos generados (${d.conceptos.length})`);
    d.conceptos.forEach((c) => L.push(conceptoLinea(c)));
  }

  if (d.seleccion) {
    const s = d.seleccion;
    L.push("\n## 3. Selección");
    L.push(`Elegido: ${s.elegido}`);
    L.push(`Por qué este y no otros: ${s.por_que_este_y_no_otros || "(sin respuesta)"}`);
    L.push("\nRanking:");
    s.ranking.forEach((r, i) =>
      L.push(
        `${i + 1}. ${r.id} — ${r.probabilidad}% (confianza ${r.confianza})\n   Funciona: ${r.por_que_funciona}\n   Podría fallar: ${r.por_que_podria_fallar}\n   Comparable: ${r.comparable}`
      )
    );
    if (s.descartados_destacados.length) {
      L.push("\nDescartados destacados:");
      s.descartados_destacados.forEach((x) => L.push(`- ${x.id}: ${x.motivo}`));
    }
    L.push(`\nCómo dice el selector que leyó las instrucciones: ${s.lectura || "(sin respuesta)"}`);
  }

  if (d.lecturaPlan) {
    L.push("\n## 4. Plan");
    L.push(`Cómo dice el planificador que leyó las instrucciones: ${d.lecturaPlan}`);
  }

  L.push("\n## 5. Llamadas al modelo (prompt exacto, pensamiento y salida cruda)");
  const sistemasVistos = new Set();

  d.llamadas.forEach((l, i) => {
    L.push(
      `\n### ${i + 1}. ${l.etapa} — intento ${l.intento}, ${l.ms} ms, ${l.tokens} tokens, temperatura ${l.temperatura ?? "por defecto"}`
    );
    if (l.error) L.push(`ERROR: ${l.error}`);

    L.push("Pensamiento del modelo:");
    L.push(
      l.pensamiento
        ? bloque(l.pensamiento)
        : "(vacío: el proxy no envió pensamiento, o el modelo no lo expuso)"
    );

    L.push("Salida cruda:");
    L.push(bloque(l.salida_cruda));

    if (sistemasVistos.has(l.system)) {
      L.push("Prompt del sistema: igual a uno ya listado arriba.");
    } else {
      sistemasVistos.add(l.system);
      L.push("Prompt del sistema:");
      L.push(bloque(l.system));
    }

    L.push("Mensaje de usuario:");
    L.push(bloque(l.userMessage));
  });

  return L.join("\n");
};

const construirDiagnostico = (estado, llamadas, { model, idea }) => {
  const d = {
    fecha: new Date().toISOString(),
    modo: estado.modo,
    idea,
    config: {
      model,
      usarPozo: estado.usarPozo,
      temperaturas: TEMP,
      genParalelo: GEN_PARALLEL,
      conceptosPorLlamada: CONCEPTOS_POR_LLAMADA,
    },
    pozo: estado.pozo,
    conceptos: estado.conceptos,
    lecturasGenerador: estado.lecturasGen,
    seleccion: estado.seleccion,
    lecturaPlan: estado.lecturaPlan,
    llamadas,
  };

  d.markdown = diagnosticoMarkdown(d);
  return d;
};

const publicarDiagnostico = (d) => {
  try {
    console.groupCollapsed(`[idea] diagnóstico (${d.llamadas.length} llamadas)`);
    console.log(d.markdown);
    console.groupEnd();

    if (typeof window !== "undefined") window.__ultimoDiagnostico = d;
  } catch {
    /* el diagnóstico nunca debe romper el pipeline */
  }
};

// ═════════════════════════════════════════════════════════════
// PIPELINE
// ═════════════════════════════════════════════════════════════
export const runIdeaPipeline = async ({
  supabase,
  model,
  idea,
  history = [],
  platform = "tiktok", // id ("tiktok" | "reels" | "shorts") o texto libre
  duracionS = 30,
  lastPlan = null,
  businessContext: businessContextRaw = null,
  // "auto": refina si hay plan anterior, si no genera desde cero.
  // "nueva": ignora el plan anterior y genera conceptos nuevos.
  // "refinar": aplica `idea` como cambio sobre `lastPlan`.
  modo = "auto",
  // Permite comparar generación libre vs. con pozo sin tocar el archivo.
  usarPozo = USAR_POZO,
  onThinking = null,
  signal = null,
}) => {
  const trace = [];
  const llamadas = DIAG ? [] : null;
  const total = () => trace.reduce((s, t) => s + (t.tokens || 0), 0);

  const refinar = modo === "refinar" || (modo === "auto" && !!lastPlan);

  const estado = {
    modo: refinar && lastPlan ? "refinar" : "nueva",
    usarPozo,
    pozo: [],
    conceptos: [],
    lecturasGen: [],
    seleccion: null,
    lecturaPlan: "",
  };

  const ctx = {
    platform: PLATFORM_LABELS[platform] ?? platform,
    duracionS,
    businessContext: formatBusinessContext(businessContextRaw),
    history,
  };

  const common = { supabase, model, trace, diag: llamadas, signal, onThinking };

  const cerrarDiagnostico = () => {
    if (!DIAG) return null;
    const d = construirDiagnostico(estado, llamadas, { model, idea });
    publicarDiagnostico(d);
    return d;
  };

  try {
    // ── Refinar: una sola llamada sobre el plan existente ──
    if (refinar && lastPlan) {
      const base = await runStage({
        ...common,
        system: PLAN_PROMPT,
        userMessage: buildPlanMessageRefinar(ctx, idea, lastPlan),
        temperature: TEMP.plan,
        stage: "plan",
        parse: parsePlan,
      });

      estado.lecturaPlan = base.lectura;

      return {
        plan: armarPlan(base),
        tokens: total(),
        trace,
        diagnostico: cerrarDiagnostico(),
      };
    }

    // ── 1. Generar (en paralelo) ──
    const genMessage = buildGeneratorMessage(ctx, idea);
    const genSystem = usarPozo ? GENERATOR_CON_POZO : GENERATOR_LIBRE;

    const runs = await Promise.allSettled(
      Array.from({ length: GEN_PARALLEL }, (_, i) =>
        runStage({
          ...common,
          system: genSystem,
          userMessage: genMessage,
          temperature: TEMP.generar,
          stage: "generar",
          label: `generar #${i + 1}`,
          parse: parseGeneracion,
        })
      )
    );

    const ok = runs.filter((r) => r.status === "fulfilled").map((r) => r.value);

    if (!ok.length) {
      const motivo = runs.find((r) => r.status === "rejected")?.reason;
      throw motivo ?? new Error("La IA no pudo generar conceptos. Probá de nuevo.");
    }

    estado.pozo = usarPozo ? [...new Set(ok.flatMap((r) => r.pozo_obvio))] : [];
    estado.lecturasGen = ok.map((r) => r.lectura);
    estado.conceptos = ok
      .flatMap((r) => r.conceptos)
      .map((c, i) => ({ id: `c${i + 1}`, ...c }));

    const porId = new Map(estado.conceptos.map((c) => [c.id, c]));

    // ── 2. Seleccionar ──
    const seleccion = await runStage({
      ...common,
      system: buildSelectorPrompt(usarPozo),
      userMessage: buildSelectorMessage(ctx, idea, estado.pozo, estado.conceptos),
      temperature: TEMP.seleccionar,
      stage: "seleccionar",
      parse: (raw) => parseSeleccion(raw, new Set(porId.keys())),
    });

    estado.seleccion = seleccion;

    const elegido = porId.get(seleccion.elegido);
    const estimacion = seleccion.ranking.find((r) => r.id === seleccion.elegido);

    // ── 3. Planificar ──
    const base = await runStage({
      ...common,
      system: PLAN_PROMPT,
      userMessage: buildPlanMessageNuevo(ctx, idea, {
        primer_segundo: elegido.primer_segundo,
        pregunta_del_espectador: elegido.pregunta_del_espectador,
        resolucion: elegido.resolucion,
      }),
      temperature: TEMP.plan,
      stage: "plan",
      parse: parsePlan,
    });

    estado.lecturaPlan = base.lectura;

    const alternativas = seleccion.ranking
      .filter((r) => r.id !== seleccion.elegido)
      .map((r) => porId.get(r.id))
      .filter(Boolean)
      .map((c) => ({
        primer_segundo: c.primer_segundo,
        pregunta_del_espectador: c.pregunta_del_espectador,
        resolucion: c.resolucion,
      }));

    return {
      plan: armarPlan(base, {
        estimacion: estimacion
          ? { probabilidad: estimacion.probabilidad, confianza: estimacion.confianza }
          : null,
        alternativas,
      }),
      tokens: total(),
      trace,
      diagnostico: cerrarDiagnostico(),
    };
  } catch (e) {
    e.tokens = total();
    // Aun si falla, el diagnóstico parcial muestra hasta dónde llegó.
    try {
      e.diagnostico = cerrarDiagnostico();
    } catch {
      /* ignorar */
    }
    throw e;
  }
};

// Adapta al formato que espera ChatScreen. `estimacion` y `alternativas` son
// campos extra: la UI puede ignorarlos.
const armarPlan = (base, extra = {}) => ({
  tipo: "plan",
  titulo: base.titulo,
  idea_principal: base.idea_principal,
  ejecucion: base.ejecucion,
  analisis: null,
  veredicto: null,
  pregunta_seguimiento: "",
  ...extra,
});