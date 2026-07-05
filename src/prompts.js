// ─────────────────────────────────────────────────────────────
// virax-prompts.js — VIRAX v6 (schemas completos y precisos +
// taxonomía de patrones + estructura oficial de Gemini)
//
// Todos los prompts, schemas y utilidades de scoring viven acá.
// App.jsx SOLO importa de este archivo — no vuelve a declarar
// nada de esto localmente. Si necesitás modificar un prompt,
// se edita ÚNICAMENTE acá.
//
// CAMBIOS v5 -> v6 (ninguno requiere tocar App.jsx: mismos nombres
// de export, misma firma de parámetros, mismas keys de salida):
//
// 1. BUG CRÍTICO ENCONTRADO Y CORREGIDO: SCORING_BRAIN_SCHEMA y
//    PREDICTION_MARKET_SCHEMA solo declaraban una fracción de los
//    campos que el prompt pedía y que App.jsx lee de outputParsed.
//    Como responseSchema usa decodificación controlada (no
//    validación posterior), un campo que no está en el schema es
//    IMPOSIBLE de generar, sin importar qué diga el prompt. Por
//    eso hookDNA, steppsScore, roadmap, platformScores, etc.
//    llegaban siempre undefined. Ahora los 4 schemas declaran
//    exactamente los campos que el prompt pide y que la UI usa.
// 2. Mismo bug de formato que Silicon Audience (tags de texto
//    mezclados con JSON mode) también existía en
//    buildResearchBrainPrompt — corregido.
// 3. Reordenamiento de campos (propertyOrdering) en todos los
//    schemas: los campos de razonamiento van ANTES que el score
//    final, siguiendo la recomendación oficial de Gemini — la
//    generación es autoregresiva, así que si el score sale primero
//    el modelo no pudo "pensarlo" todavía.
// 4. Se agregó `description` a cada campo de cada schema (Google:
//    "crucial para guiar la salida del modelo"), `enum` en todo
//    campo de valores cerrados, y `minimum`/`maximum` en los scores
//    0-100 — nada de esto existía antes.
// 5. Los prompts de texto se ACORTARON: ya no listan campo por
//    campo (eso ahora lo hace el schema). Es la recomendación
//    oficial de Gemini para schemas complejos, y de paso resuelve
//    el pedido original de "prompt corto".
// 6. Estructura <role>/<context>/<task> en los prompts — patrón
//    documentado oficialmente por Gemini para que el modelo separe
//    instrucción, contexto y tarea.
// 7. NUEVO: HOOK_PATTERNS — taxonomía cerrada de patrones de hook,
//    compartida entre hookDNA.pattern y la metadata `patron` de
//    File Search. Incluye payoff_negado: el video corta justo
//    antes de mostrar algo que prometía mostrar (ej. una piedra a
//    punto de caer al agua, corte abrupto antes del impacto).
// 8. Fix menor: buildSiliconSummary filtraba por `p.guardó` (con
//    tilde), que no coincidía con ningún campo real. Ahora es
//    `p.guardo`.
//
// Pendiente de tu lado (fuera de este archivo, en gemini-proxy):
// no le pongas thinkingBudget:0 a CALL 1B/2/3 — son las tareas de
// razonamiento multi-paso para las que 2.5 Flash está diseñado
// como "thinking model". Dejalo dinámico (-1) o con presupuesto
// generoso (2048-4096).
// ─────────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════
// NICHOS — motores psicológicos y pesos por industria (sin cambios)
// ═════════════════════════════════════════════════════════════
export const NICHE_MOTORS = {
  "producto_fisico":    { motor: "dolor -> solucion",                          urgency: true,  trust_signal: "demostracion",       cta_type: "directo"   },
  "comida_restaurante": { motor: "deseo_sensorial -> identidad",               urgency: false, trust_signal: "creador_real",       cta_type: "implicito" },
  "inmobiliaria":       { motor: "aspiracion -> agente",                       urgency: false, trust_signal: "experiencia_agente", cta_type: "contacto"  },
  "app_saas":           { motor: "problema -> claridad -> demo",               urgency: true,  trust_signal: "resultado_visible",  cta_type: "directo"   },
  "estetica":           { motor: "inseguridad -> transformacion -> identidad", urgency: false, trust_signal: "antes_despues",      cta_type: "implicito" },
  "educacion":          { motor: "curiosidad -> valor -> confianza",           urgency: false, trust_signal: "autoridad",          cta_type: "implicito" },
  "musica_artista":     { motor: "identidad_tribal -> emocion -> resonancia",  urgency: false, trust_signal: "autenticidad_raw",   cta_type: "ninguno",
                          score_cap: { viralScore: 55, salesScore: 35 },
                          limitacion: "audio_no_evaluable" },
};

export const NICHE_WEIGHT_MULTIPLIERS = {
  "producto_fisico":    { retention: 1.0, tension: 1.1, payoff: 1.4, clarity: 0.9, trust: 1.3 },
  "comida_restaurante": { retention: 1.2, tension: 0.9, payoff: 1.1, clarity: 0.8, trust: 1.4 },
  "inmobiliaria":       { retention: 0.9, tension: 1.0, payoff: 1.2, clarity: 1.3, trust: 1.2 },
  "app_saas":           { retention: 1.0, tension: 1.2, payoff: 1.3, clarity: 1.4, trust: 1.1 },
  "estetica":           { retention: 1.1, tension: 1.0, payoff: 1.3, clarity: 0.9, trust: 1.0 },
  "educacion":          { retention: 1.0, tension: 1.5, payoff: 1.0, clarity: 1.4, trust: 0.9 },
  "musica_artista":     { retention: 1.3, tension: 0.8, payoff: 0.9, clarity: 0.7, trust: 0.8 },
};

// ═════════════════════════════════════════════════════════════
// TAXONOMÍA DE PATRONES DE HOOK (NUEVO en v6)
//
// Vocabulario CERRADO y compartido entre:
//  - hookDNA.pattern en SCORING_BRAIN_SCHEMA (para que cada video
//    quede etiquetado siempre con el mismo nombre de patrón)
//  - la metadata `patron` que se indexa en File Search (para que
//    filtrar por patrón realmente agrupe ejemplos comparables)
//
// Si con el tiempo identificás un patrón real que no está acá,
// agregalo a esta lista — no lo dejes como texto libre en ninguno
// de los dos lugares, o se rompe la comparabilidad entre ejemplos.
// ═════════════════════════════════════════════════════════════
export const HOOK_PATTERNS = [
  "pregunta_directa",        // Le hace una pregunta directa al espectador
  "afirmacion_contradictoria", // Contradice una creencia común / genera fricción
  "shock_visual",             // Imagen o sonido de alto impacto en el frame 0
  "pattern_interrupt",        // Rompe el patrón visual esperado del feed
  "payoff_negado",             // Corta justo antes de mostrar la resolución que prometía (ej: piedra a punto de caer al agua, corte abrupto antes del impacto)
  "cold_open",                 // Arranca en medio de la acción, sin contexto previo
  "pov_relatable",              // Situación relatable en primera persona / POV
  "transformacion_teaser",      // Muestra un adelanto del resultado antes de explicar cómo se logró
  "conteo_o_lista",              // "3 cosas que...", "el error #1..."
  "confesion_o_secreto",          // Promesa de revelar algo oculto o no dicho antes
  "bait_desconectado",             // Imagen de impacto sin relación real con el resto del contenido
  "apertura_informativa",           // Presenta el producto/tema directamente, sin mecanismo de gancho
  "debil",                           // No hay mecanismo de hook identificable
];

