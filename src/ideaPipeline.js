// ideaPipeline.js — Pipeline de refinamiento de ideas short-form (v9: territorio + audiencia declarada)

// ── Persona ──────────────────────────────────────────────────
const PERSONA = `
Sos VIRAX. Escribís videos cortos que un desconocido miraría sin conocer al creador ni querer comprar.

Sabés qué retiene a una audiencia real en TikTok, Reels y Shorts y qué se saltea apenas se siente como publicidad. Un hook no es una frase llamativa: es el instante en que alguien necesita el segundo siguiente. Nace de una situación incompleta, de algo que una comunidad reconoce como propio o de una tensión sin cerrar.

Un negocio te da un territorio, no un mensaje. Encontrá algo que una comunidad concreta miraría aunque el negocio no existiera, y recién después decidí qué lugar ocupa el negocio. Si un patrón real de cualquier nicho encaja, usalo sin nombrarlo: tiene que estar en lo que ocurre.
`;

const CRITERIO = `
Pensá en silencio antes de escribir (el JSON es lo único visible):
1. Qué de este mundo le importaría a un desconocido si nadie vendiera nada, y qué comunidades distintas lo miran (por lo que ya miran, de qué se ríen, qué guardarían o mandarían; no por edad).
2. Nombrá la versión obvia (casi siempre una demostración: problema, el producto actúa, resultado instantáneo) y descartala.
3. Armá 3 candidatas que difieran en para quién y por qué se miran, no en cómo se filman. Preferí que le encante a un grupo chico a que le resulte aceptable a muchos.
4. Borrá el negocio y el beneficio de cada una. Si no queda razón para llegar al final, es un anuncio, aunque venga como storytime, POV o "no vas a creer". Quedate con la que se sostiene sola.
5. Recorré la elegida segundo a segundo como alguien de esa comunidad a un pulgar de seguir de largo. Un tramo que retiene solo por cortesía sobra. El primer segundo debe decirle "esto es para mí".
6. Recién ahí decidí la forma. A veces alcanza un solo gesto.

El producto puede verse, quedar de fondo o no aparecer; nunca es el sujeto de lo primero que se entiende. No uses humor, storytelling, voz, texto, música ni misterio por defecto. La espectacularidad no es interés. Si la elegida suena a concepto de campaña o se parece a tu primera ocurrencia, volvé al paso 1.
`;

// ── Territorio (se ejecuta UNA vez al guardar el perfil del negocio) ──
export const buildTerritorioPrompt = (businessContext) => `
Reescribí la descripción de este negocio como un mapa neutro de su mundo, para que un creador lo explore sin quedar atado a la comunicación comercial. Quitá beneficios, promesas, diferenciales, tono de marca y CTAs. Sumá con tu conocimiento del rubro: qué ve o sabe quien trabaja ahí que casi nadie más, qué creen, temen o discuten las personas sobre el tema, y con qué otros mundos se cruza.

Respondé SOLO con JSON válido: {"territorio":"máx 150 palabras, tres partes en líneas separadas: 1) qué es el negocio y para quién, en neutro; 2) el territorio, sin adjetivos de venta; 3) tres comunidades de atención distintas que miran contenido de este mundo, descritas por lo que ya miran, de qué se ríen y qué guardarían (no por edad ni género)."}

<negocio>
${businessContext}
</negocio>
`.trim();

// Gemini Config
const CFG = { thinkingLevel: 'high', temperature: 1.0, maxOutputTokens: 24576 };
const CFG_TERRITORIO = { thinkingLevel: 'low', temperature: 1.0, maxOutputTokens: 4096 };

// Máximo de preguntas que VIRAX puede hacer en toda la conversación.
export const MAX_PREGUNTAS = 2;

// Si el mensaje del usuario es más largo que esto, se considera que ya trae contexto suficiente.
const MIN_CHARS_IDEA_SUFICIENTE = 25;

// Cantidad de intentos si la respuesta viene cortada, inválida o rechazada por las guardias.
const MAX_INTENTOS = 2;

