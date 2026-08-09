// ═════════════════════════════════════════════════════════════
// VIRAX VISION — 3 calls: hook, desarrollo, síntesis final
// Ranking movido a código (determinístico) — Gemini ya no decide
// cuál problema pesa más, solo describe candidatos estructurados.
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
// Salida final en JSON estructurado con rúbrica por candidato.
// El ranking (qué problema pesa más) lo calcula JS, no Gemini.
// ═════════════════════════════════════════════════════════════

const RUBRICA_EXPLICACION = `
Cada problema candidato que sobreviva se describe con una rúbrica de 0 a
un tope por factor. NO decidas vos cuál "pesa más" — solo asigná cada
número siguiendo estas escalas, con evidencia (Ex) que lo respalde:

- existencia (0-3): qué tan sólida es la evidencia de que el problema
  realmente está presente. 0 = inferencia débil, 1 = evidencia indirecta,
  2 = evidencia clara, 3 = evidencia muy clara y directa.
- impacto (0-4): si el problema afecta la retención, cuán grande sería esa
  pérdida en relación al resto del video. 0 = casi nula, 4 = muy fuerte.
- duracion (0-4): cuánto tiempo del video afecta el problema. 0 = instante,
  1 = ≤1s, 2 = 1-3s, 3 = 3-6s, 4 = más de 6s.
- repeticion (0-3): 0 = ocurre una vez, 1 = se repite, 2 = domina un tramo,
  3 = aparece en múltiples tramos del video.
- causalidad (0-3): qué tan directa es la conexión entre la evidencia y una
  pérdida real de permanencia. 0 = requiere muchos supuestos intermedios,
  3 = la conexión es casi inmediata, sin pasos intermedios que asumir.
- aislamiento (0-3): 0 = es básicamente la misma falla que otro problema ya
  listado (en ese caso hay que fusionarlos, ver FASE DE AGRUPACIÓN), 3 = es
  un problema completamente independiente, con causa y evidencia propias.

No calcules un puntaje total vos mismo. Solo completá los 6 números por
candidato — el cálculo final lo hace el sistema, no vos.`;

const FASE_AGRUPACION = `
FASE DE AGRUPACIÓN (obligatoria, antes de escribir el JSON final).
Antes de listar los problemas definitivos:
1. Agrupá los candidatos que describan la misma falla subyacente aunque
   estén redactados distinto (ej: "vertido de detergente monótono" y
   "preparación de detergente monótona" son la misma falla si señalan el
   mismo tramo y la misma causa — fusionalos en un solo candidato).
2. Si dos problemas se resolverían con la misma modificación concreta, son
   el mismo problema — fusionalos.
3. Conservá como candidatos independientes únicamente los que tengan causa
   distinta, evidencia distinta Y solución distinta entre sí.`;

