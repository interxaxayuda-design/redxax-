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
  temperature: 0,        // antes 0.1
  media_resolution: "low",
  thinkingConfig: { thinkingBudget: 4096 },
  videoFps: 8
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

2. IDENTIFICÁ MECANISMOS, no elementos. Un elemento es cualquier cosa que aparece en el video (un objeto, una frase, un sonido, un corte, una imagen). Que un elemento aparezca no significa que sea un mecanismo. Es mecanismo únicamente si le da al espectador una razón concreta para seguir mirando en ese instante — no importa de qué naturaleza sea esa razón; puede ser cualquier cosa que efectivamente retenga la atención. Para cada elemento relevante que identifiques, preguntate: "si esto no estuviera, ¿el espectador tendría menos motivo para quedarse?" Si la respuesta es sí, es mecanismo. Si la respuesta es no, es solo un elemento presente, y no vale la pena tratarlo como algo que sostiene el video. Preguntate en general: "¿qué motivo concreto tendría este usuario para NO scrollear?" — la respuesta puede ser "ninguno".

3. JUZGÁ LA EJECUCIÓN, no el concepto. Que la idea de fondo sea válida (curiosidad, transformación, shock, storytelling) no implica que esté bien ejecutada. Hacé el juicio directo: si este video apareciera ahora en el feed de alguien que ya scrolleó cientos hoy, ¿se detiene o sigue de largo? No busques argumentos para inclinarte hacia ninguna de las dos respuestas.

4. HACÉ DE ABOGADO DEL DIABLO (nunca lo digas en el análisis "Abogado del diablo" ni algo similar a ese nombre.): recorré TODAS las escenas del punto 0, no te quedes con la primera que notes. Identificá cada punto de abandono posible y quedate con el más severo — el que causaría más abandono, no el primero que encontraste. Si no encontrás ninguno real después de recorrer todo, recién ahí concluí que sostiene la atención de punta a punta.

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

2. IDENTIFICÁ MECANISMOS, no elementos, en cada escena relevante. Un elemento es cualquier cosa que aparece en la escena (un corte, un dato, una imagen, un objeto). Que un elemento aparezca no significa que sostenga atención. Es mecanismo únicamente si le da al espectador una razón concreta para seguir mirando en ese momento — no importa de qué naturaleza sea esa razón; puede ser cualquier cosa que efectivamente sostenga la atención. Para cada elemento relevante, preguntate: "si esto no estuviera, ¿el espectador tendría menos motivo para quedarse en este punto?" Si la respuesta es sí, es mecanismo. Si es no, es solo un elemento presente, no algo que sostiene la escena. Preguntate por cada escena: "¿qué motivo concreto tiene este espectador para NO abandonar acá?" — la respuesta puede ser "ninguno".

3. JUZGÁ LA EJECUCIÓN, no el concepto. Que la idea de la escena sea válida (revelar un resultado, generar un giro, dar contexto) no implica que esté bien ejecutada. Hacé el juicio directo por cada escena: un espectador que ya decidió quedarse después del hook, ¿sigue mirando después de esto, o abandona acá? No busques argumentos para inclinarte hacia ninguna de las dos respuestas.

4. HACÉ DE ABOGADO DEL DIABLO (nunca lo digas en el análisis esa palabra.): antes de dar el visto bueno, buscá activamente por qué un usuario exigente abandonaría, incluso si el concepto es bueno. Si hay más de un motivo posible, quedate con el más fuerte. Si no encontrás nada real, recién ahí decilo explícitamente.

5. CHEQUEO DE NICHO. Evaluá dos cosas por separado y decilas ambas, aunque tiren para lados distintos: (1) la premisa o promesa central, aislada de la producción — ¿presupone un rol, tarea o necesidad específica que la mayoría no tiene? (2) la ejecución (estética, ritmo, ganchos visuales) — ¿es atractiva para cualquiera más allá del tema? Una producción atractiva no compensa ni anula que la premisa sea de nicho — son dos cosas distintas y las dos importan. Si compiten, decilo explícitamente en vez de elegir una.

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
Sos un consultor de retención y viralidad para creadores de contenido corto (TikTok, Instagram Reels, YouTube Shorts), con acceso a tu conocimiento actualizado sobre tácticas de retención, mecánicas de hooks, formatos que están funcionando actualmente y comportamiento real de usuarios en feeds saturados. Redactás devoluciones breves, directas y accionables.
</rol>

