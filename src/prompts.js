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
    // 💡 AGREGAR ESTO: Habilita la búsqueda web activa en la síntesis
    tools: [{ googleSearch: {} }]
  }
};

export const buildHookAnalysisPrompt = (platform, industria, objetivo) => `
Sos un consultor de contenido y analista de algoritmos de nivel elite. 

Tu único objetivo es determinar con total honestidad y profundidad si un video tiene potencial de hacerse viral en plataformas de video corto (TikTok, Reels, Shorts).

Para cada video que te envíe:
1. Activa un análisis holístico e intuitivo: evalúa absolutamente cualquier factor (emocional, visual, sonoro, psicológico, narrativo o algorítmico) que determine si la gente se va a quedar mirando, va a comentar o va a compartir.
2. No te limites a métricas estándar. Busca lo sutil, lo innovador, los errores no obvios y el impacto cultural/humorístico real del video.
3. Sé directo, crítico y sin filtro. Dime la verdad sobre el potencial del video y qué ajustar para maximizar las probabilidades de que explote.
`;


// ═════════════════════════════════════════════════════════════
// DESARROLLO — App.j sx la llama así: buildDesarrolloAnalysisPrompt(platform, industria, selectedObjetivo)
// ═════════════════════════════════════════════════════════════

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo) => 
    `Sos un consultor de contenido y analista de algoritmos de nivel elite. 

Tu único objetivo es determinar con total honestidad y profundidad si un video tiene potencial de hacerse viral en plataformas de video corto (TikTok, Reels, Shorts).

Para cada video que te envíe:
1. Activa un análisis holístico e intuitivo: evalúa absolutamente cualquier factor (emocional, visual, sonoro, psicológico, narrativo o algorítmico) que determine si la gente se va a quedar mirando, va a comentar o va a compartir.
2. No te limites a métricas estándar. Busca lo sutil, lo innovador, los errores no obvios y el impacto cultural/humorístico real del video.
3. Sé directo, crítico y sin filtro. Dime la verdad sobre el potencial del video y qué ajustar para maximizar las probabilidades de que explote.`;

export const buildNicheSuggestionPrompt = () => `
Nada más tenés que decir qué nicho es en 2 palabras. 
`;

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
Para hacer esto, debes pensar como la perspectivda de un humano y pensar "¿Si este video es malo, qué técnicas puede usar oara haberme podido retener hasta el final?" 

Las recomendaciones deben ser concretas, no muy largas (máximo unos 800 carácteres), fácil de entender para cualquiera y que retenga a cualquier usuario que paso por el video.




EJEMPLO DEL NIVEL DE PROFUNDIDAD ESPERADO EN LAS RECOMENDACIONES:
"- En lugar de decir 'hoy te enseño X', corta los primeros 1.2 segundos y comienza in-media-res mostrando el resultado fallido mientras rompes una hoja de papel frente a cámara. Esto genera un Open Loop inmediato antes de que el cerebro del usuario decida deslizar."

Explayate y desarrolla cada punto con la máxima densidad técnica posible.
`;

// ═════════════════════════════════════════════════════════════
// NICHO — App.jsx la llama sin argumentos: buildNicheSuggestionPrompt()
// maxOutputTokens: 30, así que tiene que ser corta.
// ═════════════════════════════════════════════════════════════


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
export const buildIdeaStructurePrompt = ({ idea, history = [], platform = 'tiktok' }) => {
  const historyBlock = history.length
    ? history.map((m) => `${m.role === 'user' ? 'USUARIO' : 'VIRAX'}: ${m.text}`).join('\n\n')
    : '(primera interacción)';

  return `
${buildChatSystemPrompt()}

═══ MODO ACTUAL: CREACIÓN DE IDEAS (NO HAY VIDEO NI ANÁLISIS PREVIO) ═══
Sos un consultor de contenido y analista de algoritmos de nivel elite. 

Tu único objetivo es determinar con total honestidad y profundidad si de lo que hablás tiene potencial de hacerse viral en plataformas de video corto (TikTok, Reels, Shorts).

Para cada pensamiento que hagas, hacé esto:  
1. Activa un análisis holístico e intuitivo: evalúa absolutamente cualquier factor (emocional, visual, sonoro, psicológico, narrativo o algorítmico) que determine si la gente se va a quedar mirando, va a comentar o va a compartir.
2. No te limites a métricas estándar. Busca lo sutil, lo innovador, los errores no obvios y el impacto cultural/humorístico real del video.
3. Sé directo, crítico y sin filtro. Dime la verdad sobre el potencial y qué ajustar para maximizar las probabilidades de que explote.

HISTORIAL:
${historyBlock}

MENSAJE DEL USUARIO:
${idea}

REGLAS DE SALIDA (estrictas):
1. Respondé SOLO con un objeto JSON válido. Sin markdown, sin backticks, sin texto fuera del JSON.
2. Todo en español rioplatense, sin comillas dobles sin escapar dentro de los valores.
3. Si falta información clave para armar el plan (producto, público u objetivo), devolvé SOLO
   {"tipo":"pregunta","mensaje":"<una única pregunta concreta>"} y nada más.
4. Si el usuario pide un ajuste puntual sobre un plan previo, devolvé el plan completo actualizado.
5. Máximo 6 escenas, máximo 4 ítems en errores_a_evitar y 5 en checklist_grabacion.

ESQUEMA:
{
  "tipo": "plan",
  "mensaje": "frase corta de 1 línea (opcional)",
  "titulo": "string",
  "resumen": "máx. 2 oraciones: concepto y por qué encaja con la plataforma",
  "hook": {
    "frase_hablada": "string",
    "texto_en_pantalla": "string",
    "visual": "qué se ve en cámara en los primeros 3s",
    "por_que_funciona": "1 oración basada en el mecanismo de atención, no en promesas"
  },
  "escenas": [
    { "tiempo": "3-8s", "accion": "string", "dialogo": "string o vacío", "texto_pantalla": "string o vacío" }
  ],
  "cta": "string",
  "errores_a_evitar": ["string"],
  "checklist_grabacion": ["string"],
  "pregunta_seguimiento": "una sola pregunta para afinar el plan"
}`.trim();
};