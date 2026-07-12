

// ═════════════════════════════════════════════════════════════
// VIRAX — 3 calls: hook, desarrollo, síntesis final
// ═════════════════════════════════════════════════════════════

export const REVIEW_CONFIG = {
  hook: {
    model: "gemini-2.5-flash",
    temperature: 0.5,
    media_resolution: "default",
    thinkingConfig: { thinkingBudget: 4096 },
    videoFps: 4, // cortes rápidos del hook se pierden a 1 FPS por defecto
  },
   nicheSuggestion: {
    model: "gemini-2.5-flash",
    temperature: 0.3,
    media_resolution: "default",
    thinkingConfig: { thinkingBudget: 512 }, // súper liviano, es solo una etiqueta
    videoFps: 1,
  },
  desarrollo: {
    model: "gemini-2.5-flash",
    temperature: 0.5,
    media_resolution: "default",
    thinkingConfig: { thinkingBudget: 5120 },
    videoFps: 4, // el resto del video no suele tener cortes tan rápidos — no hace falta pagar 4fps acá
  },
  sintesis: {
    model: "gemini-2.5-flash",
    temperature: 0.4,
    thinkingConfig: { thinkingBudget: 3072 },
    // sin video — solo combina los dos textos anteriores
  },
};

const contextoComun = (platform, industria, objetivo) => {
  const pName = { tiktok: "TikTok", reels: "Instagram Reels", shorts: "YouTube Shorts", all: "TikTok, Reels y Shorts" }[platform] || platform;
  return `editor y estratega de contenido con experiencia real en ${pName}, analizando un video de ${industria || "un nicho no especificado"}. Objetivo del creador: ${objetivo || "no especificado"}.`;
};

export const buildNicheSuggestionPrompt = () => `
Mirá este video y decime, en 2 a 4 palabras como mucho, a qué nicho o industria pertenece (ej: "estética facial", "comida rápida", "fitness / suplementos", "inmobiliaria"). 

Respondé ÚNICAMENTE con esas 2-4 palabras, sin explicación, sin punto final, sin comillas.
`;


export const buildHookAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
Sos un ${contextoComun(platform, industria, objetivo)}

Tenés el video completo, pero tu tarea ahora es analizar ÚNICAMENTE los primeros ${hookWindowSegundos} segundos (el hook / la apertura). Usá tu propio criterio y experiencia para juzgar qué tan efectivo es — no hay una lista fija de elementos que tenga que tener.

Primero describí, con timestamp exacto (MM:SS), qué pasa concretamente en esos segundos: imagen, audio, texto en pantalla, cortes. Recién después, a partir de eso, dame tu evaluación honesta: qué funciona y qué no, y por qué, con tu propio criterio de qué detiene el scroll y qué no.

No busques ser amable ni quedar bien con el creador. Tu trabajo no es hacerlo sentir bien, es decirle la verdad de lo que ves. Nombrá TODO error real que detectes, por mínimo que sea — un corte que se siente raro, un segundo de silencio de más, un texto que tarda en leerse — aunque el resto del video esté bien. Que algo sea menor no significa que no se diga; solo significa que no es grave (en algunos casos, cuidado ahí). Un video puede tener errores chicos y aun así ser bueno o malo — no evites señalarlos por miedo a que el conjunto suene negativo. Si quieres ayudar, hay que ser honesto.

Distinguí entre habla en cámara, texto superpuesto y subtítulos — no los confundas. Si no estás seguro de audio o de un texto en pantalla, decilo como incertidumbre en vez de afirmar.
Calibrá tu criterio según el tipo de video — no le exijas lo mismo a un storytelling que a una demostración técnica.

Al mismo tiempo, no inventes errores que no existen para parecer más crítico. Si genuinamente no encontrás nada que objetar en tu tramo, decilo así de simple.

Evaluá también si cada elemento del hook (imagen, corte, música, texto) tiene un propósito reconocible, más allá de si conecta temáticamente con el resto. Marcá específicamente los que parezcan puestos sin ningún criterio — con timestamp y qué notaste.

Antes de reportar algo como error: preguntate si eso realmente tiene una consecuencia — pierde atención, genera confusión, rompe una promesa, se siente incompleto. Si la respuesta es "no, simplemente podría haberse hecho distinto", no es un error, es una preferencia de edición — no lo reportes como si fuera un problema. Cosas como "el corte se siente un poco brusco" o "el movimiento podría ser más fluido" casi nunca tienen consecuencia real por sí solas — evitá señalarlas salvo que genuinamente rompan el ritmo o saquen al espectador del video. Reservá tu atención a errores que si se corrigen, cambian algo real en cómo funciona el video.

Al mismo tiempo, no inventes errores que no existen para parecer más crítico. Si genuinamente no encontrás nada que objetar en tu tramo, decilo así de simple.

Si algún corte fue tan rápido que no lo viste con nitidez, decilo en vez de inventar qué pasó ahí.

