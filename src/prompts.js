// ═════════════════════════════════════════════════════════════
// REDXAX VISION — 3 calls: hook, desarrollo, síntesis final
// Objetivo: mejor precisión en videos cortos, bait, curiosidad y retención
// ═════════════════════════════════════════════════════════════

export const REVIEW_CONFIG = {
  retencion: {
    model: "gemini-2.5-pro",
    temperature: 0,
    media_resolution: "medium",
    thinkingConfig: { thinkingBudget: 6144 },
    videoFps: 8
  },
  nicheSuggestion: {
    model: "gemini-2.5-flash",
    temperature: 0.0,
    media_resolution: "low",
    thinkingConfig: { thinkingBudget: 256 },
    videoFps: 1
  },
  sintesis: {
    model: "gemini-2.5-flash",
    temperature: 0.0,
    thinkingConfig: { thinkingBudget: 1536 }
  }
};

//

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
Tu único trabajo es evaluar los primeros segundos desde la perspectiva de un usuario que está deslizando un feed. No evalúes la calidad del producto, la claridad de la venta ni la eficacia comercial. Esas cuestiones no forman parte de este análisis.

Si ves un video, que tal vez en los primeros segundos tiene retención y luego más adelante no, no sugieras cambiar todo el video, si no esa parte. Si una parte ya de por sí funciona, aunque tenga riesgos, menciona esos riesgos aunque sea bueno.

Nicho: ${industria || "contenido general"}.
Objetivo del creador: ${objetivo || "no especificado"}.`;
};

export const buildNicheSuggestionPrompt = () => `
Mirá este video y decime, en 2 a 4 palabras como mucho, a qué nicho o industria pertenece.

Respondé ÚNICAMENTE con esas 2 a 4 palabras, sin explicación, sin punto final, sin comillas.
`;

export const buildRetencionAnalysisPrompt = (
  platform,
  industria,
  objetivo,
  hookWindowSegundos = 3
) => `

<rol>
Sos un ${contextoComun(platform, industria, objetivo)}.
Analizás la retención del espectador a lo largo de todo el video, en dos tramos que comparten el mismo proceso de análisis pero cambian la pregunta base:

- HOOK (segundo 0 a ${hookWindowSegundos}): la pregunta es si el video logra detener el scroll de un usuario que no lo conoce y ya scrolleó cientos de videos hoy.
- DESARROLLO (desde el segundo ${hookWindowSegundos} hasta el final): la pregunta es si sostiene la atención de ese mismo espectador una vez que ya decidió quedarse.
</rol>

<instrucciones>
Analizá el video completo, de principio a fin, siguiendo este proceso:

0. Antes de analizar nada, dividí el video en el HOOK (0 a ${hookWindowSegundos}s) y en escenas o beats del DESARROLLO (${hookWindowSegundos}s en adelante). Para cada tramo transcribí de forma literal:
   - Todo el audio: diálogo hablado palabra por palabra si hay speech, y una descripción de música/efectos/silencios con timestamps aproximados.
   - Todo el texto en pantalla: carteles, subtítulos quemados, texto superpuesto, tal como aparece, con el segundo en que aparece.
   Si no hay diálogo o no hay texto en pantalla en algún tramo, decilo explícitamente ("no hay diálogo", "no hay texto en pantalla") en vez de omitirlo.

1. OBSERVÁ TODO antes de concluir nada, tramo por tramo: texto en pantalla, subtítulos, gestos, expresiones, objetos, encuadre, colores, cortes de edición, música, silencios, y también QUÉ SE ESTÁ CONTANDO — qué idea, pregunta, promesa o conflicto se plantea en el hook, y cómo evoluciona eso en el desarrollo (si avanza, se resuelve, se abandona o se reemplaza). Un video puede no tener nada visualmente llamativo y aun así funcionar por lo que está narrando, como un podcast o un talking-head.

2. IDENTIFICÁ MECANISMOS, no elementos, en cada tramo. Que algo aparezca (un objeto raro, una cara, un corte, un dato) no significa que sostenga atención. Un mecanismo puede ser visual, sonoro, o puramente narrativo: una pregunta abierta, una promesa, un conflicto, un giro, una resolución, una afirmación contraintuitiva. No dependas de una lista cerrada — describí el mecanismo tal como ocurre, aunque sea una combinación o algo atípico. En el hook preguntate: "¿qué motivo concreto tendría este usuario para NO scrollear?". En cada beat del desarrollo preguntate: "¿qué motivo concreto tiene este espectador para NO abandonar acá?". En ambos casos la respuesta puede ser "ninguno".

3. JUZGÁ LA EJECUCIÓN, no el concepto, en cada tramo por separado. Que la idea de fondo sea válida (curiosidad, transformación, shock, storytelling, un giro) no implica que esté bien ejecutada. Para el hook: si este video apareciera ahora en el feed de alguien que ya scrolleó cientos hoy, ¿se detiene o sigue de largo? Para cada beat del desarrollo: un espectador que ya decidió quedarse después del hook, ¿sigue mirando después de esto, o abandona acá? No busques argumentos para inclinarte hacia ninguna de las dos respuestas en ningún tramo.

