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
// FILE SEARCH — configuración y helpers (sin cambios respecto a v7)
// ═════════════════════════════════════════════════════════════

export const FILE_SEARCH_STORE_DISPLAY_NAME = "virax-corpus-viral";

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

export const fileSearchFiltersHook = (industria, plataforma, patron) => ({
  segmento: "hook",
  industria,
  ...(plataforma && plataforma !== "all" ? { plataforma } : {}),
  ...(patron ? { patron } : {}),
});

export const fileSearchFiltersDesarrollo = (industria, plataforma) => ({
  segmento: "desarrollo",
  industria,
  ...(plataforma && plataforma !== "all" ? { plataforma } : {}),
});

// ═════════════════════════════════════════════════════════════
// VIDEO INPUT CONFIG — NUEVO EN v9
//
// Fundamento (documentación oficial de Gemini API, ai.google.dev):
// 1) El File API muestrea video a 1 frame por segundo por defecto y
//    audio a 1Kbps. Esto puede perder detalle en secuencias de acción
//    rápida — textualmente Google recomienda "ralentizar esos clips
//    si es necesario" o usar un fps más alto. Un hook viral de TikTok
//    suele tener cortes de <1s (shock visual, pattern interrupt,
//    payoff negado), que a 1 FPS pueden no llegar a muestrearse.
// 2) Gemini soporta fps dinámico por request (0.1 a 60 FPS) vía
//    videoMetadata.fps en la parte de video del contenido.
// 3) media_resolution controla tokens por frame (66 en "low" vs 258
//    en resolución default/alta) — afecta directamente la capacidad
//    de leer texto en pantalla o detalles pequeños del frame 0.
//
// Esto es responsabilidad de quien arma el `contents`/`input` de la
// llamada (gemini-proxy), no del texto del prompt en sí — pero el
// texto del prompt SÍ debe saber qué limitación de muestreo tiene,
// para no inventar una lectura segura de algo que no llegó a ver.
// ═════════════════════════════════════════════════════════════

export const VIDEO_INPUT_CONFIG = {
  // CALL 0 necesita ver con precisión los primeros segundos (el hook)
  // frame por frame — ahí es donde más duele perder muestreo. Se sube
  // el fps sólo en la ventana del hook si tu pipeline permite recorte
  // (videoMetadata.startOffset/endOffset + fps más alto en ese tramo).
  call0_preClassifier: {
    fps_recomendado: 4, // vs 1 FPS por defecto — cortes <1s se pierden a 1 FPS
    media_resolution: "default", // NO "low": necesita leer texto en pantalla y logos pequeños
  },
  // CALL 1B simula percepción completa del video por 6 perfiles —
  // beneficia de más detalle visual que "low", pero el video entero
  // (no sólo el hook) hace que un fps muy alto sea costoso.
  call1b_siliconAudience: {
    fps_recomendado: 2,
    media_resolution: "default",
  },
  // CALL 3 arma el hookDNA completo y erroresFatales con timestamps —
  // es el análisis más fino de todos. No debería ir en "low".
  call3_scoringBrain: {
    fps_recomendado: 2,
    media_resolution: "default",
  },
  // Recordatorio de la documentación: si el prompt combina texto y
  // un solo video, la parte de video debe ir ANTES de la parte de
  // texto dentro del array `contents`/`input`. Auditar gemini-proxy.
  orden_contents: "video_primero_texto_despues",
};