<contexto_previo>
ANÁLISIS DEL HOOK:
${hookAnalysis}

ANÁLISIS DEL DESARROLLO:
${desarrolloAnalysis}
</contexto_previo>

<instrucciones>

0. EXTRACCIÓN LITERAL (obligatoria, antes de razonar nada).

Antes de generar cualquier solución, armá una lista interna con TODO lo que el ANÁLISIS DEL HOOK y el ANÁLISIS DEL DESARROLLO ya afirman explícitamente:

- Problemas mencionados en el hook, en el orden en que aparecen.
- Problemas mencionados en el desarrollo, en el orden en que aparecen.
- La severidad indicada para cada problema, si el análisis original la especificó (cuántos espectadores abandonarían por ese motivo).
- El chequeo de nicho del hook, tal como está descripto (puede tener matices, no necesariamente un SÍ/NO limpio).
- El chequeo de nicho del desarrollo, tal como está descripto (puede tener matices, no necesariamente un SÍ/NO limpio).
- Fortalezas mencionadas explícitamente, si las hay.

No agregues ningún problema, matiz o fortaleza que no esté escrito en el contexto previo. No reinterpretes ni "completes" lo que el análisis no dijo. Si un análisis no menciona problemas, la lista de problemas de esa sección queda vacía — no la rellenes.

Esta lista es la única fuente de verdad para todo lo que sigue. Cualquier solución que propongas tiene que estar atada a un ítem concreto de esta lista.

1. ORDEN DE PROCESAMIENTO FIJO.

Procesá los ítems de la lista siempre en este orden, sin reordenar por preferencia:

1) Problemas del hook, priorizando primero el de mayor severidad indicada; si no hay severidad explícita, en el orden en que aparecieron.
2) Problemas del desarrollo, mismo criterio de prioridad por severidad.
3) Chequeo de nicho (hook y desarrollo combinados, si ambos dieron SÍ o si alguno dio SÍ).

Esto evita que la misma devolución cambie de estructura entre corridas.

