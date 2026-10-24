import { ArrowLeft, ArrowUp, Building2, Check, ChevronDown, Copy, Gem, Mic, RotateCcw, ShoppingBag, Square, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { runIdeaPipeline } from './ideaPipeline.js';
import { REVIEW_CONFIG } from './prompts.js';

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'reels', label: 'Reels' },
  { id: 'shorts', label: 'Shorts' },
];

const SUGGESTIONS = [
  { icon: ShoppingBag, label: 'Vender un producto', hint: 'Skincare, ropa, accesorios…', text: 'Quiero vender un producto de skincare con un video corto' },
  { icon: Building2, label: 'Mostrar una propiedad', hint: 'Recorridos y ventas inmobiliarias', text: 'Tengo una inmobiliaria y no sé cómo mostrar una propiedad' },
  { icon: UtensilsCrossed, label: 'Promocionar un restaurante', hint: 'Sin que parezca un anuncio', text: 'Idea para promocionar mi restaurante sin parecer anuncio' },
];

const THINKING_STEPS = ['Pensando el gancho', 'Armando las escenas', 'Puliendo el cierre'];
const MAX_HISTORY_TURNS = 6;
const SESSION_TOKEN_LIMIT = 80000;

// Entrada escalonada: cada elemento aparece un paso después del anterior
const step = (i) => ({ '--i': i });

// ── Lógica (sin cambios de comportamiento) ──
const pick = (o, keys) => {
  for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k];
  return undefined;
};

// La respuesta puede llegar como objeto, como texto con JSON, dentro de ```json o envuelta en otra clave
const parseMaybeJson = (v) => {
  if (typeof v !== 'string') return v;
  const t = v.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* no era JSON puro */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* sigue como texto */ } }
  return v;
};

const WRAPPERS = ['plan', 'resultado', 'result', 'respuesta', 'response', 'data', 'output', 'content'];

const unwrapPlan = (raw, depth = 0) => {
  let p = parseMaybeJson(raw);
  if (Array.isArray(p)) p = p.find((x) => x && typeof x === 'object') ?? p.find((x) => typeof x === 'string');
  if (typeof p === 'string') return p.trim() ? { tipo: 'pregunta', mensaje: p.trim() } : null;
  if (!p || typeof p !== 'object') return null;
  const known = p.hook || p.gancho || p.escenas || p.scenes || p.guion || p.mensaje || p.pregunta;
  if (!known && depth < 3) {
    for (const k of WRAPPERS) {
      if (p[k] != null) {
        const inner = unwrapPlan(p[k], depth + 1);
        if (inner) return inner;
      }
    }
  }
  return p;
};

const asText = (v, keys) => (typeof v === 'string' ? v : v && typeof v === 'object' ? pick(v, keys) : undefined);

const normalizePlan = (raw) => {
  const base = unwrapPlan(raw);
  if (!base) return null;
  const plan = { ...base };

  plan.hook = plan.hook ?? plan.gancho;
  if (typeof plan.hook === 'string') plan.hook = { recomendado: plan.hook };
  if (plan.hook?.alternativas) {
    plan.hook = {
      ...plan.hook,
      alternativas: plan.hook.alternativas.map((a) => (typeof a === 'string' ? { frase_hablada: a } : a)),
    };
  }

  const scenes = plan.escenas ?? plan.scenes ?? plan.guion;
  if (Array.isArray(scenes)) {
    plan.escenas = scenes.filter(Boolean).map((e) =>
      typeof e === 'string'
        ? { accion: e }
        : {
            ...e,
            accion: pick(e, ['accion', 'acción', 'descripcion', 'descripción', 'escena', 'visual']),
            tiempo: pick(e, ['tiempo', 'duracion', 'duración', 'segundos']),
          });
  }

  plan.cta = asText(plan.cta ?? pick(plan, ['cierre', 'llamado_a_la_accion', 'llamado_a_la_acción', 'call_to_action']),
    ['texto', 'frase', 'mensaje', 'accion', 'acción']);

  const errs = plan.errores_a_evitar ?? plan.errores;
  if (Array.isArray(errs)) {
    plan.errores_a_evitar = errs.map((x) => asText(x, ['texto', 'error', 'descripcion', 'descripción'])).filter(Boolean);
  }

  if (typeof plan.veredicto === 'string') plan.veredicto = { razon: plan.veredicto };
  if (plan.veredicto && typeof plan.veredicto === 'object') {
    plan.veredicto = {
      ...plan.veredicto,
      razon: pick(plan.veredicto, ['razon', 'razón', 'motivo', 'justificacion', 'justificación']),
    };
  }

  const msg = pick(plan, ['mensaje', 'pregunta', 'pregunta_seguimiento']);
  const hasPlanBody = Boolean(plan.hook) || plan.escenas?.length > 0;
  if (plan.tipo === 'pregunta' || !hasPlanBody) {
    plan.tipo = 'pregunta';
    plan.mensaje = plan.mensaje ?? msg;
  } else if (!plan.tipo) {
    plan.tipo = 'plan';
  }
  return plan;
};