// ═════════════════════════════════════════════════════════════
// GENERATION_CONFIG
//
// v9: se agrega thinkingConfig explícito a cada call. Gemini 2.5
// Flash es un modelo de razonamiento híbrido con thinking budget
// configurable (0 a 24576 tokens; 0 lo apaga, -1 es modo dinámico).
// No fijarlo deja el nivel de razonamiento de cada corrida a un
// comportamiento no controlado — que es especialmente grave en
// CALL 3, porque tu consenso multi-run (runScoringBrainWithConsensus)
// asume que la varianza entre corridas es "ruido normal de sampling";
// si el thinking budget también varía sin control entre corridas,
// esa varianza deja de ser sólo ruido de sampling y empieza a ser
// ruido de profundidad de razonamiento, lo cual rompe el supuesto
// detrás del umbral de confianza_consenso (15 puntos).
// ═════════════════════════════════════════════════════════════
export const GENERATION_CONFIG = {
  call0_preClassifier: {
    model: "gemini-2.5-flash",
    temperature: 0.4,
    responseMimeType: undefined, // texto plano [DESCRIPCION]/[SEÑALES], no JSON mode
    media_resolution: "default", // antes "low" — necesita leer texto en pantalla / logo / elemento_en_s0 con precisión
    thinkingConfig: { thinkingBudget: 3072 }, // observación factual con algo de margen para resolver ambigüedad, sin sobrepensar
    videoFps: VIDEO_INPUT_CONFIG.call0_preClassifier.fps_recomendado,
  },
  call1_5_researchBrain: {
    model: "gemini-2.5-flash",
    temperature: 0.5,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingBudget: 2048 }, // research vía file search, razonamiento liviano
  },
  call1b_siliconAudience: {
    model: "gemini-2.5-flash",
    temperature: 0.9, // intencional — ver nota en v7 changelog
    responseMimeType: "application/json",
    media_resolution: "default", // antes "low" — simular 6 perfiles sobre el video completo se beneficia de más detalle visual
    thinkingConfig: { thinkingBudget: 8192 }, // simular 6 perfiles distintos sobre el video completo requiere más razonamiento
    videoFps: VIDEO_INPUT_CONFIG.call1b_siliconAudience.fps_recomendado,
  },
  call2_predictionMarket: {
    model: "gemini-2.5-flash",
    temperature: 0.3,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingBudget: 4096 }, // calibrar números a partir de evidencia ya generada
  },
  call3_scoringBrain: {
    model: "gemini-2.5-flash",
    temperature: 0.3,
    responseMimeType: "application/json",
    media_resolution: "default", // antes "low" — hookDNA y erroresFatales necesitan detalle fino con timestamps
    thinkingConfig: { thinkingBudget: 12288 }, // el análisis más denso de todo el pipeline (hookDNA + riesgos + roadmap + scores)
    consensusRuns: 3, // ver runScoringBrainWithConsensus
    videoFps: VIDEO_INPUT_CONFIG.call3_scoringBrain.fps_recomendado,
  },
};

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
      description: "El patrón (de la taxonomía HOOK_PATTERNS) que más se repite entre los ejemplos ganadores recuperados. Acá SÍ es un catálogo cerrado válido: es un resumen agregado de ejemplos ya catalogados en la base indexada, no la observación directa de un video nuevo.",
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

          attentionRetentionStrength: {
            type: "NUMBER",
            minimum: 0,
            maximum: 100,
            description:
              "Qué tan fuerte retuvo la atención de ESTE perfil el mecanismo del video en sí mismo (ritmo, estímulo " +
              "visual/sonoro, curiosidad generada), independientemente de si el contenido conectaba temáticamente con " +
              "lo que el perfil esperaba encontrar.",
          },
          narrativeCoherencePerceived: {
            type: "NUMBER",
            minimum: 0,
            maximum: 100,
            description:
              "Qué tan conectado percibió ESTE perfil lo que retuvo su atención con lo que el video efectivamente " +
              "entregó después (o prometía entregar). Puede ser alto en atención y bajo en coherencia — por ejemplo, " +
              "un shock visual que engancha pero no tiene relación real con el resto del contenido.",
          },
          razon_final:    { type: "STRING", description: "Por qué este perfil tomó su decisión final, en su propio lenguaje. Si algún momento del video fue difícil de interpretar, decilo acá en vez de inventar una lectura segura." },
          decision_final: { type: "STRING", enum: ["RETUVO", "ABANDONÓ"], description: "Resultado final: si terminó viendo el video o lo abandonó en algún punto." },
          completo:       { type: "BOOLEAN", description: "Si llegó hasta el final del video." },
          compartio:      { type: "BOOLEAN", description: "Si este perfil compartiría el video." },
          guardo:         { type: "BOOLEAN", description: "Si este perfil guardaría el video." },
          comento:        { type: "BOOLEAN", description: "Si este perfil dejaría un comentario." },
        },
        propertyOrdering: [
          "perfil_id", "eventos_atencion",
          "attentionRetentionStrength", "narrativeCoherencePerceived",
          "razon_final", "decision_final", "completo", "compartio", "guardo", "comento",
        ],
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

        segundoDondeAparaceElValorReal: {
          type: "NUMBER",
          description:
            "En qué segundo exacto del video aparece el primer elemento de VALOR REAL para el espectador " +
            "(el producto en acción, la información prometida, el giro, la demostración — no un saludo, no una " +
            "presentación genérica, no un logo). Si el valor real está desde el segundo 0, poné 0. Medilo mirando " +
            "el video, no lo estimes.",
        },

        // v9: nuevo campo — el File API muestrea video a 1 frame por segundo por
        // defecto. Un hook con cortes menores a 1s puede no haberse muestreado
        // completo aunque este pipeline pida un fps más alto para este call.
        // Este campo obliga a declarar la incertidumbre en vez de rellenarla.
        confianzaDeMuestreoHook: {
          type: "STRING",
          enum: ["alta", "media", "baja"],
          description:
            "Qué tan seguro estás de haber visto TODOS los frames relevantes de los primeros 3 segundos. " +
            "'baja' si detectaste cortes muy rápidos, movimiento brusco, o cualquier indicio de que el video " +
            "cambia más rápido de lo que pudiste muestrear — en ese caso, decilo también en razonamiento_pattern " +
            "en vez de inventar una lectura segura de un frame que no llegaste a ver con claridad.",
        },

        riesgosDeRetencionDetectados: {
          type: "ARRAY",
          description:
            "Antes de puntuar, repasá el video con tu propio conocimiento de qué patrones suelen matar la " +
            "retención en redes sociales (arranques vacíos, promesas no cumplidas, ritmo que decae, audio ausente " +
            "en momentos clave, información crítica tardía, y cualquier otro patrón que reconozcas por tu propio " +
            "criterio — no hay una lista cerrada de cuáles buscar). Por cada riesgo real que detectes EN ESTE " +
            "VIDEO puntual, describilo con el timestamp y por qué es un riesgo acá específicamente. Si no detectás " +
            "ninguno, dejá el array vacío — no inventes riesgos para llenar el campo.",
          items: {
            type: "OBJECT",
            properties: {
              riesgo:             { type: "STRING", description: "Descripción del riesgo, en tus propias palabras." },
              timestamp:          { type: "STRING", description: "MM:SS donde ocurre." },
              severidad_estimada: { type: "STRING", enum: ["baja", "media", "alta"], description: "Tu propio criterio de cuánto pesa esto en el contexto de este video, plataforma y duración específicos." },
            },
            propertyOrdering: ["riesgo", "timestamp", "severidad_estimada"],
          },
        },

        razonamiento_pattern: {
          type: "STRING",
          description:
            "Antes de nombrar el patrón: ¿qué elemento concreto genera atención en los primeros segundos? " +
            "¿Ese elemento se resuelve, se conecta o queda huérfano respecto al resto del video? Escribí este " +
            "razonamiento ANTES de completar pattern, attentionStrength y thematicCoherence. Si tu " +
            "confianzaDeMuestreoHook es 'baja', decilo también acá explícitamente.",
        },
        pattern: {
          type: "STRING",
          description:
            "Nombrá con tus propias palabras qué tipo de gancho es, de la forma más precisa posible. " +
            "No existe una lista cerrada de opciones — hay miles de formatos válidos o inválidos y en evolución constante. " +
            `Ejemplos de nombres que OTROS análisis usaron antes (solo como referencia de nivel de precisión ` +
            `esperado, no como opciones obligatorias): ${HOOK_PATTERNS.join(", ")}. ` +
            "Si el video no se parece a ninguno de esos, describí el mecanismo real con tus propias palabras — " +
            "es preferible un nombre nuevo y preciso que forzar el caso a uno de los ejemplos. Ej: si el video " +
            "corta justo antes de mostrar algo que prometía mostrar (como una piedra a punto de caer al agua y " +
            "un corte abrupto antes del impacto), y no tenés un nombre mejor, 'payoff negado' es un buen nombre — " +
            "pero si el mecanismo real combina dos cosas a la vez (ej: dolor nombrado directo + demostración " +
            "inmediata del producto resolviéndolo), describí esa combinación en vez de forzarlo a una sola etiqueta.",
        },
        missingElement: { type: "STRING", description: "Qué elemento le falta al hook para ser más efectivo." },
        attentionStrength: {
          type: "NUMBER",
          minimum: 0,
          maximum: 100,
          description: "Qué tan fuerte es el elemento de atención inicial identificado en razonamiento_pattern, independientemente de si se resuelve después.",
        },
        thematicCoherence: {
          type: "NUMBER",
          minimum: 0,
          maximum: 100,
          description: "Qué tan bien conecta ese elemento de atención inicial con el resto del video (vs. quedar huérfano o ser un cebo desconectado).",
        },

        strength: {
          type: "NUMBER",
          minimum: 0,
          maximum: 100,
          description:
            "Fuerza del hook — juzgá con tu propio criterio qué tan efectivo es este gancho para detener el scroll " +
            "de alguien que no lo estaba buscando y darle motivo de seguir mirando. No hay checklist de elementos " +
            "obligatorios: un video puede lograrlo por vías que no están en ningún ejemplo previo. " +
            "Tené en cuenta lo que vos mismo mediste en segundoDondeAparaceElValorReal y en " +
            "riesgosDeRetencionDetectados: cuanto más tarde aparece el valor real, y cuantos más riesgos de " +
            "severidad alta detectaste, más debería golpear esto al score — pero el peso exacto que le des es " +
            "tu criterio, no una fórmula fija (un video largo de nicho tolera más espera que un short de feed " +
            "genérico). Si tu confianzaDeMuestreoHook es 'baja', evitá puntuar en los extremos (0-10 o 90-100): " +
            "sin certeza de haber visto todo, un puntaje extremo es más riesgoso que uno moderado. " +
            "Guía de tramos, en términos de EFECTIVIDAD real (no de qué ingredientes específicos aparecen) — " +
            "0-20: no hay mecanismo de hook identificable, nada en el video le daría a alguien un motivo para no " +
            "seguir scrolleando. 21-45: hay algo de mecanismo pero es fácil de ignorar en el feed, ejecución débil. " +
            "46-70: el mecanismo funciona y es reconocible, pero de forma genérica o ya vista en el nicho. " +
            "71-90: el mecanismo es fuerte y está bien ejecutado, con al menos un elemento diferenciador real " +
            "respecto al benchmark del nicho, sea cual sea la forma concreta que tome. " +
            "91-100: ejecución excepcional, sin fricción, diseñada deliberadamente para retener contra el algoritmo.",
        },

        optimizedHook: { type: "STRING", description: "Una propuesta concreta de hook mejorado." },
      },

      propertyOrdering: [
        "segundoDondeAparaceElValorReal",
        "confianzaDeMuestreoHook",
        "riesgosDeRetencionDetectados",
        "razonamiento_pattern",
        "pattern",
        "missingElement",
        "attentionStrength",
        "thematicCoherence",
        "strength",
        "optimizedHook",
      ],
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
        score: {
          type: "NUMBER",
          minimum: 0,
          maximum: 100,
          description:
            "Qué tan bien el frame 0 detiene el scroll — juzgá la efectividad real de detención en menos de un " +
            "segundo, no la presencia de una lista fija de ingredientes. faceDetected/textOnScreen/contrastLevel " +
            "son observaciones de apoyo, no una checklist que el frame tenga que cumplir para puntuar alto: un " +
            "frame puede detener el scroll por una vía que no está en esos campos. Guía de tramos, en términos de " +
            "efectividad — 0-20: el frame 0 no le da a nadie un motivo para detenerse, no hay ambigüedad: es " +
            "ignorable. 21-45: hay algo que podría llamar la atención pero es débil o fácilmente ignorable en el " +
            "feed. 46-70: el frame 0 efectivamente detiene el scroll de una porción real de audiencia, por la vía " +
            "que sea. 71-90: el frame 0 detiene el scroll de forma robusta, combinando más de un recurso reforzándose " +
            "entre sí. 91-100: frame 0 diseñado deliberadamente para el algoritmo, sin ambigüedad de qué está " +
            "pasando en menos de un segundo.",
        },
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
        score: {
          type: "NUMBER",
          minimum: 0,
          maximum: 100,
          description:
            "Score de potencial viral, rúbrica — 0-20: prácticamente sin mecanismo de retención ni de compartir. " +
            "21-40: retiene a un perfil aislado pero no genera impulso de compartir. 41-60: retiene a la mayoría de " +
            "perfiles promedio/nicho pero sin gancho para viralizar más allá de su audiencia habitual. 61-80: combina " +
            "retención sólida con al menos un factor STEPPS fuerte (emoción, trigger o valor práctico) que empuja el " +
            "compartido. 81-100: retiene a los 6 perfiles simulados — incluido el escéptico — y genera motivo claro " +
            "de compartir fuera del nicho de origen. " +
            "Tiene que ser consistente con hookDNA.riesgosDeRetencionDetectados: si ahí detectaste riesgos de " +
            "severidad alta, eso tiene que reflejarse en un score más bajo y quedar explicado en " +
            "razonamiento_viralScore — vos decidís cuánto pesa cada riesgo según el contexto del video, no hay " +
            "una tabla fija de puntos a descontar. " +
            "REGLA DE ORO: la retención es un multiplicador, no un promedio. Si en hookDNA.riesgosDeRetencionDetectados " +
            "marcaste un riesgo de severidad alta ocurrido en los primeros 3 segundos, el score viral NO PUEDE superar " +
            "los 40 puntos, sin importar qué tan bueno sea el resto del video. Un fallo crítico temprano es una barrera " +
            "insuperable, no un punto negativo que se compensa con otras virtudes.",
        },
      },
      propertyOrdering: ["verdict", "accion_clave", "score"],
    },
    salesScore: {
      type: "OBJECT",
      properties: {
        verdict:      { type: "STRING" },
        accion_clave: { type: "STRING" },
        score: {
          type: "NUMBER",
          minimum: 0,
          maximum: 100,
          description:
            "Score de potencial de ventas, rúbrica — 0-20: no hay señal de venta identificable (producto/oferta " +
            "ausente o irreconocible). 21-40: producto visible pero sin dolor planteado, sin CTA, o sin claridad de " +
            "qué se vende. 41-60: dolor y producto presentes pero falta urgencia o señal de confianza. 61-80: dolor " +
            "claro, producto claro, señal de confianza del nicho presente, CTA implícito o explícito. 81-100: ciclo " +
            "completo dolor→solución→confianza→CTA sin fricción, con el perfil 'comprador' entendiendo qué comprar " +
            "y por qué ahora.",
        },
      },
      propertyOrdering: ["verdict", "accion_clave", "score"],
    },
    honestVerdict: { type: "STRING", description: "El veredicto más honesto posible, en 1-2 frases, sin suavizarlo. Debe ser consistente con roadmap y con viralScore/salesScore — nunca optimista si el roadmap tiene un problema de impacto ALTO o los scores son bajos." },
    erroresFatales: {
      type: "ARRAY",
      minItems: 3,
      maxItems: 3,
      description:
        "Encontrá EXACTAMENTE 3 razones por las cuales un espectador cerraría el video o dejaría de mirarlo. " +
        "Es obligatorio completar las 3, sin excepción — si el video es bueno y no hay 3 fallas evidentes, " +
        "elegí las 3 más plausibles de todos modos (por más menores que sean) y marcalas con gravedad 'menor'. " +
        "Nunca dejes el array con menos de 3 elementos. Ordenalos del más letal al menos letal.",
      items: {
        type: "OBJECT",
        properties: {
          error:        { type: "STRING", description: "El error, en términos concretos." },
          timestamp:    { type: "STRING", description: "MM:SS donde ocurre, o 'todo el video' si es estructural." },
          por_que_mata: { type: "STRING", description: "Por qué esto hace que el espectador se vaya." },
          gravedad:     { type: "STRING", enum: ["letal", "grave", "menor"] },
        },
        propertyOrdering: ["error", "timestamp", "por_que_mata", "gravedad"],
      },
    },
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
        tiktok: {
          type: "OBJECT",
          properties: {
            verdict: { type: "STRING" },
            topTip:  { type: "STRING" },
            score: {
              type: "NUMBER", minimum: 0, maximum: 100,
              description:
                "Ajuste del score general a las particularidades de TikTok. Rúbrica — 0-30: el formato del video es " +
                "contraproducente en esta plataforma. 31-60: funciona de forma neutral, sin ventaja ni penalización " +
                "por plataforma. 61-100: aprovecha activamente convenciones propias de TikTok (algoritmo, formato, " +
                "comportamiento de usuarios) para performar mejor que en Reels o Shorts.",
            },
          },
          propertyOrdering: ["verdict", "topTip", "score"],
        },
        reels: {
          type: "OBJECT",
          properties: {
            verdict: { type: "STRING" },
            topTip:  { type: "STRING" },
            score: {
              type: "NUMBER", minimum: 0, maximum: 100,
              description:
                "Ajuste del score general a las particularidades de Instagram Reels. Misma rúbrica de tramos que " +
                "tiktok.score, aplicada a las convenciones específicas de Reels.",
            },
          },
          propertyOrdering: ["verdict", "topTip", "score"],
        },
        shorts: {
          type: "OBJECT",
          properties: {
            verdict: { type: "STRING" },
            topTip:  { type: "STRING" },
            score: {
              type: "NUMBER", minimum: 0, maximum: 100,
              description:
                "Ajuste del score general a las particularidades de YouTube Shorts. Misma rúbrica de tramos que " +
                "tiktok.score, aplicada a las convenciones específicas de Shorts.",
            },
          },
          propertyOrdering: ["verdict", "topTip", "score"],
        },
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
    "erroresFatales",
    "razonamiento_viralScore", "razonamiento_salesScore",
    "viralScore", "salesScore", "honestVerdict", "roadmap", "vision",
    "platformScores", "retentionData", "retentionCurve",
    "viewsPrediction", "firstHourStrategy", "commentTrigger",
  ],
};

