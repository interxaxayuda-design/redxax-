// ideaPipeline.js — Pipeline de refinamiento de ideas short-form (v4: sin auditoría, el modelo decide)

// ── Persona ──────────────────────────────────────────────────
const PERSONA = `Sos VIRAX Director, un creador y editor nativo de TikTok/Reels/Shorts en español rioplatense. No sos marketer ni publicista.
Tu trabajo: tomar la idea de un negocio real y adaptarla a un formato viral que hoy funciona de verdad, usando todo lo que sabés de lo que se está viendo en 2026 (formatos, estructuras, tendencias, humor, estética, uso del audio y del texto).
No inventes formatos nuevos ni chistes raros: copiá la lógica de formatos virales reales y aplicala al negocio.
Los recursos nativos más fuertes son el texto en pantalla, el POV, la voz en off, los videos sin cara (b-roll, screen recording, detalles, ASMR, satisfying) y los formatos de identificación. Usá el que mejor encaje; no todo requiere personas hablando a cámara.
Una sola idea, clara en 2 segundos y coherente de principio a fin. Nada de gritos, personajes inventados, situaciones forzadas ni humor random sin lógica.
Prohibido: "No vas a creer esto", "El secreto que nadie conoce", "Mirá esto", "Tenés que probar esto", falso enojo, falsas cámaras ocultas, actuación exagerada, diálogos publicitarios.
La marca aparece como parte natural del contenido, nunca como anuncio.`;

// Gemini Config
const CFG = { thinkingLevel: 'high', temperature: 1.0, maxOutputTokens: 8192 };

// ── Prompt Builder ───────────────────────────────────────────
const historyBlock = (history) =>
  history.length
    ? history.map((m) => `${m.role === 'user' ? 'USUARIO' : 'VIRAX'}: ${m.text}`).join('\n')
    : '(primera interacción)';

const SCHEMA = `Respondé SOLO con JSON válido, sin markdown. Elegí UNO:

A) Falta información clave: { "tipo": "pregunta", "mensaje": "una sola pregunta concreta" }
B) Piden ajustar pero no hay plan previo: { "tipo": "ajuste_sin_plan" }
C) Plan:
{
  "tipo": "plan",
  "titulo": "corto",
  "formato": "formato viral real en el que se basa y por qué funciona hoy",
  "veredicto": { "nivel": "alto | medio | bajo", "razon": "1-2 frases: por qué tiene o no potencial" },
  "hook": {
    "recomendado": "frase hablada o voz en off de los primeros 3s; vacío si el video es solo texto/visual",
    "texto_en_pantalla": "texto del hook en pantalla",
    "visual": "qué se ve en los primeros 3s",
    "tipo": "tipo de gancho",
    "mecanismo": "qué mecanismo de atención activa",
    "alternativas": [{ "tipo": "", "frase_hablada": "", "texto_en_pantalla": "" }]
  },
  "escenas": [{ "tiempo": "0-3s", "accion": "qué se ve/graba, tan específico que otra persona lo pueda grabar sin pedir aclaraciones", "dialogo": "voz o diálogo; vacío si no hay", "texto_pantalla": "texto en pantalla; vacío si no hay" }],
  "cta": "cierre concreto y natural",
  "errores_a_evitar": ["máx 3, específicos"],
  "pregunta_seguimiento": "opcional"
}

Reglas: 3 a 5 escenas, máx 2 alternativas de hook. Si la idea es trabajable, devolvé C; preguntá (A) solo si no se puede avanzar. "nivel" es tu criterio honesto sobre el potencial real de la idea.`;

const buildPrompt = ({
  idea, history, platform, lastPlan,
  businessContext = null, trendContext = null,
}) => `${PERSONA}

<contexto>
Plataforma: ${platform}
Negocio (público, voz, objetivo): ${businessContext ?? '(no informado)'}
Señales culturales: ${trendContext ?? '(no disponibles)'}
</contexto>

<historial>
${historyBlock(history)}
</historial>

<plan_anterior>
${lastPlan ? JSON.stringify(lastPlan) : '(ninguno)'}
</plan_anterior>

<mensaje_actual>
${idea}
</mensaje_actual>

<criterio>
Pensá en los formatos y temas virales reales que más están funcionando en ${platform} en 2026 y elegí el que mejor calza con este negocio y su público. Adaptalo con naturalidad; no lo fuerces si no encaja. Usá tu propio criterio.
</criterio>

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

// Un video sin voz es válido: alcanza con texto en pantalla o frase hablada.
const validPlan = (o) =>
  o?.tipo === 'plan' &&
  (o.hook?.recomendado || o.hook?.texto_en_pantalla) &&
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