const isRenderable = (p) => Boolean(p && (p.mensaje || p.hook || p.escenas?.length));

const planToText = (p) => {
  if (!p) return '';
  if (p.tipo === 'pregunta') return p.mensaje ?? '';
  const L = [];
  if (p.titulo) L.push(p.titulo, '');
  if (p.veredicto) {
    L.push(`Potencial ${p.veredicto.nivel ?? ''}${p.veredicto.razon ? `: ${p.veredicto.razon}` : ''}`.trim(), '');
  }
  if (p.hook) {
    L.push('HOOK');
    const frase = p.hook.recomendado ?? p.hook.frase_hablada;
    if (frase) L.push(`Dicho: ${frase}`);
    if (p.hook.texto_en_pantalla) L.push(`Pantalla: ${p.hook.texto_en_pantalla}`);
    if (p.hook.visual) L.push(`Visual: ${p.hook.visual}`);
    if (p.hook.alternativas?.length) {
      L.push('Alternativas:');
      p.hook.alternativas.forEach((a) =>
        L.push(`- (${a.tipo}) ${a.frase_hablada}${a.texto_en_pantalla ? ` | Pantalla: ${a.texto_en_pantalla}` : ''}`));
    }
    L.push('');
  }
  if (p.escenas?.length) {
    L.push('ESCENAS');
    p.escenas.forEach((e, i) =>
      L.push(`${i + 1}. [${e.tiempo}] ${e.accion}${e.dialogo ? ` — “${e.dialogo}”` : ''}`));
    L.push('');
  }
  if (p.cta) L.push(`CTA: ${p.cta}`, '');
  if (p.errores_a_evitar?.length) L.push('EVITA', ...p.errores_a_evitar.map((x) => `- ${x}`), '');
  return L.join('\n').trim();
};

const historyText = (m) => {
  if (m.role !== 'bot') return m.text;
  if (m.plan?.tipo === 'plan') return `(Plan entregado: ${m.plan.titulo ?? 'sin título'})`;
  return m.plan ? planToText(m.plan) : m.text;
};

const friendlyError = (err) => {
  const msg = err?.message || '';
  if (err instanceof ReferenceError || err instanceof TypeError || err instanceof SyntaxError) {
    return 'Algo falló de nuestro lado. Inténtalo de nuevo.';
  }
  if (/non-2xx|Edge Function|402|RESOURCE_EXHAUSTED/i.test(msg)) {
    return 'El servicio está con mucha demanda. Inténtalo de nuevo en unos minutos.';
  }
  return msg || 'Se cortó la conexión. Inténtalo de nuevo.';
};

// ── Dictado por voz ──
const SpeechRecognitionAPI =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

