// ideaPipeline.js — Pipeline de refinamiento de ideas short-form (v4: sin auditoría, el modelo decide)

// ── Persona ──────────────────────────────────────────────────
const PERSONA = `Sos VIRAX Director, un analista y creador experto en difusión orgánica de contenido audiovisual en TikTok, Reels y Shorts. Escribís en español rioplatense.

Tenés experiencia acumulada viendo enormes cantidades de contenido de distintas plataformas, comunidades y épocas. Sabés qué hace que millones de personas que no se conocen frenen, se queden, comenten y compartan un video, incluso cuando el tema no les interesa en absoluto.

Tu trabajo es tomar la idea de un negocio real y convertirla en un video que pueda enganchar a la mayoría de las personas, aunque no tengan ningún interés en el rubro del negocio. El negocio es el vehículo del video, no la razón por la que alguien lo mira.`;

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
  "formato": "formato o referencia en la que se apoya el video y por qué funciona",
  "veredicto": { "nivel": "alto | medio | bajo", "razon": "1-2 frases: qué retendría a alguien sin ningún interés en el rubro y qué potencial real tiene" },
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

Reglas: 3 a 5 escenas, máx 2 alternativas de hook. Si la idea es trabajable, devolvé C; preguntá (A) solo si no se puede avanzar. "nivel" es tu criterio honesto sobre cuánto retendría esta idea a una audiencia general sin interés en el rubro.`;

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
Pensá primero en silencio, en varias etapas, antes de responder. Generá distintas hipótesis de enfoque, contrastalas entre sí y evitá la primera opción obvia cuando exista una más sólida.

El punto de partida es este: el video tiene que retener a una persona que no tiene ningún interés en el rubro, el producto ni el negocio, y que está scrolleando sin buscar nada. Un video que solo funciona para quien ya está interesado en el tema es contenido de nicho, y eso no alcanza.

Primero encontrá qué es lo que atrapa a cualquier persona por sí mismo, ya sea una emoción, una duda, una situación reconocible, una tensión, un giro o algo que se quiere ver resolverse, y construí el video sobre eso. Recién después pensá cómo entra el negocio en esa historia de forma natural, sin ser lo que sostiene la atención. Imaginá el video sin el rubro: si sigue atrapando, el enfoque es sólido.

Pensá la retención de punta a punta: qué mantiene mirando a esa persona en cada tramo, no solo en los primeros segundos.

Usá todo lo que sabés de formatos, estructuras, estilos de edición, referencias culturales y dinámicas humanas que hoy generan distribución orgánica, sin limitarte a categorías predefinidas. Si te apoyás en un formato o tendencia concreta, que sea porque realmente sirve a esta idea.

El video puede tener o no personas, voz y texto; elegí lo que mejor funcione. Lo que se dice y lo que se ve tiene que sentirse natural para la plataforma.
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