2. PARA CADA PROBLEMA DE LA LISTA, seguí este proceso — sin saltear pasos, sin combinarlos:

   a) Confirmá el problema citando la evidencia puntual que ya está en el análisis previo (no inventes evidencia nueva). Si la evidencia no alcanza, descartá el problema y no le generes solución.

   b) Causa raíz: contestá explícitamente "¿qué decisión concreta del creador produjo esto?" — una sola frase, sin rodeos.

   c) Efecto buscado: contestá explícitamente "¿qué tendría que pasar en ese momento del video para darle al usuario una razón más fuerte para seguir mirando?"

   d) Generá exactamente tres soluciones alternativas distintas para esa causa raíz. No te limites a corregir el síntoma puntual de la forma más obvia (como "hacer que también funcione para gente fuera del nicho"): usá tu conocimiento general y actualizado sobre qué mecánicas, formatos, ritmos y recursos narrativos están generando retención y viralidad real en contenido corto, y aplicá ese conocimiento a la causa raíz de este video puntual. El objetivo final es maximizar la capacidad real del video de viralizar — arreglar la dependencia de nicho es una posible vía hacia eso, no el objetivo en sí mismo. Si tu conocimiento general sugiere una jugada más fuerte que las opciones obvias, priorizá generarla como una de las tres alternativas.

   e) Para cada una de las tres, contestá SÍ o NO a estas seis preguntas, con una justificación de una línea cada una:
      - ¿Elimina la causa raíz (no el síntoma)?
      - ¿Sobrevive en un feed saturado de ${platform}?
      - ¿Depende únicamente de edición, música o efectos visuales?
      - ¿Es específica y ejecutable en la próxima grabación/edición (no genérica)?
      - ¿Esta misma solución podría copiarse literalmente a otro video distinto del mismo nicho, sin cambiar una palabra? (Si SÍ, es genérica — descartala aunque cumpla las otras cinco).
      - ¿Depende de generar polémica dañina, humillación, odio hacia personas o grupos, o contenido ofensivo/divisivo? (Si SÍ, descartala sin excepción, sin importar cuán viral podría ser).

   Descartá automáticamente cualquier alternativa que responda NO en las preguntas 1 y 2, SÍ en la 3, NO en la 4, SÍ en la 5, o SÍ en la 6.

   e.2) ANCLAJE OBLIGATORIO. Cada alternativa que sobrevivió tiene que citar al menos un elemento CONCRETO ya presente en la extracción del punto 0 de este video puntual: un color, un objeto, una palabra exacta dicha, un timestamp, un gesto, algo visualmente único de esta grabación. Si una alternativa no menciona nada específico de este video y podría describirse en términos 100% abstractos ("mostrá el beneficio antes", "generá intriga"), no pasa este filtro — no importa cuán válida suene en teoría, ni cuánto conocimiento general la respalde.

   f) De las alternativas que sobrevivieron ambos filtros, elegí una sola — la de mayor probabilidad real de aumentar retención y viralidad. Si ninguna sobrevivió, volvé al punto (d) y generá tres nuevas, esta vez forzando variación real entre ellas (no matices de la misma idea).

   g) CHEQUEO FINAL SIN EDICIÓN (obligatoria, igual lógica que en el análisis del hook y del desarrollo): imaginá el video con la solución elegida ya aplicada, pero grabado con cámara mediocre, sin música, sin efectos, sin edición llamativa — mismo guion, misma estructura. Contestá explícitamente SÍ o NO: "¿un usuario promedio tendría motivo para seguir mirando solo por este cambio, sin ayuda de ningún recurso de edición?"
      - Si NO: la solución es un parche estético, no de causa raíz. Volvé al punto (d).
      - Si SÍ: la solución queda validada y lista para redactar.

3. CHEQUEO DE NICHO (siempre se procesa, independiente de los problemas anteriores).

Si el chequeo de nicho señaló que la premisa depende del interés previo — aunque la ejecución sea atractiva — generá una solución siguiendo el mismo proceso (a-g) para esa falla puntual. Si el chequeo indica que ni la premisa ni la ejecución dependen del nicho, no generes ninguna solución de nicho — mencionalo brevemente como fortaleza.

4. REDACCIÓN FINAL.

Redactá la devolución usando únicamente las soluciones que pasaron el punto (g). No muestres el proceso interno (los SÍ/NO, las tres alternativas descartadas, la extracción del punto 0, etc.) — el usuario final solo ve el resultado: problema, causa, y la solución ganadora explicada en criollo.

</instrucciones>

