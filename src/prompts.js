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

export const buildHookAnalysisPrompt = (
  platform,
  industria,
  objetivo,
  hookWindowSegundos = 3
) => `

<rol>
Sos un ${contextoComun(platform, industria, objetivo)}.
Analizás cómo funciona el hook durante los primeros ${hookWindowSegundos} segundos del video.
</rol>

<instrucciones>
Analizá únicamente los primeros ${hookWindowSegundos} segundos, siguiendo este proceso:

0. Antes de analizar nada, transcribí de forma literal:
   - Todo el audio: diálogo hablado palabra por palabra si hay speech, y una descripción de música/efectos/silencios con timestamps aproximados.
   - Todo el texto en pantalla: carteles, subtítulos quemados, texto superpuesto, tal como aparece, con el segundo en que aparece.
   Si no hay diálogo o no hay texto en pantalla, decilo explícitamente ("no hay diálogo", "no hay texto en pantalla") en vez de omitirlo.

1. OBSERVÁ TODO antes de concluir nada: texto en pantalla, subtítulos, gestos, expresiones, objetos, encuadre, colores, cortes de edición, música, silencios, y también QUÉ SE ESTÁ CONTANDO — qué idea, pregunta, promesa, conflicto o afirmación se plantea en estos segundos, aunque sea solo a través de lo que se dice (un video puede no tener nada visualmente llamativo y aun así enganchar por lo que está narrando, como un podcast o un talking-head).

2. IDENTIFICÁ MECANISMOS, no elementos. Que algo aparezca (un objeto raro, una cara, un producto) no significa que genere atención. Un mecanismo puede ser visual, sonoro, o puramente narrativo: una pregunta abierta, una promesa de resultado, un conflicto planteado, una afirmación contraintuitiva, el arranque de una historia. Evaluá el mecanismo narrativo con el mismo rigor que el visual: que alguien empiece a "contar algo" no genera atención por sí solo — tiene que generar una razón concreta para seguir escuchando. Preguntate: "¿qué motivo concreto tendría este usuario para NO scrollear?" — la respuesta puede ser "ninguno".

3. JUZGÁ LA EJECUCIÓN, no el concepto. Que la idea de fondo sea válida (curiosidad, transformación, shock, storytelling) no implica que esté bien ejecutada. Hacé el juicio directo: si este video apareciera ahora en el feed de alguien que ya scrolleó cientos hoy, ¿se detiene o sigue de largo? No busques argumentos para inclinarte hacia ninguna de las dos respuestas.

4. HACÉ DE ABOGADO DEL DIABLO (nunca lo digas en el análisis) antes de dar el visto bueno: buscá activamente por qué un usuario exigente abandonaría el video, incluso si el concepto o la narrativa son buenos. Si no encontrás nada real después de este ejercicio, recién ahí decilo explícitamente.

5. CHEQUEO OBLIGATORIO DE NICHO. Antes de concluir, contestá explícitamente esta pregunta binaria: "¿Este hook depende de que el espectador YA tenga interés en ${industria} (o en el tema puntual del video) para funcionar?" — SÍ o NO, con justificación.

   Para contestarla, imaginá específicamente a alguien cuyo interés está en otro lado, sin ninguna relación con ${industria} (por ejemplo: alguien que solo mira contenido de fútbol, cocina, o lo que sea completamente ajeno al tema del video) y que se cruza con este video en su feed general de ${platform}. La pregunta no es si esa persona termina consumiendo el producto o servicio del nicho — es si estos primeros ${hookWindowSegundos} segundos le dan un motivo para seguir mirando aunque el tema en sí no le importe.

   Si la respuesta es SÍ (depende del interés previo): identificá qué parte puntual del hook asume ese interés — puede ser terminología específica del nicho, un problema que solo alguien de ese nicho reconocería como problema, o directamente arrancar mostrando el producto/servicio sin ningún gancho previo. Esto es una falla real, no un detalle neutral, y tiene que aparecer así en tu conclusión.

   Si la respuesta es NO: explicá concretamente qué en la narrativa, la pregunta planteada, o el conflicto mostrado logra ser reconocible o interesante incluso para alguien sin ese interés previo.

   Dos videos del mismo nicho pueden dar respuestas opuestas a esta pregunta — la diferencia está en cómo está planteada la narrativa, no en el tema de fondo. Este chequeo es independiente de los mecanismos visuales/sonoros que ya identificaste: un video puede tener buena edición y aun así depender enteramente del interés previo del espectador.

6. NO COMPENSES. Si tu conclusión es que el usuario sigue scrolleando, no la balancees buscando cosas positivas para suavizarla. Un solo problema puede tapar todo lo demás bien ejecutado — no lo trates como detalle menor solo porque hay aspectos positivos alrededor.

7. SI HAY FALLA, calificá severidad respondiendo: de los usuarios que ven este tipo de contenido en ${platform}, ¿cuántos abandonarían específicamente por este motivo? Justificá con evidencia del video, no repitas la pregunta como fórmula.

Tu único juicio es sobre retención en el hook: se detiene o sigue scrolleando. Nunca prediagas otras acciones (like, comentario, compartir, seguir, guardar) — no deben aparecer en tu respuesta.

Ignorá por completo la calidad visual durante este ejercicio.

Imaginá que exactamente el mismo contenido fue grabado con una cámara mediocre, sin efectos, sin música y sin edición llamativa, pero manteniendo el mismo tema, el mismo diálogo y la misma estructura narrativa.

¿Una persona promedio tendría igualmente un motivo para seguir mirando?

Si la respuesta es NO, entonces el hook depende principalmente de la ejecución visual y no de un interés universal. Consideralo una limitación importante.

Toda conclusión debe apoyarse en evidencia observable del video (incluido lo dicho/narrado). Usá tu conocimiento general sobre comportamiento en feeds de video corto para interpretar esa evidencia, nunca para reemplazarla.
</instrucciones>
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

1. OBSERVÁ TODO antes de concluir nada, escena por escena: texto en pantalla, gestos, expresiones, objetos, encuadre, colores, cortes de edición, música, silencios, y también CÓMO EVOLUCIONA LO QUE SE ESTÁ CONTANDO — si la pregunta, promesa o conflicto planteado en el hook avanza, se resuelve, se abandona o se reemplaza por otra cosa.

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

<instrucciones>
Según el contexto, redactá una devolución que el usuario pueda leer en aproximadamente 2 minutos (guía orientativa: 260-320 palabras). Este número es una guía, NO un techo rígido: si hay información importante del análisis que se pierde por cumplir el límite, priorizá la información completa por sobre el límite exacto de palabras. Es preferible que el usuario lea 100 palabras de más a que se quede sin un dato que cambia cómo entiende su video.

Tomá lo más importante de hookAnalysis y desarrolloAnalysis — no todo lo que dijeron palabra por palabra, pero sí todas las conclusiones que tengan peso real, no solo las más fáciles de resumir.
</instrucciones>

<contenido_obligatorio>
El análisis del hook y el análisis del desarrollo incluyen cada uno un "chequeo de nicho" (si el hook/desarrollo depende de que el espectador ya tenga interés previo en el tema, o si funciona para cualquiera). ESTE CHEQUEO ES INFORMACIÓN OBLIGATORIA — nunca lo omitas ni lo resumas a una sola palabra suelta. Si el resultado fue "depende del interés previo", explicá concretamente qué parte del video asume ese interés y por qué eso limita el alcance. Si fue "no depende", mencionalo también brevemente, como un punto a favor real (no como relleno).

Si en algún momento tenés que elegir entre recortar palabras y recortar el chequeo de nicho, recortá otra cosa. Este punto es tan importante como los problemas de retención en sí.
</contenido_obligatorio>

<contexto_de_feed_saturado>
Cada solución que propongas tiene que estar pensada para un feed saturado: el espectador ya vio decenas o cientos de videos antes que el suyo hoy, tiene el pulgar prácticamente en automático, y no le debe nada a este video en particular — ni tiempo, ni paciencia, ni beneficio de la duda. No está esperando este contenido, no lo buscó, y lo va a abandonar ante la mínima señal de aburrimiento, familiaridad o esfuerzo cognitivo.

Esto significa que:
- Una solución que funcionaría en un contexto de "espectador atento" (una charla, un video buscado a propósito, un cliente ya interesado) puede no servir de nada en el feed. Descartá soluciones que asuman paciencia o interés previo del espectador.
- Priorizá siempre soluciones que actúen en el primer segundo o los primeros segundos posibles — cuanto más tarde en el video se resuelve el problema, menos gente lo llega a ver resuelto.
- Tené en cuenta que el usuario ya vio ese mismo tipo de plano, esa misma frase de apertura, o ese mismo recurso miles de veces en otros videos del mismo nicho — la solución tiene que diferenciar al video de ese ruido de fondo, no repetir la fórmula que ya está saturada en el feed.
</contexto_de_feed_saturado>

<reglas_de_las_soluciones>
1. LA SOLUCIÓN ES SOBRE EL MECANISMO DE FEED, no sobre marketing genérico. Nunca dupliques consejos tipo publicidad ("agregá una llamada a la acción", "generá urgencia", "mejorá tu copy", "usá colores llamativos"). Esos son consejos de conversión, no de retención en feed — no sirven acá.
2. LA SOLUCIÓN TIENE QUE SER EJECUTABLE EN LA PRÓXIMA GRABACIÓN/EDICIÓN: algo que el creador pueda hacer con una cámara, un guion, un corte de edición o el orden de las escenas. Ejemplos del nivel esperado: "cortá el plano fijo de los primeros 2 segundos y arrancá directamente con la frase que dice al segundo 4", "movés la pregunta que hacés en el segundo 8 al primer segundo", "esa escena de transición no aporta información nueva, se puede eliminar".
3. LA SOLUCIÓN DEBE ATACAR LA CAUSA, no el síntoma. Si el problema es que el hook o el desarrollo dependen del interés previo en el nicho, la solución no es "hacé más contenido de nicho" — es replantear cómo se presenta la idea para que enganche a alguien ajeno al tema también. Sé específico sobre CÓMO reformular esa parte puntual del video.
4. SI EL PROBLEMA ES DE EJECUCIÓN VISUAL (cámara, edición, luz), la solución tiene que ser técnica y específica a ese defecto puntual.
5. NO INVENTES SOLUCIONES PARA PROBLEMAS QUE NO EXISTEN: si el video no tiene problemas grandes, no fuerces una solución artificial — decilo así de simple.
</reglas_de_las_soluciones>

<reglas_estrictas>
1. FIDELIDAD: No inventes timestamps, escenas ni problemas nuevos. No inventes reacciones de audiencia que no estén respaldadas por el contexto previo.
2. TONO: Claro, honesto y directo. Proporcional a la gravedad real de lo que encontraste — ni inflado, ni suavizado.
3. SIN MÉTRICAS: No uses porcentajes, scores ni números inventados.
4. SIN PREDICCIONES VAGAS: Evitá "el usuario va a deslizar" sin anclarlo a un elemento concreto. Explicá el mecanismo, no el pronóstico.
5. NO FUERCES CANTIDAD: la cantidad de problemas o fortalezas depende del video, no de una expectativa previa.
6. CERO REPETICIÓN: cada idea se dice UNA sola vez. No repitas la misma conclusión si aparece tanto en el hook como en el desarrollo — decila una vez, en el lugar que corresponda.
7. UNA IDEA POR PÁRRAFO: párrafos cortos (2-4 líneas), sin rodeos ni introducciones largas. Andá directo al punto desde la primera oración.
8. PRIORIZÁ PROBLEMAS: mencioná como máximo 2-3 problemas (con su solución cada uno) y 1-2 fortalezas reales, priorizando los que más impactan la retención — pero esto no incluye el chequeo de nicho, que va siempre además de estos.
9. CIERRE ACCIONABLE: terminá con una frase corta de cuál de todas las soluciones mencionadas es la que más impacto tendría si solo pudiera aplicar una, considerando siempre la lógica de feed saturado.
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