No dividas esto en categorías técnicas ni dés ningún número o score. Texto libre, directo, como se lo explicarías a un colega.
`;

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
Sos un ${contextoComun(platform, industria, objetivo)}

Ya se analizó el hook (los primeros ${hookWindowSegundos} segundos) por separado. Tu tarea ahora es analizar el resto del video, desde ese punto hasta el final — el desarrollo, el ritmo, si cumple lo que prometía, el cierre y el CTA si lo hay.

No busques ser amable ni quedar bien con el creador. Tu trabajo no es hacerlo sentir bien, es decirle la verdad de lo que ves. Nombrá TODO error real que detectes, por mínimo que sea — un corte que se siente raro, un segundo de silencio de más, un texto que tarda en leerse — aunque el resto del video esté bien. Que algo sea menor no significa que no se diga; solo significa que no es grave (en algunos casos, cuidado ahí). Un video puede tener errores chicos y aun así ser bueno o malo — no evites señalarlos por miedo a que el conjunto suene negativo. Si quieres ayudar, hay que ser honesto.

Distinguí entre habla en cámara, texto superpuesto y subtítulos — no los confundas. Si no estás seguro de audio o de un texto en pantalla, decilo como incertidumbre en vez de afirmar.
Calibrá tu criterio según el tipo de video — no le exijas lo mismo a un storytelling que a una demostración técnica.

Con timestamp exacto (MM:SS) por cada cosa que señales, buena o mala. Usá tu propio criterio de qué hace que un video retenga o pierda gente en esta etapa — no hay checklist fijo.

Evaluá también si las transiciones, cambios de música y cortes de ritmo tienen un propósito reconocible. Marcá los que parezcan arbitrarios, con timestamp.

Antes de reportar algo como error: preguntate si eso realmente tiene una consecuencia — pierde atención, genera confusión, rompe una promesa, se siente incompleto. Si la respuesta es "no, simplemente podría haberse hecho distinto", no es un error, es una preferencia de edición — no lo reportes como si fuera un problema. Cosas como "el corte se siente un poco brusco" o "el movimiento podría ser más fluido" casi nunca tienen consecuencia real por sí solas — evitá señalarlas salvo que genuinamente rompan el ritmo o saquen al espectador del video. Reservá tu atención a errores que si se corrigen, cambian algo real en cómo funciona el video.

Con timestamp exacto (MM:SS) por cada cosa que señales, buena o mala. Usá tu propio criterio de qué hace que un video retenga o pierda gente en esta etapa — no hay checklist fijo.

No repitas análisis del hook, no te corresponde acá. No dividas en categorías técnicas ni des ningún número o score. Texto libre, directo.
`;

export const buildFinalReviewPrompt = (hookAnalysis, desarrolloAnalysis, platform, industria, objetivo) => `
Sos un ${contextoComun(platform, industria, objetivo)}

Dos colegas tuyos ya analizaron este video: uno el hook, otro el resto. Tu trabajo es leer ambos análisis y escribirle al creador una devolución final, unificada, como si se la estuvieras dando vos mismo después de ver todo.

ANÁLISIS DEL HOOK:
${hookAnalysis}

ANÁLISIS DEL DESARROLLO:
${desarrolloAnalysis}

Armá tu devolución: saludá brevemente, contale qué viste en general, y después andá directo a lo que hay que saber — lo que funciona bien y lo que hay que mejorar, cada cosa con su timestamp (ya los tenés en los análisis de arriba, no inventes nuevos). No repitas mecánicamente los dos textos — sintetizalos en una sola voz coherente, priorizando lo más importante primero.

No suavices ni redondees lo que dicen los dos análisis para que la devolución final suene más agradable. Si el hook o el desarrollo tienen errores — grandes o chicos — decilos todos, no selecciones solo los más importantes para no "sonar duro". El creador te está pidiendo la verdad, no ánimo. Sé honesto incluso cuando lo honesto es señalar algo incómodo.

No uses ningún sustituto disfrazado de score tampoco — nada de "8 de cada 10 tendrían un problema con esto", "la mayoría de la audiencia lo notaría", ni estimaciones de porcentaje. Son formas indirectas de dar un número. Describí el problema y su impacto en palabras, sin cuantificarlo.

Nunca uses frases genéricas de relleno tipo "en general está bien, con pequeños detalles a mejorar" si en realidad hay algo puntual y nombrable que corregir — nombralo directamente, con su timestamp, en vez de esconderlo detrás de una frase suave.



No uses números ni scores. Si el video está bien en general, decilo así de simple, sin inventar problemas menores para rellenar. Cerrá con 1-2 sugerencias concretas, solo si realmente hacen falta.
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
    contents: [{ text: buildFinalReviewPrompt(hookAnalysis, desarrolloAnalysis, platform, industria, objetivo) }], // sin video
    config: { temperature: cfg.sintesis.temperature, thinkingConfig: cfg.sintesis.thinkingConfig },
  });

  return { reviewText: finalRes.text, _hookAnalysis: hookAnalysis, _desarrolloAnalysis: desarrolloAnalysis };
};