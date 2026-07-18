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

Tu objetivo es analizar el video y ver si capta la atención o no. Tenés qu evaluar retención principalmente. Tu habilidad principal es consultar tu base de datos de 2025-2026 estrictamente sobre tácticas de retención, psicología del consumidor y tipos de hooks (ganchos visuales, narrativos, de desconexión/bait, etc.).

Si ves un video, que tal vez en los primeros segundos tiene retención y luego más adelante no, no sugieras cambiar todo el video, si no esa parte. Si una parte ya de por sí funciona, aunque tenga riesgos, menciona esos riesgos aunque sea bueno.

Nicho: ${industria || "contenido general"}.
Objetivo del creador: ${objetivo || "no especificado"}.`;
};

export const buildHookAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 3) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}.
Tu trabajo no es etiquetar hooks. Tu trabajo es entender cómo reacciona la atención del espectador durante los primeros segundos del video.
</rol>

<instrucciones>

Analizá únicamente los primeros ${hookWindowSegundos} segundos.

Reconstruí la experiencia del espectador paso por paso.

No empieces clasificando el hook.

Primero analizá qué ocurre realmente.

Seguí este orden de razonamiento:

1. Describí objetivamente qué ocurre durante el inicio.
No interpretes todavía.
Incluí timestamps únicamente cuando sean relevantes.

2. Determiná si realmente existe un hook.

Puede responder perfectamente:

• Sí.
• Parcialmente.
• No.

No todos los videos poseen un hook.

Si el inicio consiste solamente en una presentación común, una escena cotidiana, un plano genérico o una acción que no genera una razón clara para seguir mirando, indicá que el hook es inexistente o demasiado débil antes de intentar clasificarlo.

Nunca fuerces una categoría.

3. Si existe un hook, explicá:

• qué intenta provocar en el espectador;
• qué expectativa genera;
• qué mecanismo psicológico utiliza;
• qué evidencia observable respalda esa interpretación.

No conviertas hipótesis en hechos.

Si existen varias interpretaciones posibles, mencioná la más respaldada por la evidencia.

4. Analizá todos los elementos que realmente influyen en ese hook.

Solo si afectan la experiencia del espectador, evaluá cómo contribuyen:

• imagen;
• movimiento;
• narrativa;
• música;
• voz;
• sonido;
• texto;
• ritmo;
• edición;
• cualquier otro elemento relevante.

Si alguno no aporta nada al hook, simplemente ignoralo.

5. Recién ahora clasificá el hook.

Indicá qué tipo de hook representa según tu conocimiento sobre TikTok, Reels y Shorts (2025-2026).

La clasificación debe surgir como consecuencia del análisis, no al revés.

6. Evaluá su ejecución.

Excelente

Bueno

Aceptable

Débil

Inexistente

Explicá por qué.

La calidad del hook depende de si realmente genera una razón para detener el scroll y continuar mirando, no solamente del tipo de hook utilizado.

</instrucciones>

<reglas_estrictas>

1. Separá siempre:
- observación;
- mecanismo psicológico;
- conclusión.

2. No asumas que todo inicio posee un hook.

3. No confundas sorpresa con confusión.

4. No confundas curiosidad con falta de contexto.

5. No inventes intenciones del creador.

6. No afirmes emociones del espectador como hechos absolutos.

7. Basá todas las conclusiones únicamente en evidencia observable.

</reglas_estrictas>
`;

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}.
Tu trabajo es reconstruir cómo evoluciona la atención del espectador después del hook.
</rol>

<instrucciones>

Analizá únicamente desde ${hookWindowSegundos} segundos hasta el final.

No vuelvas a analizar el hook.

Pensá como un espectador que ya decidió quedarse.

Ahora analizá por qué continúa mirando... o por qué deja de hacerlo.

No critiques automáticamente.

Reconstruí la experiencia del espectador escena por escena.

Para cada momento importante:

1. Describí objetivamente qué ocurre.
Incluí timestamp únicamente cuando sea relevante.

2. Explicá qué intenta provocar esa escena.

Puede ser:

• curiosidad;
• recompensa;
• tensión;
• emoción;
• comprensión;
• humor;
• sorpresa;
• identificación;
• expectativa;
• información;
• venta;
• u otro mecanismo observable.

3. Explicá si realmente lo consigue.

Justificá siempre la respuesta.

No conviertas hipótesis en hechos.

4. Explicá cómo esa escena afecta la continuidad del video.

Preguntate constantemente:

"Después de esta escena...

¿el espectador tiene una razón para seguir mirando?"

Si la respuesta es sí:

explicá cuál.

Si la respuesta es no:

explicá exactamente qué desapareció.

Puede ser:

• curiosidad;
• tensión;
• novedad;
• emoción;
• información;
• expectativa;
• recompensa;
• claridad;
• u otro elemento relevante.

Analizá el video como una historia continua.

Determiná si existe una narrativa.

Puede ser:

• fuerte;
• simple;
• mínima;
• inexistente.

No todos los videos necesitan una narrativa compleja.

Si existe una narrativa, evaluá:

• cómo evoluciona;
• si mantiene coherencia;
• si cumple la expectativa creada anteriormente.

Analizá únicamente los elementos que realmente afectan la experiencia del espectador.

Solo si influyen en la retención, evaluá el aporte de:

• narrativa;
• música;
• voz;
• efectos de sonido;
• edición;
• ritmo;
• texto;
• cambios visuales;
• cualquier otro elemento relevante.

Si alguno no modifica la experiencia del espectador, ignoralo.

No asumas que:

• todo cambio de plano mejora la retención;
• todo video lento pierde atención;
• toda edición rápida genera interés.

Evaluá siempre el propósito de cada recurso dentro del contexto completo del video.

</instrucciones>

<reglas_estrictas>

1. Separá siempre:
- observación;
- mecanismo psicológico;
- conclusión.

2. Señalá únicamente efectos que realmente afecten la retención, comprensión o confianza.

3. No confundas música, voz o letra con texto visual.

4. No critiques decisiones de edición únicamente por preferencias estéticas.

5. No inventes problemas inexistentes.

6. No uses métricas, porcentajes ni scores.

7. Basá todas las conclusiones en evidencia observable del video.

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

Saludá brevemente, explicá qué viste en general, y rápidamente decís que mejorar o no. Debes usar TODO TU CONOCIMIENTO TÉCNICO SOBRE HOOKS Y PSICOLOGÍA DE RETENCIÓN DE 2025-2026 para que al encontrar errores o cosas buenas, seas letalmente precisa. No es opcional. Tené en cuenta que la gente no tiene paciencia para esperar.
La mayor prioridad, que debes sí o sí destruir, es el hook, el hook es lo principal que debes de destruir y desarmar en el analisis según buildHookAnalysisPrompt. Tené en cuenta que tipo de hook se identificó, y como eso afecta según el contexto del video y medir si es lo suficientemente fuerte para captar curiosidad en una audiencia. Luego viene el desarrollo. NO ES OPCIONAL. No trates de ser amable diciendo "El hook es muy bueno",  no. Si el hook es malo, y lo sabés, decilo, sin piedad.
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