// ═════════════════════════════════════════════════════════════
// VIRAX VISION — 3 calls: hook, desarrollo, síntesis final
// ═════════════════════════════════════════════════════════════

export const REVIEW_CONFIG = {
  hook: {
    model: "gemini-2.5-pro",
    temperature: 0,
    media_resolution: "medium",
    thinkingConfig: { thinkingBudget: 3072 },
    videoFps: 12,
    seed: 42
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
    temperature: 0.35,
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
Tu único trabajo es evaluar los primeros segundos desde la perspectiva de un usuario que está deslizando un feed. No evalúes la calidad del producto, la claridad de la venta ni la eficacia comercial. Esas cuestiones no forman parte de este análisis.

Si ves un video, que tal vez en los primeros segundos tiene retención y luego más adelante no, no sugieras cambiar todo el video, si no esa parte. Si una parte ya de por sí funciona, aunque tenga riesgos, menciona esos riesgos aunque sea bueno.

PRINCIPIO CENTRAL: no evalúes si el tema del video es interesante. Evaluá si la FORMA en que el video presenta ese tema consigue volverlo interesante para alguien que inicialmente no tenía intención de verlo. Analizá desde el comportamiento humano más general posible: no supongas conocimientos previos, intereses específicos, profesión, edad, hobbies o afinidad con el tema de ${industria}. Un video de cualquier nicho puede obtener una evaluación excelente si logra transformar un tema específico en una experiencia atractiva para un espectador cualquiera. Si el interés depende principalmente de que el espectador ya conozca o le importe el tema de antemano, es una limitación real. Si el interés nace de cómo está presentada la información en sí, es una fortaleza real — independientemente de cuán de nicho sea el tema de fondo.

PERCEPCIÓN: no analices el video como una lista de casilleros a completar. Analizalo como lo haría un espectador humano real, con toda su capacidad de leer personas y situaciones — expresiones faciales, tono de voz, energía, ritmo, timing, incomodidad, entusiasmo genuino vs. actuado, aburrimiento, confusión, tensión, alivio, sorpresa. Cualquier ejemplo de elementos a observar que aparezca más abajo en este prompt es solo ilustrativo — nunca una lista cerrada. Si notás algo relevante para la retención que ningún ejemplo mencionó, usalo igual: tu criterio humano completo vale más que cualquier lista que un prompt pueda enumerar.

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

FASE 1 — OBSERVACIÓN LITERAL. Registrá TODO lo que existe en estos ${hookWindowSegundos} segundos, sin excepción y sin evaluar nada todavía: audio palabra por palabra (diálogo, música, silencios, con timestamps aproximados — usá rangos como "≈2 s" si no hay precisión exacta), todo texto en pantalla tal como aparece con su segundo, tono, gestos, energía, expresiones, edición, encuadre, colores, ritmo de cortes, y qué tipo de estructura o formato es este contenido y qué arco o progresión plantea, si lo hay. Si algo no está presente (no hay diálogo, no hay texto), decilo explícito en vez de omitirlo. Esta fase es pura descripción — cualquier cosa que seas capaz de percibir en el video pertenece acá, sin importar si tenés o no un nombre preciso para categorizarla; si no lo tenés, describila igual con tus propias palabras.

FASE 2 — INVENTARIO Y ETIQUETADO DE MECANISMOS.
Asigná un ID a cada mecanismo detectable: [MEC-1], [MEC-2], etc. (incluyendo texto, audio, progresión).

FASE 3 — MATRIZ DE COBERTURA Y JUICIO INTEGRADO.
Antes de emitir cualquier juicio, listá TODOS los IDs de la Fase 2 y asignales un rol:
- [MEC-X]: ¿Aporta intriga, tensión o novedad? (SÍ/NO)

Cualquier momento que consideres "débil" o "problema" DEBE ser contrastado contra la Matriz:
Si el momento T depende o forma parte de [MEC-X] y [MEC-X] aporta intriga, QUEDA PROHIBIDO clasificarlo como problema aislado.

FASE 4 — FALSACIÓN Y ABSTRACCIÓN DE CATEGORÍA.
1. Traducí el hook a su estructura abstracta (ej: "Sujeto A promete X usando Y"). ¿Esta estructura genera una brecha de información? Evaluá la brecha, NO el producto ni la industria.
2. Si vas a reportar un PROBLEMA, debe cumplir la Regla de Causalidad Estricta: citá el [MEC-X] afectado y explicá por qué el espectador deslizaría inmediatamente a pesar de la presencia de los otros [MEC-Y] activos.

FASE 5 — VEREDICTO. Con lo que sobrevivió a la Fase 4, sin agregar evidencia nueva, concluí si el hook detiene el scroll o no. Para cada problema real (el que sobrevivió la falsación), describí la conexión causal entre la evidencia y la pérdida de permanencia, en vez de estimar cuántos espectadores abandonarían — esa cifra no tiene datos reales detrás. Mencioná TODOS los problemas reales que hayan sobrevivido, no solo uno. Si dos lecturas son igual de plausibles y ninguna evidencia alcanza para inclinar la balanza, decilo así en vez de forzar una conclusión categórica. Tu juicio es solo sobre retención — nunca prediagas otras acciones (like, comentario, compartir, seguir, guardar). Toda conclusión se apoya en evidencia ya reunida, nunca en algo nuevo. Antes de nombrar algo como problema, confirmá que efectivamente redujo permanencia en la Fase 4 — si el análisis concluyó que algo capta o sostiene la atención, eso va como fortaleza, nunca bajo un título de problema. Tampoco invesntes problemas por que no existen. Aprende a identificar problemas de cosas que funcionan. 

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

FASE 1 — OBSERVACIÓN LITERAL. Dividí el video en escenas o beats desde el segundo ${hookWindowSegundos}. Registrá TODO lo que existe en cada una, sin excepción y sin evaluar nada todavía: audio palabra por palabra, todo texto en pantalla con su segundo (usá rangos si no hay precisión exacta), tono, gestos, energía, edición, y la estructura/formato completo del video junto con cómo se desarrolla el arco planteado en el hook a lo largo de las escenas. Si algo no está presente en alguna escena, decilo explícito. Esta fase es pura descripción — cualquier cosa que seas capaz de percibir pertenece acá, con tus propias palabras si no tenés una categoría precisa para nombrarla.

FASE 2 — INVENTARIO DE MECANISMOS. Por cada elemento de cada escena (texto, audio, visual, narrativo, sensorial — sin jerarquía entre canales), preguntate: "si esto no estuviera, ¿el espectador tendría menos motivo para quedarse en este punto?" Listá todos los que pasen ese test, sin importar el canal ni cuán simple o técnico parezca. Un texto en pantalla puede sostener una escena tan bien como cualquier recurso visual; una progresión, contraste o revelación que se va construyendo también cuenta, aunque su pago llegue en una escena posterior. Además, recorré el video momento a momento, no solo escena por escena: en cada instante, ¿hay algo nuevo que procesar, o simplemente sigue pasando el tiempo sin agregar nada? Un tramo donde nada cambia es evidencia de aburrimiento por sí mismo, aunque tampoco haya un error puntual — no necesitás encontrar una falla para señalar un tramo muerto, la ausencia de novedad ya es la falla. Buscá activamente estos tramos, no solo los momentos donde algo visiblemente falla.

FASE 3 — JUICIO INTEGRADO. Juzgá cada escena combinando TODOS los mecanismos de la Fase 2 en conjunto, nunca canal por canal aislado. Antes de señalar cualquier escena como problema, contrastala contra los mecanismos que ya identificaste: si esa escena es parte de cómo funciona algo que ya reconociste como sostén (el arranque de una progresión que se resuelve después), no la reportes como falla aislada sin dejar esa conexión explícita. Juzgá el mecanismo por su efecto real, nunca por la categoría o industria del video. Evaluá cómo evoluciona lo planteado en el hook — si avanza, se resuelve, se abandona o se reemplaza. Formato conocido no es débil por ser conocido. No anticipes escenas futuras al juzgar una escena puntual.

FASE 4 — FALSACIÓN. Tomá el juicio de la Fase 3 e intentá refutarlo: "si mi conclusión es que esta escena sostiene la atención, ¿qué evidencia demostraría lo contrario?" Una observación se convierte en problema real únicamente cuando hay una cadena causal directa entre la evidencia y una pérdida plausible de permanencia — una imperfección no es automáticamente un problema si otro mecanismo ya identificado sostiene la atención por su cuenta. Recorré TODAS las escenas antes de concluir. Evaluá además: (a) sin producción — ¿el mecanismo integrado sobrevive hasta el final sin edición, música ni efectos?; (b) nicho — si eliminás todo conocimiento previo del tema, ¿las promesas centrales siguen teniendo una razón intrínseca para interesar? ¿Qué parte del interés desaparecería sin ese conocimiento previo? No asumas por default que un tema específico reduce el interés general. Si hay señales que compiten entre sí, decilo así.

FASE 5 — VEREDICTO. Con lo que sobrevivió a la Fase 4, sin agregar evidencia nueva, concluí en qué punto(s), si los hay, el espectador abandona. Para cada problema real, describí la conexión causal entre la evidencia y la pérdida de permanencia, en vez de estimar cuántos espectadores abandonarían. Mencioná TODOS los problemas reales que hayan sobrevivido. Si dos lecturas son igual de plausibles, decilo así en vez de forzar una conclusión categórica. Tu juicio es solo sobre retención — nunca prediagas otras acciones. Toda conclusión se apoya en evidencia ya reunida.

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

Armá una lista interna con TODO lo que el ANÁLISIS DEL HOOK y el ANÁLISIS DEL DESARROLLO ya afirman explícitamente: problemas del hook (en orden), problemas del desarrollo (en orden), el chequeo de nicho de cada uno (puede tener matices, no necesariamente un SÍ/NO limpio), y fortalezas mencionadas. Si algo está descripto como algo que capta, retiene o sostiene la atención — aunque el análisis original lo haya puesto bajo un título de "problema" — clasificalo como fortaleza, no como problema, para el resto del proceso. No agregues ningún problema, matiz o fortaleza que no esté escrito en el contexto previo. Si un análisis no menciona problemas reales, esa lista queda vacía — no la rellenes.

Esta lista es la única fuente de verdad para todo lo que sigue.

1. ORDEN DE PROCESAMIENTO FIJO.

1) Problemas del hook, en el orden en que aparecieron.
2) Problemas del desarrollo, en el orden en que aparecieron.
3) Chequeo de nicho (si hay dependencia, total o parcial, en hook o desarrollo).

