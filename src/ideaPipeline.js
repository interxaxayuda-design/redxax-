// ideaPipeline.js — Pipeline de refinamiento de ideas short-form (versión compacta)

// ── Persona ──────────────────────────────────────────────────
const PERSONA = `Sos VIRAX Director, un editor obsesionado con por qué la gente se queda mirando videos. No sos marketer ni copywriter.
Convertís ideas de negocios reales en videos de TikTok/Reels/Shorts que funcionen sin seguidores ni branding. Español rioplatense.
Pensás como editor de TikTok, creador de memes y consumidor crónico de internet. Competís contra memes, edits, historias reales y videos raros, no contra otras publicidades.
El espectador detecta marketing al instante e ignora beneficios, promesas y CTAs forzados. Solo atiende algo raro, inesperado, divertido, incómodo o que necesita contexto.
Su secuencia mental: "¿Qué está pasando?" → "¿Por qué?" → "¿Cómo pasó eso?". La venta viene después, nunca antes.
Prohibido: "No vas a creer esto", "El secreto que nadie conoce", "Mirá esto", "Tenés que probar esto", falso enojo, falsas cámaras ocultas, reacciones actuadas, diálogos publicitarios.
Si parece un anuncio disfrazado de contenido, fallaste. Si parece contenido que casualmente incluye una marca, vas bien.`;

// Gemini Config
const CFG = { thinkingLevel: 'high', temperature: 1.0, maxOutputTokens: 8192 };

const MIN_SCROLL_STOP = 7; // score mínimo verificado de scroll_stop
const MIN_AVG = 7;         // promedio mínimo verificado de los 8 criterios
const MAX_RETRIES = 1;     // 0 = nunca reintenta

const CRITERIOS = [
  'scroll_stop', 'context_gap', 'conversation_trigger', 'novelty',
  'retention', 'authenticity', 'platform_fit', 'product_integration',
];

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
  "veredicto": { "razon": "1-2 frases: por qué tiene o no potencial y qué enfoque elegiste" },
  "hook": {
    "recomendado": "frase hablada exacta de los primeros 3s, 100% natural",
    "texto_en_pantalla": "",
    "visual": "qué se ve en cámara",
    "tipo": "curiosidad | contraste | analog horror | shitpost | meta-humor | duda silenciosa | etc.",
    "mecanismo": "qué mecanismo de atención activa",
    "alternativas": [{ "tipo": "", "frase_hablada": "", "texto_en_pantalla": "" }]
  },
  "escenas": [{ "tiempo": "0-3s", "accion": "grabable sin pedir aclaraciones", "dialogo": "", "texto_pantalla": "" }],
  "cta": "cierre concreto",
  "errores_a_evitar": ["máx 3, específicos"],
  "pregunta_seguimiento": "opcional",
  "auditoria": {
    "scroll_stop": { "score": 0, "evidence": "", "fix": "" },
    "context_gap": { "score": 0, "evidence": "", "fix": "" },
    "conversation_trigger": { "score": 0, "evidence": "", "fix": "" },
    "novelty": { "score": 0, "evidence": "", "fix": "" },
    "retention": { "score": 0, "evidence": "", "fix": "" },
    "authenticity": { "score": 0, "evidence": "", "fix": "" },
    "platform_fit": { "score": 0, "evidence": "", "fix": "" },
    "product_integration": { "score": 0, "evidence": "", "fix": "" }
  }
}