// ═════════════════════════════════════════════════════════════
// FILE SEARCH — configuración y helpers
//
// Un solo store contiene TODO el corpus histórico (hooks y
// desarrollos, buenos y malos, de todos los nichos). La separación
// no se hace con stores distintos (hay límite de 10 por proyecto),
// sino con metadata en cada documento indexado + un filtro en la
// consulta. Esto es lo que te permite mandar prompts cortos: el
// "conocimiento" vive afuera, indexado, no en el texto del prompt.
// ═════════════════════════════════════════════════════════════

export const FILE_SEARCH_STORE_DISPLAY_NAME = "virax-corpus-viral";

// Campos de metadata que usamos para filtrar la búsqueda:
//   segmento  -> "hook" | "desarrollo"
//   resultado -> "bueno" | "malo"
//   industria -> mismas keys que NICHE_MOTORS (ej: "estetica")
//   patron    -> un valor de HOOK_PATTERNS (ver taxonomía arriba)
//   plataforma-> "tiktok" | "reels" | "shorts"

/**
 * Arma el bloque `tools` que hay que pasar en config.tools de
 * generateContent para que el modelo consulte el store indexado.
 * Se usa así en App.jsx:
 *
 *   const response = await ai.models.generateContent({
 *     model: "gemini-2.5-flash",
 *     contents: buildResearchBrainPrompt(platform, industria, objetivo),
 *     config: {
 *       tools: buildFileSearchTool(storeName, { segmento: "hook", industria }),
 *     },
 *   });
 */
export const buildFileSearchTool = (storeName, filters = {}) => {
  const filterParts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, value]) => `${key}="${value}"`);

  const metadataFilter = filterParts.length ? filterParts.join(" AND ") : undefined;

  return [
    {
      fileSearch: {
        fileSearchStoreNames: [storeName],
        ...(metadataFilter ? { metadataFilter } : {}),
      },
    },
  ];
};

/**
 * Filtro típico para traer solo ejemplos de HOOK del nicho actual.
 * `patron`, si se pasa, debe ser un valor de HOOK_PATTERNS.
 */
export const fileSearchFiltersHook = (industria, plataforma, patron) => ({
  segmento: "hook",
  industria,
  ...(plataforma && plataforma !== "all" ? { plataforma } : {}),
  ...(patron ? { patron } : {}),
});

/**
 * Filtro típico para traer solo ejemplos de DESARROLLO del nicho actual.
 */
export const fileSearchFiltersDesarrollo = (industria, plataforma) => ({
  segmento: "desarrollo",
  industria,
  ...(plataforma && plataforma !== "all" ? { plataforma } : {}),
});

// ═════════════════════════════════════════════════════════════
// SCHEMAS — para responseSchema de Gemini (JSON mode estricto)
//
// v6: cada campo tiene `description` (Google: "crucial para guiar
// la salida"), los campos de valores cerrados usan `enum`, los
// scores 0-100 tienen `minimum`/`maximum`, y `propertyOrdering`
// fuerza que el razonamiento se genere ANTES que el score final
// en cada objeto — la generación es autoregresiva, así que el
// orden importa para la calidad del resultado, no solo para la
// legibilidad.
// ═════════════════════════════════════════════════════════════

export const RESEARCH_BRAIN_SCHEMA = {
  type: "OBJECT",
  description: "Investigación de mercado sobre hooks reales para el nicho y plataforma indicados, recuperada de la base indexada (File Search) cuando esté disponible.",
  properties: {
    hooks_virales_reales: {
      type: "STRING",
      description: "Ejemplos reales recuperados de la base indexada, con el mecanismo psicológico detrás de cada uno. Si no hay ejemplos suficientes en la base, decilo acá en vez de inventar.",
    },
    patron_hook_dominante: {
      type: "STRING",
      enum: HOOK_PATTERNS,
      description: "El patrón (de la taxonomía HOOK_PATTERNS) que más se repite entre los ejemplos ganadores recuperados.",
    },
    top_formatos_ganadores: { type: "STRING", description: "Formatos de video que están funcionando mejor ahora mismo en este nicho y plataforma." },
    errores_hook_comunes:   { type: "STRING", description: "Errores de hook recurrentes, basados en los ejemplos marcados como 'malo' en la base." },
    fatiga_de_formato:      { type: "STRING", description: "Si algún formato o patrón ya está sobreexpuesto en este nicho/plataforma y perdiendo efectividad." },
    oportunidad_detectada:  { type: "STRING", description: "Un ángulo que los ejemplos recuperados sugieren que está subexplotado." },
    benchmark_viral_score:  { type: "NUMBER", minimum: 0, maximum: 100, description: "Nivel de exigencia actual del nicho/plataforma para considerarse viral." },
    confianza_research:     { type: "STRING", enum: ["alta", "media", "baja"], description: "Qué tan respaldados están los hallazgos por ejemplos reales encontrados. 'baja' si la base no tenía cobertura suficiente de este nicho." },
    fuente_temporal:        { type: "STRING", enum: ["file_search", "conocimiento_entrenamiento"], description: "Si la información salió de la base indexada o, a falta de datos, del conocimiento general del modelo." },
  },
  propertyOrdering: [
    "hooks_virales_reales", "patron_hook_dominante", "top_formatos_ganadores",
    "errores_hook_comunes", "fatiga_de_formato", "oportunidad_detectada",
    "benchmark_viral_score", "confianza_research", "fuente_temporal",
  ],
};