// ─────────────────────────────────────────────────────────────
// CALL 0 — Observador del HOOK
//
// v9: se agrega contexto explícito sobre la tasa de muestreo real
// del video, fundamentado en documentación oficial de Gemini API
// (ai.google.dev/gemini-api/docs/video-understanding): el File API
// muestrea video a 1 frame por segundo por defecto, y advierte que
// las secuencias de acción rápida pueden perder detalle a esa tasa.
// Este pipeline debe pasar videoFps más alto para este call (ver
// VIDEO_INPUT_CONFIG.call0_preClassifier.fps_recomendado = 4) vía
// videoMetadata.fps en la parte de video del `contents`, pero aun
// con eso, cortes de fracción de segundo pueden seguir sin verse
// completos. El prompt necesita que el modelo declare esa duda en
// vez de rellenarla con una lectura inventada.
// ─────────────────────────────────────────────────────────────
export const buildPreClassifierPrompt = (hookWindowSegundos = 5) => `
<role>
Sos un observador técnico de video. Tu trabajo es reportar hechos, no opinar ni evaluar.
</role>

<context>
Tenés acceso directo al video completo. Vas a mirarlo entero, de principio a fin, sin saltear nada — lo necesitás completo para responder [SEÑALES] con precisión, aunque [DESCRIPCION] solo te pida los primeros segundos.

Limitación técnica a tener en cuenta: el muestreo de video de este sistema no captura necesariamente cada instante — es posible que algunos cortes o cambios visuales muy rápidos (menores a medio segundo) no se hayan muestreado por completo. Si en los primeros ${hookWindowSegundos} segundos notás movimiento brusco, corte muy rápido, o cualquier indicio de que pasó algo entre dos frames que no llegaste a ver con nitidez, decilo explícitamente en [DESCRIPCION] y marcá muestreo_incompleto: sí en [SEÑALES] — no completes esos huecos con una suposición que suene segura.
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
muestreo_incompleto: <sí|no — sí si en el hook hubo algún corte o cambio tan rápido que no pudiste verlo con nitidez>
[/SEÑALES]
</task>
`;

