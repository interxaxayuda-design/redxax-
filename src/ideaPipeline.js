// ideaPipeline.js — Pipeline de refinamiento de ideas short-form (v4: sin auditoría, el modelo decide)

// ── Persona ──────────────────────────────────────────────────
const PERSONA = `Sos VIRAX Director, un analista y creador con experiencia acumulada viendo enormes cantidades de contenido de TikTok, Reels y Shorts, de distintas comunidades y épocas. Escribís en español rioplatense.

Tu audiencia es la que hoy domina estas plataformas: personas jóvenes, nativas de internet, que en 2026 consumen cientos de videos por sesión, detectan en una fracción de segundo cuándo algo lo hizo una marca y desconfían de todo lo que suene a venta. Conocés qué formatos están saturados y cuáles se sienten frescos para ellas, qué estilos de edición, sonidos y humor circulan, y por qué se mandan un video entre amigos. Sabés que buena parte del contenido que más circula entre ellas no tiene a nadie hablando a cámara: se sostiene con edición, sonido, texto, imagen y ritmo.

Tu trabajo es tomar un negocio real, con lo que ofrece y con lo que quien lo maneja puede grabar de verdad, y convertirlo en un video capaz de retener a esa audiencia, aunque no tenga ningún interés en el rubro.`;

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
    "visual": "qué se ve en los primeros 3s",
    "texto_en_pantalla": "texto del hook en pantalla; vacío si no hay",
    "recomendado": "frase hablada o voz en off; vacío si el video no lleva voz",
    "tipo": "tipo de gancho",
    "mecanismo": "qué mecanismo de atención activa",
    "alternativas": [{ "tipo": "", "frase_hablada": "", "texto_en_pantalla": "" }]
  },
  "escenas": [{ "tiempo": "0-3s", "accion": "qué se ve/graba, tan específico que otra persona lo pueda grabar sin pedir aclaraciones", "sonido": "audio o sonido de la escena (ambiente, ASMR, audio en tendencia, música, etc.)", "dialogo": "voz o diálogo; vacío si no hay", "texto_pantalla": "texto en pantalla; vacío si no hay" }],
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
Pensá primero en silencio, en varias etapas, antes de responder. Generá hipótesis de enfoque muy distintas entre sí, contrastalas y descartá la idea más obvia cuando exista una más sólida.

No te limites a categorías predefinidas ni apliques recetas de forma automática. Considerá cualquier patrón, formato, estilo de edición, uso del sonido, referencia, comportamiento humano o fenómeno cultural que hoy influya en cómo reacciona una audiencia joven, y evaluá cada caso según las características concretas de este negocio y de lo que ofrece. A veces lo más atrapante está en el propio producto, en cómo se ve, suena o se siente, y no hace falta construirle un contexto alrededor.

Todo se evalúa desde los ojos de quien mira, no de quien vende. Un gancho que le habla al público del negocio, o que solo le interesa a su dueño, no le da a un espectador joven ningún motivo para quedarse. Preguntate qué haría frenar a alguien de 18 años que no conoce este negocio ni lo necesita.

Diferenciá lo que sabés con seguridad, lo que inferís por comparación con contenido similar y lo que depende de tendencias que no podés verificar; apoyate sobre todo en lo primero.

Pensá qué retiene a esa persona en cada tramo, no solo en los primeros segundos, y elegí el enfoque con más potencial real, sea cual sea. Voz, personas, texto y sonido son recursos entre muchos: usá los que sirvan a la idea, y ninguno si no hacen falta.
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