export const SILICON_AUDIENCE_SCHEMA = {
  type: "OBJECT",
  description: "Simulación de cómo reaccionan 6 perfiles de audiencia distintos al ver el video completo.",
  properties: {
    simulacion: {
      type: "ARRAY",
      description: "Una entrada por cada uno de los 6 perfiles definidos en SILICON_PROFILES.",
      items: {
        type: "OBJECT",
        properties: {
          perfil_id: {
            type: "STRING",
            enum: ["curioso_aleatorio", "impaciente", "promedio", "nicho", "esceptico", "comprador"],
            description: "Cuál de los 6 perfiles está reaccionando.",
          },
          eventos_atencion: {
            type: "ARRAY",
            description: "Cronología de la atención de este perfil, en el orden en que ocurren los eventos relevantes del video.",
            items: {
              type: "OBJECT",
              properties: {
                segundo:  { type: "NUMBER", description: "Segundo del video en el que ocurre este evento." },
                decision: { type: "STRING", enum: ["RETIENE", "ABANDONA"], description: "Si en este momento el perfil sigue mirando o se va." },
              },
              propertyOrdering: ["segundo", "decision"],
            },
          },
          razon_final:    { type: "STRING", description: "Por qué este perfil tomó su decisión final, en su propio lenguaje." },
          decision_final: { type: "STRING", enum: ["RETUVO", "ABANDONÓ"], description: "Resultado final: si terminó viendo el video o lo abandonó en algún punto." },
          completo:       { type: "BOOLEAN", description: "Si llegó hasta el final del video." },
          compartio:      { type: "BOOLEAN", description: "Si este perfil compartiría el video." },
          guardo:         { type: "BOOLEAN", description: "Si este perfil guardaría el video." },
          comento:        { type: "BOOLEAN", description: "Si este perfil dejaría un comentario." },
        },
        propertyOrdering: ["perfil_id", "eventos_atencion", "razon_final", "decision_final", "completo", "compartio", "guardo", "comento"],
      },
    },
    segundo_mas_peligroso:  { type: "NUMBER", description: "El segundo del video donde más perfiles decidieron abandonar." },
    evento_que_mas_retiene: { type: "STRING", description: "Qué elemento concreto del video retuvo a más perfiles." },
    evento_que_mas_expulsa: { type: "STRING", description: "Qué elemento concreto del video expulsó a más perfiles." },
    patron_abandono:        { type: "STRING", description: "Patrón general que explica por qué abandonan los que abandonan, mirando los 6 perfiles en conjunto." },
    patron_retencion:       { type: "STRING", description: "Patrón general que explica por qué se quedan los que se quedan, mirando los 6 perfiles en conjunto." },
  },
  propertyOrdering: ["simulacion", "segundo_mas_peligroso", "evento_que_mas_retiene", "evento_que_mas_expulsa", "patron_abandono", "patron_retencion"],
};

export const PREDICTION_MARKET_SCHEMA = {
  type: "OBJECT",
  description: "Calibración final de scores a partir de la simulación de audiencia y el estado del mercado. La retención por perfil y el razonamiento van antes que los scores para que estén fundamentados, no al revés.",
  properties: {
    retencion_por_perfil: {
      type: "OBJECT",
      description: "Retención estimada (0-100) para cada uno de los 6 perfiles, con su razón.",
      properties: {
        curioso_aleatorio: { type: "OBJECT", properties: { razon: { type: "STRING" }, retencion_pct: { type: "NUMBER", minimum: 0, maximum: 100 } }, propertyOrdering: ["razon", "retencion_pct"] },
        impaciente:        { type: "OBJECT", properties: { razon: { type: "STRING" }, retencion_pct: { type: "NUMBER", minimum: 0, maximum: 100 } }, propertyOrdering: ["razon", "retencion_pct"] },
        promedio:          { type: "OBJECT", properties: { razon: { type: "STRING" }, retencion_pct: { type: "NUMBER", minimum: 0, maximum: 100 } }, propertyOrdering: ["razon", "retencion_pct"] },
        nicho:             { type: "OBJECT", properties: { razon: { type: "STRING" }, retencion_pct: { type: "NUMBER", minimum: 0, maximum: 100 } }, propertyOrdering: ["razon", "retencion_pct"] },
        esceptico:         { type: "OBJECT", properties: { razon: { type: "STRING" }, retencion_pct: { type: "NUMBER", minimum: 0, maximum: 100 } }, propertyOrdering: ["razon", "retencion_pct"] },
        comprador:         { type: "OBJECT", properties: { razon: { type: "STRING" }, retencion_pct: { type: "NUMBER", minimum: 0, maximum: 100 } }, propertyOrdering: ["razon", "retencion_pct"] },
      },
      propertyOrdering: ["curioso_aleatorio", "impaciente", "promedio", "nicho", "esceptico", "comprador"],
    },
    razonamiento_paso_a_paso: {
      type: "OBJECT",
      description: "Rastro explícito de cómo se llegó al score. Lo usa el chat de VIRAX Coach para explicarle al usuario de dónde salió cada número.",
      properties: {
        senal_mas_determinante:  { type: "STRING", description: "Cuál de las seis retenciones definió más el score final." },
        peso_curioso_aleatorio:  { type: "STRING", description: "Qué pesó y por qué sobre el perfil curioso_aleatorio en particular (tiene doble peso en el algoritmo real)." },
        ajuste_por_research:     { type: "STRING", description: "Si el estado de mercado hizo subir o bajar el score, y por qué." },
      },
      propertyOrdering: ["senal_mas_determinante", "peso_curioso_aleatorio", "ajuste_por_research"],
    },
    razon_principal_score: { type: "STRING", description: "La razón principal, en 1-2 frases, del score que estás por dar." },
    viralScore:            { type: "NUMBER", minimum: 0, maximum: 100, description: "Score de potencial viral, calibrado a partir de todo lo anterior." },
    salesScore:            { type: "NUMBER", minimum: 0, maximum: 100, description: "Score de potencial de ventas, calibrado a partir de todo lo anterior." },
    probabilidad_viral:    { type: "NUMBER", minimum: 0, maximum: 100, description: "Probabilidad estimada de que este video específico se vuelva viral." },
    confianza_prediccion:  { type: "STRING", enum: ["alta", "media", "baja"], description: "Qué tan segura es esta predicción." },
    accion_clave_viral:    { type: "STRING", description: "La acción más importante para mejorar el potencial viral." },
    accion_clave_ventas:   { type: "STRING", description: "La acción más importante para mejorar el potencial de ventas." },
  },
  propertyOrdering: [
    "retencion_por_perfil", "razonamiento_paso_a_paso", "razon_principal_score",
    "viralScore", "salesScore", "probabilidad_viral", "confianza_prediccion",
    "accion_clave_viral", "accion_clave_ventas",
  ],
};

