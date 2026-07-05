// ─────────────────────────────────────────────────────────────
// virax-prompts.js — VIRAX v5 (File Search + anti-contaminación
// entre brains + timestamps nativos de Gemini)
//
// Todos los prompts, schemas y utilidades de scoring viven acá.
// App.jsx SOLO importa de este archivo — no vuelve a declarar
// nada de esto localmente. Si necesitás modificar un prompt,
// se edita ÚNICAMENTE acá.
//
// CAMBIOS v3 -> v4:
// - Se agrega la sección FILE SEARCH (RAG nativo de Gemini): en vez
//   de pedirle al modelo que "recuerde" hooks virales de su
//   entrenamiento, se consulta una base real e indexada de hooks y
//   desarrollos (buenos y malos) con miles de ejemplos.
// - buildResearchBrainPrompt se ACHICA: ya no describe ejemplos a
//   mano, delega la búsqueda al tool file_search.
// - Se agregan helpers de indexado (uso admin / backend, no en el
//   bundle del cliente) para cargar el corpus histórico.
//
// CAMBIOS v4 -> v5:
// - CALL 0 ya NO describe el video completo. [DESCRIPCION] queda
//   limitada al hook (primeros `hookWindowSegundos` segundos).
//   Antes, esa descripción completa se pasaba a CALL 1B y CALL 3,
//   que YA miran el video entero por su cuenta (vía context cache)
//   — recibirla los anclaba a la lectura de CALL 0 en vez de
//   observar de forma independiente. [SEÑALES] sigue requiriendo
//   el video completo porque son hechos objetivos, no narrativa.
// - buildSiliconAudiencePrompt y buildScoringBrainPrompt reciben
//   ahora `hookDescripcion` (no `videoDescription`/`descripcionRaw`)
//   y el prompt la marca explícitamente como referencia parcial,
//   no como resumen del video completo — con instrucción explícita
//   de observar y corregir por cuenta propia (anti-anchoring).
// - payoff_segundo ahora se pide en formato MM:SS (parseado por
//   parsePreClassifierResponse), siguiendo la guía oficial de
//   Gemini: es el formato en el que el modelo fue entrenado para
//   razonar temporalmente sobre video, más preciso que un entero
//   suelto.
// - Pendiente de tu lado (fuera de este archivo, en gemini-proxy):
//   Gemini muestrea video a 1 frame/segundo por defecto, lo que
//   puede perder cortes rápidos — justo lo que importa para contar
//   `cortes_por_10s` en un hook. Si tu proxy arma el `videoMetadata`
//   de la Part de video, subir el `fps` (ej. a 4) específicamente
//   para CALL 0 mejora la detección de corte rápido sin encarecer
//   mucho el costo, porque solo aplica a esa llamada.
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
// FILE SEARCH — configuración y helpers (NUEVO)
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
//   patron    -> ej: "pregunta", "shock", "pattern_interrupt", "pov"...
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
 */
export const fileSearchFiltersHook = (industria, plataforma) => ({
  segmento: "hook",
  industria,
  ...(plataforma && plataforma !== "all" ? { plataforma } : {}),
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
// Sin cambios.
// ═════════════════════════════════════════════════════════════
export const RESEARCH_BRAIN_SCHEMA = {
  type: "OBJECT",
  properties: {
    hooks_virales_reales:   { type: "STRING" },
    patron_hook_dominante:  { type: "STRING" },
    top_formatos_ganadores: { type: "STRING" },
    errores_hook_comunes:   { type: "STRING" },
    fatiga_de_formato:      { type: "STRING" },
    oportunidad_detectada:  { type: "STRING" },
    confianza_research:     { type: "STRING" },
    benchmark_viral_score:  { type: "NUMBER" },
    fuente_temporal:        { type: "STRING" },
  },
};

export const SILICON_AUDIENCE_SCHEMA = {
  type: "OBJECT",
  properties: {
    simulacion: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          perfil:              { type: "STRING" },
          decision_final:      { type: "STRING" },
          abandono_en_evento:  { type: "STRING" },
          completo:            { type: "BOOLEAN" },
          compartio:           { type: "BOOLEAN" },
          guardo:              { type: "BOOLEAN" },
          comento:             { type: "BOOLEAN" },
          razon_final:         { type: "STRING" },
        },
      },
    },
    segundo_mas_peligroso: { type: "NUMBER" },
    evento_que_mas_retiene: { type: "STRING" },
    evento_que_mas_expulsa: { type: "STRING" },
  },
};