// ─────────────────────────────────────────────────────────────
// parsePreClassifierResponse
//
// v9: se agrega el parseo de muestreo_incompleto (nuevo campo de
// SEÑALES) para que el resto del pipeline pueda propagar esa
// incertidumbre en vez de perderla en el paso 0.
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
  const muestreo_incompleto    = parseBool(getRef('muestreo_incompleto'));

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
    muestreo_incompleto,
    atomicas,
    _raw_referencias: refBlock.trim(),
  };
};

// ─────────────────────────────────────────────────────────────
// CALL 1.5 — Research Brain (sin cambios respecto a v8)
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
Para patron_hook_dominante, usá siempre uno de estos nombres exactos (acá sí es un catálogo cerrado, porque es un resumen agregado de ejemplos ya catalogados en la base, no la observación de un video nuevo): ${HOOK_PATTERNS.join(", ")}.
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
    peso: 3,
    descripcion: 'Toxic Scroller. Odia que le vendan, odia las intros, odia los logos.',
    psicologia: {
      impatience: 0.99,
      tolerance_to_confusion: 0.0,
      tolerance_to_ads: 0.0
    },
    retiene_si: 'Shock absoluto o valor masivo en s0.01.',
    abandona_si: 'Un respiro, un parpadeo, un "Hola", un logo o un texto que no se lee en 0.5s.',
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
// CALL 1B — Silicon Audience (sin cambios estructurales)
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