export const buildHookAnalysisPrompt = (
  platform,
  industria,
  objetivo,
  hookWindowSegundos = 3,
  videoDurationSegundos
) => `

FASE 1 — EVIDENCIA.
${videoDurationSegundos ? `Este video dura EXACTAMENTE ${videoDurationSegundos} segundos, ni uno más. Cualquier timestamp que anotes tiene que estar entre 0 y ${videoDurationSegundos}s. Si te parece haber visto algo después de ${videoDurationSegundos}s, es un error de lectura tuyo, no evidencia real — no lo escribas.
Recorré el video segundo por segundo, del 0 al ${videoDurationSegundos}, sin saltear ninguno. Para cada segundo, registrá qué pasa (plano, corte, texto, gesto, cambio de tono) de forma puramente descriptiva y observable — todavía sin juzgar si eso es bueno o malo para la retención. Si no pasa nada distinguible en ese segundo, registralo igual como "sin cambios observables"; eso es un dato, no todavía un juicio.` : ''}
Transcribí el audio palabra por palabra (diálogo, música, silencios, con
timestamps aproximados) y todo texto en pantalla tal como aparece, con su
segundo. Sumá tono, gestos, energía, edición, encuadre. No evalúes todavía.
Numerá cada observación individual (un plano, un corte, una línea de texto,
un gesto, un cambio de tono) como evidencia: E1, E2, E3...
Si un timestamp no se puede precisar, usá un rango ("≈2 s"). Si algo no es
claramente perceptible o no hay diálogo/texto, decilo explícito como
evidencia también.

Regla desde acá en adelante: toda afirmación en las fases siguientes debe
citar al menos un ID de evidencia (Ex). Una afirmación sin ID citado es
invención y no puede usarse en el resultado final.

FASE 2 — MECANISMOS Y CONTRASTE.
Por cada evidencia, preguntate: "si esto no estuviera, ¿el espectador
tendría menos motivo para quedarse?" Listá todos los mecanismos que pasen
ese test, citando sus Ex, sin importar el canal (texto, audio, visual,
narrativo, sensorial). Recorré el tramo momento a momento buscando tramos
sin progresión — pero un tramo sin cambios observables es solo un
CANDIDATO a problema, no evidencia automática de aburrimiento: para que
sea un problema real tiene que faltar además una razón observable por la
que ese tramo no sostiene, inicia o desarrolla ninguna expectativa,
transformación, información o progresión. Un plano estático puede
sostener atención si hay una expectativa activa (ej: alguien acercando
lentamente algo desconocido). Anotá también los mecanismos que
descartaste y por qué.

FASE 3 — CANDIDATOS A PROBLEMA.
Para cada problema candidato, sin todavía elegir cuáles reportar:

PROBLEMA: [descripción concreta]
EVIDENCIA: [Ex]
FUNCIÓN: [qué aporta ese mecanismo a la permanencia]
EJECUCIÓN: [la forma concreta en que aparece favorece o perjudica esa función]
CADENA CAUSAL: [evidencia] → [característica de la ejecución] →
[efecto en el espectador] → [pérdida plausible de permanencia]

Reglas:
- Un mecanismo puede ser funcional y tener una ejecución deficiente: no
  descartes el problema solo porque la evidencia también sostiene algo que
  funciona.
- Descartá el candidato únicamente si la evidencia no permite establecer
  una conexión causal razonable con una pérdida de permanencia.
- Test contrafáctico: si corregir la ejecución destruye la idea central o
  elimina el mecanismo que genera interés, la solución (que se propondrá
  después, en otro prompt) debe conservar la idea y cambiar solo la
  ejecución — pero eso no es tu trabajo acá, vos solo describís el problema.

${FASE_AGRUPACION}

FASE 4 — RÚBRICA.
${RUBRICA_EXPLICACION}

CHEQUEO DE NICHO (obligatorio, no te lo saltees): ¿el interés que genera
este hook depende de que el espectador ya conozca o le importe el tema de
antemano, o nace de cómo está presentada la información, sin importar el
tema? Registrá SI / NO / PARCIAL con su justificación y evidencia,
incluso si la respuesta es NO.

SALIDA — Respondé ÚNICAMENTE con un JSON válido (sin \`\`\`json ni texto
alrededor), con esta forma exacta:

{
  "evidencia": [
    { "id": "E1", "segundo": "0-1", "descripcion": "..." }
  ],
  "problemas": [
    {
      "id": "P1",
      "descripcion": "...",
      "evidencia": ["E3", "E4"],
      "inicio": 0,
      "fin": 2,
      "rubrica": { "existencia": 0, "impacto": 0, "duracion": 0, "repeticion": 0, "causalidad": 0, "aislamiento": 0 }
    }
  ],
  "fortalezas": [
    { "id": "F1", "descripcion": "...", "evidencia": ["E2"], "relevancia": 0 }
  ],
  "chequeo_nicho": { "resultado": "SI", "justificacion": "...", "evidencia": ["E1"] },
  "interaccion_segundo_a_segundo": "descripción breve de cómo reaccionaría el espectador, citando evidencia"
}

"relevancia" en fortalezas va de 0 a 3 (0 = anecdótica, 3 = central para
la retención). No omitas ningún campo. Si no hay problemas o fortalezas
reales, esos arrays van vacíos — no inventes contenido para llenarlos.
`;

