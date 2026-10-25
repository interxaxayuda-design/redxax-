// ideaPipeline.js — Pipeline de refinamiento de ideas short-form (v7: pocas preguntas, solo si son imprescindibles)

// ── Persona ──────────────────────────────────────────────────
const PERSONA = `
Sos VIRAX.

Tu única misión es encontrar ideas extremadamente difíciles de ignorar en un feed moderno.

No sos consultor de marketing.
No sos community manager.
No sos copywriter.

No asumas formatos.
No asumas estructuras.
No asumas que un video necesita:

- personas hablando
- voz en off
- texto en pantalla
- CTA
- storytelling
- hook tradicional

Observá el contexto.

Considerá múltiples posibilidades.

Elegí la ejecución que consideres más difícil de ignorar.

No uses consejos genéricos.

No expliques teoría de marketing.

Pensá durante varias etapas antes de responder.

Si encontrás una idea mejor durante el análisis, descartá la anterior.

Tu objetivo no es crear contenido correcto.

Tu objetivo es encontrar la versión más difícil de ignorar.
`;

const CRITERIO = `
Imaginá que el usuario está mirando un feed compuesto exclusivamente por contenido que le gusta.

Tu idea aparece de repente entre esos videos.

Evaluá constantemente:

- ¿qué lo haría detenerse?
- ¿qué lo haría seguir mirando?
- ¿en qué momento podría aburrirse?
- ¿qué parte eliminarías si tuvieras que cortar el 50% del video?

Si una idea necesita muchos elementos para funcionar, probablemente es débil.

Las ideas más fuertes suelen apoyarse en pocos elementos con mucha intensidad.
`;

// Gemini Config
// Los tokens de razonamiento (thinking) cuentan dentro de maxOutputTokens.
// Con un tope bajo, el JSON del plan se corta a mitad de camino. Por eso el margen es amplio.
// Si seguís viendo cortes, bajá thinkingLevel a 'low'.
const CFG = { thinkingLevel: 'high', temperature: 1.0, maxOutputTokens: 24576 };

// Máximo de preguntas que VIRAX puede hacer en toda la conversación.
// Bajalo a 1 (o 0) si querés que casi nunca pregunte.
export const MAX_PREGUNTAS = 2;

// Si el mensaje del usuario es más largo que esto, se considera que ya trae contexto suficiente.
const MIN_CHARS_IDEA_SUFICIENTE = 25;

// Cantidad de intentos si la respuesta viene cortada o inválida.
const MAX_INTENTOS = 2;

// ── Conteo de preguntas ──────────────────────────────────────
// Cuenta los mensajes de VIRAX que son preguntas (terminan en "?").
// Si tu front ya lleva la cuenta, pasá `questionsAsked` a runIdeaPipeline y se usa ese valor.
// Se ignoran los mensajes largos (planes que terminan con "pregunta_seguimiento"), que no son preguntas del pipeline.
const countQuestions = (history) =>
  history.filter((m) => {
    if (m.role === 'user') return false;
    const t = String(m.text ?? '').trim();
    return t.length <= 300 && /\?\s*$/.test(t);
  }).length;

// Decide si VIRAX tiene permitido preguntar en este turno.
// Regla: solo se pregunta si NO hay plan previo, quedan preguntas y el mensaje es demasiado pobre para trabajar.
const puedePreguntar = ({ asked, lastPlan, idea, businessContext }) => {
  if (asked >= MAX_PREGUNTAS) return false;
  if (lastPlan) return false; // refinando un plan: ajustar, nunca interrogar
  const ideaTexto = String(idea ?? '').trim();
  const tieneContexto = Boolean(businessContext && String(businessContext).trim());
  if (tieneContexto && ideaTexto.length >= MIN_CHARS_IDEA_SUFICIENTE) return false;
  if (ideaTexto.length >= MIN_CHARS_IDEA_SUFICIENTE * 3) return false; // idea ya detallada
  return true;
};

// ── Prompt Builder ───────────────────────────────────────────
const historyBlock = (history) =>
  history.length
    ? history.map((m) => `${m.role === 'user' ? 'USUARIO' : 'VIRAX'}: ${m.text}`).join('\n')
    : '(primera interacción)';

const SCHEMA_PREGUNTA = `
A) Imposible avanzar: no se entiende qué producto, negocio o tema es el video:
{
  "tipo":"pregunta",
  "mensaje":"una sola pregunta concreta"
}
`;

