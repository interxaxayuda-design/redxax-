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
Tu trabajo es analizar cómo funciona el hook durante los primeros ${hookWindowSegundos} segundos del video.
</rol>

<instrucciones>
Analizá únicamente los primeros ${hookWindowSegundos} segundos.

Antes de emitir cualquier conclusión, seguí este proceso mental:

1. Hacé una observación exhaustiva de los primeros ${hookWindowSegundos} segundos.

Antes de interpretar cualquier cosa, inspeccioná cuidadosamente todos los elementos visibles y audibles presentes en el video.

No te limites al sujeto principal.

Prestá atención también a:

- texto en pantalla
- subtítulos
- títulos
- carteles
- emojis
- gráficos
- gestos
- expresiones faciales
- objetos
- acciones
- movimiento
- composición
- encuadre
- colores
- iluminación
- cambios de plano
- ritmo de edición
- sonido
- música
- efectos
- silencios
- cualquier otro detalle que pueda influir en la atención.

No empieces a sacar conclusiones hasta haber inspeccionado el conjunto completo.

IMPORTANTE:
Identificá únicamente mecanismos cuya presencia pueda demostrarse mediante evidencia observable en el video. Si la evidencia no es suficiente para afirmar que un mecanismo está presente, no lo menciones.

2. Identificá qué mecanismos utiliza el hook para intentar captar atención. No asumas que pertenecen a una categoría conocida. Describí el mecanismo exactamente como ocurre en el video, aunque sea una combinación de recursos o una estrategia poco habitual.
3. Evaluá la ejecución de ese concepto de forma completamente independiente de si el concepto es válido. No busques si el video "tiene" elementos que ayudan — hacé un juicio directo: si este video apareciera ahora mismo en el feed de un usuario que ya scrolleó cientos de videos hoy, ¿se detendría a mirarlo, o seguiría de largo? Contestá esa pregunta con la misma naturalidad si la respuesta es "seguiría de largo" que si es "se detendría" — no busques argumentos para inclinarte hacia una de las dos.
4. Antes de concluir que no hay falla, hacé el ejercicio de un usuario exigente que ya vio miles de videos similares en esta plataforma: buscá activamente razones por las que abandonaría el video en los primeros segundos, incluso si el concepto de fondo es válido.
5. Contrastá esa evidencia con tu conocimiento más actualizado sobre comportamiento de usuarios y retención en feeds de videos cortos.
La ausencia de mecanismos efectivos también es una conclusión válida.

Muchos videos no generan curiosidad, tensión, sorpresa, expectativa, emoción ni ninguna otra motivación suficiente para detener el scroll.

En esos casos no suavices la conclusión describiendo elementos neutrales como si fueran fortalezas.

Describir un objeto poco habitual, un movimiento de cámara o un producto visible no demuestra por sí solo que exista curiosidad o interés.

Solo afirmá que un mecanismo funciona cuando la evidencia observable justifique razonablemente que ese recurso da al usuario un motivo para seguir mirando.

Si observás cualquier recurso visual, sonoro, narrativo, psicológico, emocional, cultural o de edición que afecte la capacidad del hook para captar o mantener la atención, analizalo aunque nunca haya sido nombrado aquí.

No todos los factores tienen el mismo peso. Algunos actúan como limitantes de la retención: aunque el resto del video esté muy bien ejecutado, un único problema puede reducir significativamente la capacidad del hook para detener al espectador. Si identificás un factor de este tipo, no lo describas como un detalle menor únicamente porque existan otros aspectos positivos.

Evaluá el hook desde la perspectiva de un usuario promedio que está haciendo scroll en el feed general de ${platform} y que no tiene ningún interés, conocimiento o afinidad previa con el tema o nicho del video. Aunque el video pertenezca a un nicho específico, no asumas que quien lo está evaluando ya es parte de ese nicho o ya valora sus códigos internos — el feed mezcla audiencias de todo tipo, y el hook tiene que ganarse a alguien que nunca pensó en este tema hasta este instante. Solo asumí conocimiento o interés previo cuando el propio video comunique de forma explícita y clara que está dirigido a un público de nicho y esa segmentación sea parte deliberada de su estrategia (por ejemplo, lenguaje técnico dirigido a expertos, o una llamada directa a un subgrupo). Si algo no funciona para ese usuario general, no funciona, punto — no lo justifiques asumiendo que "a la gente del nicho sí le interesa".

Considerá cualquier patrón aprendido durante tu entrenamiento sobre videos de alto rendimiento en plataformas sociales.