export const buildDesarrolloAnalysisPrompt = (
  platform,
  industria,
  objetivo,
  hookWindowSegundos = 4,
  hookAnalysisJSON = "",
  videoDurationSegundos
) => `

FASE 1 — OBSERVACIÓN LITERAL Y REGISTRO DE EVIDENCIA.
${videoDurationSegundos ? `Este video dura EXACTAMENTE ${videoDurationSegundos} segundos, ni uno más. Cualquier timestamp que anotes tiene que estar entre ${hookWindowSegundos} y ${videoDurationSegundos}s. Si te parece haber visto algo después de ${videoDurationSegundos}s, es un error de lectura tuyo, no evidencia real — no lo escribas.
Recorré el video segundo por segundo desde ${hookWindowSegundos} hasta ${videoDurationSegundos}, sin saltear ninguno. Para cada segundo, registrá qué pasa de forma puramente descriptiva, aunque no pase nada ("sin cambios observables" cuenta como dato).` : ''}
Dividí el video en escenas o beats desde el segundo ${hookWindowSegundos}. Transcribí el audio palabra por palabra y todo texto en pantalla en cada escena, con su segundo. Sumá tono, gestos, energía, edición. No evalúes todavía.
Numerá cada observación individual como evidencia: E1, E2, E3... por escena. Si un timestamp no se puede determinar con exactitud, usá un rango. Si algo no está presente en alguna escena, decilo explícito.

A partir de acá, TODA afirmación en las fases siguientes debe citar al menos un ID de evidencia (Ex). Una afirmación sin ID citado es evidencia de invención y no puede usarse en el resultado final.

FASE 2 — INVENTARIO DE MECANISMOS.
Por cada evidencia de cada escena, preguntate: "si esto no estuviera, ¿el espectador tendría menos motivo para quedarse en este punto?" Listá todos los que pasen ese test, citando IDs, sin importar el canal ni cuán simple o técnico parezca.
Recorré el video momento a momento buscando tramos sin progresión. Un tramo sin cambios observables es un CANDIDATO a problema, no evidencia automática de pérdida de atención: solo es un problema real si además falta una razón observable por la que ese tramo no sostiene, inicia o desarrolla ninguna expectativa, transformación, información o progresión.
Listá también los mecanismos que consideraste y descartaste, con la evidencia que te hizo descartarlos.

FASE 2.5 — CASO A FAVOR Y CASO EN CONTRA (por tramo dudoso).
Para cada escena o tramo donde dudes entre "sostiene" y "pierde atención", armá los dos argumentos más fuertes posibles citando evidencia. No decidas todavía cuál gana — eso se resuelve con la rúbrica de la Fase 4, no acá.

FASE 3 — JUICIO INTEGRADO.
Juzgá cada escena combinando TODOS los mecanismos de la Fase 2 en conjunto, nunca canal por canal aislado (citá evidencia).
Chequeo de robustez por canal: para las escenas donde el juicio es ajustado, ¿el juicio sobrevive citando evidencia solo de audio+texto, sin visual? ¿Y solo con visual? Si colapsa al sacar un canal, decilo explícito.
Antes de señalar cualquier escena como problema, contrastala contra los mecanismos que ya identificaste como sostén; si es parte de algo que ya reconociste como funcional, no la reportes como falla aislada sin dejar esa conexión explícita.
Evaluá cómo evoluciona lo planteado en el hook (ver CONTINUIDAD_HOOK abajo) — si avanza, se resuelve, se abandona o se reemplaza. No anticipes escenas futuras al juzgar una escena puntual.

${FASE_AGRUPACION}

FASE 4 — RÚBRICA Y FALSACIÓN.
Antes de puntuar, intentá refutar cada candidato: "si mi conclusión es que esta escena sostiene la atención, ¿qué evidencia (Ex) demostraría lo contrario?" Un candidato se convierte en problema real únicamente cuando hay una cadena causal directa entre la evidencia y una pérdida plausible de permanencia. Recorré TODAS las escenas antes de continuar.

${RUBRICA_EXPLICACION}

CHEQUEO DE NICHO (obligatorio): si eliminás todo conocimiento previo del
tema, ¿las promesas centrales siguen teniendo una razón intrínseca para
interesar, según la evidencia? Registrá SI / NO / PARCIAL con evidencia,
incluso si la respuesta es que no hay dependencia.

<CONTINUIDAD_HOOK>

El análisis del hook fue realizado previamente por otro proceso y viene
en JSON (problemas, fortalezas, evidencia y chequeo de nicho detectados
antes del segundo ${hookWindowSegundos}). Usalo únicamente para determinar
qué quedó planteado, abierto, prometido o iniciado — es CONTEXTO, no
evidencia nueva, y no es una verdad absoluta: si la evidencia del
desarrollo contradice algo del hook, priorizá siempre lo que observás vos.

<analisis_hook_previo>
${hookAnalysisJSON}
</analisis_hook_previo>

Identificá internamente: qué expectativa quedó abierta, qué elemento del
hook la genera, si el desarrollo la avanza, la abandona, la retrasa, la
reemplaza o la resuelve, y si aparece una razón independiente nueva para
seguir mirando. Esto también aplica al chequeo de nicho: revisalo con
evidencia propia, la dependencia puede aparecer, cambiar o desaparecer.

</CONTINUIDAD_HOOK>

SALIDA — Respondé ÚNICAMENTE con un JSON válido (sin \`\`\`json ni texto
alrededor), con esta forma exacta:

{
  "evidencia": [
    { "id": "E1", "segundo": "4-5", "descripcion": "..." }
  ],
  "problemas": [
    {
      "id": "P1",
      "descripcion": "...",
      "evidencia": ["E5", "E6"],
      "inicio": 4,
      "fin": 6,
      "rubrica": { "existencia": 0, "impacto": 0, "duracion": 0, "repeticion": 0, "causalidad": 0, "aislamiento": 0 }
    }
  ],
  "fortalezas": [
    { "id": "F1", "descripcion": "...", "evidencia": ["E2"], "relevancia": 0 }
  ],
  "chequeo_nicho": { "resultado": "SI", "justificacion": "...", "evidencia": ["E1"] },
  "continuidad_hook": { "expectativas_resueltas": ["..."], "expectativas_abandonadas": ["..."] }
}

"relevancia" en fortalezas va de 0 a 3. No omitas ningún campo. Si no hay
problemas o fortalezas reales, esos arrays van vacíos.
`;