const applyVoiceCommands = (text) =>
  text
    .replace(/\s*\babre interrogaci[oó]n\s*/gi, ' ¿')
    .replace(/\s*\bcierra interrogaci[oó]n\b\s*/gi, '? ')
    .replace(/\s*\babre exclamaci[oó]n\s*/gi, ' ¡')
    .replace(/\s*\bcierra exclamaci[oó]n\b\s*/gi, '! ')
    .replace(/\s*\bpunto y coma\b\s*/gi, '; ')
    .replace(/\s*\bdos puntos\b\s*/gi, ': ')
    .replace(/\s*\bpuntos suspensivos\b\s*/gi, '... ')
    .replace(/\s*\b(?:nueva l[ií]nea|punto y aparte)\b\s*/gi, '.\n')
    .replace(/\s*\bpunto\b\s*/gi, '. ')
    .replace(/\s*\bcoma\b\s*/gi, ', ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/(^|[.!?]\s+|\n)([a-záéíóúñ])/g, (_, a, b) => a + b.toUpperCase());

function useDictation(onText) {
  const recRef = useRef(null);
  const onTextRef = useRef(onText);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  useEffect(() => { onTextRef.current = onText; }, [onText]);

  const start = (baseText = '') => {
    if (!SpeechRecognitionAPI || recRef.current) return;
    const rec = new SpeechRecognitionAPI();
    rec.lang = 'es-AR';
    rec.continuous = true;
    rec.interimResults = true;
    const base = baseText ? baseText.replace(/\s*$/, ' ') : '';

    rec.onresult = (e) => {
      const parts = [];
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (!t) continue;
        const prev = parts[parts.length - 1];
        if (prev && t.toLowerCase().startsWith(prev.toLowerCase())) parts[parts.length - 1] = t;
        else parts.push(t);
      }
      onTextRef.current(base + applyVoiceCommands(parts.join(' ')));
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setVoiceError('Permite el acceso al micrófono para dictar.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setVoiceError('No se pudo usar el micrófono.');
      }
    };
    rec.onend = () => { recRef.current = null; setListening(false); };

    setVoiceError('');
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { recRef.current = null; }
  };

  const stop = () => recRef.current?.stop();
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported: Boolean(SpeechRecognitionAPI), listening, voiceError, start, stop };
}

// ── Piezas de interfaz ──
// Avatar mínimo: círculo chico con el logo (o una "V" si no hay logo)
const Avatar = ({ logo }) => (
  <div className="cs-in mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 text-[12px] font-semibold text-neutral-300">
    {logo ? <img src={logo} alt="VIRAX" className="h-4 w-4 object-contain" /> : 'V'}
  </div>
);

const H = ({ children }) => <h4 className="mb-1.5 text-[15px] font-semibold text-white">{children}</h4>;

function CopyBtn({ text, label }) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      setTimeout(() => setOk(false), 1800);
    } catch { /* sin permiso de portapapeles */ }
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-[12px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? 'Copiado' : label}
    </button>
  );
}

function Thinking({ logo }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % THINKING_STEPS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-start gap-3">
      <Avatar logo={logo} />
      <div style={step(1)} className="cs-in flex items-center gap-2.5 pt-2">
        <span className="flex gap-1">
          {[0, 1, 2].map((k) => (
            <span key={k} className="cs-dot" style={{ animationDelay: `${k * 0.16}s` }} />
          ))}
        </span>
        <span className="text-[14px] text-neutral-400">{THINKING_STEPS[i]}…</span>
      </div>
    </div>
  );
}

const LEVELS = {
  bajo: { n: 1, bar: 'bg-red-400', text: 'text-red-300' },
  medio: { n: 2, bar: 'bg-amber-400', text: 'text-amber-300' },
  alto: { n: 3, bar: 'bg-emerald-400', text: 'text-emerald-300' },
};

