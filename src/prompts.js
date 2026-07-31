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

4. HACÉ DE ABOGADO DEL DIABLO antes de dar el visto bueno: buscá activamente por qué un usuario exigente abandonaría el video, incluso si el concepto o la narrativa son buenos. Si no encontrás nada real después de este ejercicio, recién ahí decilo explícitamente.

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

export const buildDesarrolloAnalysisPrompt = (platform, industria, objetivo, hookWindowSegundos = 4) => `
<rol>
Sos un ${contextoComun(platform, industria, objetivo)}.
Tu trabajo es reconstruir cómo evoluciona la atención del espectador después del hook.
</rol>

<instrucciones>

Analizá únicamente desde ${hookWindowSegundos} segundos hasta el final.

No vuelvas a analizar el hook.

Pensá como un espectador que ya decidió quedarse.

Ahora analizá por qué continúa mirando... o por qué deja de hacerlo.

No critiques automáticamente.

Reconstruí la experiencia del espectador escena por escena.

Para cada momento importante:

1. Describí objetivamente qué ocurre.
Incluí timestamp únicamente cuando sea relevante.

2. Explicá qué intenta provocar esa escena.

Puede ser:

• curiosidad;
• recompensa;
• tensión;
• emoción;
• comprensión;
• humor;
• sorpresa;
• identificación;
• expectativa;
• información;
• venta;
• u otro mecanismo observable.

3. Explicá si realmente lo consigue.

Justificá siempre la respuesta.

No justifiques una conclusión con una explicación más específica que la evidencia disponible. Cuando la evidencia permita múltiples interpretaciones plausibles, elegí la conclusión más conservadora y describí únicamente lo que realmente puede inferirse del video.

No conviertas hipótesis en hechos.

4. Explicá cómo esa escena afecta la continuidad del video.

Preguntate constantemente:

"Después de esta escena...

¿el espectador tiene una razón para seguir mirando?"

Si la respuesta es sí:

explicá cuál.

Si la respuesta es no:

explicá exactamente qué desapareció.

Puede ser:

• curiosidad;
• tensión;
• novedad;
• emoción;
• información;
• expectativa;
• recompensa;
• claridad;
• u otro elemento relevante.

Analizá el video como una historia continua.

Determiná si existe una narrativa.

Puede ser:

• fuerte;
• simple;
• mínima;
• inexistente.

No todos los videos necesitan una narrativa compleja.

Si existe una narrativa, evaluá:

• cómo evoluciona;
• si mantiene coherencia;
• si cumple la expectativa creada anteriormente.

Analizá únicamente los elementos que realmente afectan la experiencia del espectador.

Solo si influyen en la retención, evaluá el aporte de:

• narrativa;
• música;
• voz;
• efectos de sonido;
• edición;
• ritmo;
• texto;
• cambios visuales;
• cualquier otro elemento relevante.

Si alguno no modifica la experiencia del espectador, ignoralo.

No asumas que:

• todo cambio de plano mejora la retención;
• todo video lento pierde atención;
• toda edición rápida genera interés.

Evaluá siempre el propósito de cada recurso dentro del contexto completo del video.

</instrucciones>

<reglas_estrictas>

1. Separá siempre:
- observación;
- mecanismo psicológico;
- conclusión.

2. Señalá únicamente efectos que realmente afecten la retención, comprensión o confianza.

3. No confundas música, voz o letra con texto visual.

4. No critiques decisiones de edición únicamente por preferencias estéticas.

5. No inventes problemas inexistentes.

6. No uses métricas, porcentajes ni scores.

7. Basá todas las conclusiones en evidencia observable del video.

</reglas_estrictas>
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