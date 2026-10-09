// ideaPipeline.js — una llamada (2 solo si la autoauditoría no pasa).
// Devuelve { plan, tokens, trace }. Si falla, el error trae err.tokens con lo ya gastado.
// No usa buildChatSystemPrompt: ese prompt pide Markdown y acá la salida es JSON puro.

const PERSONA =
  'Sos VIRAX Coach, estratega de contenido short-form. Español rioplatense, directo. Nunca inflás algo flojo.';

// Gemini 3: temperature 1.0 (valores bajos pueden degradar el razonamiento).
// maxOutputTokens incluye los tokens de pensamiento: dejá margen.
// Si ves finishReason MAX_TOKENS en consola, bajá thinkingLevel a 'medium'.
const CFG = { thinkingLevel: 'high', temperature: 1.0, maxOutputTokens: 8192 };

const MIN_HOOK = 7;     // score mínimo verificado del criterio hook
const MIN_AVG = 7;      // promedio mínimo verificado de los 8 criterios
const MAX_RETRIES = 1;  // 0 = nunca reintenta

const CRITERIOS = [
  'hook', 'emotion', 'shareability', 'novelty', 'retention', 'trend_fit', 'clarity_cta', 'platform_fit',
];

// ── Prompt ───────────────────────────────────────────────────

const historyBlock = (history) =>
  history.length
    ? history.map((m) => `${m.role === 'user' ? 'USUARIO' : 'VIRAX'}: ${m.text}`).join('\n\n')
    : '(primera interacción)';

const SCHEMA = `
Respondé SOLO con un objeto JSON válido, sin texto extra ni markdown. Elegí UNO de estos formatos:

A) Si falta información clave para trabajar la idea:
{ "tipo": "pregunta", "mensaje": "una sola pregunta concreta" }

B) Si el usuario pide ajustar algo pero no hay plan previo:
{ "tipo": "ajuste_sin_plan" }

C) Plan completo:
{
  "tipo": "plan",
  "titulo": "string corto",
  "veredicto": { "razon": "por qué esta idea tiene o no potencial, en 1-2 frases" },
  "hook": {
    "recomendado": "frase hablada exacta de los primeros 3 segundos",
    "texto_en_pantalla": "string",
    "visual": "qué se ve en cámara",
    "tipo": "curiosidad | contraste | pregunta | promesa | etc.",
    "mecanismo": "qué mecanismo de atención activa, ligado a algo observable en la idea",
    "alternativas": [
      { "tipo": "string", "frase_hablada": "string", "texto_en_pantalla": "string" }
    ]
  },
  "escenas": [
    {
      "tiempo": "0-3s",
      "accion": "qué se graba, tan específico que otra persona lo pueda grabar sin pedir aclaraciones",
      "dialogo": "string o vacío",
      "texto_pantalla": "string o vacío"
    }
  ],
  "cta": "cierre concreto",
  "errores_a_evitar": ["máx 3, específicos de esta idea"],
  "pregunta_seguimiento": "string opcional",
  "auditoria": {
    "hook":         { "score": 0, "evidence": "fragmento LITERAL copiado del plan", "fix": "string" },
    "emotion":      { "score": 0, "evidence": "...", "fix": "..." },
    "shareability": { "score": 0, "evidence": "...", "fix": "..." },
    "novelty":      { "score": 0, "evidence": "...", "fix": "..." },
    "retention":    { "score": 0, "evidence": "...", "fix": "..." },
    "trend_fit":    { "score": 0, "evidence": "...", "fix": "..." },
    "clarity_cta":  { "score": 0, "evidence": "...", "fix": "..." },
    "platform_fit": { "score": 0, "evidence": "...", "fix": "..." }
  }
}

Condiciones:
- "score" es un número de 0 a 10.
- Entre 3 y 5 escenas.
- "evidence" debe ser texto copiado TAL CUAL de hook.recomendado, hook.texto_en_pantalla, hook.visual, hook.mecanismo, escenas (accion/dialogo/texto_pantalla) o cta. Si no es literal, el score se topa en 3.
- Si el mensaje es una idea mínimamente trabajable, devolvé el plan (C); preguntá (A) solo si realmente no se puede avanzar.
`.trim();

const buildPrompt = ({ idea, history, platform, lastPlan, feedback }) => `
${PERSONA}

Sos VIRAX Coach: convertís ideas de negocios reales en conceptos de video corto
que una persona pueda grabar con naturalidad. Hablás en español rioplatense.
No prometés viralidad ni confundís una ocurrencia llamativa con una idea eficaz.

<contexto>
Plataforma: ${platform}
Idea: ${idea}
Historial: ${historyBlock(history)}
Plan anterior: ${lastPlan ? JSON.stringify(lastPlan) : '(ninguno)'}
Público, voz y objetivo del negocio: ${businessContext ?? '(no informado)'}
Señales culturales actuales disponibles: ${trendContext ?? '(no disponibles)'}
</contexto>

<criterio>
Primero identificá qué tiene de concreto esta idea: persona, producto, situación,
tensión, resultado, sorpresa o detalle visual. No inventes hechos, clientes,
reacciones ni tendencias.

Generá tres enfoques distintos:
1. Una observación real o detrás de escena.
2. Una conexión cultural, solo si hay una señal actual disponible y encaja
   naturalmente con el público y el negocio.
3. Una demostración, transformación o intriga basada en algo que se pueda filmar.

Para cada enfoque, explicá en una frase qué detalle observable lo sostiene.
Descartá cualquier enfoque que dependa de actuar una reacción falsa, fabricar
controversia o usar una referencia cultural solo para parecer actual.
Si no hay buen encaje cultural, indicá que no conviene forzarlo.

Elegí el enfoque más fuerte para este caso. Escribí un plan grabable, con diálogo
que suene como algo que diría esa persona en su trabajo, no como un anuncio.
Cada escena debe mostrar algo concreto. No uses fórmulas de engagement genéricas.
</criterio>

<salida>
Devolvé solo el JSON definido por el esquema de la API.
Incluí: enfoques, recomendado, razón, hook, escenas, CTA y riesgos específicos.
No incluyas puntajes de auditoría salvo que cada puntaje tenga un criterio
operacional y una evidencia observable.
</salida>

Plataforma: ${platform}

<historial>
${historyBlock(history)}
</historial>

<plan_anterior>
${lastPlan ? JSON.stringify(lastPlan) : '(ninguno)'}
</plan_anterior>

<mensaje_actual>
${idea}
</mensaje_actual>

${feedback ? `<correccion>\n${feedback}\n</correccion>\n` : ''}
${SCHEMA}
`.trim();

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
  const hook = rows.find((r) => r.k === 'hook').score;
  return { rows, avg, hook, ok: hook >= MIN_HOOK && avg >= MIN_AVG };
};

const levelFor = (s) => (s >= 8 ? 'alto' : s >= 6 ? 'medio' : 'bajo');

const validPlan = (o) =>
  o?.tipo === 'plan' && o.hook?.recomendado && Array.isArray(o.escenas) && o.escenas.length > 0;

// ── Pipeline ─────────────────────────────────────────────────

export const runIdeaPipeline = async ({ supabase, model, idea, history = [], platform = 'tiktok', lastPlan = null }) => {
  const trace = [];
  const total = () => trace.reduce((s, t) => s + t.tokens, 0);

  const run = async (feedback) => {
    const r = await callGemini(supabase, {
      ...CFG,
      model,
      text: buildPrompt({ idea, history, platform, lastPlan, feedback }),
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
          .filter((x) => x.score < MIN_HOOK)
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