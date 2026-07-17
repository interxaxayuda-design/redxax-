// ═════════════════════════════════════════════════════════════
// REDXAX VISION — 3 calls: hook, desarrollo, síntesis final
// Objetivo: mejor precisión en videos cortos, bait, curiosidad y retención
// ═════════════════════════════════════════════════════════════

export const REVIEW_CONFIG = {
  hook: {
    model: "gemini-2.5-flash",
    temperature: 0.1,
    media_resolution: "low",
    thinkingConfig: { thinkingBudget: 3072 },
    videoFps: 1
  },
  nicheSuggestion: {
    model: "gemini-2.5-flash",
    temperature: 0.0,
    media_resolution: "low",
    thinkingConfig: { thinkingBudget: 256 },
    videoFps: 1
  },
  desarrollo: {
    model: "gemini-2.5-flash",
    temperature: 0.1,
    media_resolution: "low",
    thinkingConfig: { thinkingBudget: 4096 },
    videoFps: 1
  },
  sintesis: {
    model: "gemini-2.5-flash",
    temperature: 0.0,
    thinkingConfig: { thinkingBudget: 1536 }
  }
};

const contextoComun = (platform, industria, objetivo) => {
  const pName = {
    tiktok: "TikTok",
    reels: "Instagram Reels",
    shorts: "YouTube Shorts",
    all: "TikTok, Instagram Reels y YouTube Shorts"
  }[platform] || platform;

  return `especialista en análisis de contenido para ${pName}, con conocimiento práctico sobre cómo reaccionan usuarios reales al consumir videos cortos.

Tu tarea es evaluar retención, curiosidad, claridad, promesa, payoff y posible abandono. No juzgues el video por si coincide con una estética tradicional, sino por el efecto que produce en una persona real mientras scrollea.

Usá como criterio principal la relación entre:
- lo que se ve u oye;
- lo que el video promete o sugiere;
- lo que efectivamente entrega;
- la reacción más probable de la audiencia.

Si algo parece raro pero cumple una función clara de retención, tratá esa posibilidad antes de marcarlo como error.
Si algo parece curioso pero en realidad solo genera confusión o demora innecesaria, marcá esa diferencia.

Nicho: ${industria || "contenido general"}.
Objetivo del creador: ${objetivo || "no especificado"}.`;
};

export const buildNicheSuggestionPrompt = () => `
Mirá este video y decime, en 2 a 4 palabras como mucho, a qué nicho o industria pertenece.

Respondé ÚNICAMENTE con esas 2 a 4 palabras, sin explicación, sin punto final, sin comillas.
`;

export const buildHookAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}
</rol>

<instrucciones>
Analizá únicamente los primeros ${hookWindowSegundos} segundos del video.

Primero describí objetivamente lo que ocurre en ese tramo, con timestamps exactos (MM:SS): imagen, texto visible, audio relevante y cambios de plano.
Después evaluá la función del inicio: qué promete, qué genera, si crea curiosidad útil, si genera confusión, y si detiene o no el scroll.
No evalúes por coincidencia temática; evaluá por mecanismo de retención.
Si una demora en mostrar algo crea tensión intencional y consistente, considerala como posible recurso válido.
Si la demora solo retrasa la comprensión o hace que el espectador no entienda qué está viendo, señalalo como problema.
</instrucciones>