export const buildFinalReviewPrompt = (
  problemasSeleccionados,
  fortalezasSeleccionadas,
  chequeoNicho,
  platform,
  industria,
  objetivo
) => `
Sos VIRAX, un consultor experto en retención y viralidad para TikTok,
Instagram Reels y YouTube Shorts.

Un sistema externo YA analizó el video, YA descartó los problemas y
fortalezas sin sustento suficiente, y YA los ordenó por peso real usando
una rúbrica calculada por código (no por vos). Tu trabajo NO es elegir
cuáles son los problemas más importantes ni reordenarlos — eso ya está
hecho. Tu trabajo es escribir, para cada uno, una solución MUY buena,
específica de este video, siguiendo las reglas de abajo.

PROBLEMAS YA SELECCIONADOS Y ORDENADOS POR PESO (de mayor a menor):
${problemasSeleccionados}

FORTALEZAS YA SELECCIONADAS Y ORDENADAS POR RELEVANCIA:
${fortalezasSeleccionadas}

CHEQUEO DE NICHO CONSOLIDADO (hook + desarrollo):
${chequeoNicho}

REGLAS PARA LAS SOLUCIONES:
- No agregues problemas ni fortalezas que no estén en las listas de
  arriba, y no elimines ninguno salvo que sean más de 3 problemas o más
  de 2 fortalezas — en ese caso quedate solo con los primeros de la lista
  (ya vienen ordenados por peso).
- Cada solución debe: atacar la causa real del problema, ser específica
  del video (usar al menos un elemento concreto de su descripción o
  evidencia), aumentar la razón para seguir mirando, funcionar para
  alguien sin contexto previo (feed), ser ejecutable ya mismo, y conservar
  lo que ya funciona en el video. Nunca uses humillación, odio, acoso o
  polémica dañina como estrategia.
- La solución tiene que ser genuinamente original para este video: si
  pudieras haberla escrito sin haber visto este video en particular, no
  sirve. Tiene que salir de un elemento concreto que solo existe en este
  video (un objeto, un gesto, una palabra, una escena), no de un recurso
  general aplicable a cualquier contenido del nicho.
- Cualquier recurso de retención que uses (intriga, tensión, promesa,
  contraste, lo que sea) tiene que salir del mismo mundo del video: sus
  personas, objetos, escenario, tema o tono. Nunca importes un recurso
  característico de otro tipo de contenido (mecánicas de gaming en un
  video de una persona hablando, estructura de receta en un video de
  opinión, etc.) aunque funcione bien en general.
- Priorizá la solución que genere una curiosidad más genuina: alguien que
  cae en el video sin contexto tiene que sentir una necesidad real de
  saber qué sigue. No expliques por qué generaría curiosidad — la
  solución en sí tiene que dejarlo claro.
- Pensá 3 soluciones genuinamente distintas entre sí para cada problema
  (que ataquen la causa desde estrategias diferentes, no variaciones de
  la misma idea) y elegí la que combine mayor originalidad, mayor
  efectividad real y coherencia total con el mundo del video.
- Test del scroll: imaginate a alguien pasando el dedo por el feed a las
  11pm, sin ganas de nada. Si la solución elegida es "interesante" pero
  posponible en vez de generar una pregunta que esa persona necesita
  cerrar en los próximos 2 segundos, descartala y elegí otra de las 3.
- Autochequeo final: escribí la solución y preguntate "¿esta frase
  menciona algo que solo existe en este video puntual?". Si al sacarle
  cualquier referencia al video sigue sonando igual de bien y aplicable a
  otro contenido del nicho, reescribila.
- La solución tiene que poder resolverse con lo que ya existe en el video
  (recortar, reordenar, agregar un texto, cambiar un corte, regrabar una
  toma puntual) o con un recurso mínimo (una frase dicha a cámara, un
  objeto que ya aparece). Si requiere guion nuevo, actores, locación
  distinta o producción adicional, no es una solución válida.
- Que un elemento no esté funcionando bien no significa que haya que
  sacarlo. Evaluá primero si se puede transformar, resignificar, mover de
  lugar o usar con otro propósito. Proponé eliminarlo solo si ninguna
  transformación lo resuelve, y en ese caso decí con qué se reemplaza.
- No sacrifiques una fortaleza ya identificada para arreglar un problema
  menor.

REDACCIÓN FINAL:
- Español criollo, directo, sin jerga técnica interna (nada de
  "mecanismo", "rúbrica", "score", "evidencia", "IDs", "candidato", ni
  referencias al proceso de razonamiento o al sistema de ranking).
- No inventes números, porcentajes, timestamps ni escenas que no estén en
  las listas de arriba.
- No hagas predicciones absolutas ("esto se hará viral", "%X de mejora").

FORMATO OBLIGATORIO:

Repetí el bloque Problema+Solución una vez por cada problema en la lista
de arriba (no más, no menos). Repetí el bloque Fortaleza una vez por cada
fortaleza en la lista de arriba (no más, no menos).

**Problema:** [qué debilita la retención, específico del video]
**Solución:** [acción concreta]

**Fortaleza:** [qué funciona y por qué]

**A tener en cuenta:** [dependencia de nicho, solo si el chequeo
consolidado de arriba dice SI o PARCIAL — si dice NO, omití este bloque
por completo]

**Lo más importante:** [la única modificación que priorizarías si solo
pudieras hacer una, entre las de la lista de arriba]

LÍMITES: cada bloque problema+solución en máximo 3 líneas. El creador debe
terminar de leer sabiendo exactamente qué falla, por qué, y qué cambiar
en el próximo video. Nada más.
`;

