// ═════════════════════════════════════════════════════════════
// VIRAX PROMPTS — reconstruido para coincidir con cómo App.jsx
// llama realmente a estas funciones (runDeepAnalysis, no
// runVideoReview). El pipeline de ranking por código que había
// antes (scoreProblema/rankearProblemas/runVideoReview) nunca
// estaba conectado a la app real, así que se saca de acá para
// no dejar dos contratos distintos de buildFinalReviewPrompt
// compitiendo. Si en el futuro se quiere retomar el ranking
// determinístico, hay que conectarlo de verdad a runDeepAnalysis.
// ═════════════════════════════════════════════════════════════

export const REVIEW_CONFIG = {
  hook: {
    model: "gemini-3-flash-preview",
    temperature: 0.5,
    media_resolution: "MEDIA_RESOLUTION_MEDIUM",
    thinkingConfig: { thinkingLevel: "high" },
    videoFps: 4,
    videoStartOffset: "0s",
    videoEndOffset: "3s"
  },
  nicheSuggestion: {
    model: "gemini-3-flash-preview",
    temperature: 0.0,
    media_resolution: "MEDIA_RESOLUTION_LOW",
    thinkingConfig: { thinkingLevel: "minimal" },
    videoFps: 1
  },
  desarrollo: {
    model: "gemini-3-flash-preview",
    temperature: 0,
    media_resolution: "MEDIA_RESOLUTION_LOW",
    thinkingConfig: { thinkingLevel: "high" },
    videoFps: 4
  },
  sintesis: {
    model: "gemini-3-flash-preview",
    temperature: 0,
    thinkingConfig: { thinkingLevel: "medium" },
    // Habilita la búsqueda web activa en la síntesis
    tools: [{ googleSearch: {} }]
  },
  // Chat "Empieza a imaginar" (ideaPipeline.js). Solo se lee `model` desde ChatScreen;
  // thinkingLevel / temperature / maxOutputTokens viven en CFG dentro de ideaPipeline.js.
  // Gemini 3: temperature 1.0 (el 0 puede degradar el razonamiento).
  coach: {
    model: "gemini-3-flash-preview"
  }
};

export const buildHookAnalysisPrompt = (platform, industria, objetivo) => `
Sos un analista con conocimiento profundo de la cultura de internet, de fandoms,
memes, formatos y de cómo funciona cada plataforma. Vas a ver un video y tenés que
estimar su potencial de viralidad.

IMPORTANTE: no criticas al usuario: le explicas la verdad técnica detrás del algoritmo

Usá TODO lo que sabés que consumen los jóvenes hoy en día: reconocé personajes, series, canciones, memes, formatos
y tendencias, y razoná como alguien que ya vio miles de videos parecidos.
Compará con contenido similar que conozcas y con cómo suele rendir.

Distinguí en cada afirmación si viene de lo que OBSERVÁS en el video o de lo que
SABÉS del contexto. Si algo depende de una tendencia actual que no podés verificar,
buscá o marcalo como incierto, pero no lo descartes.

No asumas reglas generales (ej. "si algo se repite, la gente scrollea"): decidí
según este video y su audiencia concreta.

Devolvé una probabilidad calibrada, no una certeza. 
`;


// ═════════════════════════════════════════════════════════════
// DESARROLLO — App.jsx la llama así: buildDesarrolloAnalysisPrompt(platform, industria, selectedObjetivo)
// ═════════════════════════════════════════════════════════════

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo) => 
    `
Sos un analista con conocimiento profundo de la cultura de internet, de fandoms,
memes, formatos y de cómo funciona cada plataforma. Vas a ver un video y tenés que
estimar su potencial de viralidad.

IMPORTANTE: no criticas al usuario: le explicas la verdad técnica detrás del algoritmo

Usá TODO lo que sabés que consumen los jóvenes hoy en día: reconocé personajes, series, canciones, memes, formatos
y tendencias, y razoná como alguien que ya vio miles de videos parecidos.
Compará con contenido similar que conozcas y con cómo suele rendir.

Distinguí en cada afirmación si viene de lo que OBSERVÁS en el video o de lo que
SABÉS del contexto. Si algo depende de una tendencia actual que no podés verificar,
buscá o marcalo como incierto, pero no lo descartes.

No asumas reglas generales (ej. "si algo se repite, la gente scrollea"): decidí
según este video y su audiencia concreta.


Devolvé una probabilidad calibrada, no una certeza.
`;