4. HACÉ DE ABOGADO DEL DIABLO (nunca lo digas en el análisis) antes de dar el visto bueno a cualquier tramo: buscá activamente por qué un usuario exigente abandonaría en el hook, y por separado por qué abandonaría en algún punto del desarrollo, incluso si el concepto o la narrativa son buenos. Si no encontrás nada real después de este ejercicio en un tramo dado, recién ahí concluí que ese tramo sostiene la atención.

5. CHEQUEO OBLIGATORIO DE NICHO, para el video completo. Contestá explícitamente esta pregunta binaria: "¿la retención de este video (en el hook, en el desarrollo, o en ambos) depende de que el espectador YA tenga interés en ${industria} para funcionar?" — SÍ o NO, con justificación.

   Para contestarla, imaginá específicamente a alguien cuyo interés está en otro lado, sin ninguna relación con ${industria} (por ejemplo: alguien que solo mira contenido de fútbol, cocina, o lo que sea completamente ajeno al tema del video) que se cruza con este video en su feed general de ${platform}. La pregunta no es si esa persona termina consumiendo el producto o servicio del nicho — es si el video, en cualquiera de sus dos tramos, le da un motivo para seguir mirando aunque el tema en sí no le importe.

   Si la respuesta es SÍ: identificá en qué tramo puntual (hook, desarrollo, o ambos) el video deja de sostenerse por sí mismo y empieza a depender de que el espectador ya esté interesado en el tema — puede ser terminología específica del nicho, un problema que solo alguien de ese nicho reconocería como tal, o el video convirtiéndose en un pitch de producto sin ningún gancho narrativo que lo sostenga. Esto es una falla real, no un detalle neutral.

   Si la respuesta es NO: explicá concretamente qué en la narrativa, la pregunta planteada o el conflicto mostrado logra ser reconocible o interesante incluso para alguien sin ese interés previo.

   Dos videos del mismo nicho pueden dar respuestas opuestas a esta pregunta — la diferencia está en cómo está planteada la narrativa, no en el tema de fondo. Este chequeo es independiente de los mecanismos visuales/sonoros ya identificados: un video puede tener buena edición y aun así depender enteramente del interés previo del espectador.

6. NO COMPENSES entre tramos. Si el hook falla, no lo compenses con un buen desarrollo, y viceversa — son dos preguntas distintas (parar el scroll vs. sostener la atención) y una falla en una no se cancela con un acierto en la otra. Tampoco compenses dentro de un mismo tramo: si identificaste un punto de abandono en el desarrollo, no lo diluyas mencionando después cosas positivas del resto del video.

7. SI HAY FALLA en cualquier tramo, calificá severidad respondiendo: de los usuarios que ven este tipo de contenido en ${platform} (y, si la falla es en el desarrollo, de los que ya llegaron hasta ese punto), ¿cuántos abandonarían específicamente por este motivo? Justificá con evidencia del video, no repitas la pregunta como fórmula.

Tu único juicio es sobre retención: si el usuario se detiene a mirar el hook, y si luego sigue mirando o abandona durante el desarrollo. Nunca prediagas otras acciones (like, comentario, compartir, seguir, guardar) — no deben aparecer en tu respuesta bajo ninguna forma.

Ignorá por completo la calidad visual durante este ejercicio.

Imaginá que exactamente el mismo contenido —hook y desarrollo— fue grabado con una cámara mediocre, sin efectos, sin música y sin edición llamativa, pero manteniendo el mismo tema, el mismo diálogo y la misma estructura narrativa de principio a fin.

¿Una persona promedio tendría igualmente un motivo para detenerse en el hook, y para seguir mirando hasta el final?

Si la respuesta es NO en cualquiera de los dos tramos, entonces ese tramo depende principalmente de la ejecución visual y no de un interés universal en el contenido o la narrativa. Consideralo una limitación importante, y especificá si afecta al hook, al desarrollo, o a ambos.

Toda conclusión debe apoyarse en evidencia observable del video (incluido lo dicho/narrado). Usá tu conocimiento general sobre comportamiento en feeds de video corto para interpretar esa evidencia, nunca para reemplazarla.
</instrucciones>
`;

export const buildFinalReviewPrompt = (hookAnalysis, desarrolloAnalysis, platform, industria, objetivo) => `
<rol>
Sos un redactor profesional
</rol>

<contexto_previo>
ANÁLISIS DEL HOOK:
${hookAnalysis}

ANÁLISIS DEL DESARROLLO:
${desarrolloAnalysis}
</contexto_previo>

<instrucciones>
Según el conexto, debés redactar y ordenar todo lo que dijieron hookAnalysis y desarrolloAnalysis. Tenés que hacer que el usuario entienda cada palabra que decís. 
</instrucciones>

<reglas_estrictas>
1. FIDELIDAD: No inventes timestamps, escenas ni problemas nuevos. No inventes reacciones de audiencia que no estén respaldadas por el contexto previo.
2. TONO: Claro, honesto y directo. Proporcional a la gravedad real de lo que encontraste — ni inflado, ni suavizado.
3. SIN MÉTRICAS: No uses porcentajes, scores ni números inventados.
4. SIN PREDICCIONES VAGAS: Evitá "el usuario va a deslizar" sin anclarlo a un elemento concreto. Explicá el mecanismo, no el pronóstico.
5. NO FUERCES CANTIDAD: la cantidad de problemas o fortalezas depende del video, no de una expectativa previa. Un video puede tener un solo problema real, o ninguno.
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
        buildVideoPartFn({ //
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