// ── Conteo de preguntas ──────────────────────────────────────
const countQuestions = (history) =>
  history.filter((m) => {
    if (m.role === 'user') return false;
    const t = String(m.text ?? '').trim();
    return t.length <= 300 && /\?\s*$/.test(t);
  }).length;

const puedePreguntar = ({ asked, lastPlan, idea, businessContext }) => {
  if (asked >= MAX_PREGUNTAS) return false;
  if (lastPlan) return false;
  const ideaTexto = String(idea ?? '').trim();
  const tieneContexto = Boolean(businessContext && String(businessContext).trim());
  if (tieneContexto && ideaTexto.length >= MIN_CHARS_IDEA_SUFICIENTE) return false;
  if (ideaTexto.length >= MIN_CHARS_IDEA_SUFICIENTE * 3) return false;
  return true;
};

// ── Prompt Builder ───────────────────────────────────────────
const historyBlock = (history) =>
  history.length
    ? history.map((m) => `${m.role === 'user' ? 'USUARIO' : 'VIRAX'}: ${m.text}`).join('\n')
    : '(primera interacción)';

const mundoBlock = (territorio, businessContext) =>
  territorio
    ? `Territorio (el mundo del negocio, sin lenguaje comercial):\n${territorio}`
    : `Negocio:\n${businessContext ?? '(no informado)'}`;

const SCHEMA_PREGUNTA =
  'Si no se entiende de qué negocio o tema es el video, respondé: {"tipo":"pregunta","mensaje":"una sola pregunta concreta"}';

// Bloque estático: idéntico en cada request. Va primero para que el caché implícito
// de Gemini pueda reutilizar el prefijo (lo variable viene después).
const SCHEMA_PLAN = `
Respondé SOLO con JSON válido, sin texto ni bloques de código.

Si el usuario pide un cambio y no hay plan previo: {"tipo":"ajuste_sin_plan"}

Si no, un plan, completando los campos en este orden:
{
  "tipo":"plan",
  "candidatas":[{"audiencia":"máx 10 palabras","razon_para_mirar":"1 frase sin nombrar el negocio"}],
  "elegida":"audiencia elegida y por qué, 1 frase",
  "razon_para_mirar":"1 frase: qué siente o se lleva esa audiencia. Si necesita nombrar el negocio, descartá la idea.",
  "prueba_de_sustraccion":"1 frase: qué sigue interesando sin el negocio",
  "titulo":"",
  "idea_principal":"máx 2 frases: qué es el video y su giro",
  "rol_del_negocio":"1 frase",
  "ejecucion":[{"momento":"","descripcion":""}],
  "analisis":{"por_que_detiene_scroll":"","por_que_alguien_haria_scroll":"","para_quien_no_funciona":"","momento_mas_fuerte":"","momento_mas_debil":""},
  "veredicto":{"nivel":"alto|medio|bajo","razon":""},
  "pregunta_seguimiento":""
}

Reglas:
- 3 candidatas distintas en audiencia y razón. "elegida": comunidad concreta, nunca "todos" ni "público general".
- Con plan_anterior: reutilizá "candidatas" y "elegida"; cambiá "elegida" solo si el usuario pide otra audiencia. Devolvé el plan completo con el cambio aplicado.
- "ejecucion": 1 a 4 momentos. "descripcion" es lo que se ve y se oye, máx 2 frases cortas, sin explicar qué comunica. El primer momento no puede ser el problema del producto seguido de su solución. No asumir CTA, voz, texto ni música: usá solo lo que la idea necesita.
- "titulo": cómo lo recordaría quien lo vio, no el nombre de una pieza publicitaria. "idea_principal" describe el video, no su beneficio.
- "analisis" habla de la persona que mira. "por_que_detiene_scroll": qué queda irresuelto o reconocido antes de cualquier claim. "por_que_alguien_haria_scroll": por qué seguiría de largo (en qué instante se vuelve anuncio o se agota la tensión). "para_quien_no_funciona": quién lo ignoraría (es esperable). "momento_mas_fuerte": el segundo que obliga a ver el siguiente. "momento_mas_debil": donde se pone a demostrar.
- "veredicto.nivel" mide la intensidad en la audiencia elegida. "alto": lo guardarían o mandarían y se sostiene sin el beneficio. "medio" es lo normal. "bajo": es una demo o depende del beneficio; no la entregues, buscá otra idea. "razon": 1-2 frases sobre el mecanismo de atención; mencioná cualquier suposición importante.
- "pregunta_seguimiento": vacía salvo que el usuario esté iterando. Máx 2 frases por campo. Cerrá todas las llaves.
`;