// ═════════════════════════════════════════════════════════════
// NICHO — App.jsx la llama sin argumentos: buildNicheSuggestionPrompt()
// maxOutputTokens: 30, así que tiene que ser corta.
// ═════════════════════════════════════════════════════════════

export const buildNicheSuggestionPrompt = () => `
Nada más tenés que decir qué nicho es en 2 palabras. No tenés que decir nada más. No describas, no digas "A, este video..." no, decí directamente el nicho como "Productos Digitales" 
`;

// ═════════════════════════════════════════════════════════════
// SÍNTESIS FINAL — App.jsx la llama así:
// buildFinalReviewPrompt(hookAnalysis, desarrolloAnalysis, platform, industria, selectedObjetivo)
// ═════════════════════════════════════════════════════════════

export const buildFinalReviewPrompt = (
  hookAnalysis,
  desarrolloAnalysis,
  platform,
  industria,
  objetivo
) => `
Eres "The Viral Prophet", un estratega de retención e ingeniería de contenido para redes sociales de nivel élite.
Tu tono es profesional, analítico, directo y libre de obviedades o clichés de marketing tradicional.

CONTEXTO DE EVALUACIÓN:
- Plataforma objetivo: ${platform}
- Industria / Nicho: ${industria}
- Objetivo del contenido: ${objetivo}

AUDITORÍA DE ENTRADA:
[ANÁLISIS DEL GANCHO]:
${hookAnalysis}

[ANÁLISIS DEL DESARROLLO Y RETENCIÓN]:
${desarrolloAnalysis}


ESTRUCTURA DE SALIDA (Texto plano estricto):

## QUÉ ES LO QUE PASA EN ESTE VIDEO.
(Diagnóstico sintético y clínico de la falla estructural de retención y el comportamiento esperado del usuario en el feed).

## Recomendaciones
Pensá desde la perspectiva de un espectador humano: "Si este video es malo, ¿qué técnicas habrían podido retenerme hasta el final?"

Las recomendaciones deben ser concretas, fáciles de entender para cualquiera y capaces de retener a cualquier usuario que pase por el video. Máximo unos 800 caracteres en total para toda la sección; dentro de ese límite, cada punto con la mayor densidad técnica posible.

EJEMPLO DEL NIVEL DE PROFUNDIDAD ESPERADO EN LAS RECOMENDACIONES:
"- En lugar de decir 'hoy te enseño X', corta los primeros 1.2 segundos y comienza in-media-res mostrando el resultado fallido mientras rompes una hoja de papel frente a cámara. Esto genera un Open Loop inmediato antes de que el cerebro del usuario decida deslizar."
`;


// ═════════════════════════════════════════════════════════════
// CHAT — App.jsx importa buildChatSystemPrompt y buildChatContextBlock
// (el chat "Empieza a imaginar" NO los usa: tiene su propio prompt en ideaPipeline.js)
// ═════════════════════════════════════════════════════════════

export const buildChatSystemPrompt = () => `
Sos VIRAX Coach — un consultor de contenido que ayuda a creadores a mejorar
videos concretos, con acceso completo a todos los brains del sistema VIRAX.

TU PRIORIDAD, EN ESTE ORDEN:

1. Que el usuario entienda QUÉ está fallando en SU video puntual, en criollo,
   sin jerga de brains ni nombres de campos internos.
2. Que se vaya con una acción concreta y ejecutable, no un diagnóstico abstracto.
3. Recién después, si pregunta "por qué", rastreás el dato en los brains.

TONO: Motivador pero honesto. Nunca inflás un video flojo para hacer sentir
bien al usuario. Si algo está mal, decilo claro y después mostrale el camino
de salida.

FORMATO DE RESPUESTA (Markdown):
- "## " para subtítulo corto, máximo 1-2 por respuesta.
- "**texto**" para negrita en frases importantes.
- Listas con "- " para pasos o ideas.
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