export const PREDICTION_MARKET_SCHEMA = {
  type: "OBJECT",
  properties: {
    viralScore:             { type: "NUMBER" },
    salesScore:              { type: "NUMBER" },
    probabilidad_viral:     { type: "NUMBER" },
    confianza_prediccion:   { type: "STRING" },
    razon_principal_score:  { type: "STRING" },
    accion_clave_viral:     { type: "STRING" },
    accion_clave_ventas:    { type: "STRING" },
  },
};

export const SCORING_BRAIN_SCHEMA = {
  type: "OBJECT",
  properties: {
    viralScore: {
      type: "OBJECT",
      properties: {
        score:        { type: "NUMBER" },
        verdict:      { type: "STRING" },
        accion_clave: { type: "STRING" },
      },
    },
    salesScore: {
      type: "OBJECT",
      properties: {
        score:        { type: "NUMBER" },
        verdict:      { type: "STRING" },
        accion_clave: { type: "STRING" },
      },
    },
    honestVerdict: { type: "STRING" },
  },
};

// ─────────────────────────────────────────────────────────────
// CALL 0 — Observador del HOOK (v5: ya NO describe el video entero)
//
// POR QUÉ CAMBIÓ: la [DESCRIPCION] de CALL 0 se pasaba tal cual a
// CALL 1B y CALL 3, que YA tienen acceso directo al video completo
// vía context cache. Recibir la interpretación de CALL 0 además de
// mirar el video con sus propios "ojos" los anclaba a esa lectura
// (anchoring bias) en vez de observar de forma independiente.
//
// SOLUCIÓN: [DESCRIPCION] queda limitada EXCLUSIVAMENTE al hook
// (los primeros `hookWindowSegundos` segundos). Es lo único que se
// pasa río abajo, y se pasa explícitamente marcado como "referencia
// de apertura, no verdad completa" (ver buildSiliconAudiencePrompt
// y buildScoringBrainPrompt más abajo).
//
// [SEÑALES] SÍ requiere ver el video completo (duración, cortes,
// payoff, rehook) — pero es extracción de hechos objetivos, no
// interpretación narrativa, así que no genera el mismo anclaje.
//
// TIMESTAMPS: siguiendo la guía oficial de Gemini para video
// understanding, se pide el formato MM:SS en vez de un número
// suelto de segundos — es el formato en el que el modelo fue
// entrenado para razonar temporalmente sobre video, y mejora la
// precisión de payoff_segundo respecto a pedirle un entero a ojo.
// ─────────────────────────────────────────────────────────────
export const buildPreClassifierPrompt = (hookWindowSegundos = 5) => `
Tenés acceso directo al video completo. Miralo entero, de principio a fin, sin saltear nada — lo necesitás completo para responder [SEÑALES] con precisión, aunque [DESCRIPCION] solo te pida los primeros segundos.

[DESCRIPCION]
Describí ÚNICAMENTE lo que pasa en los primeros ${hookWindowSegundos} segundos (el hook / la apertura): imagen, audio, texto en pantalla, ritmo de corte, qué promesa o pattern interrupt se instala ahí.
NO describas ni resumas el resto del video en este bloque. El desarrollo completo lo va a observar cada análisis siguiente de forma directa e independiente — tu trabajo acá es solo dejar registrado qué arma el video en su apertura, sin condicionar cómo se lee el resto.
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
`;