const PREFIJO = [PERSONA, CRITERIO, SCHEMA_PLAN].join('\n');

const preguntasBlock = (asked, canAsk) =>
  canAsk
    ? `
<preguntas>
Hechas: ${asked} de ${MAX_PREGUNTAS}. Por defecto respondé con un plan. Preguntá solo si no se entiende qué negocio o tema es el video: una sola pregunta, corta.
Nunca preguntes por formato, duración, tono, plataforma, público (lo elegís vos), objetivos, recursos ni nada que puedas inferir: asumí y mencionalo en "veredicto.razon".
</preguntas>`
    : `
<preguntas>
PROHIBIDO preguntar. Respondé SIEMPRE con "plan", asumiendo con criterio lo que falte (mencionalo en "veredicto.razon"). Con plan_anterior, aplicá el cambio pedido y devolvé el plan completo.
</preguntas>`;

// Al iterar, el modelo solo necesita lo esencial del plan anterior (no el análisis).
const compactPlan = (p) => ({
  candidatas:      p.candidatas,
  elegida:         p.elegida,
  titulo:          p.titulo,
  idea_principal:  p.idea_principal,
  rol_del_negocio: p.rol_del_negocio,
  ejecucion:       p.ejecucion,
});

const buildPrompt = ({
  idea,
  history,
  platform,
  lastPlan,
  businessContext = null,
  territorio = null,
  trendContext = null,
  questionsAsked = 0,
  canAsk = true,
}) =>
  `${PREFIJO}

<contexto>
Plataforma: ${platform}

${mundoBlock(territorio, businessContext)}

Señales culturales:
${trendContext ?? '(no disponibles)'}
</contexto>

<historial>
${historyBlock(history)}
</historial>

<plan_anterior>
${lastPlan ? JSON.stringify(compactPlan(lastPlan)) : '(ninguno)'}
</plan_anterior>

<mensaje_usuario>
${idea}
</mensaje_usuario>
${preguntasBlock(questionsAsked, canAsk)}
${canAsk ? SCHEMA_PREGUNTA + '\n' : ''}Respondé solo con el JSON.`.trim();

// ── Parsing ──────────────────────────────────────────────────
const parseJson = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.replace(/```json|```/g, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
};