const SCHEMA_RESTO = `
B) El usuario pide un ajuste/cambio pero no hay plan previo:
{
  "tipo":"ajuste_sin_plan"
}

C) Idea:

{
  "tipo":"plan",

  "titulo":"",

  "idea_principal":"",

  "ejecucion":[
    {
      "momento":"",
      "descripcion":""
    }
  ],

  "analisis":{
    "por_que_detiene_scroll":"",
    "por_que_alguien_haria_scroll":"",
    "momento_mas_fuerte":"",
    "momento_mas_debil":""
  },

  "veredicto":{
    "nivel":"alto|medio|bajo",
    "razon":""
  },

  "pregunta_seguimiento":""
}

Reglas:

- No asumir CTA.
- No asumir voz.
- No asumir texto.
- No asumir storytelling.
- Usar únicamente los elementos necesarios.
- Si una sola imagen funciona mejor que cinco escenas, usar una sola.
- Si el silencio funciona mejor que la voz, usar silencio.
- Priorizar atención sobre estructura.
- "ejecucion" debe tener al menos un elemento y como máximo 5.
- Cada "descripcion" de "ejecucion": máximo 2 frases cortas.
- Cada campo de "analisis" y "veredicto.razon": máximo 2 frases.
- El JSON completo debe ser conciso. Cerrá siempre todas las llaves y corchetes.
- "veredicto.nivel" debe ser exactamente "alto", "medio" o "bajo".
`;

const buildSchema = (canAsk) =>
  `Respondé SOLO con JSON válido, sin texto antes ni después, sin bloques de código.\n` +
  (canAsk ? SCHEMA_PREGUNTA : '') +
  SCHEMA_RESTO;

const preguntasBlock = (asked, canAsk) =>
  canAsk
    ? `
<limite_preguntas>
Preguntas ya hechas: ${asked} de ${MAX_PREGUNTAS} permitidas.
Cada pregunta le cuesta tiempo al usuario. LA RESPUESTA POR DEFECTO ES UN PLAN, NO UNA PREGUNTA.

Solo podés preguntar si NO se entiende qué producto, negocio o tema es el video, y sin eso es imposible proponer algo concreto.

NUNCA preguntes por:
- formato, duración, estilo, tono, voz, texto, música o CTA (decidilo vos)
- plataforma (ya la tenés en <contexto>)
- público objetivo, objetivos o métricas
- presupuesto, recursos, equipo o equipamiento
- datos que podés inferir del negocio, del historial o del mensaje
- preferencias del usuario ("¿preferís A o B?"): elegí vos la mejor opción

Ante cualquier duda, asumí lo más razonable y entregá el plan; si hiciste una suposición importante, mencionala en "razon" del veredicto.
Si preguntás: una sola pregunta, corta y concreta.
</limite_preguntas>`
    : `
<limite_preguntas>
PROHIBIDO preguntar en este turno.
Usá todo lo que ya sabés, asumí lo que falte con criterio y respondé SIEMPRE con un plan (tipo "plan").
Si hay datos faltantes, resolvelos con la mejor suposición y mencionala brevemente en "razon" del veredicto.
Si hay un plan anterior y el usuario pide un cambio, aplicalo y devolvé el plan completo actualizado.
</limite_preguntas>`;

const buildPrompt = ({
  idea,
  history,
  platform,
  lastPlan,
  businessContext = null,
  trendContext = null,
  questionsAsked = 0,
  canAsk = true,
}) => {
  return `
${PERSONA}

${CRITERIO}

<contexto>
Plataforma: ${platform}

Negocio:
${businessContext ?? '(no informado)'}

Señales culturales:
${trendContext ?? '(no disponibles)'}
</contexto>

<historial>
${historyBlock(history)}
</historial>

<plan_anterior>
${lastPlan ? JSON.stringify(lastPlan) : '(ninguno)'}
</plan_anterior>

<mensaje_usuario>
${idea}
</mensaje_usuario>
${preguntasBlock(questionsAsked, canAsk)}

${buildSchema(canAsk)}`.trim();
};

// ── Llamada al proxy ─────────────────────────────────────────

const parseJson = (raw) => {
  const s = raw.replace(/```json|```/g, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
};

const callGemini = async (supabase, body) => {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: { ...body, expectsJson: true },
  });

  if (error) {
    let msg = '';
    try { msg = await error.context?.text?.(); } catch (_) {}
    throw new Error(msg || error.message);
  }
  if (data?.error) throw new Error(`${data.error} ${data.message ?? ''}`);

  const cand = data?.candidates?.[0];
  const raw = cand?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? data?.text ?? '';
  const tokens = data?.usageMetadata?.totalTokenCount ?? Math.ceil((body.text.length + raw.length) / 4);
  const truncated = cand?.finishReason === 'MAX_TOKENS';

  // `retryable` marca errores que vale la pena reintentar (respuesta cortada o mal formada).
  const fail = (message, retryable = false) => {
    const e = new Error(message);
    e.tokens = tokens;
    e.retryable = retryable;
    throw e;
  };

  if (cand?.finishReason && cand.finishReason !== 'STOP') {
    console.warn('Gemini finishReason:', cand.finishReason, data?.usageMetadata);
  }
  if (!raw) {
    fail(
      truncated
        ? 'La respuesta se cortó por longitud. Probá con una idea más puntual.'
        : (data?.promptFeedback?.blockReason ?? 'Respuesta vacía de la IA'),
      truncated
    );
  }
  const json = parseJson(raw);
  if (!json) {
    console.warn('RAW (no parseable):', raw.slice(0, 800), '| finishReason:', cand?.finishReason);
    fail('La IA devolvió un formato inesperado. Probá de nuevo.', true);
  }
  return { json, tokens };
};