2. PARA CADA PROBLEMA DE LA LISTA, seguí este proceso — sin saltear pasos:

   a) Confirmá el problema citando la evidencia puntual que ya está en el análisis previo. Si la evidencia no alcanza, descartá el problema.

   b) Causa raíz: "¿qué decisión concreta del creador produjo esto?" — una sola frase.

   c) Efecto buscado: "¿qué tendría que pasar en ese momento para darle al usuario una razón más fuerte para seguir mirando?"

   d) Generá exactamente tres soluciones alternativas distintas para esa causa raíz. No te limites a corregir el síntoma de la forma más obvia: usá tu conocimiento general sobre qué mecánicas, formatos, ritmos y recursos narrativos están generando retención y viralidad real en contenido corto, y aplicalo a la causa raíz de este video puntual. El objetivo es maximizar la capacidad real del video de viralizar.

   e) Para cada una de las tres, contestá SÍ o NO a estas siete preguntas, con justificación de una línea:
      - ¿Elimina la causa raíz (no el síntoma)?
      - ¿Sobrevive en un feed saturado de ${platform}?
      - ¿Depende únicamente de edición, música o efectos visuales?
      - ¿Es específica y ejecutable en la próxima grabación/edición (no genérica)?
      - ¿Esta misma solución podría copiarse literalmente a otro video distinto del mismo nicho, sin cambiar una palabra?
      - ¿Depende de generar polémica dañina, humillación, odio hacia personas o grupos, o contenido ofensivo/divisivo?
      - ¿Esta solución elimina o debilita algún mecanismo que el propio análisis ya identificó como parte de lo que funciona?

   Descartá automáticamente cualquier alternativa que responda NO en 1 o 2, SÍ en 3, NO en 4, SÍ en 5, SÍ en 6, o SÍ en 7.

   e.2) ANCLAJE OBLIGATORIO. Cada alternativa que sobrevivió tiene que citar al menos un elemento CONCRETO de este video puntual (un color, un objeto, una palabra exacta, un timestamp, un gesto). Si es 100% abstracta ("mostrá el beneficio antes", "generá intriga"), no pasa el filtro. Este anclaje tiene que aparecer literalmente en el texto final de la solución.

   f) De las que sobrevivieron, elegí una sola — la de mayor probabilidad real de aumentar retención y viralidad. Si ninguna sobrevivió, volvé a (d) con variación real.

   g) CHEQUEO SIN EDICIÓN: imaginá la solución aplicada con cámara mediocre, sin música ni efectos. ¿Un usuario promedio tendría motivo para seguir mirando solo por este cambio? Si NO, volvé a (d). Si SÍ, queda validada.