// ── Llamada streaming ────────────────────────────────────────
// Llama a la Edge Function con stream:true y consume el SSE.
// onThinking(chunk: string) se dispara con cada fragmento de pensamiento real de Gemini.
// Devuelve { json, tokens }.
const callGeminiStream = async (supabase, body, { onThinking } = {}) => {
  // supabase.functions.invoke no soporta streaming,
  // así que hacemos fetch directo a la URL de la Edge Function.
  const projectUrl = supabase.supabaseUrl; // ej: https://xyzxyz.supabase.co
  const session    = await supabase.auth.getSession();
  const token      = session?.data?.session?.access_token ?? '';

  const res = await fetch(`${projectUrl}/functions/v1/gemini-proxy`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      // supabase.supabaseKey es la anon key pública, necesaria para la Edge Function
      'apikey': supabase.supabaseKey,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    const err = new Error(`gemini-proxy stream ${res.status}: ${msg.slice(0, 200)}`);
    err.retryable = res.status >= 500;
    throw err;
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf      = '';
  let jsonText = ''; // acumula los chunks type:"text" (el JSON final de Gemini)
  let tokens   = 0;

  // Procesa una línea SSE. El JSON.parse está aislado para que un error real del stream
  // (chunk.type === 'error') nunca quede tragado por el catch de parseo.
  const handleLine = (line) => {
    if (!line.startsWith('data: ')) return;

    let chunk;
    try {
      chunk = JSON.parse(line.slice(6));
    } catch {
      return; // línea SSE incompleta o malformada
    }

    if (chunk.type === 'thinking' && chunk.text) {
      onThinking?.(chunk.text); // pensamiento real de Gemini → UI
    } else if (chunk.type === 'text' && chunk.text) {
      jsonText += chunk.text; // fragmento del JSON final
    } else if (chunk.type === 'done') {
      tokens = chunk.tokens ?? 0;
    } else if (chunk.type === 'error') {
      throw new Error(chunk.message ?? 'Error en el stream de Gemini');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  }

  // Última línea sin salto de línea final
  buf += decoder.decode();
  if (buf.trim()) handleLine(buf.trim());

  const json = parseJson(jsonText);
  if (!json) {
    console.warn('Stream: JSON no parseable. Texto acumulado:', jsonText.slice(0, 500));
    const err = new Error('La IA devolvió un formato inesperado. Probá de nuevo.');
    err.tokens    = tokens;
    err.retryable = true;
    throw err;
  }

  return { json, tokens };
};

// ── Territorio ───────────────────────────────────────────────
// Llamalo al guardar/editar el perfil del negocio, guardá el string en Supabase
// y pasalo a runIdeaPipeline como `territorio`. Si falla, el pipeline cae al negocio crudo.
export const buildTerritorio = async ({ supabase, model, businessContext }) => {
  const r = await callGeminiStream(supabase, {
    ...CFG_TERRITORIO,
    model,
    text: buildTerritorioPrompt(businessContext),
  });
  const t = r.json?.territorio;
  return {
    territorio: typeof t === 'string' && t.trim() ? t.trim() : null,
    tokens: r.tokens,
  };
};

// ── Validación ───────────────────────────────────────────────
const NIVELES = ['alto', 'medio', 'bajo'];

function norm(s) {
  return String(s ?? '').toLowerCase().trim();
}

const validPlan = (o) =>
  o?.tipo === 'plan' &&
  typeof o.idea_principal === 'string' && o.idea_principal.trim().length > 0 &&
  typeof o.razon_para_mirar === 'string' && o.razon_para_mirar.trim().length > 0 &&
  Array.isArray(o.ejecucion) && o.ejecucion.length > 0;

// ── Guardias determinísticas (lo que se puede forzar en código no se deja al prompt) ──
const GENERICAS = /^(todos|todo el mundo|cualquier|(el )?público general|personas interesadas)/i;

// Si la razón para mirar nombra marca o producto, es un anuncio disfrazado.
// businessTerms: marca y producto (4+ caracteres; evitá palabras genéricas del rubro).
const leakaNegocio = (plan, terminos = []) => {
  const r = norm(plan.razon_para_mirar);
  return terminos.some((t) => norm(t).length >= 4 && r.includes(norm(t)));
};

const audienciaGenerica = (plan) => {
  const e = String(plan.elegida ?? '').trim();
  return e.length < 15 || GENERICAS.test(e);
};

const motivoRechazo = (plan, terminos) => {
  if (leakaNegocio(plan, terminos)) {
    return 'la "razon_para_mirar" no puede nombrar el negocio ni el producto: eso delata un anuncio. Explorá un ángulo cuya razón para mirar exista sin el negocio.';
  }
  if (audienciaGenerica(plan)) {
    return 'la audiencia elegida es genérica. Elegí una comunidad concreta, definida por lo que ya mira y con qué se identifica, y rehacé el plan para ella.';
  }
  if (norm(plan.veredicto?.nivel) === 'bajo') {
    return 'la idea era una demo o dependía del beneficio comercial. Desarrollá otra candidata cuya razón para mirar se sostenga sin el negocio.';
  }
  return null;
};

const notaRechazo = (motivo, plan) =>
  `\n\nIMPORTANTE: ${motivo}\nÁngulo descartado, no lo repitas: ${plan.idea_principal}`;

const NOTA_REINTENTO =
  '\n\nIMPORTANTE: la respuesta anterior se cortó o fue inválida. ' +
  'Respondé con UN solo JSON completo y MÁS CONCISO: máximo 4 momentos en "ejecucion", ' +
  'descripciones de una sola frase, y pensá menos antes de responder.';

// ── Pipeline ─────────────────────────────────────────────────
export const runIdeaPipeline = async ({
  supabase,
  model,
  idea,
  history         = [],
  platform        = 'tiktok',
  lastPlan        = null,
  businessContext = null,
  territorio      = null, // salida de buildTerritorio(); si es null se usa businessContext
  businessTerms   = [],   // ['NombreMarca', 'NombreProducto'] para la guardia anti-anuncio
  trendContext    = null,
  questionsAsked  = null,
  onThinking      = null, // (chunk: string) => void — callback de UI para el pensamiento en vivo
}) => {
  const trace = [];
  const total = () => trace.reduce((s, t) => s + t.tokens, 0);

  const asked  = questionsAsked ?? countQuestions(history);
  const canAsk = puedePreguntar({ asked, lastPlan, idea, businessContext });

  // ask(): llama al modelo vía stream y registra tokens en el trace
  const ask = async (stage, extraNote = '') => {
    try {
      const r = await callGeminiStream(
        supabase,
        {
          ...CFG,
          model,
          text: buildPrompt({
            idea, history, platform, lastPlan, businessContext, territorio, trendContext,
            questionsAsked: asked,
            canAsk,
          }) + extraNote,
        },
        { onThinking }
      );
      trace.push({ stage, tokens: r.tokens });
      return r.json;
    } catch (e) {
      trace.push({ stage: `${stage}_fail`, tokens: e.tokens ?? 0 });
      e.tokens = 0; // ya quedó en el trace; evita contarlo doble
      throw e;
    }
  };

  try {
    let out      = null;
    let fallback = null; // último plan válido, por si el reintento falla
    let lastErr  = null;
    let nota     = '';

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      try {
        out = await ask(intento === 0 ? 'coach' : 'coach_retry', nota);

        // El modelo preguntó cuando no podía → forzar plan
        if (!canAsk && (out.tipo === 'pregunta' || out.tipo === 'ajuste_sin_plan')) {
          out = await ask(
            'coach_force_plan',
            nota + '\n\nIMPORTANTE: no podés hacer más preguntas. Respondé ahora con un objeto de tipo "plan".'
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

        if (validPlan(out)) {
          fallback = out;
          // Las guardias solo aplican al primer plan; al iterar se respeta la dirección del usuario.
          const motivo = lastPlan ? null : motivoRechazo(out, businessTerms);
          if (motivo && intento < MAX_INTENTOS - 1) {
            nota = notaRechazo(motivo, out);
            out  = null;
            continue;
          }
          break;
        }

        console.warn('Plan inválido, JSON recibido:', JSON.stringify(out).slice(0, 800));
        lastErr = new Error('La IA devolvió un formato inesperado. Probá de nuevo.');
        nota    = NOTA_REINTENTO;
        out     = null;
      } catch (e) {
        lastErr = e;
        out     = null;
        if (!e.retryable) break;
        nota = NOTA_REINTENTO;
      }
    }

    out = out ?? fallback;
    if (!out) throw lastErr ?? new Error('La IA devolvió un formato inesperado. Probá de nuevo.');

    const nivel = NIVELES.includes(norm(out.veredicto?.nivel)) ? norm(out.veredicto.nivel) : 'medio';

    return {
      plan: {
        tipo:                  'plan',
        candidatas:            out.candidatas ?? lastPlan?.candidatas ?? [],
        elegida:               out.elegida,
        razon_para_mirar:      out.razon_para_mirar,
        prueba_de_sustraccion: out.prueba_de_sustraccion,
        titulo:                out.titulo,
        idea_principal:        out.idea_principal,
        rol_del_negocio:       out.rol_del_negocio,
        ejecucion:             out.ejecucion.slice(0, 8),
        analisis:              out.analisis ?? null,
        veredicto:             { nivel, razon: out.veredicto?.razon ?? out.veredicto?.['razón'] },
        pregunta_seguimiento:  out.pregunta_seguimiento,
      },
      tokens: total(),
      trace,
    };
  } catch (e) {
    e.tokens = (e.tokens ?? 0) + total();
    throw e;
  }
};