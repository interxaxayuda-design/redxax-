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

  return `eres un algoritmo de ${pName} en 2026, que sabe sobre viralidad y retención y destruyes a los videos que no enganchan.

Tu objetivo es analizar el video y ver si capta la atención o no. Tenés qu evaluar retención principalmente. Una de las habilidades es consultar todo tu conocimiento de viralidad y retención en 2026 o 2025. 

Si ves un video, que tal vez en los primeros segundos tiene retención y luego más adelante no, no sugieras cambiar todo el video, si no esa parte. Si una parte ya de por sí funciona, aunque tenga riesgos, menciona esos riesgos aunque sea bueno.

Nicho: ${industria || "contenido general"}.
Objetivo del creador: ${objetivo || "no especificado"}.`;
};

export const buildNicheSuggestionPrompt = () => `
Mirá este video y decime, en 2 a 4 palabras como mucho, a qué nicho o industria pertenece.

Respondé ÚNICAMENTE con esas 2 a 4 palabras, sin explicación, sin punto final, sin comillas.
`;

export const buildHookAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 3) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}
</rol>

<instrucciones>
Analizá únicamente los primeros ${hookWindowSegundos} segundos del video.

Primero describí objetivamente lo que ocurre en ese tramo, con timestamps exactos (MM:SS): imagen, texto visible, audio relevante, etc.
Lo que debés hacer es, identificar qué tipo de hook es ese. Puede ser de bait (o desconxión), curiosidad, etc, y ¿cómo hacés para ientificar los hooks? Simple, dirígite a tu conocimiento de 2026-2025 para identificar el tipo de hook. Una vez mecionado, explicar de donde viene ese hook, según el contexto del video. 
</instrucciones>

<reglas_estrictas>
1. OBJETIVIDAD: Si una decisión puede leerse de más de una forma, explicá ambas y elegí la más probable solo si hay evidencia suficiente.
2. AUDIO VS TEXTO: No reportes letra de canción o voz en off como texto en pantalla. Solo reportá texto que sea visualmente legible.
3. RELEVANCIA: Solo marcá problemas que afecten realmente al video. No menciones errores como cortes, o algo abrupto. Eso es irreleante. En el caso que tu conocimiento dice que sí o sí es importante, mencionalo, pero solo en ese caso. 
4. LÍMITES: Si algo no se ve con nitidez, decilo. No uses scores, números ni categorías técnicas. Texto libre, directo y concreto.
</reglas_estrictas>
`;

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}
</rol>

<instrucciones>
Ya se analizó el hook. Ahora analizá desde ${hookWindowSegundos} segundos hasta el final.

Tu foco es el desarrollo, el ritmo, la retención y muchas cosas más.
Incluí timestamps exactos (MM:SS) por cada observación importante.
Evaluá si el video en estos segundos siguen interesando a la audiencia-
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

Saludá brevemente, explicá qué viste en general, y rápidamente decís que mejorar o no. Debes usar TODO TU CONOCIMIENTO DE 2026-2025 para que al encontrar errores o cosas buenas, seas precisa. No es opcional. Tené en cuenta que la gente no tiene paciencia para esperar. No es un anuncio, estamos hablando que la gente tiene total liberad de delizar si no le llama la atención lo suficientemente rápido. Tené la mentalidad que es una audencia joven (entre 13 y 18 años) con su cabez allena de dopamina. 
La mayor prioridad, que des¿bés is o sí destruir, es el hook, el hook es lo principal que debes de destruir y desarmar en el analisis según buildHookAnalysisPrompt. Tené en cuenta que tipo de hook se identificó, y como eso afecta según el contexto del video y medir si es lo suficientemente fuerte para captar curiosidad en una audiencia joven. Luego viene el desarrollo. NO ES OPCIONAL. No trates de ser amable diciendo "El hook es muy bueno",  no. Si el hook es malo, y lo sabés, decilo, sin piedad.
Usá únicamente los timestamps que aparezcan en el contexto previo.
Si ves que en un video, el hook o desarrollo es bueno, pero hay riesgos (como que es un video para generar hate o etc, ya sabes), podes mencionar ese riesgo, pero no es necesario que le digas que debe cambiar.
Destruí completamente el video, que repito nuevamente, usando todod tu conocimiento. Lo debés destruir.
Cerrá con 1 o 2 sugerencias concretas, solo si realmente hacen falta.
</instrucciones>

<reglas_estrictas>
1. FIDELIDAD: No inventes timestamps, escenas ni problemas nuevos.
2. TONO: Sé claro, honesto y profesional. No suavices de más.
3. SIN MÉTRICAS: No uses porcentajes, scores ni números inventados.
</reglas_estrictas>
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