3. CHEQUEO DE NICHO (siempre se procesa).

Si el chequeo de nicho señaló dependencia (total o parcial), generá una solución con el mismo proceso (a-g). Si no hay dependencia real, mencionalo brevemente como fortaleza.

4. REDACCIÓN FINAL.

Redactá usando únicamente las soluciones que pasaron (g). No muestres el proceso interno (SÍ/NO, alternativas descartadas, extracción, etiquetas de nicho) — el usuario ve solo: problema, causa, solución explicada en criollo. Nunca uses en la redacción palabras del propio proceso ("mecanismo", "causa raíz", "chequeo de nicho", "SÍ/NO", "anclaje"). Si el chequeo de nicho tiene matices, conservá esa doble lectura en una frase simple, sin etiquetas técnicas. Si ningún problema sobrevivió el proceso, no fuerces uno — decilo así de simple y listá las fortalezas reales encontradas.

FORMATO VISUAL OBLIGATORIO (para que se lea rápido, en Markdown):
Cada problema va en este formato exacto, sin desviarte:

**Problema:** [una línea con el problema, ya en criollo]
**Solución:** [una línea con la acción concreta]

Fortalezas en una sola línea cada una, con **Fortaleza:** al inicio.

El chequeo de nicho, si corresponde, con **A tener en cuenta:** al inicio.

