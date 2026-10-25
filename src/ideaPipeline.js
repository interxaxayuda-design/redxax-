// ideaPipeline.js — Pipeline de refinamiento de ideas short-form (v4: sin auditoría, el modelo decide)

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
const CFG = { thinkingLevel: 'high', temperature: 1.0, maxOutputTokens: 8192 };

// ── Prompt Builder ───────────────────────────────────────────
const historyBlock = (history) =>
  history.length
    ? history.map((m) => `${m.role === 'user' ? 'USUARIO' : 'VIRAX'}: ${m.text}`).join('\n')
    : '(primera interacción)';

const SCHEMA = `
Respondé SOLO con JSON válido.

A) Falta información:
{
  "tipo":"pregunta",
  "mensaje":"una sola pregunta concreta"
}

B) Ajuste sin plan previo:
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
`;

const buildPrompt = ({
  idea,
  history,
  platform,
  lastPlan,
  businessContext = null,
  trendContext = null,
}) => `
${PERSONA}

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

<plan_an
${SCHEMA}`.trim();

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

  const fail = (message) => { const e = new Error(message); e.tokens = tokens; throw e; };

  if (cand?.finishReason && cand.finishReason !== 'STOP') {
    console.warn('Gemini finishReason:', cand.finishReason, data?.usageMetadata);
  }
  if (!raw) {
    fail(cand?.finishReason === 'MAX_TOKENS'
      ? 'La respuesta se cortó por longitud. Probá con una idea más puntual.'
      : (data?.promptFeedback?.blockReason ?? 'Respuesta vacía de la IA'));
  }
  const json = parseJson(raw);
  if (!json) {
    console.warn('RAW (no parseable):', raw.slice(0, 800));
    fail('La IA devolvió un formato inesperado. Probá de nuevo.');
  }
  return { json, tokens };
};

// ── Validación ───────────────────────────────────────────────

const NIVELES = ['alto', 'medio', 'bajo'];

// Un video sin voz ni texto es válido: alcanza con que el hook tenga visual, texto o frase hablada.
const validPlan = (o) =>
  o?.tipo === 'plan' &&
  (o.hook?.recomendado || o.hook?.texto_en_pantalla || o.hook?.visual) &&
  Array.isArray(o.escenas) && o.escenas.length > 0;

// ── Pipeline ─────────────────────────────────────────────────

export const runIdeaPipeline = async ({
  supabase, model, idea, history = [], platform = 'tiktok',
  lastPlan = null, businessContext = null, trendContext = null,
}) => {
  const trace = [];
  const total = () => trace.reduce((s, t) => s + t.tokens, 0);

  try {
    const r = await callGemini(supabase, {
      ...CFG,
      model,
      text: buildPrompt({ idea, history, platform, lastPlan, businessContext, trendContext }),
    });
    trace.push({ stage: 'coach', tokens: r.tokens });
    const out = r.json;

    if (out.tipo === 'pregunta') {
      return { plan: { tipo: 'pregunta', mensaje: out.mensaje }, tokens: total(), trace };
    }
    if (out.tipo === 'ajuste_sin_plan') {
      return {
        plan: { tipo: 'pregunta', mensaje: '¿Sobre qué video querés trabajar? Contame la idea y armo el plan.' },
        tokens: total(),
        trace,
      };
    }
    if (!validPlan(out)) {
      console.warn('Plan inválido, JSON recibido:', JSON.stringify(out).slice(0, 800));
      throw new Error('La IA devolvió un formato inesperado. Probá de nuevo.');
    }

    const nivel = NIVELES.includes(norm(out.veredicto?.nivel)) ? norm(out.veredicto.nivel) : 'medio';

    return {
      plan: {
        tipo: 'plan',
        titulo: out.titulo,
        formato: out.formato,
        veredicto: { nivel, razon: out.veredicto?.razon ?? out.veredicto?.['razón'] },
        hook: out.hook,
        escenas: out.escenas.slice(0, 5),
        cta: out.cta,
        errores_a_evitar: (out.errores_a_evitar ?? []).slice(0, 3),
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

function norm(s) {
  return String(s ?? '').toLowerCase().trim();
}