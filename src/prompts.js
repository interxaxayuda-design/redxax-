// ═════════════════════════════════════════════════════════════
// REDXAX VISION — 3 calls: hook, desarrollo, síntesis final
// ═════════════════════════════════════════════════════════════

export const REVIEW_CONFIG = {
  hook: {
    model: "gemini-2.5-flash",
    temperature: 0.2, // Reducido de 0.5 a 0.2 para mayor precisión analítica
    media_resolution: "default",
    thinkingConfig: { thinkingBudget: 4096 },
    videoFps: 8, 
  },
   nicheSuggestion: {
    model: "gemini-2.5-flash",
    temperature: 0.1, // Aún más bajo porque es solo una etiqueta
    media_resolution: "default",
    thinkingConfig: { thinkingBudget: 512 }, 
    videoFps: 1,
  },
  desarrollo: {
    model: "gemini-2.5-flash",
    temperature: 0.2, // Reducido de 0.5 a 0.2
    media_resolution: "default",
    thinkingConfig: { thinkingBudget: 5120 },
    videoFps: 8, 
  },
  sintesis: {
    model: "gemini-2.5-flash",
    temperature: 0.3, // Reducido de 0.4 para evitar que invente datos en el resumen
    thinkingConfig: { thinkingBudget: 3072 },
  },
};

const contextoComun = (platform, industria, objetivo) => {
  const pName = {
    tiktok: "TikTok",
    reels: "Instagram Reels",
    shorts: "YouTube Shorts",
    all: "TikTok, Instagram Reels y YouTube Shorts"
  }[platform] || platform;

  return `especialista en análisis de contenido para ${pName}, con amplio conocimiento sobre cómo reaccionan los usuarios reales al consumir videos cortos en estas plataformas.

Tu tarea es analizar el video desde la perspectiva de la audiencia real mientras hace scroll. No lo evalúes como una publicidad tradicional, un comercial o una pieza audiovisual siguiendo reglas clásicas de narrativa o edición.

Basate en tu conocimiento general sobre el comportamiento de los usuarios de ${pName} y juzgá cada decisión creativa por el efecto que probablemente produzca en la audiencia (atención, curiosidad, comprensión, emoción, humor, sorpresa, conversación, rechazo, abandono, etc), no por si cumple convenciones narrativas tradicionales.

Analizá cada video de forma independiente, utilizando tu propio criterio y sin asumir que una decisión creativa es buena o mala por sí misma. Considerá siempre el contexto, la intención aparente del creador y la reacción más probable de la audiencia.

Nicho: ${industria || "contenido general"}.
Objetivo del creador: ${objetivo || "no especificado"}.`;
};

export const buildNicheSuggestionPrompt = () => `
Mirá este video y decime, en 2 a 4 palabras como mucho, a qué nicho o industria pertenece (ej: "estética facial", "comida rápida", "fitness / suplementos", "inmobiliaria"). 

Respondé ÚNICAMENTE con esas 2-4 palabras, sin explicación, sin punto final, sin comillas.
`;

export const buildHookAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}
</rol>

<instrucciones>
Tenés el video completo, pero tu tarea ahora es analizar ÚNICAMENTE los primeros ${hookWindowSegundos} segundos (el hook / la apertura). Usá tu propio criterio y experiencia para juzgar qué tan efectivo es.
Primero describí, con timestamp exacto (MM:SS), qué pasa concretamente en esos segundos: imagen, audio, texto en pantalla, cortes. Recién después, a partir de eso, dame tu evaluación honesta: qué funciona y qué no, y por qué, enfocándote en si detiene el scroll.
</instrucciones>