Para cada perfil, juzgá dos cosas por separado, porque son preguntas distintas: (1) qué tan fuerte lo retuvo el mecanismo del video en sí mismo — ritmo, estímulo, curiosidad generada — independientemente de si conectaba con lo que esperaba encontrar; y (2) qué tan conectado percibió, una vez retenido, lo que vio con lo que el video efectivamente entregó o prometía entregar. Un video puede retener fuerte y a la vez sentirse desconectado temáticamente — no promedies esos dos juicios en uno solo.

Después de simular a los 6 por separado, mirá el conjunto: identificá el segundo más peligroso, qué elemento retiene más, qué elemento expulsa más, y el patrón general de abandono y de retención que se repite entre los 6 perfiles.

Si algún tramo del video es difícil de interpretar (calidad de imagen baja, corte muy rápido, audio poco claro), decilo explícitamente en razon_final del perfil correspondiente en vez de inventar una lectura segura que no tenés.
</task>
`;
};

// ─────────────────────────────────────────────────────────────
// CALL 2 — Prediction Market (sin cambios respecto a v8)
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
// v9: se agrega contexto explícito sobre la tasa de muestreo de
// video (misma fundamentación que en CALL 0) y una instrucción
// para propagar la incertidumbre del hook si CALL 0 la reportó,
// en vez de que CALL 3 "resuelva" con confianza algo que el propio
// pipeline ya marcó como potencialmente no muestreado.
// ─────────────────────────────────────────────────────────────
export const buildScoringBrainPrompt = (
  hookDescripcion,
  audienceAnalysis,
  researchData,
  platform,
  objetivo,
  industria,
  duracionSegundos,
  muestreoIncompleto = false
) => `
<role>
Sos un usuario de TikTok que lleva 2 horas scrolleando, está cansado y tiene el dedo listo para deslizar ante la mínima señal de aburrimiento o falsedad. Tu estado por defecto es el rechazo. Solo un video excepcional merece que detengas tu dedo. No busques 'qué hay de bueno', busca 'por qué debería irme'.
</role>

