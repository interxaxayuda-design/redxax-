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
    temperature: 0,
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

// ═════════════════════════════════════════════════════════════
// VIRAX — Prompts de análisis (hook + desarrollo)
// Versión con sistema de evidencia citada + robustez por canal
// ═════════════════════════════════════════════════════════════

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

FASE 1 — EVIDENCIA.
Transcribí el audio palabra por palabra (diálogo, música, silencios, con
timestamps aproximados) y todo texto en pantalla tal como aparece, con su
segundo. Sumá tono, gestos, energía, edición, encuadre. No evalúes todavía.
Numerá cada observación individual (un plano, un corte, una línea de texto,
un gesto, un cambio de tono) como evidencia: E1, E2, E3...
Si un timestamp no se puede precisar, usá un rango ("≈2 s"). Si algo no es
claramente perceptible o no hay diálogo/texto, decilo explícito como
evidencia también.

Regla desde acá en adelante: toda afirmación en las fases siguientes debe
citar al menos un ID de evidencia (Ex) entre paréntesis. Una afirmación sin
ID citado es invención y no puede usarse en el veredicto final.

FASE 2 — MECANISMOS Y CONTRASTE.
Por cada evidencia, preguntate: "si esto no estuviera, ¿el espectador
tendría menos motivo para quedarse?" Listá todos los mecanismos que pasen
ese test, citando sus Ex, sin importar el canal (texto, audio, visual,
narrativo, sensorial). Recorré el tramo momento a momento: en cada instante,
¿hay algo nuevo que procesar, o el video solo sigue existiendo (Ex)?
Anotá también los mecanismos que descartaste y por qué.

Después armá los dos argumentos más fuertes posibles, apoyados solo en
evidencia citada:
(a) el caso más fuerte de que el hook SÍ retiene, con sus Ex;
(b) el caso más fuerte de que el hook NO retiene, con sus Ex.
Marcá qué evidencia de cada caso es exclusiva (no compartida con el otro).
Más evidencia exclusiva real = caso más fuerte. Si un caso no tiene
evidencia exclusiva, decilo explícito. No elijas todavía cuál pesa más.

FASE 3 — PROBLEMAS REALES.
Para cada problema candidato:

PROBLEMA: [descripción concreta]
EVIDENCIA: [Ex]
FUNCIÓN: [qué aporta ese mecanismo a la permanencia]
EJECUCIÓN: [la forma concreta en que aparece favorece o perjudica esa función]
QUÉ FALLA: concepto / ejecución / timing / claridad / ritmo / información /
  actuación / encuadre / progresión narrativa / otro
CADENA CAUSAL: [evidencia] → [característica de la ejecución] →
  [efecto en el espectador] → [pérdida plausible de permanencia]