<reglas_estrictas>
1. OBJETIVIDAD Y TONO: Sé puramente objetivo y analítico. Si hay un error que afecta la retención, señalalo directamente. Si una sección funciona perfectamente, indicalo sin buscar errores donde no los hay. No inventes problemas para parecer más crítico.
2. AUDIO VS TEXTO EN PANTALLA (CRÍTICO): El video puede contener música con letras. BAJO NINGUNA CIRCUNSTANCIA reportes la letra de una canción o una voz en off como si fuera texto escrito en la pantalla. Si no ves letras dibujadas físicamente en el video, no inventes texto.
3. DIFERENCIACIÓN: Distinguí claramente entre habla en cámara, texto superpuesto visualmente y subtítulos. Si no estás seguro de algo, expresalo como incertidumbre en vez de afirmar.
4. RELEVANCIA DE ERRORES: Antes de reportar un error, preguntate si tiene una consecuencia real (pierde atención, genera confusión, rompe una promesa, etc). Si es solo una preferencia de edición (ej. "el corte es un poco brusco") que no afecta realmente, no lo reportes como un problema grave.
5. LÍMITES: Si algún corte fue tan rápido que no lo viste con nitidez, decilo. No dividas esto en categorías técnicas ni des ningún número o score. Texto libre, directo, como se lo explicarías a un colega.
</reglas_estrictas>
`;

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}
</rol>

<instrucciones>
Ya se analizó el hook (los primeros ${hookWindowSegundos} segundos). Tu tarea ahora es analizar el RESTO del video, desde ese punto hasta el final: el desarrollo, el ritmo, si cumple lo que prometía, el cierre y el CTA si lo hay.
Incluí el timestamp exacto (MM:SS) por cada cosa que señales, sea buena o mala. Usá tu criterio de qué hace que un video retenga o pierda audiencia en esta etapa.
</instrucciones>

<reglas_estrictas>
1. OBJETIVIDAD Y TONO: Sé puramente objetivo. Señalá errores reales que afecten la retención, por mínimos que sean, pero no inventes fallos si una sección cumple su propósito correctamente.
2. AUDIO VS TEXTO EN PANTALLA (CRÍTICO): BAJO NINGUNA CIRCUNSTANCIA confundas la letra de una canción de fondo con texto superpuesto en pantalla. Reportá como texto solo lo que puedas leer visualmente.
3. RELEVANCIA DE ERRORES: Solo reportá errores que tengan consecuencias reales (aburrimiento, confusión, pérdida de retención, etc). Evitá señalar preferencias personales que no afecten el rendimiento.
4. LÍMITES: No repitas análisis del hook, no te corresponde acá. No uses scores, números ni categorías técnicas. Texto libre y directo.
</reglas_estrictas>
`;

export const buildFinalReviewPrompt = (hookAnalysis, desarrolloAnalysis, platform, industria, objetivo) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}
</rol>

<contexto_previo>
ANÁLISIS DEL HOOK:
${hookAnalysis}

ANÁLISIS DEL DESARROLLO:
${desarrolloAnalysis}
</contexto_previo>

<instrucciones>
Dos colegas tuyos ya analizaron este video. Tu trabajo es leer ambos análisis y escribirle al creador una devolución final unificada, como si se la estuvieras dando vos mismo después de ver todo.
Saludá brevemente, contale qué viste en general, y andá directo a lo que funciona bien y lo que hay que mejorar. Usá los timestamps exactos provistos en el contexto previo.
Sintetizá los textos en una sola voz coherente, priorizando lo más importante. Cerrá con 1 o 2 sugerencias concretas de mejora si hacen falta.
</instrucciones>

<reglas_estrictas>
1. FIDELIDAD: No inventes problemas ni timestamps nuevos que no estén en los análisis de tus colegas. 
2. TONO DIRECTO: No suavices los errores para sonar agradable, pero tampoco seas destructivo. Sé honesto, claro y profesional. No uses frases de relleno ("en general está bien...").
3. SIN MÉTRICAS INVENTADAS: No uses números, porcentajes o scores de ningún tipo (ej. "8 de cada 10 notarían esto"). Describí el problema y su impacto solo con palabras.
</reglas_estrictas>
`;

export const runVideoReview = async (ai, buildVideoPartFn, { platform, industria, objetivo, hookWindowSegundos = 4 }) => {
  const cfg = REVIEW_CONFIG;

  const [hookRes, desarrolloRes] = await Promise.all([
    ai.models.generateContent({
      model: cfg.hook.model,
      contents: [buildVideoPartFn({ fps: cfg.hook.videoFps }), { text: buildHookAnalysisPrompt(platform, industria, objetivo, hookWindowSegundos) }],
      config: { temperature: cfg.hook.temperature, thinkingConfig: cfg.hook.thinkingConfig, mediaResolution: cfg.hook.media_resolution },
    }),
    ai.models.generateContent({
      model: cfg.desarrollo.model,
      contents: [buildVideoPartFn({ fps: cfg.desarrollo.videoFps }), { text: buildDesarrolloAnalysisPrompt(platform, industria, objetivo, hookWindowSegundos) }],
      config: { temperature: cfg.desarrollo.temperature, thinkingConfig: cfg.desarrollo.thinkingConfig, mediaResolution: cfg.desarrollo.media_resolution },
    }),
  ]);

  const hookAnalysis = hookRes.text;
  const desarrolloAnalysis = desarrolloRes.text;

  const finalRes = await ai.models.generateContent({
    model: cfg.sintesis.model,
    contents: [{ text: buildFinalReviewPrompt(hookAnalysis, desarrolloAnalysis, platform, industria, objetivo) }], 
    config: { temperature: cfg.sintesis.temperature, thinkingConfig: cfg.sintesis.thinkingConfig },
  });

  return { reviewText: finalRes.text, _hookAnalysis: hookAnalysis, _desarrolloAnalysis: desarrolloAnalysis };
};