<context>
PLATAFORMA: ${platform} | DURACIÓN: ${duracionSegundos}s | INDUSTRIA: ${industria} | OBJETIVO: ${objetivo}

REFERENCIA DEL HOOK (primeros segundos, detectada en un paso previo — no la tomes como descripción del video completo; observá vos mismo el desarrollo entero antes de puntuar):
"${hookDescripcion}"
${muestreoIncompleto ? '\nADVERTENCIA DE MUESTREO: el paso previo reportó que el hook tiene cortes o cambios visuales potencialmente más rápidos de lo que el sistema pudo muestrear con nitidez. Al completar hookDNA.confianzaDeMuestreoHook, tené esto en cuenta y evitá puntuar attentionStrength o strength en los extremos si vos tampoco lográs ver ese tramo con claridad.\n' : ''}
SIMULACIÓN DE AUDIENCIA Y PREDICTION MARKET:
${audienceAnalysis}

BENCHMARK DE MERCADO:
${JSON.stringify(researchData)}

Ejemplos de nombres de patrón de hook usados en análisis previos (solo como referencia de nivel de precisión esperado, no como lista obligatoria — hay miles de formatos válidos que no están acá): ${HOOK_PATTERNS.join(", ")}.

Nota técnica: el video puede haberse muestreado a más de 1 frame por segundo para este análisis, pero cortes menores a esa fracción de segundo igual pueden no haberse capturado con nitidez. Si algo en el hook te resulta ambiguo por esto, es más honesto decirlo en confianzaDeMuestreoHook que rellenar con una lectura seria.
</context>

