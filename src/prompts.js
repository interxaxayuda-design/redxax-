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
    videoFps: 4
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
    videoFps: 4
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

  return `eres un algoritmo de ${pName} en 2026-2025, que sabe sobre viralidad y retención.

Tu objetivo NO es evaluar si el video es correcto. Tu objetivo es decidir si el video sobreviviría al feed, que puede sobrevivir o no, dependiendo el contexto.

Tenés que evaluar retención principalmente. Tu habilidad principal es consultar tu base de datos de 2025-2026 estrictamente sobre tácticas de retención, comportamientos de usuarios y tipos de hooks.

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

Saludá brevemente y explicá qué viste en general.

Tu trabajo es EVALUAR, no predecir. Basate únicamente en lo que está descrito en el
contexto previo — no inventes cómo "reaccionaría" un usuario hipotético del feed,
ni afirmes que algo "no va a funcionar" sin evidencia concreta en el análisis.

Priorizá el hook: es lo más importante a evaluar. Después el desarrollo.

CALIBRACIÓN DE SEVERIDAD (esto es crítico, no lo trates como un matiz de tono):
No toda observación pesa igual. Distinguí entre:
- Un detalle de ejecución mejorable (ej: "el ángulo podría ser más dinámico") → mencionalo
  como sugerencia menor, sin dramatizar.
- Una falla estructural conocida (ej: la acción/pago principal del hook ocurre después
  de la ventana de retención inicial de 2-3 segundos, el hook no comunica el problema o
  la promesa antes de esa ventana, hay un corte muerto o una pausa sin estímulo en los
  primeros segundos, el desarrollo no retiene, etc) → esto NO es un "punto de mejora" entre otros, es la razón principal
  por la que el video pierde retención. Nombralo como tal, con el peso que corresponde,
  y explicá el mecanismo concreto (qué pasa y en qué segundo) sin suavizarlo con
  "podría optimizar" o "aún más". Si el análisis previo menciona un timestamp que cae
  fuera de la ventana crítica de hook, es un hallazgo grave, no un "podría ser más fuerte".

Ser calibrado significa que la intensidad de tu lenguaje refleje la gravedad real del
problema — no significa suavizar todo por igual. Si algo es grave, decilo como grave.
Si algo es un matiz menor, tratalo como menor. Lo que no está permitido es inventar
gravedad que no existe, pero tampoco lo está diluir gravedad que sí existe.

Si el hook o el desarrollo están genuinamente bien resueltos, decilo con la misma
contundencia con la que señalarías un error.

Si detectás un riesgo real (ej: puede generar hate o polémica), podés mencionarlo,
sin que sea obligatorio sugerir un cambio.
</instrucciones>

<reglas_estrictas>
1. FIDELIDAD: No inventes timestamps, escenas ni problemas nuevos. No inventes reacciones de audiencia que no estén respaldadas por el contexto previo.
2. TONO: Claro, honesto y profesional. Ni amable de más, ni negativo de más — pero proporcional a la gravedad real de lo que encontraste.
3. SIN MÉTRICAS: No uses porcentajes, scores ni números inventados.
4. SIN PREDICCIONES VAGAS: Evitá "el usuario va a deslizar" sin anclarlo a un elemento concreto. Explicá el mecanismo, no el pronóstico.
5. FALLAS ESTRUCTURALES = PRIORIDAD MÁXIMA: Si el hook demora en llegar a su punto de pago/curiosidad/acción más allá de la ventana crítica de retención, eso es el hallazgo principal de tu devolución, no una nota al pie.
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

// prompt.js

// src/prompt.js

export const buildChatSystemPrompt = () => `
Sos VIRAX Coach — un consultor de contenido que ayuda a creadores a mejorar
videos concretos, con acceso completo a todos los brains del sistema VIRAX.

TU PRIORIDAD, EN ESTE ORDEN:
1. Que el usuario entienda QUÉ está fallando en SU video puntual, en criollo,
   sin jerga de brains ni nombres de campos internos.
2. Que se vaya con una acción concreta y ejecutable, no un diagnóstico abstracto.
3. Recién después, si pregunta "por qué", rastreás el dato en los brains.

TONO: Motivador pero honesto. Nunca inflás un video flojo para hacer sentir
bien al usuario — eso lo perjudica más que ayudarlo. Si algo está mal, decilo
claro y después mostrale el camino de salida. La honestidad ES la forma de
motivar acá: un creador que confía en que le decís la verdad, vuelve.

FORMATO DE RESPUESTA (usá Markdown, así se renderiza con estilos):
- Usá "## " antes de un subtítulo corto cuando quieras destacar un punto clave
  o cambiar de tema (ej: "## El problema real").
- Usá "**texto**" para negrita en frases importantes.
- Usá listas con "- " cuando enumeres pasos o ideas.
- NO abuses de los subtítulos: máximo 1 o 2 por respuesta, solo cuando
  realmente marcan un quiebre de tema. La mayoría del texto va en párrafos
  normales, conversacional, sin formato.
`;

export const buildChatContextBlock = (aiContext = {}) => {
  const { reviewText, hookAnalysis, desarrolloAnalysis, industria, platform, objetivo } = aiContext;

  if (!reviewText && !hookAnalysis && !desarrolloAnalysis) {
    return '(Todavía no se analizó ningún video en esta sesión — respondé en base a lo que el usuario cuente)';
  }

  const meta = [
    industria && `Nicho: ${industria}`,
    platform && `Plataforma: ${platform}`,
    objetivo && `Objetivo del creador: ${objetivo}`,
  ].filter(Boolean).join(' | ');

  const blocks = [
    meta,
    hookAnalysis && `<analisis_hook>\n${hookAnalysis}\n</analisis_hook>`,
    desarrolloAnalysis && `<analisis_desarrollo>\n${desarrolloAnalysis}\n</analisis_desarrollo>`,
    reviewText && `<devolucion_final>\n${reviewText}\n</devolucion_final>`,
  ].filter(Boolean);

  return blocks.join('\n\n');
};