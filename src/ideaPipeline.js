// ideaPipeline.js — Pipeline de refinamiento de ideas short-form (v8: streaming thinking)

// ── Persona ──────────────────────────────────────────────────
const PERSONA = `
Sos VIRAX, inteligencia artificial para generar ideas de videos cortos para que se hagan virales para todo tipo de negocios. Conoces cualquier tipo de formato de viralidad en 2026 (como, demostración, ASMR, hook negativo, POV, etc). Todo ese conocimiento sobre videos virales te va a servir para el siguiente objetivo: 

OBJETIVO PARA VIDEOS DE NEGOCIOS:
Una persona te da la idea del video (ejemplo: quiero mostrar mi restaurante para que más gente lo conozca) Tu objetivo es estudiar el entrenamiento de Google acerca de tood tipo de videos virales (no cualquier cosa que se te ocurra, sino lo que Google por entrenamiento sabe qué funciona) y generar la estratégia exacta para que el video sea viral. A continuación, pensá para tu objetivo:

- Qué es lo que engancha a la gente en 2026 (cualquier cosa que esté en un entrenamiento)
- Qué tipo de estructuras usan esos videos virales (ejemplo: tipo de hook [POV, humor, pena, duda, curiosidad, etc], desarrollo y sensación del usuario)
- Por qué otros videos similares no funcionan 

EVITÁ LO SIGUIEnTE: 
- Si el usuario ve que es un anuncio lo que está viendo, independientemente de lo bueno que sea, scrollea. 
`;

const CRITERIO = `
Sos VIRAX, inteligencia artificial para generar ideas de videos cortos para que se hagan virales para todo tipo de negocios. Conoces cualquier tipo de formato de viralidad en 2026 (como, demostración, ASMR, hook negativo, POV, etc). Todo ese conocimiento sobre videos virales te va a servir para el siguiente objetivo: 

OBJETIVO PARA VIDEOS DE NEGOCIOS:
Una persona te da la idea del video (ejemplo: quiero mostrar mi restaurante para que más gente lo conozca) Tu objetivo es estudiar el entrenamiento de Google acerca de tood tipo de videos virales (no cualquier cosa que se te ocurra, sino lo que Google por entrenamiento sabe qué funciona) y generar la estratégia exacta para que el video sea viral. A continuación, pensá para tu objetivo:

- Qué es lo que engancha a la gente en 2026 (cualquier cosa que esté en un entrenamiento)
- Qué tipo de estructuras usan esos videos virales (ejemplo: tipo de hook [POV, humor, pena, duda, curiosidad, etc], desarrollo y sensación del usuario)
- Por qué otros videos similares no funcionan 

EVITÁ LO SIGUIEnTE: 
- Si el usuario ve que es un anuncio lo que está viendo, independientemente de lo bueno que sea, scrollea. 
`;

// Gemini Config
const CFG = { thinkingLevel: 'high', temperature: 1.0, maxOutputTokens: 24576 };

// Máximo de preguntas que VIRAX puede hacer en toda la conversación.
export const MAX_PREGUNTAS = 2;

// Si el mensaje del usuario es más largo que esto, se considera que ya trae contexto suficiente.
const MIN_CHARS_IDEA_SUFICIENTE = 25;

// Cantidad de intentos si la respuesta viene cortada o inválida.
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

