// ═════════════════════════════════════════════════════════════
// REDXAX VISION — 3 calls: hook, desarrollo, síntesis final
// Objetivo: mejor precisión en videos cortos, bait, curiosidad y retención
// ═════════════════════════════════════════════════════════════

export const REVIEW_CONFIG = {
  hook: {
  model: "gemini-2.5-pro",
  temperature: 0,
  media_resolution: "medium",
  thinkingConfig: { thinkingBudget: 3072 },
  videoFps: 12
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
    temperature: 0.35,
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

PRINCIPIO CENTRAL: no evalúes si el tema del video es interesante. Evaluá si la FORMA en que el video presenta ese tema consigue volverlo interesante para alguien que inicialmente no tenía intención de verlo. Analizá desde el comportamiento humano más general posible: no supongas conocimientos previos, intereses específicos, profesión, edad, hobbies o afinidad con el tema de ${industria}. Un video de cualquier nicho —contabilidad, mecánica, cocina, lo que sea— puede obtener una evaluación excelente si logra transformar un tema específico en una experiencia atractiva para un espectador cualquiera. Si el interés depende principalmente de que el espectador ya conozca o le importe el tema de antemano, es una limitación real del video. Si el interés nace de cómo está presentada la información en sí, es una fortaleza real — independientemente de cuán de nicho sea el tema de fondo.

PERCEPCIÓN: no analices el video como una lista de casilleros a completar. Analizalo como lo haría un espectador humano real, con toda su capacidad de leer personas y situaciones — expresiones faciales, tono de voz, energía, ritmo, timing de un chiste o una revelación, incomodidad, entusiasmo genuino vs. actuado, aburrimiento, confusión, vergüenza ajena, tensión, alivio, sorpresa. Cualquier ejemplo de elementos a observar que aparezca más abajo en este prompt es solo ilustrativo — nunca una lista cerrada. Si notás algo relevante para la retención que ningún ejemplo mencionó, usalo igual: tu criterio humano completo vale más que cualquier lista que un prompt pueda enumerar.

Nicho: ${industria || "contenido general"}.
Objetivo del creador: ${objetivo || "no especificado"}.`;
};

export const buildNicheSuggestionPrompt = () => `
Mirá este video y decime, en 2 a 4 palabras como mucho, a qué nicho o industria pertenece.

Respondé ÚNICAMENTE con esas 2 a 4 palabras, sin explicación, sin punto final, sin comillas.
`;

export const buildHookAnalysisPrompt = (
  platform,
  industria,
  objetivo,
  hookWindowSegundos = 3
) => `

<rol>
Sos un ${contextoComun(platform, industria, objetivo)}.
</rol>

Mirá los primeros ${hookWindowSegundos} segundos de este video como lo miraría una persona real haciendo scroll en su feed de ${platform} — sin ponerte en modo analista todavía. Prestá atención a todo lo que una persona nota sin esfuerzo: lo que se dice, lo que se ve, el tono, el ritmo, si algo la atrapa, si algo la aburre, si algo la confunde, si hay algo que le genera ganas de seguir mirando o ganas de scrollear.

Contame qué notaste, en tus propias palabras, siguiendo el orden natural en que ocurre en el video. No fuerces ninguna categoría ni uses una estructura fija — si en un tramo no pasa nada relevante, decilo así de simple ("acá no pasa nada que sume o reste"), no inventes algo para llenar el análisis.

Después de contarme lo que viste, decime con tus propias palabras si esto detiene el scroll de un usuario promedio o no, y por qué — pensando específicamente en alguien que no tenía ningún interés previo en ${industria} y se cruza con esto sin buscarlo.

Cerrá respondiendo, explícitamente y sin rodeos, esta pregunta puntual porque la necesito de forma clara: ¿este hook depende de que el espectador YA tenga interés en ${industria} para funcionar? Respondé SÍ o NO y en una frase por qué.
`;

export const buildDesarrolloAnalysisPrompt = (
  platform,
  industria,
  objetivo,
  hookWindowSegundos = 4
) => `

<rol>
Sos un ${contextoComun(platform, industria, objetivo)}.
Analizás cómo evoluciona la atención del espectador desde el segundo ${hookWindowSegundos} hasta el final del video. El hook ya fue analizado aparte — no lo vuelvas a evaluar.
</rol>

<instrucciones>
Analizá únicamente desde el segundo ${hookWindowSegundos} hasta el final, siguiendo este proceso. Pensá como un espectador que ya decidió quedarse después del hook.

0. Antes de analizar nada, dividí el video en escenas o beats desde el segundo ${hookWindowSegundos} hasta el final y transcribí de forma literal en cada una:
   - Todo el audio: diálogo hablado palabra por palabra si hay speech, y una descripción de música/efectos/silencios con timestamps aproximados.
   - Todo el texto en pantalla: carteles, subtítulos quemados, texto superpuesto, tal como aparece, con el segundo en que aparece.
   Si no hay diálogo o no hay texto en pantalla en alguna escena, decilo explícitamente ("no hay diálogo", "no hay texto en pantalla") en vez de omitirlo.

1. OBSERVÁ TODO antes de concluir nada: texto en pantalla, subtítulos, gestos, expresiones, objetos, encuadre, colores, cortes de edición, música, silencios, el estado emocional real que transmite quien habla (genuino, forzado, nervioso, aburrido de repetir lo mismo), y también QUÉ SE ESTÁ CONTANDO — qué idea, pregunta, promesa, conflicto o afirmación se plantea en estos segundos, aunque sea solo a través de lo que se dice (un video puede no tener nada visualmente llamativo y aun así enganchar por lo que está narrando, como un podcast o un talking-head). Esta enumeración es un piso, no un techo — traé cualquier otra percepción humana relevante que notes, aunque no esté nombrada acá.

2. IDENTIFICÁ MECANISMOS, no elementos, en cada escena relevante. Que algo aparezca (un corte, un dato, una imagen) no significa que sostenga atención. Un mecanismo puede ser visual, sonoro, o puramente narrativo: una respuesta a lo prometido, un giro, una nueva pregunta, información que resuelve algo, humor, una demostración. Evaluá el mecanismo narrativo con el mismo rigor que el visual: que la historia "siga avanzando" no sostiene atención por sí solo — tiene que darle al espectador una razón concreta para seguir mirando. Preguntate por cada escena: "¿qué motivo concreto tiene este espectador para NO abandonar acá?" — la respuesta puede ser "ninguno".

3. JUZGÁ LA EJECUCIÓN, no el concepto. Que la idea de la escena sea válida (revelar un resultado, generar un giro, dar contexto) no implica que esté bien ejecutada. Hacé el juicio directo por cada escena: un espectador que ya decidió quedarse después del hook, ¿sigue mirando después de esto, o abandona acá? No busques argumentos para inclinarte hacia ninguna de las dos respuestas.

4. HACÉ DE ABOGADO DEL DIABLO (nunca lo digas en el análisis) antes de dar el visto bueno: buscá activamente el momento donde un espectador exigente se aburriría, perdería el hilo, o sentiría que el video no cumple lo que prometió el hook — incluso si el resto está bien ejecutado. Si no encontrás nada real después de este ejercicio, recién ahí concluí que sostiene la atención de punta a punta.

5. CHEQUEO OBLIGATORIO DE NICHO. Antes de concluir, contestá explícitamente esta pregunta binaria: "¿la continuidad de este video depende de que el espectador YA tenga interés en ${industria} (o en el tema puntual) para seguir mirando?" — SÍ o NO, con justificación.

   Para contestarla, imaginá específicamente a alguien cuyo interés está en otro lado, sin ninguna relación con ${industria} (por ejemplo: alguien que solo mira contenido de fútbol, cocina, o lo que sea completamente ajeno al tema del video) que ya se quedó después del hook. La pregunta no es si esa persona termina consumiendo el producto o servicio del nicho — es si el desarrollo le sigue dando motivos para mirar aunque el tema en sí no le importe.

   Si la respuesta es SÍ (depende del interés previo): identificá en qué escena puntual el desarrollo deja de sostenerse por sí mismo y empieza a depender de que el espectador ya esté interesado en el tema — puede ser terminología específica del nicho, una demostración que solo alguien de ese nicho valoraría, o el video convirtiéndose en un pitch de producto sin ningún gancho narrativo que lo sostenga. Esto es una falla real, no un detalle neutral.

   Si la respuesta es NO: explicá concretamente qué en la narrativa, la resolución planteada, o el desarrollo logra ser reconocible o interesante incluso para alguien sin ese interés previo.

   Este chequeo es independiente de los mecanismos visuales/sonoros que ya identificaste: un video puede tener buena edición y aun así depender enteramente del interés previo del espectador.

6. NO COMPENSES. Si identificaste un punto de abandono, no lo diluyas mencionando después cosas positivas del resto del video para suavizarlo. Un solo tramo que pierde al espectador puede tapar todo lo demás bien ejecutado — no lo trates como detalle menor solo porque hay aspectos positivos alrededor.

7. SI HAY FALLA, calificá severidad respondiendo: de los espectadores que llegaron hasta ese punto (ya pasaron el hook), ¿cuántos abandonarían específicamente ahí por este motivo? Justificá con evidencia del video, no repitas la pregunta como fórmula.

Tu único juicio es sobre retención durante el desarrollo: en qué punto, si lo hay, el espectador abandona. Nunca prediagas otras acciones (like, comentario, compartir, seguir, guardar) — no deben aparecer en tu respuesta.

Ignorá por completo la calidad visual durante este ejercicio.

Imaginá que exactamente el mismo contenido fue grabado con una cámara mediocre, sin efectos, sin música y sin edición llamativa, pero manteniendo el mismo diálogo, la misma estructura narrativa y el mismo orden de escenas.

¿Una persona promedio que ya decidió quedarse después del hook tendría igualmente un motivo para seguir mirando hasta el final?

Si la respuesta es NO, entonces el desarrollo depende principalmente de la ejecución visual y no de la narrativa o el contenido en sí. Consideralo una limitación importante.

Toda conclusión debe apoyarse en evidencia observable del video (incluido lo dicho/narrado). Usá tu conocimiento general sobre comportamiento en feeds de video corto para interpretar esa evidencia, nunca para reemplazarla.
</instrucciones>
`;

export const buildFinalReviewPrompt = (hookAnalysis, desarrolloAnalysis, platform, industria, objetivo) => `
<rol>
Sos un redactor profesional especializado en devoluciones breves y directas para creadores de contenido.
</rol>

<contexto_previo>
ANÁLISIS DEL HOOK:
${hookAnalysis}

ANÁLISIS DEL DESARROLLO:
${desarrolloAnalysis}
</contexto_previo>

Decí todo lo que dinieron ambos análisis
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