El cierre, con **Lo más importante:** al inicio.

Una línea en blanco entre cada bloque, nunca párrafos corridos de varias ideas juntas. Nada de numeración (1, 2, 3) ni viñetas — las etiquetas en negrita ya ordenan visualmente.

</instrucciones>

<reglas_de_las_soluciones>
1. LA SOLUCIÓN ES SOBRE EL MECANISMO DE FEED, no sobre marketing genérico. Nunca dupliques consejos tipo publicidad.
2. EJECUTABLE EN LA PRÓXIMA GRABACIÓN/EDICIÓN: algo concreto con cámara, guion, corte o escenas.
3. ATACA LA CAUSA, no el síntoma. Si depende del nicho, no es "hacé más contenido de nicho" — es replantear cómo se presenta para enganchar a alguien ajeno también.
4. SI EL PROBLEMA ES DE EJECUCIÓN VISUAL, la solución tiene que ser técnica y específica a ese defecto. Diseñá pensando en un usuario sin contexto que puede abandonar en cualquier instante.
5. NO INVENTES SOLUCIONES PARA PROBLEMAS QUE NO EXISTEN.
6. NINGUNA SOLUCIÓN QUE DEPENDA EXCLUSIVAMENTE DE EDICIÓN, MÚSICA O EFECTOS.
7. NADA DE RELLENO PUBLICITARIO en frases o guiones sugeridos: ¿serviría tal cual pegado en cualquier otro video del nicho? Si sí, reescribilo citando algo concreto de la escena.
8. LA VIRALIDAD NUNCA JUSTIFICA DAÑO. Descartá sin excepción soluciones basadas en polémica dañina, humillación o divisiones sociales, aunque técnicamente aumentaran retención.
</reglas_de_las_soluciones>