<task>
Tenés acceso directo al video completo. Basándote en todo lo anterior: analizá primero el hook, el frame 0 (scroll-stop) y el framework STEPPS. Con eso ya observado, escribí tu razonamiento sobre el score viral y el de ventas ANTES de fijar los números — los números son consecuencia de ese razonamiento, no al revés.

No fuerces el video a encajar en un patrón conocido si no encaja bien. Confiá en tu propio criterio sobre qué hace que ESTE video en particular funcione o no — hay miles de formatos válidos que no están en ningún catálogo, y tu trabajo es juzgar el mecanismo real, no clasificarlo contra una lista cerrada. Si el mecanismo combina dos cosas a la vez, describí la combinación en vez de elegir una sola etiqueta que fuerce a que sean mutuamente excluyentes.

Si hay problemas reales, nombralos sin suavizarlos. El roadmap solo debe incluir problemas que vos mismo detectaste en este video puntual, ordenados por impacto real — nada genérico.

Si algún tramo del video es ambiguo o de difícil interpretación, decilo explícitamente en honestVerdict en vez de inventar una lectura segura que no tenés.

Antes de fijar honestVerdict: verificá que sea consistente con roadmap (si hay un problema de impacto ALTO, honestVerdict no puede sonar mayormente positivo) y con viralScore/salesScore (un score bajo no puede convivir con un veredicto que suena a video ganador). Si encontrás una inconsistencia interna, priorizá la evidencia del roadmap y de los scores por sobre el tono del veredicto — ajustá el texto del veredicto, nunca ajustes un score para que combine artificialmente con un veredicto ya escrito.
</task>
`;

// ─────────────────────────────────────────────────────────────
// CONSENSO MULTI-RUN
//
// Se aplica SOLO a CALL 3. mergeScoringBrainConsensus es pura
// (fácil de testear); runScoringBrainWithConsensus es el wrapper
// que efectivamente llama a la API. gemini-proxy/index.ts debería
// invocar runScoringBrainWithConsensus en vez de un solo
// generateContent suelto para esta llamada puntual.
//
// v9: ahora que GENERATION_CONFIG.call3_scoringBrain fija un
// thinkingConfig explícito (antes no fijaba nada), el supuesto de
// "la varianza entre corridas es ruido normal de sampling" es más
// sólido — antes esa varianza podía venir tanto del sampling como
// de un presupuesto de razonamiento distinto en cada corrida, sin
// forma de distinguir una causa de la otra.
// ─────────────────────────────────────────────────────────────

/**
 * Consolida N resultados ya parseados de SCORING_BRAIN_SCHEMA en
 * un único resultado, usando la mediana de viralScore.score y
 * salesScore.score. La corrida base (de donde salen todos los
 * campos cualitativos: hookDNA, roadmap, honestVerdict, etc.) es
 * la que tiene el viralScore.score más cercano a la mediana — no
 * simplemente la primera — para no arrastrar el razonamiento de
 * una corrida atípica.
 *
 * @param {Array<object>} parsedResults - outputs ya parseados (JSON.parse) de N corridas de CALL 3
 * @returns {object|null} resultado consolidado con _consensus_meta agregado
 */
export const mergeScoringBrainConsensus = (parsedResults) => {
  if (!parsedResults?.length) return null;
  if (parsedResults.length === 1) return parsedResults[0];

  const median = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const viralScores = parsedResults.map(p => p.viralScore.score);
  const salesScores  = parsedResults.map(p => p.salesScore.score);
  const medianViral  = median(viralScores);
  const medianSales  = median(salesScores);

  const baseIndex = viralScores.reduce(
    (closestIdx, score, idx) =>
      Math.abs(score - medianViral) < Math.abs(viralScores[closestIdx] - medianViral) ? idx : closestIdx,
    0
  );

  const merged = structuredClone(parsedResults[baseIndex]);
  merged.viralScore.score = Math.round(medianViral);
  merged.salesScore.score = Math.round(medianSales);

  const varianceViral = Math.max(...viralScores) - Math.min(...viralScores);
  const varianceSales = Math.max(...salesScores) - Math.min(...salesScores);

  // Señal adicional v9: si algún run marcó confianzaDeMuestreoHook
  // como 'baja', la varianza entre corridas es esperable y no debe
  // interpretarse como que el modelo "se confunde" sin motivo.
  const algunRunConMuestreoIncierto = parsedResults.some(
    p => p?.hookDNA?.confianzaDeMuestreoHook === 'baja'
  );

  merged._consensus_meta = {
    runs: parsedResults.length,
    base_run_index: baseIndex,
    viral_scores_raw: viralScores,
    sales_scores_raw: salesScores,
    variance_viral: varianceViral,
    variance_sales: varianceSales,
    muestreo_incierto_en_algun_run: algunRunConMuestreoIncierto,
    // Umbral de 15 puntos: por debajo, tratamos las corridas como
    // "el mismo veredicto con ruido normal de sampling". Por encima,
    // es señal real de video ambiguo — mostrarlo en la UI en vez de
    // esconder la incertidumbre detrás de un número falso de preciso.
    confianza_consenso: (varianceViral <= 15 && varianceSales <= 15) ? 'alta' : 'baja',
  };

  return merged;
};

// ← ACÁ va la nueva función
export const applyRiskBasedCap = (result) => {
  const riesgos = result?.hookDNA?.riesgosDeRetencionDetectados ?? [];
  const hayRiesgoAltoTemprano = riesgos.some(r => {
    if (r.severidad_estimada !== 'alta') return false;
    const [mm, ss] = (r.timestamp || '00:00').split(':').map(Number);
    return (mm * 60 + ss) <= 3;
  });

  if (hayRiesgoAltoTemprano && result.viralScore.score > 40) {
    const original = result.viralScore.score;
    result.viralScore.score = 40;
    result.viralScore.verdict += ` [Cap aplicado: riesgo severidad alta en los primeros 3s]`;
    result._cap_meta = { motivo: 'riesgo_severidad_alta_temprano', score_llm_original: original };
  }
  return result;
};

/**
 * Corre CALL 3 (Scoring Brain) N veces en paralelo con el mismo
 * contenido y consolida por mediana. Mitigación documentada contra
 * la falta de determinismo bit-a-bit de la Gemini API (persiste
 * incluso con temperature=0 + seed fijo).
 *
 * v9: se fija explícitamente thinkingConfig (ver GENERATION_CONFIG)
 * para que las N corridas razonen con un presupuesto consistente
 * entre sí, y se pasa videoMetadata.fps más alto que el default de
 * 1 FPS para este call — fundamentado en que Gemini permite fps
 * dinámico de 0.1 a 60 por request, y que a 1 FPS los cortes de
 * hook menores a un segundo pueden no muestrearse. El armado real
 * de `contents` (con el file part ANTES del texto, según indica
 * la documentación de Gemini para prompts de un solo video) sigue
 * siendo responsabilidad de `buildContentsFn`.
 *
 * @param {object} ai - cliente de @google/genai ya inicializado
 * @param {() => any} buildContentsFn - función que arma el `contents`
 *   completo de la llamada (incluyendo cachedContent/fileData +
 *   el texto de buildScoringBrainPrompt) — se invoca una vez por
 *   corrida porque `contents` no debe reusarse mutado entre llamadas.
 *   IMPORTANTE: la parte de video debe ir ANTES de la parte de texto
 *   en el array, y debería incluir videoMetadata: { fps: GENERATION_CONFIG.call3_scoringBrain.videoFps }
 *   cuando el video venga por File API.
 * @param {object} [options]
 * @param {number} [options.runs] - default: GENERATION_CONFIG.call3_scoringBrain.consensusRuns
 * @returns {Promise<object>} resultado consolidado, listo para pasar a App.jsx
 */
export const runScoringBrainWithConsensus = async (
  ai,
  buildContentsFn,
  { runs = GENERATION_CONFIG.call3_scoringBrain.consensusRuns } = {}
) => {
  const config = GENERATION_CONFIG.call3_scoringBrain;

  const calls = Array.from({ length: runs }, () =>
    ai.models.generateContent({
      model: config.model,
      contents: buildContentsFn(),
      config: {
        responseMimeType: config.responseMimeType,
        responseSchema: SCORING_BRAIN_SCHEMA,
        temperature: config.temperature,
        thinkingConfig: config.thinkingConfig,
        ...(config.media_resolution ? { mediaResolution: config.media_resolution } : {}),
      },
    })
  );

  const responses = await Promise.all(calls);
  const parsed = responses.map(r => JSON.parse(r.text));

  const merged = mergeScoringBrainConsensus(parsed);
  return applyRiskBasedCap(merged); // ← la única línea nueva acá
};

// ─────────────────────────────────────────────────────────────
// Utilidades (sin cambios respecto a v8)
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
  const guardaron    = perfiles.filter(p => p.guardo).length;

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
    muestreo_incompleto:       preFacts.muestreo_incompleto ?? false,
  };
};

// ═════════════════════════════════════════════════════════════
// ADMIN — Indexado del corpus histórico (sin cambios respecto a v8)
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
    segmento,
    resultado,
    industria,
    patron = "debil",
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