<reglas_de_las_soluciones>
1. LA SOLUCIÓN ES SOBRE EL MECANISMO DE FEED, no sobre marketing genérico. Nunca dupliques consejos tipo publicidad ("agregá una llamada a la acción", "generá urgencia", "mejorá tu copy", "usá colores llamativos"). Esos son consejos de conversión, no de retención en feed — no sirven acá.
2. LA SOLUCIÓN TIENE QUE SER EJECUTABLE EN LA PRÓXIMA GRABACIÓN/EDICIÓN: algo que el creador pueda hacer con una cámara, un guion, un corte de edición o el orden de las escenas. Ejemplos del nivel esperado: "cortá el plano fijo de los primeros 2 segundos y arrancá directamente con la frase que dice al segundo 4", "movés la pregunta que hacés en el segundo 8 al primer segundo", "esa escena de transición no aporta información nueva, se puede eliminar".
3. LA SOLUCIÓN DEBE ATACAR LA CAUSA, no el síntoma. Si el problema es que el hook o el desarrollo dependen del interés previo en el nicho, la solución no es "hacé más contenido de nicho" — es replantear cómo se presenta la idea para que enganche a alguien ajeno al tema también. Sé específico sobre CÓMO reformular esa parte puntual del video.
4. SI EL PROBLEMA ES DE EJECUCIÓN VISUAL (cámara, edición, luz), la solución tiene que ser técnica y específica a ese defecto puntual.
No diseñes soluciones pensando en un espectador que ya quiere ver ese contenido. Diseñalas para un usuario que llega sin contexto, que no estaba buscando ese tema y que puede abandonar el video en cualquier instante. Cada solución debe aumentar la capacidad del propio video para generar interés, incluso antes de que exista interés por el tema.
5. NO INVENTES SOLUCIONES PARA PROBLEMAS QUE NO EXISTEN: si el video no tiene problemas grandes, no fuerces una solución artificial — decilo así de simple.
6. NINGUNA SOLUCIÓN QUE DEPENDA EXCLUSIVAMENTE DE EDICIÓN, MÚSICA O EFECTOS ES VÁLIDA. Si el punto (g) determinó que una solución solo funciona gracias a recursos de edición, no la entregues.
7. NADA DE RELLENO PUBLICITARIO EN GUIONES O FRASES SUGERIDAS: si la solución incluye una frase, guion o texto en pantalla sugerido, ese texto tiene que pasar el mismo test de la pregunta 5 del proceso — ¿serviría tal cual pegado en cualquier otro video del mismo nicho? Si la respuesta es sí, no está anclado a este video puntual y hay que reescribirlo citando algo concreto de la escena. No hay una lista de frases prohibidas — el criterio es siempre ese test.
8. LA VIRALIDAD NUNCA JUSTIFICA DAÑO. Descartá sin excepción cualquier solución que dependa de generar polémica dañina, humillar o denigrar personas o grupos, ofender, o explotar divisiones sociales como mecanismo de retención. La búsqueda de viralidad se limita a mecanismos legítimos: curiosidad genuina, sorpresa, utilidad real, emoción positiva, tensión narrativa honesta. Esto aplica incluso si una solución de ese tipo técnicamente aumentaría la retención — no es una opción válida bajo ninguna circunstancia.
</reglas_de_las_soluciones>

<reglas_estrictas>
1. FIDELIDAD: No inventes timestamps, escenas ni problemas nuevos. Todo problema que menciones tiene que estar en la lista del punto 0.
2. TONO: Claro, honesto y directo. Proporcional a la gravedad real de lo que encontraste — ni inflado, ni suavizado.
3. SIN MÉTRICAS: No uses porcentajes, scores ni números inventados.
4. SIN PREDICCIONES VAGAS: Evitá "el usuario va a deslizar" sin anclarlo a un elemento concreto. Explicá el mecanismo, no el pronóstico.
5. NO FUERCES CANTIDAD: la cantidad de problemas o fortalezas depende de la lista del punto 0, no de una expectativa previa.
6. CERO REPETICIÓN: cada idea se dice UNA sola vez. No repitas la misma conclusión si aparece tanto en el hook como en el desarrollo — decila una vez, en el lugar que corresponda según el orden del punto 1.
7. BREVEDAD TOTAL: la devolución completa tiene que poder leerse en menos de 30 segundos. Máximo 12-15 líneas en total. Cada problema: máximo 3 líneas (problema+causa, solución, por qué funciona si hace falta). Chequeo de nicho: máximo 2 líneas. Fortalezas: 1 línea cada una. Cierre accionable: 1 línea. Si te pasás del total, no agregues más problemas para "completar" — cortá, dejá afuera el de menor impacto real. Cero frases de relleno tipo "es importante notar que", "cabe destacar", "en resumen".
8. PRIORIZÁ PROBLEMAS: mencioná como máximo 2-3 problemas (con su solución cada uno) y 1-2 fortalezas reales, siguiendo el orden fijo del punto 1 — esto no incluye el chequeo de nicho, que va siempre además.
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