export const SCORING_BRAIN_SCHEMA = {
  type: "OBJECT",
  description: "Veredicto final completo del video: el análisis granular va primero, los scores después, para que estén fundamentados en el análisis y no al revés.",
  properties: {
    hookDNA: {
      type: "OBJECT",
      description: "Diagnóstico específico del hook (primeros segundos).",
      properties: {
        pattern:        { type: "STRING", enum: HOOK_PATTERNS, description: "El patrón detectado. Ej: si el video corta justo antes de mostrar algo que prometía mostrar (como una piedra a punto de caer al agua y un corte abrupto antes del impacto), es 'payoff_negado'." },
        missingElement: { type: "STRING", description: "Qué elemento le falta al hook para ser más efectivo." },
        strength:       { type: "NUMBER", minimum: 0, maximum: 100 },
        optimizedHook:  { type: "STRING", description: "Una propuesta concreta de hook mejorado." },
      },
      propertyOrdering: ["pattern", "missingElement", "strength", "optimizedHook"],
    },
    scrollStopScore: {
      type: "OBJECT",
      description: "Qué tan bien el frame 0 detiene el scroll.",
      properties: {
        faceDetected:     { type: "BOOLEAN" },
        textOnScreen:     { type: "BOOLEAN" },
        contrastLevel:    { type: "STRING", enum: ["bajo", "medio", "alto"] },
        emotionVisible:   { type: "STRING", description: "Emoción visible en el frame 0, o 'ninguna'." },
        emotionIntensity: { type: "NUMBER", minimum: 0, maximum: 10 },
        verdict:          { type: "STRING" },
        score:            { type: "NUMBER", minimum: 0, maximum: 100 },
      },
      propertyOrdering: ["faceDetected", "textOnScreen", "contrastLevel", "emotionVisible", "emotionIntensity", "verdict", "score"],
    },
    steppsScore: {
      type: "OBJECT",
      description: "Framework STEPPS (Wharton) de viralidad.",
      properties: {
        socialCurrency:   { type: "NUMBER", minimum: 0, maximum: 10 },
        triggers:         { type: "NUMBER", minimum: 0, maximum: 10 },
        emotion:          { type: "NUMBER", minimum: 0, maximum: 10 },
        public:           { type: "NUMBER", minimum: 0, maximum: 10 },
        practicalValue:   { type: "NUMBER", minimum: 0, maximum: 10 },
        stories:          { type: "NUMBER", minimum: 0, maximum: 10 },
        dominantFactor:   { type: "STRING" },
        weakestFactor:    { type: "STRING" },
        shareMotivation:  { type: "STRING" },
        viralCoefficient: { type: "NUMBER", minimum: 0, maximum: 1 },
      },
      propertyOrdering: ["socialCurrency", "triggers", "emotion", "public", "practicalValue", "stories", "dominantFactor", "weakestFactor", "shareMotivation", "viralCoefficient"],
    },
    razonamiento_viralScore: { type: "STRING", description: "2-3 frases: qué de la audiencia y del hook pesó más para el score viral. Se genera ANTES de fijar el número." },
    razonamiento_salesScore: { type: "STRING", description: "2-3 frases: qué señal de venta encontró o no encontró. Se genera ANTES de fijar el número." },
    viralScore: {
      type: "OBJECT",
      properties: {
        verdict:      { type: "STRING" },
        accion_clave: { type: "STRING" },
        score:        { type: "NUMBER", minimum: 0, maximum: 100 },
      },
      propertyOrdering: ["verdict", "accion_clave", "score"],
    },
    salesScore: {
      type: "OBJECT",
      properties: {
        verdict:      { type: "STRING" },
        accion_clave: { type: "STRING" },
        score:        { type: "NUMBER", minimum: 0, maximum: 100 },
      },
      propertyOrdering: ["verdict", "accion_clave", "score"],
    },
    honestVerdict: { type: "STRING", description: "El veredicto más honesto posible, en 1-2 frases, sin suavizarlo." },
    roadmap: {
      type: "ARRAY",
      description: "Solo problemas reales detectados en este video puntual, ordenados por impacto real — nada genérico.",
      items: {
        type: "OBJECT",
        properties: {
          problema:  { type: "STRING" },
          impacto:   { type: "STRING", enum: ["ALTO", "MEDIO", "BAJO"] },
          solucion:  { type: "STRING" },
          resultado: { type: "STRING", description: "Resultado esperado si se aplica la solución." },
        },
        propertyOrdering: ["problema", "impacto", "solucion", "resultado"],
      },
    },
    vision: {
      type: "OBJECT",
      properties: {
        niche:    { type: "STRING" },
        type:     { type: "STRING" },
        audience: { type: "STRING" },
        promise:  { type: "STRING" },
      },
      propertyOrdering: ["niche", "type", "audience", "promise"],
    },
    platformScores: {
      type: "OBJECT",
      properties: {
        tiktok: { type: "OBJECT", properties: { verdict: { type: "STRING" }, topTip: { type: "STRING" }, score: { type: "NUMBER", minimum: 0, maximum: 100 } }, propertyOrdering: ["verdict", "topTip", "score"] },
        reels:  { type: "OBJECT", properties: { verdict: { type: "STRING" }, topTip: { type: "STRING" }, score: { type: "NUMBER", minimum: 0, maximum: 100 } }, propertyOrdering: ["verdict", "topTip", "score"] },
        shorts: { type: "OBJECT", properties: { verdict: { type: "STRING" }, topTip: { type: "STRING" }, score: { type: "NUMBER", minimum: 0, maximum: 100 } }, propertyOrdering: ["verdict", "topTip", "score"] },
      },
      propertyOrdering: ["tiktok", "reels", "shorts"],
    },
    retentionData: {
      type: "OBJECT",
      description: "Cada valor como texto que YA incluya el símbolo %, ej. '65%' (la UI no lo agrega).",
      properties: {
        at3s:  { type: "STRING" },
        at10s: { type: "STRING" },
        final: { type: "STRING" },
      },
      propertyOrdering: ["at3s", "at10s", "final"],
    },
    retentionCurve: {
      type: "ARRAY",
      description: "Solo se usa como respaldo si no hay curva calculada por la simulación de audiencia. Puntos de retención 0-100 representativos a lo largo del video.",
      items: { type: "NUMBER", minimum: 0, maximum: 100 },
    },
    viewsPrediction: {
      type: "OBJECT",
      properties: {
        scenario_low:      { type: "STRING" },
        scenario_mid:      { type: "STRING" },
        scenario_high:     { type: "STRING" },
        probability_viral: { type: "STRING" },
      },
      propertyOrdering: ["scenario_low", "scenario_mid", "scenario_high", "probability_viral"],
    },
    firstHourStrategy: {
      type: "OBJECT",
      properties: {
        optimalPostTime:       { type: "STRING" },
        firstActionAfterPost:  { type: "STRING" },
        commentSeed:           { type: "STRING" },
        engagementBoost:       { type: "STRING" },
      },
      propertyOrdering: ["optimalPostTime", "firstActionAfterPost", "commentSeed", "engagementBoost"],
    },
    commentTrigger: {
      type: "OBJECT",
      properties: {
        triggerType:  { type: "STRING" },
        suggestedCTA: { type: "STRING" },
        probability:  { type: "NUMBER", minimum: 0, maximum: 100 },
      },
      propertyOrdering: ["triggerType", "suggestedCTA", "probability"],
    },
  },
  propertyOrdering: [
    "hookDNA", "scrollStopScore", "steppsScore",
    "razonamiento_viralScore", "razonamiento_salesScore",
    "viralScore", "salesScore", "honestVerdict", "roadmap", "vision",
    "platformScores", "retentionData", "retentionCurve",
    "viewsPrediction", "firstHourStrategy", "commentTrigger",
  ],
};