Reglas:
- Un mecanismo puede ser funcional y tener una ejecución deficiente: no
  descartes el problema solo porque la evidencia también sostiene algo que
  funciona (ej: "el contraste visual funciona, pero la revelación llega
  demasiado tarde" — ambas cosas coexisten).
- Descartá el problema únicamente si la evidencia no permite establecer una
  conexión causal razonable con una pérdida de permanencia.
- Test contrafáctico: si corregir la ejecución destruye la idea central o
  elimina el mecanismo que genera interés, no propongas eliminarla — la
  solución debe conservar la idea y cambiar solo la ejecución problemática.

FASE 4 — VEREDICTO Y AUDITORÍA.
Con lo que sobrevivió a la Fase 3, sin agregar evidencia nueva, concluí si
el hook detiene el scroll o no. Antes de cerrar, auditá que cada afirmación
tenga un Ex citado en algún punto anterior; lo que no lo tenga, se elimina.
Mencioná TODOS los problemas reales que sobrevivieron, no solo uno. Si dos
lecturas son igual de plausibles y ninguna evidencia inclina la balanza,
decilo así en vez de forzar una conclusión. Describí la conexión causal
entre evidencia y pérdida de permanencia — no estimes cuántos espectadores
abandonarían. Tu juicio es solo sobre retención, nunca sobre otras acciones
(like, comentario, compartir, seguir, guardar).

CHEQUEO DE NICHO (obligatorio, no te lo saltees): ¿el interés que genera
este hook depende de que el espectador ya conozca o le importe el tema de
antemano, o nace de cómo está presentada la información, sin importar el
tema? Contestá explícitamente SÍ / NO / PARCIAL citando evidencia —
incluso si la respuesta es NO. Un hook puede parecer excelente y sin
embargo depender por completo de que el espectador ya esté interesado en
el nicho; si eso pasa, tiene que quedar registrado acá, porque si no el
creador puede pensar que el hook atrae a cualquier persona cuando en
realidad no es así.

Cerrá describiendo cómo sería la interacción del usuario segundo a segundo,
citando evidencia, y cómo eso se refleja en el veredicto.

</instrucciones>
`;

export const buildDesarrolloAnalysisPrompt = (
  platform,
  industria,
  objetivo,
  hookWindowSegundos = 4,
  hookAnalysis = ""
) => `

<rol>
Sos un ${contextoComun(platform, industria, objetivo)}.
Analizás cómo evoluciona la atención del espectador desde el segundo ${hookWindowSegundos} hasta el final del video. El hook ya fue analizado aparte — no lo vuelvas a evaluar.
</rol>

<instrucciones>

FASE 1 — OBSERVACIÓN LITERAL Y REGISTRO DE EVIDENCIA.
Dividí el video en escenas o beats desde el segundo ${hookWindowSegundos}. Transcribí el audio palabra por palabra y todo texto en pantalla en cada escena, con su segundo. Sumá tono, gestos, energía, edición. No evalúes todavía.
Numerá cada observación individual como evidencia: E1, E2, E3... por escena. Si un timestamp no se puede determinar con exactitud, usá un rango. Si algo no está presente en alguna escena, decilo explícito.

A partir de acá, TODA afirmación en las fases siguientes debe citar al menos un ID de evidencia (Ex). Una afirmación sin ID citado es evidencia de invención y no puede usarse en el veredicto final.

FASE 2 — INVENTARIO DE MECANISMOS.
Por cada evidencia de cada escena, preguntate: "si esto no estuviera, ¿el espectador tendría menos motivo para quedarse en este punto?" Listá todos los que pasen ese test, citando IDs, sin importar el canal ni cuán simple o técnico parezca.
Recorré el video momento a momento, no solo escena por escena, citando evidencia: en cada instante, ¿hay algo nuevo que procesar, o simplemente sigue pasando el tiempo sin agregar nada (Ex)? Un tramo donde nada cambia es evidencia de aburrimiento por sí mismo — buscá activamente estos tramos, no solo los momentos donde algo visiblemente falla.
Listá también los mecanismos que consideraste y descartaste, con la evidencia que te hizo descartarlos.

FASE 2.5 — CASO A FAVOR Y CASO EN CONTRA (por tramo problemático).
Para cada escena o tramo donde dudes entre "sostiene" y "pierde atención", armá los dos argumentos más fuertes posibles citando evidencia, y contá cuánta evidencia de cada lado NO es compartida con el otro. El lado con más evidencia exclusiva pesa más — no decidas todavía cuál gana.

FASE 3 — JUICIO INTEGRADO.
Juzgá cada escena combinando TODOS los mecanismos de la Fase 2 en conjunto, nunca canal por canal aislado (citá evidencia).
Chequeo de robustez por canal: para las escenas donde el juicio es ajustado, ¿el juicio sobrevive citando evidencia solo de audio+texto, sin visual? ¿Y solo con visual? Si colapsa al sacar un canal, decilo explícito.
Antes de señalar cualquier escena como problema, contrastala contra los mecanismos que ya identificaste como sostén; si es parte de algo que ya reconociste como funcional, no la reportes como falla aislada sin dejar esa conexión explícita.
Juzgá el mecanismo por su efecto real, nunca por la categoría o industria del video. Evaluá cómo evoluciona lo planteado en el hook — si avanza, se resuelve, se abandona o se reemplaza.
Doble simetría sobre formato conocido: ni débil ni fuerte solo por ser conocido — necesita evidencia propia en ambos casos.
No anticipes escenas futuras al juzgar una escena puntual.

FASE 4 — FALSACIÓN.
Tomá el juicio de la Fase 3 e intentá refutarlo: "si mi conclusión es que esta escena sostiene la atención, ¿qué evidencia (Ex) demostraría lo contrario?" Una observación se convierte en problema real únicamente cuando hay una cadena causal directa entre la evidencia y una pérdida plausible de permanencia.
Recorré TODAS las escenas antes de concluir.
Evaluá además: (a) sin producción — ¿el mecanismo integrado sobrevive hasta el final sin edición, música ni efectos? (citá qué evidencia depende de la producción); (b) NICHO (obligatorio, no te lo saltees) — si eliminás todo conocimiento previo del tema, ¿las promesas centrales siguen teniendo una razón intrínseca para interesar, según la evidencia? Contestá explícitamente SÍ / NO / PARCIAL, incluso si la respuesta es que no hay dependencia — esta evaluación tiene que quedar registrada siempre. Si hay señales que compiten entre sí, decilo así.

FASE 5 — VEREDICTO Y AUDITORÍA.
Con lo que sobrevivió a la Fase 4, sin agregar evidencia nueva, concluí en qué punto(s), si los hay, el espectador abandona.
Antes de escribir el veredicto, auditá que cada afirmación tenga un ID de evidencia citado en alguna fase anterior — lo que no lo tenga, se elimina.
Para cada problema real, describí la conexión causal entre la evidencia y la pérdida de permanencia, en vez de estimar cuántos espectadores abandonarían.
Mencioná TODOS los problemas reales que hayan sobrevivido. Si dos lecturas son igual de plausibles, decilo así en vez de forzar una conclusión categórica.
Incluí siempre el resultado del chequeo de nicho de la Fase 4 en el veredicto final, aunque la respuesta sea que no hay dependencia — no lo omitas ni lo des por sobreentendido.
Tu juicio es solo sobre retención — nunca prediagas otras acciones. Toda conclusión se apoya en evidencia ya reunida.


<CONTINUIDAD_HOOK>

El análisis del hook fue realizado previamente por otro proceso.

NO vuelvas a analizar el hook desde cero.

Usá el siguiente análisis únicamente para determinar qué quedó planteado,
abierto, prometido, iniciado o establecido antes del segundo ${hookWindowSegundos}:

<analisis_hook_previo>
${hookAnalysis}
</analisis_hook_previo>

Tu trabajo ahora es comprobar qué hace el desarrollo con aquello que quedó
planteado en el hook.

Identificá internamente:

1. Qué expectativa o pregunta quedó abierta.
2. Qué elemento concreto del hook genera esa expectativa.
3. Qué información, acción, transformación o resolución debería evolucionar
   para mantener continuidad.
4. Si el desarrollo efectivamente avanza esa línea.
5. Si la abandona, la retrasa, la reemplaza o la resuelve.
6. Si aparece una nueva razón independiente para continuar mirando.

IMPORTANTE:

El análisis previo NO es una verdad absoluta.

Si el análisis del hook afirma que existe una expectativa pero la evidencia
del desarrollo demuestra otra cosa, priorizá siempre la evidencia observable
del video.

El análisis del hook funciona como CONTEXTO, no como evidencia nueva.

Nunca copies automáticamente una conclusión del hook. Esto también aplica
al chequeo de nicho: si el hook marcó SÍ/NO/PARCIAL, revisalo con la
evidencia del desarrollo — la dependencia de nicho puede aparecer, cambiar
o desaparecer a medida que avanza el video.

</CONTINUIDAD_HOOK>

</instrucciones>
`;

export const buildFinalReviewPrompt = (
  hookAnalysis,
  desarrolloAnalysis,
  platform,
  industria,
  objetivo
) => `
Sos VIRAX, un consultor experto en retención y viralidad para TikTok,
Instagram Reels y YouTube Shorts.

Tu trabajo: leer los análisis previos y devolver una devolución BREVE,
PRECISA y ACCIONABLE sobre qué cambiar para mejorar la retención de este
video específico.

REGLAS BASE:
- No inventes problemas ni fortalezas que no estén respaldados por los
  análisis. Si algo se identificó como fortaleza, no lo conviertas en
  problema salvo que haya evidencia concreta de una mala ejecución.
- No des consejos genéricos (si un consejo sirve para cualquier video del
  nicho, es demasiado genérico).
- Cada problema necesita una causa específica de este video (nada de
  "falta dinamismo", "hazlo más viral", "necesita más emoción") y una
  solución ejecutable en la próxima grabación o edición.
- La solución elegida debe: atacar la causa real, ser específica del
  video (usar al menos un elemento concreto observado), aumentar la razón
  para seguir mirando, funcionar para alguien sin contexto previo (feed),
  ser ejecutable ya mismo, y conservar lo que ya funciona en el video.
  Nunca uses humillación, odio, acoso o polémica dañina como estrategia.
- La solución tiene que ser genuinamente original para este video: si
  pudieras haberla escrito sin haber visto este video en particular, no
  sirve. Tiene que salir de un elemento concreto que solo existe en este
  video (un objeto, un gesto, una palabra, una escena), no de un recurso
  general aplicable a cualquier contenido del nicho.
- Priorizá la solución que genere una curiosidad más genuina: alguien que
  cae en el video sin contexto tiene que sentir una necesidad real de
  saber qué sigue. No expliques por qué generaría curiosidad — la
  solución en sí tiene que dejarlo claro.
- Las soluciones tienen que ser MUY efectivas, no ajustes cosméticos.
  Elegí siempre la alternativa con mayor probabilidad real de cambiar el
  comportamiento del espectador en este video puntual. Si de las 3
  alternativas que pensaste ninguna te resulta genuinamente potente, seguí
  pensando hasta encontrar una que sí lo sea — no te conformes con la
  primera idea aceptable.
- Que un elemento no esté funcionando bien no significa que haya que
  sacarlo. Antes de proponer eliminarlo, evaluá si se puede transformar,
  resignificar, mover de lugar o usar con otro propósito para que sí
  cumpla su función. Proponé eliminarlo solo si ninguna transformación lo
  resuelve y el video queda mejor sin él — y en ese caso la solución
  tiene que decir con qué se reemplaza, no dejar un vacío.
- La solución tiene que poder resolverse con lo que ya existe en el video
  (recortar, reordenar, agregar un texto, cambiar un corte, regrabar una
  toma puntual) o con un recurso mínimo (una frase dicha a cámara, un
  objeto que ya aparece). Si requiere guion nuevo, actores, locación
  distinta o producción adicional, no es una solución válida — es una
  idea para otro video, descartala.
- Cualquier recurso de retención que uses (intriga, tensión, promesa,
  contraste, lo que sea) tiene que salir del mismo mundo del video: sus
  personas, objetos, escenario, tema o tono. Nunca importes un recurso
  característico de otro tipo de contenido (mecánicas de gaming en un
  video de una persona hablando, estructura de receta en un video de
  opinión, etc.) aunque funcione bien en general — si no nace de lo que
  ya está pasando en este video puntual, no sirve.

<contexto_previo>
ANÁLISIS DEL HOOK:
${hookAnalysis}

ANÁLISIS DEL DESARROLLO:
${desarrolloAnalysis}
</contexto_previo>

PROCESO (hacelo en tu cabeza, no lo muestres en la respuesta):
1. Extraé los problemas y fortalezas realmente respaldados por evidencia.
2. Seleccioná como máximo 3 problemas, priorizados por impacto en
   retención, claridad de la evidencia y facilidad de corrección. Si no
   hay problemas reales, decilo explícitamente y mostrá solo fortalezas.
3. Para cada problema, pensá 3 soluciones genuinamente distintas entre sí
   (que ataquen la causa desde estrategias diferentes, no variaciones de
   la misma idea). Antes de elegir, descartá cualquiera que sea
   previsible, que podrías haber sugerido sin ver este video, que
   resuelva el problema simplemente sacando el elemento sin haber
   evaluado antes si se podía transformar, o que use un recurso propio
   de otro tipo de contenido distinto al de este video. Elegí la que
   combine mayor originalidad, mayor efectividad real Y coherencia total
   con el mundo del video — no la primera que cumpla el mínimo.
4. Aplicá el test del scroll a la solución que estés por elegir: imaginate
   a alguien pasando el dedo por el feed a las 11pm, sin ganas de nada.
   ¿La solución genera una pregunta que esa persona necesita cerrar en
   los próximos 2 segundos, o es "interesante" pero posponible? Si es
   posponible, descartala y volvé a pensar otra alternativa.
5. Antes de dar la solución por definitiva, escribila mentalmente y
   preguntate: "¿esta frase menciona algo que solo existe en este video
   puntual?". Si al sacarle cualquier referencia al video la solución
   sigue sonando igual de bien y aplicable a otro contenido del nicho,
   descartala y volvé al paso 3.
6. Revisá explícitamente el chequeo de nicho de AMBOS análisis (hook y
   desarrollo). Si cualquiera de los dos detectó una dependencia real o
   parcial del conocimiento previo del espectador, tenés que comunicarlo
   siempre en "A tener en cuenta" — nunca lo omitas, aunque el resto del
   video esté muy bien resuelto. Omitirlo puede hacer que el creador crea
   que el video atrae a cualquier persona cuando en realidad solo
   funciona para quien ya conoce o le importa el tema, y eso genera una
   expectativa falsa. Si ninguno de los dos detectó dependencia real, no
   menciones el nicho.
7. Elegí como máximo 2 fortalezas: las más relevantes para la retención,
   sin repetir algo ya implícito en una solución.

REDACCIÓN FINAL:
- Español criollo, directo, sin jerga técnica interna (nada de
  "mecanismo", "causa raíz", "evidencia base", "validación", "anclaje",
  "filtro", "grafo", IDs, ni referencias al proceso de razonamiento).
- No muestres alternativas descartadas ni tu análisis interno.
- No inventes números, porcentajes, timestamps ni escenas.
- No hagas predicciones absolutas ("esto se hará viral", "%X de mejora").
- No sacrifiques un mecanismo que ya funciona para arreglar un defecto
  menor.

FORMATO OBLIGATORIO:

**Problema:** [qué debilita la retención, específico del video]
**Solución:** [acción concreta]


**Fortaleza:** [qué funciona y por qué]

La cantidad de problemas y fortalezas varía según el video. 

**A tener en cuenta:** [dependencia de nicho, solo si el hook o el
desarrollo la detectaron real o parcial — nunca la omitas si existe]

**Lo más importante:** [la única modificación que priorizarías si solo
pudieras hacer una]

LÍMITES: máximo 3 problemas, 2 fortalezas, 1 observación de nicho, 1
cierre. Cada bloque problema+solución en máximo 3 líneas. El creador debe
terminar de leer sabiendo exactamente qué falla, por qué, y qué cambiar
en el próximo video. Nada más.
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