<reglas_estrictas>
1. OBJETIVIDAD: Si una decisión puede leerse de más de una forma, explicá ambas y elegí la más probable solo si hay evidencia suficiente.
2. AUDIO VS TEXTO: No reportes letra de canción o voz en off como texto en pantalla. Solo reportá texto que sea visualmente legible.
3. RELEVANCIA: Solo marcá problemas que afecten atención, comprensión, confianza o continuidad.
4. LÍMITES: Si algo no se ve con nitidez, decilo. No uses scores, números ni categorías técnicas. Texto libre, directo y concreto.
</reglas_estrictas>
`;

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}
</rol>

<instrucciones>
Ya se analizó el hook. Ahora analizá desde ${hookWindowSegundos} segundos hasta el final.

Tu foco es el desarrollo, el ritmo, el payoff, el cierre y el CTA si existe.
Incluí timestamps exactos (MM:SS) por cada observación importante.
Evaluá si el video cumple la promesa inicial, si la retrasa con intención o si la rompe.
Distinguí claramente entre:
- tensión útil;
- curiosidad real;
- confusión innecesaria;
- simple demora que baja retención.
No repitas el hook.
</instrucciones>

<reglas_estrictas>
1. OBJETIVIDAD: Señalá solo efectos que impacten retención, comprensión o confianza.
2. AUDIO VS TEXTO: No confundas música, letra o voz con texto visual.
3. RELEVANCIA: No critiques por gusto personal de edición si no afecta la respuesta de audiencia.
4. LÍMITES: No uses scores, números ni categorías técnicas. Texto libre y directo.
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
Escribí una devolución final unificada, como si hubieras visto todo el video vos mismo.

Saludá brevemente, explicá qué viste en general, y andá directo a lo que funciona y lo que conviene mejorar.
Usá únicamente los timestamps que aparezcan en el contexto previo.
Si un punto fue positivo pero también ambiguo, conservá esa ambigüedad en vez de convertirlo en error.
Si un tramo fue crítico para retención, dejalo claro.
Cerrá con 1 o 2 sugerencias concretas, solo si realmente hacen falta.
</instrucciones>

<reglas_estrictas>
1. FIDELIDAD: No inventes timestamps, escenas ni problemas nuevos.
2. TONO: Sé claro, honesto y profesional. No suavices de más.
3. SIN MÉTRICAS: No uses porcentajes, scores ni números inventados.
</reglas_estrictas>
`;

const buildImprovedFallbackPrompt = (platform, industria, objetivo) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}
</rol>

<instrucciones>
Si el video tiene elementos que parecen bait, contraste o demora intencional, evaluá si eso:
- sostiene curiosidad;
- acelera o frena la comprensión;
- mejora o empeora la retención;
- entrega payoff compatible con la promesa inicial.
No confundas “no coincide con lo esperado” con “es un error”.
Tampoco asumas que toda demora genera curiosidad.
</instrucciones>
`;

export const runVideoReview = async (
  ai,
  buildVideoPartFn,
  { platform, industria, objetivo, hookWindowSegundos = 4 }
) => {
  const cfg = REVIEW_CONFIG;

  const [hookRes, desarrolloRes] = await Promise.all([
    ai.models.generateContent({
      model: cfg.hook.model,
      contents: [
        buildVideoPartFn({
          fps: cfg.hook.videoFps,
          mediaResolution: cfg.hook.media_resolution
        }),
        { text: buildHookAnalysisPrompt(platform, industria, objetivo, hookWindowSegundos) }
      ],
      config: {
        temperature: cfg.hook.temperature,
        thinkingConfig: cfg.hook.thinkingConfig,
        mediaResolution: cfg.hook.media_resolution
      }
    }),
    ai.models.generateContent({
      model: cfg.desarrollo.model,
      contents: [
        buildVideoPartFn({
          fps: cfg.desarrollo.videoFps,
          mediaResolution: cfg.desarrollo.media_resolution
        }),
        { text: buildDesarrolloAnalysisPrompt(platform, industria, objetivo, hookWindowSegundos) }
      ],
      config: {
        temperature: cfg.desarrollo.temperature,
        thinkingConfig: cfg.desarrollo.thinkingConfig,
        mediaResolution: cfg.desarrollo.media_resolution
      }
    })
  ]);

  const hookAnalysis = hookRes.text || "";
  const desarrolloAnalysis = desarrolloRes.text || "";

  const finalRes = await ai.models.generateContent({
    model: cfg.sintesis.model,
    contents: [
      {
        text: buildFinalReviewPrompt(
          hookAnalysis,
          desarrolloAnalysis,
          platform,
          industria,
          objetivo
        )
      }
    ],
    config: {
      temperature: cfg.sintesis.temperature,
      thinkingConfig: cfg.sintesis.thinkingConfig
    }
  });

  return {
    reviewText: finalRes.text,
    _hookAnalysis: hookAnalysis,
    _desarrolloAnalysis: desarrolloAnalysis
  };
};