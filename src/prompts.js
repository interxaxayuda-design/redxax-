// ─────────────────────────────────────────────────────────────
// CALL 0 — Observador del HOOK
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
musica_presente: <sí|no — música de fondo, no solo voz/habla>
musica_cambia_en_hook: <sí|no — si la música cambia de forma notoria (entra, sube, corta) dentro de los primeros ${hookWindowSegundos}s>
[/SEÑALES]
</task>
`;

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
  desarrollo: {
    model: "gemini-2.5-flash",
    temperature: 0.5,
    media_resolution: "default",
    thinkingConfig: { thinkingBudget: 5120 },
    videoFps: 1, // el resto del video no suele tener cortes tan rápidos — no hace falta pagar 4fps acá
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

export const buildHookAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
Sos un ${contextoComun(platform, industria, objetivo)}

Tenés el video completo, pero tu tarea ahora es analizar ÚNICAMENTE los primeros ${hookWindowSegundos} segundos (el hook / la apertura). Usá tu propio criterio y experiencia para juzgar qué tan efectivo es — no hay una lista fija de elementos que tenga que tener.

Primero describí, con timestamp exacto (MM:SS), qué pasa concretamente en esos segundos: imagen, audio, texto en pantalla, cortes. Recién después, a partir de eso, dame tu evaluación honesta: qué funciona y qué no, y por qué, con tu propio criterio de qué detiene el scroll y qué no.

No busques ser amable ni quedar bien con el creador. Tu trabajo no es hacerlo sentir bien, es decirle la verdad de lo que ves. Nombrá TODO error real que detectes, por mínimo que sea — un corte que se siente raro, un segundo de silencio de más, un texto que tarda en leerse — aunque el resto del video esté bien. Que algo sea menor no significa que no se diga; solo significa que no es grave (en algunos casos, cuidado ahí). Un video puede tener errores chicos y aun así ser bueno o malo — no evites señalarlos por miedo a que el conjunto suene negativo. Si quieres ayudar, hay que ser honesto.

Al mismo tiempo, no inventes errores que no existen para parecer más crítico. Si genuinamente no encontrás nada que objetar en tu tramo, decilo así de simple.

Si algún corte fue tan rápido que no lo viste con nitidez, decilo en vez de inventar qué pasó ahí.

No dividas esto en categorías técnicas ni dés ningún número o score. Texto libre, directo, como se lo explicarías a un colega.
`;

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
Sos un ${contextoComun(platform, industria, objetivo)}

Ya se analizó el hook (los primeros ${hookWindowSegundos} segundos) por separado. Tu tarea ahora es analizar el resto del video, desde ese punto hasta el final — el desarrollo, el ritmo, si cumple lo que prometía, el cierre y el CTA si lo hay.

No busques ser amable ni quedar bien con el creador. Tu trabajo no es hacerlo sentir bien, es decirle la verdad de lo que ves. Nombrá TODO error real que detectes, por mínimo que sea — un corte que se siente raro, un segundo de silencio de más, un texto que tarda en leerse — aunque el resto del video esté bien. Que algo sea menor no significa que no se diga; solo significa que no es grave (en algunos casos, cuidado ahí). Un video puede tener errores chicos y aun así ser bueno o malo — no evites señalarlos por miedo a que el conjunto suene negativo. Si quieres ayudar, hay que ser honesto.


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