- No asumir CTA, voz, texto, música ni storytelling.
- Usar solo los elementos que la situación necesita. Si un solo momento alcanza, uno. Si el silencio funciona, silencio.
- "ejecucion": de 1 a 4 momentos. Cada "descripcion" es lo que se ve y se oye, en una o dos frases cortas. Sin intención estratégica y sin explicar qué comunica.
- El primer momento no puede ser el problema del producto seguido de la acción que lo resuelve.
- "titulo": cómo lo recordaría alguien que lo vio. Si podría ser el nombre de una pieza publicitaria, reescribilo.
- "idea_principal": la razón por la que un desconocido se queda. Si el beneficio aparece antes que la situación, reescribila.
- "por_que_detiene_scroll": qué queda irresuelto o reconocido antes de cualquier claim.
- "por_que_alguien_haria_scroll": en qué instante esto se vuelve un anuncio, o qué tensión se agota.
- "momento_mas_fuerte": el segundo que obliga a ver el siguiente.
- "momento_mas_debil": donde la idea se pone a demostrar.
- Ningún campo habla de eficacia, metáforas visuales ni de "romper la lógica". Hablan de la persona que mira.
- "veredicto.nivel" es "alto" solo si el video sigue teniendo sentido sin el beneficio. "medio" si depende mucho del contexto. "bajo" si es una demo. No premies la idea por ser vistosa.
- "veredicto.razon": una o dos frases sobre el mecanismo de atención, no sobre el producto.
- "pregunta_seguimiento": vacía salvo que el usuario ya esté iterando un plan.
- Cada campo de análisis y la razón: máximo 2 frases. Cerrá siempre el JSON.
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
// Devuelve { json, tokens } igual que callGemini, para que el pipeline no cambie.
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const chunk = JSON.parse(line.slice(6));

        if (chunk.type === 'thinking' && chunk.text) {
          // Pensamiento real de Gemini → lo mostramos en la UI
          onThinking?.(chunk.text);
        } else if (chunk.type === 'text' && chunk.text) {
          // Fragmento del JSON final → lo acumulamos silenciosamente
          jsonText += chunk.text;
        } else if (chunk.type === 'done') {
          tokens = chunk.tokens ?? 0;
        } else if (chunk.type === 'error') {
          throw new Error(chunk.message ?? 'Error en el stream de Gemini');
        }
      } catch (parseErr) {
        // Línea SSE incompleta o malformada — se ignora
        if (parseErr.message?.includes('stream')) throw parseErr; // re-lanza errores reales
      }
    }
  }

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

// ── Validación ───────────────────────────────────────────────
const NIVELES = ['alto', 'medio', 'bajo'];

const validPlan = (o) =>
  o?.tipo === 'plan' &&
  typeof o.idea_principal === 'string' && o.idea_principal.trim().length > 0 &&
  Array.isArray(o.ejecucion) && o.ejecucion.length > 0;

function norm(s) {
  return String(s ?? '').toLowerCase().trim();
}

// ── Pipeline ─────────────────────────────────────────────────
export const runIdeaPipeline = async ({
  supabase,
  model,
  idea,
  history       = [],
  platform      = 'tiktok',
  lastPlan      = null,
  businessContext = null,
  trendContext  = null,
  questionsAsked = null,
  onThinking    = null, // (chunk: string) => void — callback de UI para el pensamiento en vivo
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
            idea, history, platform, lastPlan, businessContext, trendContext,
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

  const NOTA_REINTENTO =
    '\n\nIMPORTANTE: tu respuesta anterior se cortó o fue inválida. ' +
    'Respondé con UN solo JSON completo y MÁS CONCISO: máximo 4 momentos en "ejecucion", ' +
    'descripciones de una sola frase, y pensá menos antes de responder.';

  try {
    let out     = null;
    let lastErr = null;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      try {
        out = await ask(
          intento === 0 ? 'coach' : 'coach_retry',
          intento === 0 ? '' : NOTA_REINTENTO
        );

        // El modelo preguntó cuando no podía → forzar plan
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
        out     = null;
        if (!e.retryable) break;
      }
    }

    if (!out) throw lastErr ?? new Error('La IA devolvió un formato inesperado. Probá de nuevo.');

    const nivel = NIVELES.includes(norm(out.veredicto?.nivel)) ? norm(out.veredicto.nivel) : 'medio';

    return {
      plan: {
        tipo:            'plan',
        titulo:          out.titulo,
        idea_principal:  out.idea_principal,
        ejecucion:       out.ejecucion.slice(0, 8),
        analisis:        out.analisis ?? null,
        veredicto:       { nivel, razon: out.veredicto?.razon ?? out.veredicto?.['razón'] },
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