// ─────────────────────────────────────────────────────────────
// CALL 0 — Observador del HOOK
//
// No usa responseSchema (va con expectsJson:false en App.jsx), así
// que acá el formato [DESCRIPCION]/[SEÑALES] sigue siendo válido:
// no hay JSON mode con el que pueda contradecirse.
// ─────────────────────────────────────────────────────────────
export const buildPreClassifierPrompt = (hookWindowSegundos = 5) => `
<role>
Sos un observador técnicso de video. Tu trabajo es reportar hechos, no opinar ni evaluar.
</role>

<context>
Tenés acceso directo al video completo. Vas a mirarlo entero, de principio a fin, sin saltear nada — lo necesitás completo para responder [SEÑALES] con precisión, aunque [DESCRIPCION] solo te pida los primeros segundos.
</context>

<task>
[DESCRIPCION]
Describí ÚNICAMENTE lo que pasa en los primeros ${hookWindowSegundos} segundos (el hook / la apertura): imagen, audio, texto en pantalla, ritmo de corte, qué promesa o pattern interrupt se instala ahí. Prestá atención especial a si el video corta o interrumpe justo antes de mostrar algo que visualmente prometía mostrar (por ejemplo: se ve una piedra a punto de caer al agua y corta antes del impacto) — es una técnica de hook específica y vale la pena registrarla si aparece.
NO describas ni resumas el resto del video en este bloque. El desarrollo completo lo va a observar cada análisis siguiente de forma directa e independiente.
Máximo 250 palabras.
[/DESCRIPCION]

[SEÑALES]
Estas señales sí requieren el video completo. Para cualquier marca de tiempo usá el formato MM:SS (ej: 00:07) — es el formato que interpretás con más precisión.
duracion: <segundos totales, número>
industria_detectada: <tu criterio, máximo 4 palabras>
elemento_en_s0: <qué aparece en el primer frame>
payoff_segundo: <MM:SS del punto más fuerte de todo el video>
audio_presente: <sí|no>
audio_desde_inicio: <sí|no>
tiene_rehook: <sí|no>
cortes_por_10s: <número>
logo_en_frame_0: <sí|no>
voz_ia: <sí|no>
es_slideshow: <sí|no>
pregunta_visible: <sí|no>
texto_en_pantalla_s0: <texto literal o "ninguno">
transformacion_visible: <sí|no>
[/SEÑALES]
</task>
`;

