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
  model: "gemini-2.5-pro",
  temperature: 0,
  media_resolution: "medium",
  thinkingConfig: { thinkingBudget: 3072 },
  videoFps: 12,
  seed: 42,
  videoStartOffset: "0s",
  videoEndOffset: "3s"   // ← nuevo
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
    temperature: 0,
    media_resolution: "low",
    thinkingConfig: { thinkingBudget: 4096 },
    videoFps: 4,
    seed: 42
  },
  sintesis: {
    model: "gemini-2.5-flash",
    temperature: 0,
    thinkingConfig: { thinkingBudget: 1536 }
  }
};


/**
 * Genera el prompt enfocado en análisis orgánico de retención.
 * @param {string} platform - Plataforma de destino (ej. TikTok, Instagram Reels)
 * @returns {string} Prompt optimizado sin plantillas rígidas
 */
export const buildHookAnalysisPrompt = (platform) => `
Eres un editor senior y estratega de retención de video para ${platform}. Tu única obsesión es la curva de permanencia del espectador y la psicología del consumo rápido.

Observa el video adjunto y entrega una crítica directa, orgánica y profesional. No uses plantillas fijas, listas de comprobación ni puntuaciones numéricas. Analiza el video de forma fluida como lo haría un humano experto.
Determina si el video es BUENO o MALO en términos de retención orgánica.


REGLAS: CADA COSA IMPORTANTE DEBE IR JUNTO A UN TIMESTAMP, Y TAMBIÉN DEBÉS ANALIZAR SOLAMENTE LOS PRIMEROS 3 SEGUNDOS. SI ES EL SEGUNDO 4 EN ADELANTE, IGNORÁ POR COMPLETO ESO. 
Devuelve tu respuesta ÚNICAMENTE en este objeto JSON simple:
{
  "veredicto": "BUENO | MALO",
  "analisis_critico": "Escribe aquí tu análisis detallado, realista y técnico sobre la retención, edición y flujo del video."
}
`;

// ═════════════════════════════════════════════════════════════
// DESARROLLO — App.j sx la llama así: buildDesarrolloAnalysisPrompt(platform, industria, selectedObjetivo)
// ═════════════════════════════════════════════════════════════

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo) => `
Sos VIRAX, un analista de retención especializado en el desarrollo de
video corto (todo lo que pasa después del hook) para ${platform}.

CONTEXTO
- Nicho / industria: ${industria}
- Objetivo del creador: ${objetivo}

TU TAREA
Mirá el video desde después del hook hasta el final y diagnosticá qué
tan bien sostiene la atención que ganó al principio, y si cumple lo que
prometió.

EVALUÁ, EN ESTE ORDEN:
1. Cumplimiento de la promesa: ¿el desarrollo entrega lo que el hook
   prometió, o se desvía / tarda demasiado en llegar?
2. Ritmo: ¿hay tramos donde el interés puede caer (explicaciones largas,
   silencios, repetición, falta de cambios visuales)?
3. Claridad del mensaje respecto al objetivo del creador (${objetivo}):
   ¿la estructura ayuda o entorpece ese objetivo?
4. Cierre: ¿el final deja algo (una idea, una acción, un CTA) o se corta
   sin resolver?

REGLAS
- Todo lo que reportes tiene que estar anclado en algo observable del
  video: una frase dicha, un corte, un plano, un gesto, un texto en
  pantalla. No inventes escenas ni timestamps que no puedas señalar.
- No des soluciones ni recomendaciones todavía — esta etapa es solo
  diagnóstico.
- No generes un puntaje ni un porcentaje: describí lo que ves, no lo
  cuantifiques.

FORMATO DE SALIDA (texto simple, sin JSON):
Qué funciona en el desarrollo:
- [cada punto con su evidencia concreta]

Qué falla en el desarrollo:
- [cada punto con su evidencia concreta]

Dependencia de nicho:
[una frase: si lo que funciona o falla depende de convenciones propias
de ${industria}, o si aplicaría igual a cualquier nicho]
`;

// ═════════════════════════════════════════════════════════════
// NICHO — App.jsx la llama sin argumentos: buildNicheSuggestionPrompt()
// maxOutputTokens: 30, así que tiene que ser corta.
// ═════════════════════════════════════════════════════════════

export const buildNicheSuggestionPrompt = () => `
Mirá este video y respondé ÚNICAMENTE con el nicho o tipo de contenido
al que pertenece, en 2 a 4 palabras (por ejemplo: "fitness casero",
"estética facial", "comida rápida", "inmobiliaria de lujo").

No agregues explicación, comillas, puntos ni ningún texto adicional —
solo esas palabras.
`;

// ═════════════════════════════════════════════════════════════
// SÍNTESIS FINAL — App.jsx la llama así:
// buildFinalReviewPrompt(hookAnalysis, desarrolloAnalysis, platform, industria, selectedObjetivo)
// (antes tenía 6 parámetros pensados para un pipeline de ranking
// que nunca se conectó — ver comentario del bloque de arriba).
// ═════════════════════════════════════════════════════════════

export const buildFinalReviewPrompt = (
  hookAnalysis,
  desarrolloAnalysis,
  platform,
  industria,
  objetivo
) => `
Sos VIRAX, un consultor experto en retención y viralidad para TikTok,
Instagram Reels y YouTube Shorts.

CONTEXTO DEL VIDEO
- Plataforma: ${platform}
- Nicho / industria: ${industria}
- Objetivo del creador: ${objetivo}

ANÁLISIS DEL HOOK (primeros segundos):
${hookAnalysis}

ANÁLISIS DEL DESARROLLO (resto del video):
${desarrolloAnalysis}

TU TAREA
Leé los dos análisis de arriba y, de ahí, elegí vos mismo. Tenes que decir lo que dijo el análisis.
`;

// ═════════════════════════════════════════════════════════════
// CHAT — sin cambios, ya estaban bien.
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