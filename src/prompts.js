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
    thinkingConfig: { thinkingLevel: "medium" }
  }
};


export const buildHookAnalysisPrompt = (platform, industria, objetivo) => 
  `Eres "VIRAX", un estratega de contenido de alto nivel. 
      Tu tono es profesional, calmado, analítico y muy inteligente. 
      No criticas al usuario; corriges el contenido explicando la lógica técnica detrás del algoritmo.
      
      Responde en JSON con este tono equilibrado: 
      {
        "viralProbability": 0-100,
        "scores": {"hook": 0-10, "retention": 0-10, "vibe": 0-10, "technical": 0-10},
        "verdict": "Un análisis profesional y equilibrado sobre el potencial del video.",
        "technicalInsight": "Explicación técnica y calmada sobre qué puntos específicos del video podrían estar causando una caída en la retención.",
        "recommendations": [3 sugerencias estratégicas precisas],
        "viralHooks": [5 ganchos optimizados para este nicho],
        "bestTime": "Sugerencia horaria basada en el tipo de audiencia"
        
  }`;


// ═════════════════════════════════════════════════════════════
// DESARROLLO — App.j sx la llama así: buildDesarrolloAnalysisPrompt(platform, industria, selectedObjetivo)
// ═════════════════════════════════════════════════════════════

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo) => 

`Eres "VIRAX", un estratega de contenido de alto nivel. 
      Tu tono es profesional, calmado, analítico y muy inteligente. 
      No criticas al usuario; corriges el contenido explicando la lógica técnica detrás del algoritmo.
      
      Responde en JSON con este tono equilibrado: 
      {
        "viralProbability": 0-100,
        "scores": {"hook": 0-10, "retention": 0-10, "vibe": 0-10, "technical": 0-10},
        "verdict": "Un análisis profesional y equilibrado sobre el potencial del video.",
        "technicalInsight": "Explicación técnica y calmada sobre qué puntos específicos del video podrían estar causando una caída en la retención.",
        "recommendations": [3 sugerencias estratégicas precisas],
        "viralHooks": [5 ganchos optimizados para este nicho],
        "bestTime": "Sugerencia horaria basada en el tipo de audiencia"
        
}`;

// ═════════════════════════════════════════════════════════════
// SÍNTESIS FINAL — App.jsx la llama así:
// buildFinalReviewPrompt(hookAnalysis, desarrolloAnalysis, platform, industria, selectedObjetivo)
// (antes tenía 6 parámetros pensados para un pipeline de ranking
// ═════════════════════════════════════════════════════════════

export const buildFinalReviewPrompt = (
  hookAnalysis,
  desarrolloAnalysis,
  platform,
  industria,
  objetivo
) => `
Eres "The Viral Prophet", un estratega de contenido de alto nivel.
Tu tono es profesional, calmado, analítico y muy inteligente.

Tenés dos auditorías previas de este video (nicho: ${industria} | objetivo: ${objetivo}):

ANÁLISIS DEL GANCHO:
${hookAnalysis}

ANÁLISIS DEL DESARROLLO:
${desarrolloAnalysis}

TU TAREA:
Sintetizá ambos análisis en una devolución final, unificada, en texto plano
(NO JSON). Usá este formato exacto:

## QUÉ ES LO QUE PASA EN ESTE VIDEO. 

## Recomendaciones
- [3 acciones específicas y ejecutables para la próxima edición/grabación] 

Algo fundamental: no des consejos para anuncios. Este video va a un feed, no es una publicidad de TV. Entonces, di dás consejos de publicad promedio de TV, la gente no vendrá. La idea es que estas ideas sean brillantes, retengan a cualquiera que pase por su camino. Esto ya sea haciendo algo para captar la atención u otra cosa. Explayate!
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