const Section = ({ title, meta, i = 0, children }) => (
  <section style={step(i)} className="cs-in overflow-hidden rounded-2xl bg-[#111111] ring-1 ring-white/[0.06]">
    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
      <h4 className="text-[14px] font-semibold text-white">{title}</h4>
      {meta && <span className="text-[12px] text-neutral-500">{meta}</span>}
    </div>
    {children}
  </section>
);

function PlanCard({ plan }) {
  const { hook, escenas, cta, errores_a_evitar, veredicto } = plan;
  const [showAlt, setShowAlt] = useState(false);
  const alternativas = hook?.alternativas ?? [];
  const level = LEVELS[String(veredicto?.nivel ?? '').toLowerCase()];
  const frase = hook?.recomendado ?? hook?.frase_hablada;
  const mecanismo = hook?.mecanismo ?? hook?.por_que_funciona;
  let k = 2; // el primer paso lo ocupa el mensaje que acompaña al plan
  const nx = () => k++;

  return (
    <div className="space-y-3.5 text-[15px] leading-7 text-neutral-200">
      {plan.titulo && (
        <h3 style={step(nx())} className="cs-in text-[20px] font-semibold leading-snug tracking-tight text-white">{plan.titulo}</h3>
      )}

      {veredicto && (
        <div style={step(nx())} className="cs-in rounded-2xl bg-[#111111] p-4 ring-1 ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className={`text-[14px] font-semibold ${level?.text ?? 'text-white'}`}>
              {veredicto.nivel ? `Potencial ${veredicto.nivel}` : 'Potencial'}
            </span>
            <div className="flex gap-1" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <span key={n} className={`h-1.5 w-6 rounded-full ${level && n <= level.n ? level.bar : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
          {veredicto.razon && <p className="mt-2 text-[14px] leading-6 text-neutral-400">{veredicto.razon}</p>}
        </div>
      )}

      {hook && (
        <Section i={nx()} title="Gancho" meta={`0–3 s${hook.tipo ? ` · ${hook.tipo}` : ''}`}>
          <div className="space-y-3 p-4">
            {frase && (
              <p className="border-l-2 border-emerald-400 pl-4 text-[17px] leading-snug text-white">“{frase}”</p>
            )}
            {(hook.texto_en_pantalla || hook.visual) && (
              <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5 text-[14px] leading-6">
                {hook.texto_en_pantalla && (
                  <>
                    <dt className="text-neutral-500">En pantalla</dt>
                    <dd className="text-neutral-300">{hook.texto_en_pantalla}</dd>
                  </>
                )}
                {hook.visual && (
                  <>
                    <dt className="text-neutral-500">Visual</dt>
                    <dd className="text-neutral-300">{hook.visual}</dd>
                  </>
                )}
              </dl>
            )}
            {mecanismo && <p className="text-[13px] leading-6 text-neutral-500">{mecanismo}</p>}
          </div>

          {alternativas.length > 0 && (
            <div className="border-t border-white/[0.06]">
              <button
                onClick={() => setShowAlt((v) => !v)}
                aria-expanded={showAlt}
                className="flex w-full items-center justify-between px-4 py-3 text-[14px] text-neutral-300 transition-colors hover:bg-white/[0.03]"
              >
                Otros ganchos ({alternativas.length})
                <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform ${showAlt ? 'rotate-180' : ''}`} />
              </button>
              {showAlt && (
                <ul className="space-y-3 px-4 pb-4">
                  {alternativas.map((a, i) => (
                    <li key={i} className="text-[14px] leading-6 text-neutral-300">
                      {a.tipo && <span className="mr-2 text-[12px] text-neutral-500">{a.tipo}</span>}
                      “{a.frase_hablada}”
                      {a.texto_en_pantalla && (
                        <span className="block text-[13px] text-neutral-500">En pantalla: {a.texto_en_pantalla}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Section>
      )}

      {escenas?.length > 0 && (
        <Section i={nx()} title="Guion" meta={`${escenas.length} ${escenas.length === 1 ? 'escena' : 'escenas'}`}>
          <ol className="divide-y divide-white/[0.06]">
            {escenas.map((e, i) => (
              <li key={i} style={step(nx())} className="cs-in flex gap-4 px-4 py-3.5">
                <div className="w-14 flex-shrink-0 pt-0.5">
                  <span className="block text-[14px] font-semibold tabular-nums text-white">{i + 1}</span>
                  {e.tiempo && <span className="text-[12px] text-neutral-500">{e.tiempo}</span>}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[15px] leading-6 text-neutral-200">{e.accion}</p>
                  {e.dialogo && (
                    <p className="border-l-2 border-white/15 pl-3 text-[14px] leading-6 text-neutral-400">“{e.dialogo}”</p>
                  )}
                  {e.texto_pantalla && (
                    <p className="text-[13px] text-neutral-500">En pantalla: {e.texto_pantalla}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {cta && (
        <Section i={nx()} title="Cierre">
          <p className="p-4 text-[15px] leading-6 text-neutral-200">{cta}</p>
        </Section>
      )}

      {errores_a_evitar?.length > 0 && (
        <Section i={nx()} title="Evita esto">
          <ul className="space-y-2 p-4">
            {errores_a_evitar.map((x, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-6 text-neutral-300">
                <X className="mt-1 h-4 w-4 flex-shrink-0 text-red-400" />
                {x}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.pregunta_seguimiento && <p style={step(nx())} className="cs-in text-neutral-400">{plan.pregunta_seguimiento}</p>}

      <div style={step(nx())} className="cs-in flex flex-wrap gap-2 pt-1">
        <CopyBtn label="Copiar plan" text={planToText(plan)} />
        {frase && <CopyBtn label="Copiar gancho" text={frase} />}
      </div>
    </div>
  );
}

// ── Cartel de introducción (una sola vez) ──
const INTRO_KEY = 'virax_ideas_intro_seen';
const readIntroSeen = () => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; } };
const writeIntroSeen = () => { try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* storage bloqueado */ } };

function IdeasIntroModal({ onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ideas-intro-title"
    >
      <div className="cs-in w-full max-w-sm rounded-2xl bg-[#141414] p-6 shadow-2xl">
        <h2 id="ideas-intro-title" style={step(1)} className="cs-in mb-2 text-lg font-semibold text-white">Convierte tu idea en un video</h2>
        <p style={step(2)} className="cs-in text-[14px] leading-relaxed text-neutral-300">
          Cuéntale a VIRAX qué quieres grabar y te arma el gancho, el guion escena por escena y el cierre.
        </p>
        <button
          onClick={onClose}
          style={step(3)} className="cs-in mt-5 w-full rounded-full bg-white py-3 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          Entendido
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Pantalla principal ──
export default function ChatScreen({
  supabase,
  userIcon, // se usa como logo de VIRAX en los mensajes del asistente
  onBack,
  onBeforeSend,
  businessContext = null,
  gems = null, // opcional: saldo para mostrarlo en el encabezado
  messageCost = 25, // opcional: debe coincidir con lo que descuenta onBeforeSend
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState('tiktok');
  const [tokensUsed, setTokensUsed] = useState(0);
  const [showIntro, setShowIntro] = useState(() => !readIntroSeen());
  const limitReached = tokensUsed >= SESSION_TOKEN_LIMIT;
  const tokenPct = Math.min(100, Math.round((tokensUsed / SESSION_TOKEN_LIMIT) * 100));
  const listRef = useRef(null);
  const taRef = useRef(null);
  const dictation = useDictation(setInput);
  const isEmpty = messages.length === 0 && !loading;

  const dismissIntro = () => { writeIntroSeen(); setShowIntro(false); };
  const resetChat = () => { setMessages([]); setTokensUsed(0); setInput(''); };

  // Scroll dentro de la lista (scrollIntoView podía mover toda la página)
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  const send = async () => {
    const content = input.trim();
    if (!content || loading || limitReached) return;
    dictation.stop();

    if (onBeforeSend) {
      const ok = await onBeforeSend();
      if (!ok) return;
    }

    const next = [...messages, { role: 'user', text: content }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const history = next
        .slice(0, -1)
        .filter((m) => !m.isError)
        .slice(-MAX_HISTORY_TURNS)
        .map((m) => ({ role: m.role, text: historyText(m) }));

      const lastPlan = [...messages].reverse().find((m) => m.plan?.tipo === 'plan')?.plan ?? null;

      const out = await runIdeaPipeline({
        supabase,
        model: REVIEW_CONFIG.coach.model,
        idea: content,
        history,
        platform,
        lastPlan,
        businessContext,
        trendContext: null,
      });

      const rawPlan = out?.plan ?? out?.resultado ?? out?.result ?? out?.data ?? out?.response ?? out?.respuesta ?? out?.text;
      setTokensUsed((t) => t + (Number(out?.tokens) || 0));
      try { if (out?.trace) console.table(out.trace); } catch { /* trace opcional */ }

      const parsed = normalizePlan(rawPlan);
      if (!isRenderable(parsed)) {
        console.error('Formato inesperado. Salida cruda del pipeline:', out);
        throw new Error('La IA devolvió un formato inesperado. Inténtalo de nuevo.');
      }
      setMessages([...next, { role: 'bot', plan: parsed, text: parsed.mensaje ?? '' }]);
    } catch (err) {
      console.error('ChatScreen error:', err);
      if (err.tokens) setTokensUsed((t) => t + err.tokens);
      setInput(content); // el texto vuelve al cuadro para no perderlo
      setMessages([...next, { role: 'bot', text: `${friendlyError(err)} Tu mensaje quedó en el cuadro para reenviarlo.`, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const useSuggestion = (text) => {
    setInput(text);
    taRef.current?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black text-neutral-100"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {showIntro && <IdeasIntroModal onClose={dismissIntro} />}
      <style>{`
        @keyframes cs-dot { 0%, 80%, 100% { opacity: .25; transform: scale(.8) } 40% { opacity: 1; transform: scale(1) } }
        .cs-dot { width: 6px; height: 6px; border-radius: 9999px; background: #a3a3a3; animation: cs-dot 1.2s ease-in-out infinite; }
        .cs-in { animation: cs-in .6s cubic-bezier(.22,1,.36,1) both; animation-delay: calc(min(var(--i, 0), 16) * 80ms); }
        @keyframes cs-in { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        .cs-scroll::-webkit-scrollbar { width: 6px }
        .cs-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 10px }
        @media (prefers-reduced-motion: reduce) { .cs-dot, .cs-in { animation: none } }
      `}</style>

      {/* Encabezado */}
      <header className="cs-in flex items-center gap-1 border-b border-white/[0.05] px-2 py-2">
        <button
          onClick={onBack}
          aria-label="Volver"
          className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex flex-1 items-center">
          <div className="inline-flex rounded-full bg-white/[0.06] p-0.5" role="tablist" aria-label="Plataforma">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={platform === p.id}
                onClick={() => setPlatform(p.id)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  platform === p.id ? 'bg-[#262626] text-white' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {gems != null && (
          <div className="mr-2 flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] text-neutral-200">
            <Gem className="h-3.5 w-3.5 text-emerald-400" fill="currentColor" />
            <span className="tabular-nums">{gems}</span>
          </div>
        )}
      </header>

      {/* Mensajes */}
      <div ref={listRef} className="cs-scroll flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-7 px-4 py-6">
          {isEmpty && (
            <div className="my-auto flex flex-col items-center py-8 text-center">
              <div style={step(1)} className="cs-in mb-6 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[22px] bg-[#161616] shadow-lg shadow-black/30 ring-1 ring-white/10">
                {userIcon ? (
                  <img src={userIcon} alt="VIRAX" className="h-11 w-11 object-contain" />
                ) : (
                  <span className="text-3xl font-semibold text-white">V</span>
                )}
              </div>
              <h2 style={step(2)} className="cs-in text-[28px] font-semibold leading-tight tracking-tight text-white">¿Qué quieres grabar hoy?</h2>
              <p style={step(3)} className="cs-in mt-2 max-w-sm text-[15px] leading-6 text-neutral-400">
                Cuéntame tu idea y te armo el gancho, las escenas y el cierre.
              </p>
              <ul style={step(4)} className="cs-in mt-9 w-full max-w-md divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-[#111111] text-left ring-1 ring-white/[0.06]">
                {SUGGESTIONS.map((s, i) => (
                  <li key={s.label} style={step(5 + i)} className="cs-in">
                    <button
                      onClick={() => useSuggestion(s.text)}
                      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-400">
                        <s.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-white">{s.label}</span>
                        <span className="block truncate text-[13px] text-neutral-500">{s.hint}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} className="cs-in flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-[#1a1a1a] px-4 py-2.5 text-[15px] leading-relaxed text-white">
                    {m.text}
                  </p>
                </div>
              );
            }
            const isFullPlan = Boolean(m.plan?.hook || m.plan?.escenas?.length);
            return (
              <div key={i} className="flex items-start gap-3">
                <Avatar logo={userIcon} />
                <div className="min-w-0 flex-1">
                  {isFullPlan ? (
                    <>
                      {m.text && <p style={step(1)} className="cs-in mb-4 text-[15px] leading-7 text-neutral-200">{m.text}</p>}
                      <PlanCard plan={m.plan} />
                    </>
                  ) : (
                    <p
                      style={step(1)}
                      className={`cs-in whitespace-pre-wrap pt-0.5 text-[15px] leading-7 ${
                        m.isError ? 'text-red-300' : 'text-neutral-200'
                      }`}
                    >
                      {m.text}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {loading && <Thinking logo={userIcon} />}
        </div>
      </div>

      {/* Cuadro de escritura */}
      <div className="cs-in px-3 pt-1" style={{ '--i': 8, paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto w-full max-w-3xl">
          {dictation.voiceError && <p className="mb-2 px-3 text-[12px] text-red-300">{dictation.voiceError}</p>}

          {limitReached ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-[#1a1a1a] px-5 py-4 text-center">
              <p className="text-[14px] text-neutral-300">Esta conversación llegó a su límite. Empieza una nueva para seguir.</p>
              <button
                onClick={resetChat}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Nueva conversación
              </button>
            </div>
          ) : (
            <>

              <div className="flex items-end gap-1 rounded-[28px] bg-[#1a1a1a] p-2 pl-5 ring-1 ring-white/[0.07] transition-shadow focus-within:ring-white/20">
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
                  }}
                  placeholder={dictation.listening ? 'Escuchando…' : 'Escribe tu idea'}
                  className="flex-1 resize-none border-none bg-transparent py-2.5 text-[16px] leading-snug text-white outline-none placeholder:text-neutral-500"
                />
                {dictation.supported && (
                  <button
                    type="button"
                    onClick={() => (dictation.listening ? dictation.stop() : dictation.start(input))}
                    disabled={loading}
                    aria-label={dictation.listening ? 'Detener dictado' : 'Dictar por voz'}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${
                      dictation.listening ? 'animate-pulse bg-red-500/20 text-red-300' : 'text-neutral-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {dictation.listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
                  </button>
                )}
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  aria-label="Enviar"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-black transition-opacity active:scale-95 disabled:bg-neutral-600 disabled:text-neutral-400"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>

              <p className="flex items-center justify-center gap-3 pt-2 text-[12px] text-neutral-500">
                <span className="flex items-center gap-1">
                  <Gem className="h-3 w-3" fill="currentColor" /> {messageCost} por mensaje
                </span>
                <span aria-hidden="true">·</span>
                <span className={tokenPct >= 85 ? 'text-red-300' : ''}>Sesión {tokenPct}%</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}