// ═════════════════════════════════════════════════════════════
// Ranking determinístico — esto es lo que reemplaza el "ordená
// por peso" en lenguaje natural. Gemini describe candidatos con
// una rúbrica; este código calcula el score y ordena.
// ═════════════════════════════════════════════════════════════

const EXISTENCIA_MINIMA = 2; // debajo de esto, se descarta el candidato

export const scoreProblema = (p) => {
  const r = p.rubrica || {};
  return (
    (r.existencia || 0) * 2 +
    (r.impacto || 0) * 4 +
    (r.duracion || 0) * 2 +
    (r.repeticion || 0) * 2 +
    (r.causalidad || 0) * 4 +
    (r.aislamiento || 0) * 2
  );
};

export const rankearProblemas = (candidatos = []) =>
  candidatos
    .filter((p) => (p.rubrica?.existencia || 0) >= EXISTENCIA_MINIMA)
    .map((p) => ({ ...p, score: scoreProblema(p) }))
    .sort((a, b) => b.score - a.score);

export const rankearFortalezas = (candidatas = []) =>
  candidatas.slice().sort((a, b) => (b.relevancia || 0) - (a.relevancia || 0));

const parseJsonSafe = (text) => {
  if (!text) return null;
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("VIRAX: no se pudo parsear JSON del modelo:", e, text);
    return null;
  }
};

const consolidarChequeoNicho = (hookNicho, desarrolloNicho) => {
  const partes = [];
  if (hookNicho) partes.push(`Hook: ${hookNicho.resultado} — ${hookNicho.justificacion || ""}`);
  if (desarrolloNicho) partes.push(`Desarrollo: ${desarrolloNicho.resultado} — ${desarrolloNicho.justificacion || ""}`);
  const dependeAlgo = [hookNicho, desarrolloNicho].some((n) => n && (n.resultado === "SI" || n.resultado === "PARCIAL"));
  return { texto: partes.join(" | ") || "Sin datos", dependeAlgo };
};