// ─────────────────────────────────────────────────────────────
// parsePreClassifierResponse — sin cambios
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

  // v5: payoff_segundo ahora viene en MM:SS (formato nativo de Gemini
  // para timestamps de video). Soporta también un número suelto por
  // si el modelo lo devuelve así de vez en cuando (fallback).
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
// CALL 1.5 — Research Brain (ACHICADO: ahora delega en File Search)
//
// ANTES: le pedíamos al modelo que "recuerde" hooks virales reales
// de su conocimiento de entrenamiento (impreciso, no verificable,
// y obligaba a un prompt largo con benchmark en JSON pegado).
//
// AHORA: el prompt es corto. La evidencia real (miles de hooks
// indexados, con su resultado real bueno/malo) se la trae el tool
// file_search, filtrada por industria y segmento. App.jsx debe
// pasar buildFileSearchTool(storeName, fileSearchFiltersHook(...))
// en el config.tools de esta llamada.
// ─────────────────────────────────────────────────────────────
export const buildResearchBrainPrompt = (platform, industria, objetivo) => {
  const pName = {
    tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts'
  }[platform] || platform;

  return `
Buscá en la base indexada los hooks reales (buenos y malos) más relevantes para ${pName}, nicho "${industria}", pensando en un creador cuyo objetivo es: ${objetivo}.

Usá SOLO ejemplos que efectivamente encuentres en la base. Si la base no tiene suficientes ejemplos de este nicho, decilo explícitamente en confianza_research en vez de rellenar con conocimiento genérico.

[RESEARCH]
hooks_virales_reales: <ejemplos reales recuperados, con el mecanismo detrás de cada uno>
patron_hook_dominante: <texto>
top_formatos_ganadores: <lista breve>
errores_hook_comunes: <lista breve, basada en los ejemplos marcados como "malo">
fatiga_de_formato: <texto>
oportunidad_detectada: <texto>
confianza_research: <alta|media|baja>
benchmark_viral_score: <0-100>
fuente_temporal: <file_search|conocimiento_entrenamiento>
[/RESEARCH]
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
// CALL 1B — Silicon Audience (v5: anti-anclaje contra CALL 0)
//
// ANTES: recibía descripcionRaw = el resumen de TODO el video hecho
// por CALL 0, y lo trataba como si fuera la fuente de verdad. Como
// CALL 0 ahora solo describe el hook, y como este brain igual tiene
// el video completo vía cache, se lo tratamos explícitamente como
// una referencia parcial y le pedimos que confirme o corrija por su
// cuenta en vez de asumirla.
//
// (Opcional: si querés que los perfiles reaccionen con precedentes
// reales, App.jsx puede pasar también
// buildFileSearchTool(storeName, fileSearchFiltersDesarrollo(industria))
// en esta llamada. El prompt no necesita cambios para eso: el tool
// se inyecta desde afuera.)
// ─────────────────────────────────────────────────────────────
export const buildSiliconAudiencePrompt = (hookDescripcion, marketState, platform, duracionSegundos) => {
  const pName = {
    tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts'
  }[platform] || platform;

  const perfilesStr = SILICON_PROFILES.map(p =>
    `[${p.id.toUpperCase()}] ${p.descripcion} (peso=${p.peso}, ${p.volumen})`
  ).join('\n');

  return `
Tenés acceso directo al video completo. Vas a simular, uno por uno y con total libertad de criterio, cómo reacciona cada uno de estos seis usuarios reales de ${pName} al verlo.

DURACIÓN: ${duracionSegundos}s
MERCADO: ${JSON.stringify(marketState)}

REFERENCIA DEL HOOK (detectada en un paso previo, solo los primeros segundos — es un punto de partida, NO una descripción del video completo. Mirá vos mismo el desarrollo entero y confirmá, corregí o ignorá esto si el video te muestra algo distinto):
"${hookDescripcion}"

USUARIOS:
${perfilesStr}

Mirá el video completo, de punta a punta, para cada perfil antes de decidir — tu propia observación manda por sobre la referencia del hook de arriba. Cada uno puede abandonar en el segundo que deje de interesarle, o llegar hasta el final.

[SIMULACION]
Repetí este bloque una vez por usuario:
perfil: <id>
decision_final: RETUVO|ABANDONÓ
abandono_en_evento: <número o ninguno>
completo: <sí|no>
compartio: <sí|no>
guardo: <sí|no>
comento: <sí|no>
razon_final: <texto>
[/SIMULACION]

[PATRONES]
segundo_mas_peligroso: <número>
evento_que_mas_retiene: <texto>
evento_que_mas_expulsa: <texto>
[/PATRONES]
`;
};

// ─────────────────────────────────────────────────────────────
// CALL 2 — Prediction Market — sin cambios
// ─────────────────────────────────────────────────────────────
export const buildPredictionMarketPrompt = (simulacionSilicon, marketState, platform, industria) => {
  const pName = {
    tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts'
  }[platform] || platform;

  const resumen = simulacionSilicon.simulacion.map(p =>
    `${p.perfil_id}: ${p.decision_final} | completo:${p.completo} | compartió:${p.compartio} | ${p.razon_final}`
  ).join('\n');

  return `
Sos el prediction market de ${pName} para el nicho "${industria}". Tenés la simulación completa de audiencia y el estado del mercado. Considerá todo antes de fijar tu predicción — nada queda afuera.

SIMULACIÓN:
${resumen}
segundo_mas_peligroso:${simulacionSilicon.segundo_mas_peligroso ?? '—'} | retiene:${simulacionSilicon.evento_que_mas_retiene} | expulsa:${simulacionSilicon.evento_que_mas_expulsa}

MERCADO: ${JSON.stringify(marketState)}

[PREDICCION]
retencion_por_perfil.curioso_aleatorio: <0-100>, razon: <texto>
retencion_por_perfil.impaciente: <0-100>, razon: <texto>
retencion_por_perfil.promedio: <0-100>, razon: <texto>
retencion_por_perfil.nicho: <0-100>, razon: <texto>
retencion_por_perfil.esceptico: <0-100>, razon: <texto>
retencion_por_perfil.comprador: <0-100>, razon: <texto>
viralScore: <0-100>
salesScore: <0-100>
probabilidad_viral: <0-100>
confianza_prediccion: <alta|media|baja>
razon_principal_score: <texto>
accion_clave_viral: <texto>
accion_clave_ventas: <texto>
razonamiento_paso_a_paso.peso_curioso_aleatorio: <qué pesó y por qué, en 1 frase>
razonamiento_paso_a_paso.senal_mas_determinante: <cuál de las seis retenciones definió más el score>
razonamiento_paso_a_paso.ajuste_por_research: <si hubo ajuste por el mercado, y por qué>
[/PREDICCION]
`;
};

// ─────────────────────────────────────────────────────────────
// CALL 3 — Scoring Brain (v5: anti-anclaje contra CALL 0)
//
// El primer parámetro ahora es explícitamente la referencia del
// hook (no un resumen del video entero) y se lo marca como tal, por
// la misma razón que en CALL 1B: este brain tiene el video completo
// vía cache y no debería limitarse a validar la lectura de CALL 0.
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
Tenés acceso directo al video completo, la simulación de audiencia real y el research de mercado. Analizá todo antes de emitir tu veredicto — nada queda afuera, con total libertad de criterio.

PLATAFORMA: ${platform} | DURACIÓN: ${duracionSegundos}s | INDUSTRIA: ${industria} | OBJETIVO: ${objetivo}

REFERENCIA DEL HOOK (primeros segundos, detectada en un paso previo — no la tomes como descripción del video completo; observá vos mismo el desarrollo entero antes de puntuar):
"${hookDescripcion}"

AUDIENCIA Y MERCADO:
${audienceAnalysis}

BENCHMARK:
${JSON.stringify(researchData)}

Si hay problemas reales, nombralos sin suavizarlos. El roadmap solo debe incluir problemas que vos mismo detectaste, ordenados por impacto real.

[VEREDICTO]
viralScore.score: <0-100>
viralScore.verdict: <texto>
viralScore.accion_clave: <texto>
salesScore.score: <0-100>
salesScore.verdict: <texto>
salesScore.accion_clave: <texto>
scrollStopScore.score: <0-100>
scrollStopScore.faceDetected: <sí|no>
scrollStopScore.textOnScreen: <sí|no>
scrollStopScore.contrastLevel: <bajo|medio|alto>
scrollStopScore.emotionVisible: <texto>
scrollStopScore.emotionIntensity: <0-100>
scrollStopScore.verdict: <texto>
hookDNA.strength: <0-100>
hookDNA.pattern: <texto>
hookDNA.missingElement: <texto>
hookDNA.optimizedHook: <texto>
steppsScore.socialCurrency: <0-100>
steppsScore.triggers: <0-100>
steppsScore.emotion: <0-100>
steppsScore.public: <0-100>
steppsScore.practicalValue: <0-100>
steppsScore.stories: <0-100>
steppsScore.viralCoefficient: <0-1>
steppsScore.dominantFactor: <texto>
steppsScore.weakestFactor: <texto>
steppsScore.shareMotivation: <texto>
honestVerdict: <texto>
roadmap: <una línea por problema real: problema | solución | resultado esperado | impacto ALTO/MEDIO/BAJO>
vision.niche: <texto>
vision.type: <texto>
vision.audience: <texto>
vision.promise: <texto>
platformScores.tiktok: <score, verdict, topTip>
platformScores.reels: <score, verdict, topTip>
platformScores.shorts: <score, verdict, topTip>
retentionData.at3s: <texto>
retentionData.at10s: <texto>
retentionData.final: <texto>
retentionCurve: <puntos segundo:retención% representativos del video>
viewsPrediction.scenario_low: <texto>
viewsPrediction.scenario_mid: <texto>
viewsPrediction.scenario_high: <texto>
viewsPrediction.probability_viral: <texto>
firstHourStrategy.optimalPostTime: <texto>
firstHourStrategy.firstActionAfterPost: <texto>
firstHourStrategy.commentSeed: <texto>
firstHourStrategy.engagementBoost: <texto>
commentTrigger.probability: <0-100>
commentTrigger.triggerType: <texto>
commentTrigger.suggestedCTA: <texto>
razonamiento_viralScore: <2-3 frases: qué de la audiencia pesó más>
razonamiento_salesScore: <2-3 frases: qué señal de venta encontró o no>
[/VEREDICTO]
`;

// ─────────────────────────────────────────────────────────────
// Utilidades — sin cambios
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
  const guardaron    = perfiles.filter(p => p.guardó).length;

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
// ADMIN — Indexado del corpus histórico (NUEVO)
//
// Esto NO va en el bundle del cliente (React/App.jsx). Es un script
// de administración/backend (Node.js) que corrés una vez para
// cargar tu histórico de miles de hooks y desarrollos, y después
// cada vez que sumes ejemplos nuevos. Requiere @google/genai
// >= 1.29.0 y GOOGLE_API_KEY en el entorno.
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

/**
 * Busca el store por displayName; si no existe, lo crea.
 * Evita duplicar stores en corridas sucesivas del script.
 */
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

/**
 * Indexa una entrada del corpus histórico. `entry.texto` es el
 * análisis en texto libre (hook o desarrollo, ya extraído del video
 * con Gemini multimodal en un paso previo). `entry` trae también
 * la metadata que después se usa para filtrar (segmento, resultado,
 * industria, patron, plataforma).
 *
 * File Search no soporta audio/video directamente, por eso primero
 * hay que convertir cada video a texto (transcripción + descripción
 * del hook/desarrollo) con una llamada multimodal aparte, y ESO es
 * lo que se indexa acá.
 */
export const indexEntry = async (ai, storeName, entry) => {
  const {
    texto,
    segmento,       // "hook" | "desarrollo"
    resultado,      // "bueno" | "malo"
    industria,
    patron = "sin_clasificar",
    plataforma = "all",
    displayName = `${segmento}-${Date.now()}`,
  } = entry;

  // uploadToFileSearchStore acepta un path de archivo o un Blob.
  // Si tu texto ya está en memoria (no en disco), convertilo a Blob:
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

/**
 * Indexa un lote completo en paralelo (con límite de concurrencia
 * simple para no saturar la API).
 */
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