Reglas:
- 3 a 5 escenas, máx 2 alternativas de hook. Si la idea es trabajable, devolvé C; preguntá (A) solo si no se puede avanzar.
- "auditoria" obligatoria en C. score 0-10. "evidence" = texto copiado TAL CUAL de hook.recomendado/texto_en_pantalla/visual/mecanismo, escenas o cta; si no es literal, el score se topa en 3. No infles puntajes.
- Criterios (0 → 10): scroll_stop (invisible → imposible ignorarlo); context_gap (todo obvio → necesito quedarme para entender); conversation_trigger (nadie comenta → la gente necesita opinar); novelty (visto mil veces → se siente nuevo); retention (ya vi todo tras el hook → cada escena agrega algo); authenticity (publicidad obvia → contenido genuino); platform_fit (spot publicitario → nativo); product_integration (inserción forzada → parte orgánica de la historia).`;

const buildPrompt = ({
  idea, history, platform, lastPlan, feedback,
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
Buscá una situación interesante, no marketing. La marca existe para explicar la situación, no al revés.
Descartá o replanteá la idea si: solo muestra una función; depende de que confíen en la marca; lo más interesante pasa después del segundo 5; sin la marca el video deja de ser interesante; no hay observación, anomalía, contradicción, situación social o curiosidad.
Evaluá internamente tres enfoques (observación real, situación inesperada, anomalía que genera conversación) y elegí el mejor. Si hay señales culturales que encajen de forma orgánica, usalas; si no, no las fuerces.
Priorizá tensión contextual, rareza, contradicción y observación humana. Evitá beneficios, promesas, explicaciones y demostraciones lineales.
</criterio>
${feedback ? `\n<correccion>\n${feedback}\n</correccion>\n` : ''}
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

// ── Lógica determinística (gratis: no gasta tokens) ──────────

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
};

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const planText = (o) =>
  norm([
    o.hook?.recomendado, o.hook?.texto_en_pantalla, o.hook?.visual, o.hook?.mecanismo,
    ...(o.escenas ?? []).flatMap((e) => [e.accion, e.dialogo, e.texto_pantalla]),
    o.cta,
  ].join(' '));

// Anti-inflación: sin evidencia verificable en el propio plan, el score se topa en 3.
const audit = (out) => {
  const texto = planText(out);
  const rows = CRITERIOS.map((k) => {
    const x = out.auditoria?.[k] ?? {};
    const ev = norm(x.evidence);
    const verificable = ev && ev !== 'n/a' && texto.includes(ev);
    return { k, score: verificable ? num(x.score) : Math.min(num(x.score), 3), fix: x.fix ?? '' };
  });
  const avg = rows.reduce((s, r) => s + r.score, 0) / rows.length;
  const scrollStop = rows.find((r) => r.k === 'scroll_stop').score;
  return { rows, avg, scrollStop, ok: scrollStop >= MIN_SCROLL_STOP && avg >= MIN_AVG };
};

const levelFor = (s) => (s >= 8 ? 'alto' : s >= 6 ? 'medio' : 'bajo');

const validPlan = (o) =>
  o?.tipo === 'plan' && o.hook?.recomendado && Array.isArray(o.escenas) && o.escenas.length > 0;

// ── Pipeline ─────────────────────────────────────────────────

export const runIdeaPipeline = async ({
  supabase, model, idea, history = [], platform = 'tiktok',
  lastPlan = null, businessContext = null, trendContext = null,
}) => {
  const trace = [];
  const total = () => trace.reduce((s, t) => s + t.tokens, 0);

  const run = async (feedback) => {
    const r = await callGemini(supabase, {
      ...CFG,
      model,
      text: buildPrompt({ idea, history, platform, lastPlan, feedback, businessContext, trendContext }),
    });
    trace.push({ stage: 'coach', tokens: r.tokens });
    return r.json;
  };

  try {
    const out = await run();

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

    let best = { out, a: audit(out) };

    for (let r = 0; r < MAX_RETRIES && !best.a.ok; r++) {
      const feedback = [
        'La versión anterior no pasó la auditoría. Reescribila corrigiendo SOLO esto (mantené lo que ya funciona):',
        ...best.a.rows
          .filter((x) => x.score < MIN_SCROLL_STOP)
          .map((x) => `- ${x.k} ${x.score}/10: ${x.fix || 'subir el estándar'}`),
        'Recordá: "evidence" debe ser texto copiado literal del plan.',
      ].join('\n');

      const retry = await run(feedback);
      if (!validPlan(retry)) break;
      const a = audit(retry);
      if (a.avg > best.a.avg) best = { out: retry, a };
    }

    const { out: o, a } = best;
    return {
      plan: {
        tipo: 'plan',
        titulo: o.titulo,
        veredicto: { nivel: levelFor(a.avg), razon: o.veredicto?.razon ?? o.veredicto?.['razón'] },
        hook: o.hook,
        escenas: o.escenas.slice(0, 5),
        cta: o.cta,
        errores_a_evitar: (o.errores_a_evitar ?? []).slice(0, 3),
        pregunta_seguimiento: o.pregunta_seguimiento,
      },
      tokens: total(),
      trace,
    };
  } catch (e) {
    e.tokens = (e.tokens ?? 0) + total();
    throw e;
  }
};