<reglas_estrictas>
1. FIDELIDAD: no inventes timestamps, escenas ni problemas nuevos.
2. TONO: claro, honesto, proporcional — ni inflado ni suavizado.
3. SIN MÉTRICAS: no uses porcentajes, scores ni números inventados.
4. SIN PREDICCIONES VAGAS: explicá el mecanismo, no el pronóstico.
5. NO FUERCES CANTIDAD: la cantidad de problemas o fortalezas depende de la lista del punto 0, no de una expectativa previa. Si el video no tiene problemas reales que sobrevivieron a la falsación, la sección de problemas queda vacía — no está permitido etiquetar algo positivo como "Problema" para tener contenido que mostrar. Si tiene cinco problemas reales, mencioná los cinco — no descartes ninguno real solo por acortar.
6. CERO REPETICIÓN: cada idea se dice una sola vez.
7. FORMATO ESCANEABLE, NO BREVEDAD FORZADA: no hay límite de líneas — decí todos los problemas, causas, soluciones y fortalezas reales que encontraste, completos. La velocidad de lectura viene del FORMATO VISUAL (etiquetas en negrita, bloques cortos, líneas en blanco entre ideas), no de recortar contenido. Cada **Problema:**/**Solución:** sigue siendo una o dos líneas cada uno — no te extiendas dentro de cada bloque — pero podés tener tantos bloques como problemas reales haya. Sin frases de relleno tipo "es importante notar que", "cabe destacar".
8. INCLUÍ TODO LO REAL: mencioná todos los problemas que sobrevivieron el proceso y todas las fortalezas reales encontradas, en el orden fijo del punto 1. No hay techo de cantidad — el único filtro es que cada ítem sea real (haya sobrevivido la falsación en el análisis de origen), no que sea "de los primeros 2-3".
9. CIERRE ACCIONABLE: una frase con la solución de mayor impacto si solo pudiera aplicar una.
10. SIN JERGA INTERNA en la redacción final.
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
        buildVideoPartFn({ fps: cfg.hook.videoFps, mediaResolution: cfg.hook.media_resolution }),
        { text: buildHookAnalysisPrompt(platform, industria, objetivo, hookWindowSegundos) }
      ],
      config: {
        temperature: cfg.hook.temperature,
        thinkingConfig: cfg.hook.thinkingConfig,
        mediaResolution: cfg.hook.media_resolution,
        seed: cfg.hook.seed
      }
    }),
    ai.models.generateContent({
      model: cfg.desarrollo.model,
      contents: [
        buildVideoPartFn({ fps: cfg.desarrollo.videoFps, mediaResolution: cfg.desarrollo.media_resolution }),
        { text: buildDesarrolloAnalysisPrompt(platform, industria, objetivo, hookWindowSegundos) }
      ],
      config: {
        temperature: cfg.desarrollo.temperature,
        thinkingConfig: cfg.desarrollo.thinkingConfig,
        mediaResolution: cfg.desarrollo.media_resolution,
        seed: cfg.desarrollo.seed
      }
    })
  ]);

  const hookAnalysis = hookRes.text || "";
  const desarrolloAnalysis = desarrolloRes.text || "";

  const finalRes = await ai.models.generateContent({
    model: cfg.sintesis.model,
    contents: [{ text: buildFinalReviewPrompt(hookAnalysis, desarrolloAnalysis, platform, industria, objetivo) }],
    config: { temperature: cfg.sintesis.temperature, thinkingConfig: cfg.sintesis.thinkingConfig }
  });

  return {
    reviewText: finalRes.text,
    _hookAnalysis: hookAnalysis,
    _desarrolloAnalysis: desarrolloAnalysis
  };
};

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