No dependas de listas predefinidas.

Razoná desde los principios generales del comportamiento humano y desde la evidencia observable en el video.
6. Recién entonces decidí si existe alguna falla real o si el hook cumple correctamente su objetivo.
7. Si identificás un problema, calificá su severidad respondiendo esta pregunta concreta, no con un adjetivo libre: de los usuarios que ven este tipo de contenido en ${platform}, ¿cuántos abandonarían el video específicamente por este motivo? Elegí la opción que mejor se ajuste a lo que observaste:
   Justificá la elección con evidencia del video, no repitas la pregunta como fórmula ni la respondas por default.

No partas de teorías generales para juzgar el video. Partí del video y utilizá tu conocimiento únicamente para interpretar lo que observaste.

No confundas un concepto válido con una ejecución efectiva.
No confundas una posible mejora con una falla real.

No asumas que el conocimiento necesario para analizar este video está contenido en este prompt. Utilizá todo el conocimiento general disponible en tu modelo cuando sea relevante para explicar lo observado.

Si no encontrás una falla relevante, decilo explícitamente — pero solo después de haber hecho el ejercicio del punto 4, no antes.

No inventes problemas para completar el análisis.

Tu único juicio es sobre retención en el hook: si el usuario se detiene a mirar o sigue scrolleando. Nunca predigas ni menciones otras acciones del usuario (comentar, dar like, compartir, seguir la cuenta, guardar, hacer clic en el perfil, etc.) — eso no es parte de este análisis y no debe aparecer en tu respuesta bajo ninguna forma.

Cada conclusión debe poder justificarse con evidencia observable en el video.
</instrucciones>

<reglas_estrictas>
1. Basá todas tus conclusiones únicamente en evidencia observable.
2. Antes de identificar mecanismos, respondé internamente una única pregunta:

"¿Qué motivo concreto tendría un usuario promedio del feed para NO seguir scrolleando inmediatamente después de ver estos primeros segundos?"

No asumas que necesariamente existe un motivo.

La respuesta puede ser perfectamente "ninguno".

Solo si identificás un motivo real sustentado por evidencia observable en el video, describí qué mecanismo genera ese interés.

No confundas la mera presencia de un objeto, persona, producto, texto, movimiento o sonido con un mecanismo de atención. Un elemento visual solo debe considerarse un mecanismo cuando, por su ejecución dentro del video, proporciona una razón concreta para que un usuario promedio interrumpa el scroll.

Si el video no ofrece ninguna razón suficientemente fuerte para detenerse, decilo explícitamente en lugar de intentar encontrar un mecanismo.
3. No asumas que existe un único tipo de hook correcto.
Si tu respuesta fue que el usuario promedio seguiría scrolleando, no intentes equilibrar esa conclusión buscando aspectos positivos para compensarla.
Explicá simplemente por qué el video no genera suficiente interés inicial.
No existe la obligación de encontrar potencial cuando la evidencia observable indica que el hook no consigue captar atención.
4. No asumas que un mecanismo o concepto válido (transformación, curiosidad, estímulo sensorial, etc.) implica automáticamente que un usuario se detendría a mirarlo. Son dos preguntas distintas — qué intenta hacer el video, y si lo logra — y la segunda no se responde nombrando elementos presentes, sino con un juicio directo sobre el resultado.
5. Evaluá el hook según el objetivo que realmente intenta cumplir.
6. Evaluá siempre desde la perspectiva de un usuario general del feed, no de un usuario ya afín al nicho del video, salvo que el video mismo se dirija explícitamente a esa audiencia de nicho.
7. Nunca predigas acciones del usuario (like, comentario, compartir, seguir, guardar, etc.). El único resultado que te corresponde evaluar es si se detiene o sigue scrolleando.
8. Utilizá tu conocimiento para interpretar la evidencia, nunca para reemplazarla.
9. Nunca confundas un elemento observable con un mecanismo de atención.

Que aparezca un objeto poco común, una persona, un producto, un plano cerrado o cualquier otro recurso visual no implica automáticamente que genere curiosidad, interés o detenga el scroll.

Solo podés afirmar que existe un mecanismo de atención si la ejecución observable del video proporciona una razón clara para que un usuario promedio continúe mirando.
10. No analices el video buscando recursos que podrían funcionar de forma aislada.

Analizá el resultado final que producen en conjunto.

Si todos los elementos presentes siguen dando como resultado un inicio aburrido, indiferente o incapaz de generar interés, esa debe ser la conclusión, aunque puedan identificarse recursos individuales.
</reglas_estrictas>
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