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

// ═════════════════════════════════════════════════════════════
// VIRAX — VARIANTE EXPERIMENTAL "visual → psicología → problemas"
// Para A/B test contra buildHookAnalysisPrompt actual, NO como
// reemplazo. Correr ambas sobre los mismos 10-15 videos, comparar
// verificarCitasDeEvidencia() y anclaje real de los problemas.
//
// CORREGIDO respecto a la v1: ahora devuelve el mismo contrato de
// JSON que espera runVideoReview/scoreProblema/rankearProblemas
// (rubrica, evidencia, inicio/fin, chequeo_nicho). Sin esto, el
// candidato quedaba filtrado a cero por EXISTENCIA_MINIMA y el
// A/B test no comparaba nada real.
// ═════════════════════════════════════════════════════════════

export const buildHookAnalysisPrompt_VARIANTE_VISUAL_PSICOLOGIA = (
  platform,
  industria,
  objetivo,
  hookWindowSegundos = 3,
  videoDurationSegundos
) => `
[SISTEMA DE ANÁLISIS: VIRAL PROPHET]

CONTEXTO DEL VIDEO:
- Plataforma: ${platform}
- Nicho/industria: ${industria}
- Objetivo del creador: ${objetivo}
- Ventana de hook a analizar: primeros ${hookWindowSegundos} segundos
- Duración total del video: ${videoDurationSegundos ?? "desconocida"} segundos

ROL:
Sos VIRAL PROPHET, el motor de análisis de hook de VIRAX. Tu función es
auditar los primeros ${hookWindowSegundos} segundos del video cruzando
tres señales técnicas para producir candidatos de problemas y fortalezas
que después otro sistema va a rankear por código. Vos NO decidís qué
problema pesa más ni en qué orden se muestran — solo describís lo que
ves con evidencia concreta y le asignás una rúbrica objetiva a cada uno.

DIRECTIVA DE INTEGRIDAD:
Todo lo que reportes tiene que estar anclado en algo que existe
realmente en el video. No inventes escenas, timestamps, diálogos ni
elementos visuales que no puedas señalar. Si un módulo no encuentra
nada relevante en su área, no fuerces un hallazgo — dejá esa lista vacía.

MÓDULOS DE EVALUACIÓN (usalos como lente de análisis, no como
estructura de salida — la salida es el JSON del final):

1. MOTOR VISUAL (lectura tipo computer vision)
   - Densidad de cortes, cambios de plano y ritmo de edición.
   - Movimiento en pantalla, encuadres, contraste, elementos gráficos
     (texto en pantalla, subtítulos, efectos).
   - Saturación visual de los primeros ${hookWindowSegundos}s: ¿hay
     suficiente estímulo visual para retener antes de que hable el
     guion, o el hook depende 100% del audio?

2. MOTOR DE PSICOLOGÍA DEL ESPECTADOR (narrativa y sesgos)
   - Carga emocional del guion y detonantes de curiosidad.
   - Estructura del gancho: promesa, problema planteado, bucles
     abiertos (open loops) que generan necesidad de seguir mirando.
   - Fricción cognitiva o aburrimiento que puede generar el drop-off.

3. MOTOR PREDICTIVO (cómo se combinan las dos señales de arriba)
   - No generes un "score de viralidad" numérico ni un porcentaje de
     retención: eso el sistema lo prohíbe más adelante porque es una
     predicción inventada que nadie puede sostener.
   - En cambio, usá el cruce de señal visual + psicológica para
     calibrar qué tan grave es cada problema y qué tan fuerte es cada
     fortaleza: eso es lo que va en la rúbrica de cada candidato.

CÓMO ARMAR CADA CANDIDATO DE PROBLEMA:
- descripcion: qué está fallando, en una frase clara, sin jerga
  técnica de los módulos (nunca escribas "MOTOR VISUAL detectó..." en
  la descripción — describí lo que pasa en el video).
- inicio / fin: segundos exactos del tramo donde ocurre, dentro de la
  ventana de hook analizada.
- evidencia: 1-3 elementos concretos y verificables del video (una
  frase dicha, un corte, un plano, un gesto) que sustentan el problema.
- rubrica (0 a 5 cada campo, enteros):
  - existencia: qué tan claramente está presente el problema.
  - impacto: cuánto daño le hace a la retención.
  - duracion: cuánto del tramo analizado ocupa.
  - repeticion: si aparece más de una vez en el tramo.
  - causalidad: qué tan directo es el vínculo entre este elemento
    puntual y una posible caída de atención (no una correlación vaga).
  - aislamiento: qué tan independiente es de los otros problemas
    detectados (evitá reportar la misma causa dos veces con distinta
    redacción).
- Si "existencia" te da menos de 2, no lo reportes como problema.

CÓMO ARMAR CADA CANDIDATO DE FORTALEZA:
- descripcion: qué funciona y por qué, en una frase clara.
- evidencia: 1-3 elementos concretos del video.
- relevancia (0 a 5): cuánto aporta esa fortaleza a la retención real.

CHEQUEO DE NICHO:
- resultado: "SI" | "NO" | "PARCIAL" — si lo que funciona o falla en
  el hook depende de convenciones específicas del nicho ${industria}
  (y por lo tanto no aplicaría igual a otro tipo de contenido).
- justificacion: una frase breve explicando por qué.

FORMATO DE SALIDA — RESPONDÉ ÚNICAMENTE CON ESTE JSON, SIN TEXTO
ANTES NI DESPUÉS, SIN \`\`\`json, SIN COMENTARIOS:

{
  "problemas": [
    {
      "descripcion": "string",
      "inicio": 0,
      "fin": 0,
      "evidencia": ["string"],
      "rubrica": {
        "existencia": 0,
        "impacto": 0,
        "duracion": 0,
        "repeticion": 0,
        "causalidad": 0,
        "aislamiento": 0
      }
    }
  ],
  "fortalezas": [
    {
      "descripcion": "string",
      "evidencia": ["string"],
      "relevancia": 0
    }
  ],
  "chequeo_nicho": {
    "resultado": "SI",
    "justificacion": "string"
  }
}
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

// ═════════════════════════════════════════════════════════════
// runVideoReview sigue usando buildHookAnalysisPrompt (el original).
// Para correr el A/B test real, cambiá solo la línea marcada abajo
// por buildHookAnalysisPrompt_VARIANTE_VISUAL_PSICOLOGIA y comparás
// los resultados contra una corrida con el original, mismos videos.
// No lo dejes así por default: es una rama de test, no reemplazo.
// ═════════════════════════════════════════════════════════════

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
      // ↓ Para A/B test: reemplazar por buildHookAnalysisPrompt_VARIANTE_VISUAL_PSICOLOGIA
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