// ── Validación ───────────────────────────────────────────────

const NIVELES = ['alto', 'medio', 'bajo'];

// Un plan es válido si tiene idea principal y al menos un momento de ejecución.
const validPlan = (o) =>
  o?.tipo === 'plan' &&
  typeof o.idea_principal === 'string' && o.idea_principal.trim().length > 0 &&
  Array.isArray(o.ejecucion) && o.ejecucion.length > 0;

function norm(s) {
  return String(s ?? '').toLowerCase().trim();
}

// ── Pipeline ─────────────────────────────────────────────────

export const runIdeaPipeline = async ({
  supabase, model, idea, history = [], platform = 'tiktok',
  lastPlan = null, businessContext = null, trendContext = null,
  questionsAsked = null, // opcional: si tu front lleva la cuenta, pasala acá
}) => {
  const trace = [];
  const total = () => trace.reduce((s, t) => s + t.tokens, 0);

  const asked = questionsAsked ?? countQuestions(history);
  const canAsk = puedePreguntar({ asked, lastPlan, idea, businessContext });

  const ask = async (stage, extraNote = '') => {
    try {
      const r = await callGemini(supabase, {
        ...CFG,
        model,
        text: buildPrompt({
          idea, history, platform, lastPlan, businessContext, trendContext,
          questionsAsked: asked,
          canAsk,
        }) + extraNote,
      });
      trace.push({ stage, tokens: r.tokens });
      return r.json;
    } catch (e) {
      // Contar los tokens gastados aunque el intento haya fallado.
      trace.push({ stage: `${stage}_fail`, tokens: e.tokens ?? 0 });
      e.tokens = 0; // ya quedó registrado en el trace; evita contarlo dos veces
      throw e;
    }
  };

  const NOTA_REINTENTO =
    '\n\nIMPORTANTE: tu respuesta anterior se cortó o fue inválida. ' +
    'Respondé con UN solo JSON completo y MÁS CONCISO: máximo 4 momentos en "ejecucion", ' +
    'descripciones de una sola frase, y pensá menos antes de responder.';

  try {
    let out = null;
    let lastErr = null;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      try {
        out = await ask(
          intento === 0 ? 'coach' : 'coach_retry',
          intento === 0 ? '' : NOTA_REINTENTO
        );

        // Ya no puede preguntar pero el modelo preguntó: forzar plan.
        if (!canAsk && (out.tipo === 'pregunta' || out.tipo === 'ajuste_sin_plan')) {
          out = await ask(
            'coach_force_plan',
            '\n\nIMPORTANTE: no podés hacer más preguntas. Respondé ahora con un objeto de tipo "plan".'
          );
        }

        if (out.tipo === 'pregunta' && canAsk) {
          return { plan: { tipo: 'pregunta', mensaje: out.mensaje }, tokens: total(), trace };
        }
        if (out.tipo === 'ajuste_sin_plan' && canAsk) {
          return {
            plan: { tipo: 'pregunta', mensaje: '¿Sobre qué video querés trabajar? Contame la idea y armo el plan.' },
            tokens: total(),
            trace,
          };
        }
        if (validPlan(out)) break;

        console.warn('Plan inválido, JSON recibido:', JSON.stringify(out).slice(0, 800));
        lastErr = new Error('La IA devolvió un formato inesperado. Probá de nuevo.');
        out = null;
      } catch (e) {
        lastErr = e;
        out = null;
        // Solo reintentar si el error es de formato/corte; los errores de red o auth se propagan ya.
        if (!e.retryable) break;
      }
    }

    if (!out) throw lastErr ?? new Error('La IA devolvió un formato inesperado. Probá de nuevo.');

    const nivel = NIVELES.includes(norm(out.veredicto?.nivel)) ? norm(out.veredicto.nivel) : 'medio';

    return {
      plan: {
        tipo: 'plan',
        titulo: out.titulo,
        idea_principal: out.idea_principal,
        ejecucion: out.ejecucion.slice(0, 8),
        analisis: out.analisis ?? null,
        veredicto: { nivel, razon: out.veredicto?.razon ?? out.veredicto?.['razón'] },
        pregunta_seguimiento: out.pregunta_seguimiento,
      },
      tokens: total(),
      trace,
    };
  } catch (e) {
    e.tokens = (e.tokens ?? 0) + total();
    throw e;
  }
};