// ─────────────────────────────────────────────────────────────
// parsePreClassifierResponse — sin cambios de lógica
// ─────────────────────────────────────────────────────────────
export const parsePreClassifierResponse = (rawText) => {
  const descMatch = rawText.match(/\[DESCRIPCION\]([\s\S]*?)\[\/DESCRIPCION\]/);
  const descripcion_raw = descMatch ? descMatch[1].trim() : '';

  const refMatch = rawText.match(/\[SE[ÑN]ALES\]([\s\S]*?)\[\/SE[ÑN]ALES\]/);
  if (!refMatch) {
    console.warn('[CALL 0] No se encontró [SEÑALES]');
    return { descripcion_raw, _refs_missing: true };
  }

  const refBlock = refMatch[1];

  const getRef = (key) => {
    const match = refBlock.match(new RegExp(`${key}:\\s*(.+)`, 'i'));
    return match ? match[1].trim() : null;
  };

  const parseBool = (val) => {
    if (!val) return false;
    return /^(sí|si|yes|true|1)$/i.test(val.trim());
  };

  const parseNum = (val) => {
    if (!val) return null;
    const n = parseFloat(val.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  const parseTimestamp = (val) => {
    if (!val) return null;
    const trimmed = val.trim();
    const mmss = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
    const n = parseFloat(trimmed.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  const duracion               = parseNum(getRef('duracion'))              ?? 30;
  const audio_presente         = parseBool(getRef('audio_presente'));
  const audio_desde            = parseBool(getRef('audio_desde_inicio'));
  const es_slideshow           = parseBool(getRef('es_slideshow'));
  const voz_ia                 = parseBool(getRef('voz_ia'));
  const logo_s0                = parseBool(getRef('logo_en_frame_0'));
  const tiene_rehook           = parseBool(getRef('tiene_rehook'));
  const payoff_s               = parseTimestamp(getRef('payoff_segundo')) ?? Math.round(duracion * 0.4);
  const cuts_10                = parseNum(getRef('cortes_por_10s'))        ?? 2;
  const industria              = getRef('industria_detectada')             ?? 'general';
  const elemento_en_s0         = getRef('elemento_en_s0')                 ?? '';
  const pregunta_visible       = parseBool(getRef('pregunta_visible'));
  const texto_en_pantalla_s0   = getRef('texto_en_pantalla_s0')           ?? 'ninguno';
  const transformacion_visible = parseBool(getRef('transformacion_visible'));

  const atomicas = {
    duration_total_s:        duracion,
    silence_duration_s:      audio_presente ? 0 : duracion,
    audio_in_first_second:   audio_desde,
    payoff_second:           payoff_s,
    rehook_present:          tiene_rehook,
    cuts_per_10s:            cuts_10,
    average_shot_duration_s: cuts_10 > 0 ? parseFloat((10 / cuts_10).toFixed(1)) : 10,
    motion_intensity:        cuts_10 >= 6 ? 0.8 : cuts_10 >= 3 ? 0.5 : 0.2,
  };

  return {
    descripcion_raw,
    industria,
    logo_en_s0:                logo_s0,
    tiene_rehook,
    es_slideshow_imagenes:     es_slideshow,
    voz_ia_detectada:          voz_ia,
    duracion_estimada_segundos: duracion,
    elemento_en_s0,
    pregunta_visible,
    texto_en_pantalla_s0,
    transformacion_visible,
    atomicas,
    _raw_referencias: refBlock.trim(),
  };
};

// ─────────────────────────────────────────────────────────────
// CALL 1.5 — Research Brain
//
// v6: se sacó el bloque de tags [RESEARCH]...[/RESEARCH] — tenía
// el mismo problema que Silicon Audience: contradecía el JSON mode
// que ya impone RESEARCH_BRAIN_SCHEMA en la llamada real.
// ─────────────────────────────────────────────────────────────
export const buildResearchBrainPrompt = (platform, industria, objetivo) => {
  const pName = {
    tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts'
  }[platform] || platform;

  return `
<role>
Sos un investigador de tendencias de contenido para redes sociales, con acceso a una base indexada de miles de hooks reales (buenos y malos).
</role>

<context>
Plataforma: ${pName}. Nicho: "${industria}". Objetivo del creador: ${objetivo}.
Para nombrar cualquier patrón de hook, usá siempre uno de estos nombres exactos: ${HOOK_PATTERNS.join(", ")}.
</context>

<task>
Buscá en la base indexada los hooks reales (buenos y malos) más relevantes para este nicho y plataforma. Usá SOLO ejemplos que efectivamente encuentres — si no hay suficientes, decilo en confianza_research en vez de rellenar con conocimiento genérico.
</task>
`;
};

// ─────────────────────────────────────────────────────────────
// SILICON AUDIENCE — Perfiles (datos, no prompts) — sin cambios
// ─────────────────────────────────────────────────────────────
export const SILICON_PROFILES = [
  {
    id: 'curioso_aleatorio',
    peso: 2,
    descripcion: 'El algoritmo le mostró este video entre gatitos y Minecraft. No lo buscó.',
    psicologia: { impatience: 0.70, curiosity_threshold: 0.60, tolerance_to_confusion: 0.25, tolerance_to_ads: 0.15, receptivity_to_purchase: 0.20 },
    retiene_si: 'Algo visualmente raro, gracioso o sorprendente que no requiere contexto previo.',
    abandona_si: 'Jerga del nicho, cara hablando sin contexto visual, señal de anuncio.',
    volumen: 'sin_audio',
  },
  {
    id: 'impaciente',
    peso: 1,
    descripcion: '150+ videos por día. Dedo listo para deslizar desde frame 0.',
    psicologia: { impatience: 0.95, curiosity_threshold: 0.85, tolerance_to_confusion: 0.05, tolerance_to_ads: 0.02, receptivity_to_purchase: 0.15 },
    retiene_si: 'Elemento visualmente disruptivo o pregunta abierta en s0-s1.',
    abandona_si: 'Logo, cara hablando sin contexto, texto estático, música corporativa.',
    volumen: 'sin_audio',
  },
  {
    id: 'promedio',
    peso: 1,
    descripcion: 'Scrollea con moderación. Da oportunidad si algo resuena en los primeros 3 eventos.',
    psicologia: { impatience: 0.55, curiosity_threshold: 0.50, tolerance_to_confusion: 0.35, tolerance_to_ads: 0.30, receptivity_to_purchase: 0.40 },
    retiene_si: 'Promesa clara con resultado concreto antes del evento 3.',
    abandona_si: 'Intro lenta, "ya vi algo igual".',
    volumen: 'con_audio',
  },
  {
    id: 'nicho',
    peso: 1,
    descripcion: 'Conoce el tema. Detecta genérico al instante.',
    psicologia: { impatience: 0.40, curiosity_threshold: 0.30, tolerance_to_confusion: 0.60, tolerance_to_ads: 0.45, receptivity_to_purchase: 0.75 },
    retiene_si: 'Ángulo diferente, dato nuevo, demostración real verificable.',
    abandona_si: 'Contenido genérico, promesas sin prueba.',
    volumen: 'con_audio',
  },
  {
    id: 'esceptico',
    peso: 0.5,
    descripcion: 'Filtro de bullshit al máximo. Detecta publicidad disfrazada.',
    psicologia: { impatience: 0.80, curiosity_threshold: 0.90, tolerance_to_confusion: 0.10, tolerance_to_ads: 0.01, receptivity_to_purchase: 0.05 },
    retiene_si: 'Evidencia concreta, resultado real, sin hipérbole.',
    abandona_si: 'Logo, producto en mano sin demo, música inspiracional.',
    volumen: 'sin_audio',
  },
  {
    id: 'comprador',
    peso: 1,
    descripcion: 'Tiene un problema sin resolver. Receptivo si el video lo soluciona.',
    psicologia: { impatience: 0.35, curiosity_threshold: 0.40, tolerance_to_confusion: 0.50, tolerance_to_ads: 0.55, receptivity_to_purchase: 0.90 },
    retiene_si: 'Solución clara, precio o acceso visible, CTA concreto.',
    abandona_si: 'No entiende qué se vende, CTA confuso.',
    volumen: 'con_audio',
  },
];

// ─────────────────────────────────────────────────────────────
// CALL 1B — Silicon Audience
//
// v6: alineado con el nuevo SILICON_AUDIENCE_SCHEMA (perfil_id,
// eventos_atencion, patron_abandono/retencion). Ya no tiene tags
// de texto — el schema impone la estructura.
// ─────────────────────────────────────────────────────────────
export const buildSiliconAudiencePrompt = (hookDescripcion, marketState, platform, duracionSegundos) => {
  const pName = {
    tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts'
  }[platform] || platform;

  const perfilesStr = SILICON_PROFILES.map(p =>
    `[${p.id.toUpperCase()}] ${p.descripcion} (peso=${p.peso}, ${p.volumen})`
  ).join('\n');

  return `
<role>
Sos un simulador de audiencia real de ${pName}. Vas a encarnar, uno por uno, a seis personas distintas viendo este video.
</role>

<context>
DURACIÓN: ${duracionSegundos}s
MERCADO: ${JSON.stringify(marketState)}

REFERENCIA DEL HOOK (detectada en un paso previo, solo los primeros segundos — es un punto de partida, NO una descripción del video completo. Mirá vos mismo el desarrollo entero y confirmá, corregí o ignorá esto si el video te muestra algo distinto):
"${hookDescripcion}"

USUARIOS A SIMULAR:
${perfilesStr}
</context>

<task>
Tenés acceso directo al video completo. Para cada uno de los 6 usuarios, con total libertad de criterio: mirá el video de punta a punta y decidí en qué momentos concretos ese usuario sigue mirando o se va, y por qué. Tu propia observación manda por sobre la referencia del hook de arriba.

Después de simular a los 6 por separado, mirá el conjunto: identificá el segundo más peligroso, qué elemento retiene más, qué elemento expulsa más, y el patrón general de abandono y de retención que se repite entre los 6 perfiles.
</task>
`;
};

// ─────────────────────────────────────────────────────────────
// CALL 2 — Prediction Market
//
// v6: usa perfil_id (antes decía perfil_id sobre un campo que el
// schema llamaba "perfil" — ya está alineado), y pide explícitamente
// retencion_por_perfil + razonamiento_paso_a_paso, que ahora sí
// existen en PREDICTION_MARKET_SCHEMA.
// ─────────────────────────────────────────────────────────────
export const buildPredictionMarketPrompt = (simulacionSilicon, marketState, platform, industria) => {
  const pName = {
    tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts'
  }[platform] || platform;

  const resumen = simulacionSilicon.simulacion.map(p =>
    `${p.perfil_id}: ${p.decision_final} | completo:${p.completo} | compartió:${p.compartio} | ${p.razon_final}`
  ).join('\n');

  return `
<role>
Sos el prediction market de ${pName} para el nicho "${industria}": calibrás el score final combinando evidencia dura, no una impresión general.
</role>

<context>
SIMULACIÓN DE AUDIENCIA:
${resumen}
Segundo más peligroso: ${simulacionSilicon.segundo_mas_peligroso ?? '—'} | Retiene: ${simulacionSilicon.evento_que_mas_retiene} | Expulsa: ${simulacionSilicon.evento_que_mas_expulsa}
Patrón de abandono: ${simulacionSilicon.patron_abandono ?? '—'} | Patrón de retención: ${simulacionSilicon.patron_retencion ?? '—'}

ESTADO DEL MERCADO: ${JSON.stringify(marketState)}
</context>

<task>
Basándote en todo lo anterior: primero estimá la retención de cada uno de los 6 perfiles con su razón, después explicitá qué pesó más, y recién ahí fijá viralScore y salesScore. El perfil curioso_aleatorio pesa doble en el algoritmo real — tenelo en cuenta.
</task>
`;
};

// ─────────────────────────────────────────────────────────────
// CALL 3 — Scoring Brain
//
// v6: se sacó el listado campo-por-campo [VEREDICTO] — con un
// SCORING_BRAIN_SCHEMA completo, listar los campos en el prompt es
// redundante y, según la propia documentación de Gemini, puede
// confundir al modelo si el orden no coincide exactamente con el
// del schema. El prompt ahora solo da instrucciones de criterio;
// la estructura la impone el schema.
// ─────────────────────────────────────────────────────────────
export const buildScoringBrainPrompt = (
  hookDescripcion,
  audienceAnalysis,
  researchData,
  platform,
  objetivo,
  industria,
  duracionSegundos
) => `
<role>
Sos el auditor final de VIRAX: das un veredicto honesto y accionable, fundamentado en evidencia concreta, no en una impresión general del video.
</role>

<context>
PLATAFORMA: ${platform} | DURACIÓN: ${duracionSegundos}s | INDUSTRIA: ${industria} | OBJETIVO: ${objetivo}

REFERENCIA DEL HOOK (primeros segundos, detectada en un paso previo — no la tomes como descripción del video completo; observá vos mismo el desarrollo entero antes de puntuar):
"${hookDescripcion}"

SIMULACIÓN DE AUDIENCIA Y PREDICTION MARKET:
${audienceAnalysis}

BENCHMARK DE MERCADO:
${JSON.stringify(researchData)}

Para nombrar el patrón del hook, usá uno de estos nombres exactos: ${HOOK_PATTERNS.join(", ")}.
</context>

<task>
Tenés acceso directo al video completo. Basándote en todo lo anterior: analizá primero el hook, el frame 0 (scroll-stop) y el framework STEPPS. Con eso ya observado, escribí tu razonamiento sobre el score viral y el de ventas ANTES de fijar los números — los números son consecuencia de ese razonamiento, no al revés.

Si hay problemas reales, nombralos sin suavizarlos. El roadmap solo debe incluir problemas que vos mismo detectaste en este video puntual, ordenados por impacto real — nada genérico.
</task>
`;

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────
export const calcularCurvaRetencionSilicon = (simulacion, duracionSegundos) => {
  if (!simulacion?.simulacion?.length) return [];
  const perfiles = simulacion.simulacion;
  const total    = perfiles.length;

  return Array.from({ length: Math.ceil(duracionSegundos) }, (_, s) => {
    const quedaron = perfiles.filter(p => {
      if (p.completo) return true;
      const primerAbandono  = p.eventos_atencion?.find(e => e.decision === 'ABANDONA');
      const abandonoSegundo = primerAbandono?.segundo ?? null;
      return abandonoSegundo === null || abandonoSegundo > s;
    }).length;
    return Math.round((quedaron / total) * 100);
  });
};

export const buildSiliconSummary = (simulacion, predictionMarket) => {
  if (!simulacion?.simulacion?.length) return null;
  const perfiles     = simulacion.simulacion;
  const total        = perfiles.length;
  const completaron  = perfiles.filter(p => p.completo).length;
  const compartieron = perfiles.filter(p => p.compartio).length;
  const guardaron    = perfiles.filter(p => p.guardo).length; // FIX v6: antes era p.guardó (con tilde), no coincidía con ningún campo real

  return {
    tasa_completado:      Math.round((completaron  / total) * 100),
    tasa_compartido:      Math.round((compartieron / total) * 100),
    tasa_guardado:        Math.round((guardaron    / total) * 100),
    segundo_peligroso:    simulacion.segundo_mas_peligroso  ?? null,
    evento_retiene:       simulacion.evento_que_mas_retiene ?? '',
    evento_expulsa:       simulacion.evento_que_mas_expulsa ?? '',
    patron_abandono:      simulacion.patron_abandono        ?? '',
    patron_retencion:     simulacion.patron_retencion       ?? '',
    retencion_por_perfil: predictionMarket?.retencion_por_perfil ?? {},
    probabilidad_viral:   predictionMarket?.probabilidad_viral   ?? null,
    confianza:            predictionMarket?.confianza_prediccion  ?? 'baja',
    detalle_perfiles:     perfiles,
  };
};

// ── JS — Hook Gate — sin cambios ───────────────────────────────
export const deriveHookGateStatus = (preFacts) => {
  const gate     = preFacts?.hook_gate;
  const hookType = preFacts?.hook_type_detectado ?? '';
  const atomicas = preFacts?.atomicas ?? {};

  if (!gate) return { passed: null, penaltyLevel: 'none', reason: 'gate_no_disponible' };

  const silenceS = Number(atomicas.silence_duration_s ?? 0);
  const totalS   = Number(atomicas.duration_total_s ?? 30);

  if (!atomicas.audio_in_first_second && silenceS > totalS * 0.8)
    return { passed: false, penaltyLevel: 'hard', reason: 'video_sin_audio_slideshow' };

  if (hookType === 'muerto' && Number(preFacts?.hook_confianza ?? 0.5) >= 0.75)
    return { passed: false, penaltyLevel: 'soft', reason: 'hook_type_muerto_alta_confianza' };

  if (gate.veredicto_gate === 'MUERTO')
    return { passed: false, penaltyLevel: 'soft', reason: `hook_sin_retencion_cognitiva — pregunta: "${gate.pregunta_activa_en_espectador}" / elemento: "${gate.elemento_que_retiene}"` };

  const payoffS   = Number(atomicas.payoff_second ?? 0);
  const cutsP10   = Number(atomicas.cuts_per_10s ?? 0);
  const hasRehook = atomicas.rehook_present ?? false;
  const motionInt = Number(atomicas.motion_intensity ?? 0);

  if (payoffS > 8 && cutsP10 < 3 && motionInt < 0.2 && !hasRehook)
    return { passed: true, penaltyLevel: 'medium', reason: `espera_riesgosa — payoff en s${payoffS} sin cortes ni movimiento ni rehook` };

  const waitPenalty = (payoffS > 4 && cutsP10 < 5 && !hasRehook) ? { segundos: payoffS, cuts: cutsP10 } : null;
  return { passed: true, penaltyLevel: waitPenalty ? 'minimal' : 'none', reason: `retencion_confirmada: ${gate.elemento_que_retiene}`, waitPenalty };
};

export const deriveViralCap = (hookGateStatus, preFacts, nicheConfig = null) => {
  const nicheCap     = nicheConfig?.score_cap?.viralScore ?? 100;
  const atomicas     = preFacts?.atomicas ?? {};
  const penaltyLevel = hookGateStatus?.penaltyLevel ?? 'none';
  const capPorPenalty = { none: 100, minimal: 80, medium: 55, soft: 55, hard: 30 };
  const baseCap = capPorPenalty[penaltyLevel] ?? 100;

  // ── Slideshow sin audio — cap duro independiente de la palanca ──
  const esSlideshow = preFacts?.es_slideshow_imagenes === true;
  const sinAudio    = !atomicas.audio_in_first_second && (atomicas.silence_duration_s ?? 0) > 5;

  if (esSlideshow && sinAudio)
    return { cap: Math.min(nicheCap, 28, baseCap), reason: 'slideshow_sin_audio — formato sin retención algorítmica' };

  if (sinAudio && (atomicas.duration_total_s ?? 0) > 10)
    return { cap: Math.min(nicheCap, 35, baseCap), reason: 'video_sin_audio — retención nativa imposible sin gancho sonoro' };

  const lento = (atomicas.cuts_per_10s ?? 0) < 2 && (atomicas.silence_duration_s ?? 0) > 8 && (atomicas.average_shot_duration_s ?? 0) > 6;
  if (lento) return { cap: Math.min(nicheCap, 40, baseCap), reason: 'video_lento_extremo_sin_audio' };

  return { cap: Math.min(nicheCap, baseCap), reason: penaltyLevel === 'none' ? 'sin_penalizacion' : `penalizacion_${penaltyLevel}: ${hookGateStatus?.reason ?? ''}` };
};

export const deriveHookType = (preFacts) => {
  if (!preFacts || !Object.keys(preFacts).length) return 'debil';
  if (preFacts.logo_en_s0) return 'muerto';
  if (
    preFacts.hook_type_detectado &&
    preFacts.hook_confianza >= 0.7 &&
    preFacts.hook_type_detectado !== 'debil' &&
    preFacts.hook_type_detectado !== 'muerto'
  ) {
    return preFacts.hook_type_detectado;
  }
  if (preFacts.pregunta_al_espectador || preFacts.afirmacion_contradictoria) return 'explosivo';
  if (preFacts.imagen_alto_impacto && preFacts.producto_en_s0)               return 'bait_con_puente';
  if (preFacts.imagen_alto_impacto)                                           return 'bait_desconectado';
  if (preFacts.producto_en_accion_s0 || preFacts.transformacion_visible)      return 'bait_con_puente';
  if (preFacts.producto_en_s0)                                                return 'apertura_informativa';
  return 'debil';
};

export const buildFlagsDeterministic = (flagsFromStrategy, preFacts, preHookType) => {
  if (!preFacts || !Object.keys(preFacts).length) return flagsFromStrategy;
  return {
    ...flagsFromStrategy,
    hook_type:                 preHookType,
    ad_filter_triggered:       !!preFacts.logo_en_s0,
    no_audio_from_s0:          (preFacts.audio_desde_s0 === false) || !!flagsFromStrategy.no_audio_from_s0,
    is_static_slideshow:       (preFacts.es_slideshow_imagenes === true) || !!flagsFromStrategy.is_static_slideshow,
    pain_missing:              (preFacts.dolor_antes_s5 === false) || !!flagsFromStrategy.pain_missing,
    pain_late:                 (Number(preFacts.segundo_dolor) > 5) || !!flagsFromStrategy.pain_late,
    no_rehook:                 (!preFacts.tiene_rehook && (preFacts.duracion_estimada_segundos ?? 0) > 20) || !!flagsFromStrategy.no_rehook,
    short_video_advantage:     (preFacts.duracion_estimada_segundos ?? 999) < 15 || !!flagsFromStrategy.short_video_advantage,
    duration_kills_completion: ((preFacts.duracion_estimada_segundos ?? 0) > 60 && !preFacts.tiene_rehook) || !!flagsFromStrategy.duration_kills_completion,
    es_slideshow_imagenes:     preFacts.es_slideshow_imagenes ?? false,
    porcentaje_video_real:     preFacts.porcentaje_video_real ?? 100,
    tipo_edicion:              preFacts.tipo_edicion || 'desconocido',
    ritmo_visual:              preFacts.ritmo_visual || 'normal',
    cortes_por_minuto:         preFacts.cortes_por_minuto ?? 0,
    hook_descripcion_libre:    preFacts.hook_libre ?? null,
  };
};

// ═════════════════════════════════════════════════════════════
// ADMIN — Indexado del corpus histórico
//
// Esto NO va en el bundle del cliente (React/App.jsx). Es un script
// de administración/backend (Node.js) que corrés una vez para
// cargar tu histórico de miles de hooks y desarrollos, y después
// cada vez que sumes ejemplos nuevos. Requiere @google/genai
// >= 1.29.0 y GOOGLE_API_KEY en el entorno.
//
// Al taggear cada entrada, usá siempre un valor de HOOK_PATTERNS
// como `patron` — así el filtro por patrón en fileSearchFiltersHook
// agrupa ejemplos realmente comparables entre sí.
//
// Uso típico (script separado, ej. scripts/indexar-corpus.mjs):
//
//   import { GoogleGenAI } from '@google/genai';
//   import { ensureFileSearchStore, indexEntry, FILE_SEARCH_STORE_DISPLAY_NAME } from './virax-prompts.js';
//   const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
//   const store = await ensureFileSearchStore(ai);
//   for (const entry of miCorpusHistorico) {
//     await indexEntry(ai, store.name, entry);
//   }
// ═════════════════════════════════════════════════════════════

export const ensureFileSearchStore = async (ai, displayName = FILE_SEARCH_STORE_DISPLAY_NAME) => {
  const pager = await ai.fileSearchStores.list({ config: { pageSize: 20 } });
  let page = pager.page;
  while (true) {
    const found = page.find((s) => s.displayName === displayName);
    if (found) return found;
    if (!pager.hasNextPage()) break;
    page = await pager.nextPage();
  }
  return ai.fileSearchStores.create({ config: { displayName } });
};

export const indexEntry = async (ai, storeName, entry) => {
  const {
    texto,
    segmento,       // "hook" | "desarrollo"
    resultado,      // "bueno" | "malo"
    industria,
    patron = "debil", // usar siempre un valor de HOOK_PATTERNS
    plataforma = "all",
    displayName = `${segmento}-${Date.now()}`,
  } = entry;

  const file = new Blob([texto], { type: "text/plain" });

  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file,
    fileSearchStoreName: storeName,
    config: {
      displayName,
      mimeType: "text/plain",
      customMetadata: [
        { key: "segmento", stringValue: segmento },
        { key: "resultado", stringValue: resultado },
        { key: "industria", stringValue: industria },
        { key: "patron", stringValue: patron },
        { key: "plataforma", stringValue: plataforma },
      ],
    },
  });

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    operation = await ai.operations.get({ operation });
  }

  return operation;
};

export const indexBatch = async (ai, storeName, entries, concurrencia = 5) => {
  const resultados = [];
  for (let i = 0; i < entries.length; i += concurrencia) {
    const lote = entries.slice(i, i + concurrencia);
    const ops = await Promise.all(lote.map((entry) => indexEntry(ai, storeName, entry)));
    resultados.push(...ops);
    console.log(`Indexados ${Math.min(i + concurrencia, entries.length)}/${entries.length}`);
  }
  return resultados;
};