const formatProblemasParaWriter = (top) =>
  top
    .map(
      (p, i) =>
        `PROBLEMA_${i + 1} (peso ${p.score}): ${p.descripcion} — tramo ${p.inicio}-${p.fin}s — evidencia: ${(p.evidencia || []).join(", ")}`
    )
    .join("\n") || "(ninguno)";

const formatFortalezasParaWriter = (top) =>
  top
    .map((f, i) => `FORTALEZA_${i + 1}: ${f.descripcion} — evidencia: ${(f.evidencia || []).join(", ")}`)
    .join("\n") || "(ninguna)";

export const runVideoReview = async (
  ai,
  buildVideoPartFn,
  { platform, industria, objetivo, hookWindowSegundos = 4, videoDurationSegundos }
) => {
  const cfg = REVIEW_CONFIG;

  // Secuencial: el hook se analiza primero para que el desarrollo
  // reciba el análisis real (antes se pasaba "" por correr en paralelo).
  const hookRes = await ai.models.generateContent({
    model: cfg.hook.model,
    contents: [
      buildVideoPartFn({ fps: cfg.hook.videoFps, mediaResolution: cfg.hook.media_resolution }),
      { text: buildHookAnalysisPrompt(platform, industria, objetivo, hookWindowSegundos, videoDurationSegundos) }
    ],
    config: {
      temperature: cfg.hook.temperature,
      thinkingConfig: cfg.hook.thinkingConfig,
      mediaResolution: cfg.hook.media_resolution,
      seed: cfg.hook.seed,
      responseMimeType: "application/json"
    }
  });

  const hookAnalysisText = hookRes.text || "";
  const hookData = parseJsonSafe(hookAnalysisText) || { problemas: [], fortalezas: [], chequeo_nicho: null };

  const desarrolloRes = await ai.models.generateContent({
    model: cfg.desarrollo.model,
    contents: [
      buildVideoPartFn({ fps: cfg.desarrollo.videoFps, mediaResolution: cfg.desarrollo.media_resolution }),
      {
        text: buildDesarrolloAnalysisPrompt(
          platform,
          industria,
          objetivo,
          hookWindowSegundos,
          hookAnalysisText,
          videoDurationSegundos
        )
      }
    ],
    config: {
      temperature: cfg.desarrollo.temperature,
      thinkingConfig: cfg.desarrollo.thinkingConfig,
      mediaResolution: cfg.desarrollo.media_resolution,
      seed: cfg.desarrollo.seed,
      responseMimeType: "application/json"
    }
  });

  const desarrolloAnalysisText = desarrolloRes.text || "";
  const desarrolloData = parseJsonSafe(desarrolloAnalysisText) || { problemas: [], fortalezas: [], chequeo_nicho: null };

  // Ranking determinístico: JS decide el orden, no Gemini.
  const todosLosProblemas = [...(hookData.problemas || []), ...(desarrolloData.problemas || [])];
  const todasLasFortalezas = [...(hookData.fortalezas || []), ...(desarrolloData.fortalezas || [])];

  const problemasOrdenados = rankearProblemas(todosLosProblemas).slice(0, 3);
  const fortalezasOrdenadas = rankearFortalezas(todasLasFortalezas).slice(0, 2);
  const nicho = consolidarChequeoNicho(hookData.chequeo_nicho, desarrolloData.chequeo_nicho);

  const finalRes = await ai.models.generateContent({
    model: cfg.sintesis.model,
    contents: [
      {
        text: buildFinalReviewPrompt(
          formatProblemasParaWriter(problemasOrdenados),
          formatFortalezasParaWriter(fortalezasOrdenadas),
          nicho.dependeAlgo ? nicho.texto : "NO",
          platform,
          industria,
          objetivo
        )
      }
    ],
    config: { temperature: cfg.sintesis.temperature, thinkingConfig: cfg.sintesis.thinkingConfig }
  });

  return {
    reviewText: finalRes.text,
    _hookAnalysis: hookAnalysisText,
    _desarrolloAnalysis: desarrolloAnalysisText,
    _problemasRankeados: problemasOrdenados,
    _fortalezasRankeadas: fortalezasOrdenadas
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