import { ArrowLeft, ArrowUp, Check, Copy, Gem, Mic, RotateCcw, Square } from 'lucide-react';
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
  { label: 'Vender un producto', hint: 'Skincare, ropa, accesorios…', text: 'Quiero vender un producto de skincare con un video corto' },
  { label: 'Mostrar una propiedad', hint: 'Recorridos y ventas inmobiliarias', text: 'Tengo una inmobiliaria y no sé cómo mostrar una propiedad' },
  { label: 'Promocionar un restaurante', hint: 'Sin que parezca un anuncio', text: 'Idea para promocionar mi restaurante sin parecer anuncio' },
];

// Máximo de caracteres del pensamiento visible en la burbuja (lo más viejo se descarta).
const MAX_THINKING_VISIBLE = 600;
const MAX_HISTORY_TURNS = 6;
const SESSION_TOKEN_LIMIT = 80000;

const step = (i) => ({ '--i': i });

// ── Lógica ───────────────────────────────────────────────────
const pick = (o, keys) => {
  for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k];
  return undefined;
};

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
  const known = p.idea_principal || p.ejecucion || p.mensaje || p.pregunta;
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

const normalizePlan = (raw) => {
  const base = unwrapPlan(raw);
  if (!base) return null;
  const plan = { ...base };

  plan.tipo_hook = plan.tipo_hook ?? plan.tipoHook;

  const ej = plan.ejecucion ?? plan.momentos;
  if (Array.isArray(ej)) {
    plan.ejecucion = ej
      .filter(Boolean)
      .map((e) =>
        typeof e === 'string'
          ? { descripcion: e }
          : {
              ...e,
              momento: pick(e, ['momento', 'tiempo']),
              descripcion: pick(e, ['descripcion', 'descripción', 'accion', 'acción']),
            })
      .filter((e) => e.descripcion);
  }

  if (typeof plan.veredicto === 'string') plan.veredicto = { razon: plan.veredicto };
  if (plan.veredicto && typeof plan.veredicto === 'object') {
    plan.veredicto = {
      ...plan.veredicto,
      razon: pick(plan.veredicto, ['razon', 'razón', 'motivo', 'justificacion', 'justificación']),
    };
  }

  const hasPlanBody = Boolean(plan.idea_principal) || plan.ejecucion?.length > 0;
  if (plan.tipo === 'pregunta' || !hasPlanBody) {
    plan.tipo = 'pregunta';
    plan.mensaje = plan.mensaje ?? pick(plan, ['pregunta', 'pregunta_seguimiento']);
  } else if (!plan.tipo) {
    plan.tipo = 'plan';
  }
  return plan;
};

const isRenderable = (p) => Boolean(p && (p.mensaje || p.idea_principal || p.ejecucion?.length));

const planToText = (p) => {
  if (!p) return '';
  if (p.tipo === 'pregunta') return p.mensaje ?? '';
  const L = [];
  if (p.titulo) L.push(p.titulo, '');
  if (p.tipo_hook) L.push(`Hook elegido: ${p.tipo_hook}`, '');
  if (p.veredicto) {
    L.push(`Potencial ${p.veredicto.nivel ?? ''}${p.veredicto.razon ? `: ${p.veredicto.razon}` : ''}`.trim(), '');
  }
  if (p.idea_principal) L.push('IDEA', p.idea_principal, '');
  if (p.ejecucion?.length) {
    L.push('EJECUCIÓN');
    p.ejecucion.forEach((e, i) => L.push(`${i + 1}. [${e.momento ?? ''}] ${e.descripcion ?? ''}`));
    L.push('');
  }
  if (p.analisis) {
    L.push('ANÁLISIS');
    if (p.analisis.por_que_detiene_scroll) L.push(`Por qué detiene el scroll: ${p.analisis.por_que_detiene_scroll}`);
    if (p.analisis.por_que_alguien_haria_scroll) L.push(`Por qué alguien haría scroll: ${p.analisis.por_que_alguien_haria_scroll}`);
    if (p.analisis.momento_mas_fuerte) L.push(`Momento más fuerte: ${p.analisis.momento_mas_fuerte}`);
    if (p.analisis.momento_mas_debil) L.push(`Momento más débil: ${p.analisis.momento_mas_debil}`);
  }
  return L.join('\n').trim();
};

// Resumen corto de cada mensaje para el historial que viaja al modelo (incluye el tipo de hook).
const historyText = (m) => {
  if (m.role !== 'bot') return m.text;
  if (m.plan?.tipo === 'plan') {
    return `(Plan entregado: ${m.plan.titulo ?? 'sin título'}${m.plan.tipo_hook ? `; hook: ${m.plan.tipo_hook}` : ''})`;
  }
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

// ── Dictado por voz ──────────────────────────────────────────
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

// ── Piezas de interfaz ───────────────────────────────────────
const Avatar = ({ logo }) => (
  <div className="cs-in mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 text-[12px] font-semibold text-neutral-400">
    {logo ? <img src={logo} alt="VIRAX" className="h-4 w-4 object-contain" /> : 'V'}
  </div>
);

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
      className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] font-medium text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? 'Copiado' : label}
    </button>
  );
}

// Pensamiento real de Gemini en streaming; puntitos + "Pensando…" mientras no llega nada.
function Thinking({ text, logo }) {
  const visible = text.length > MAX_THINKING_VISIBLE ? '…' + text.slice(-MAX_THINKING_VISIBLE) : text;
  return (
    <div className="flex items-start gap-3">
      <Avatar logo={logo} />
      <div className="min-w-0 flex-1 pt-1.5">
        {visible ? (
          <p className="whitespace-pre-wrap text-[13px] leading-6 text-neutral-500">
            {visible}
            <span aria-hidden="true" className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-neutral-500 align-middle" />
          </p>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((k) => (
                <span key={k} className="cs-dot" style={{ animationDelay: `${k * 0.16}s` }} />
              ))}
            </span>
            <span className="text-[13px] text-neutral-500">Pensando…</span>
          </div>
        )}
      </div>
    </div>
  );
}

const LEVELS = {
  bajo:  { n: 1, bar: 'bg-red-400',     text: 'text-red-300' },
  medio: { n: 2, bar: 'bg-amber-400',   text: 'text-amber-300' },
  alto:  { n: 3, bar: 'bg-emerald-400', text: 'text-emerald-300' },
};

// Tarjeta con encabezado (título + meta a la derecha), como en el diseño nuevo.
const Card = ({ title, meta, i = 0, children }) => (
  <section style={step(i)} className="cs-in overflow-hidden rounded-2xl bg-[#111111] ring-1 ring-white/[0.06]">
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
      <h4 className="text-[14px] font-semibold text-white">{title}</h4>
      {meta && <span className="text-right text-[12px] text-neutral-500">{meta}</span>}
    </div>
    {children}
  </section>
);

function PlanCard({ plan }) {
  const { veredicto, idea_principal, ejecucion, analisis, tipo_hook } = plan;
  const level = LEVELS[String(veredicto?.nivel ?? '').toLowerCase()] ?? LEVELS.medio;
  const rows = [
    ['Por qué detiene el scroll', analisis?.por_que_detiene_scroll],
    ['Por qué alguien haría scroll', analisis?.por_que_alguien_haria_scroll],
    ['Momento más fuerte', analisis?.momento_mas_fuerte],
    ['Momento más débil', analisis?.momento_mas_debil],
  ].filter((r) => r[1]);
  let k = 1;
  const nx = () => k++;

  return (
    <div className="flex flex-col gap-3.5 text-[15px] leading-7 text-neutral-200">
      {plan.titulo && (
        <h3 style={step(nx())} className="cs-in text-[20px] font-semibold leading-snug tracking-tight text-white">
          {plan.titulo}
        </h3>
      )}

      {veredicto && (
        <div style={step(nx())} className="cs-in rounded-2xl bg-[#111111] p-4 ring-1 ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className={`text-[14px] font-semibold ${level.text}`}>
              {veredicto.nivel ? `Potencial ${veredicto.nivel}` : 'Potencial'}
            </span>
            <div className="flex gap-1" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <span key={n} className={`h-1.5 w-6 rounded-full ${n <= level.n ? level.bar : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
          {veredicto.razon && <p className="mt-2 text-[14px] leading-6 text-neutral-400">{veredicto.razon}</p>}
        </div>
      )}

      {idea_principal && (
        <Card i={nx()} title="Idea" meta={tipo_hook ? `Hook elegido: ${tipo_hook}` : undefined}>
          <p className="p-4 text-[15px] leading-6 text-neutral-200">{idea_principal}</p>
        </Card>
      )}

      {ejecucion?.length > 0 && (
        <Card i={nx()} title="Ejecución" meta={`${ejecucion.length} ${ejecucion.length === 1 ? 'momento' : 'momentos'}`}>
          <ol className="divide-y divide-white/[0.06]">
            {ejecucion.map((e, i) => (
              <li key={i} className="flex gap-4 px-4 py-3.5">
                <div className="w-14 flex-shrink-0 pt-0.5">
                  <span className="block text-[14px] font-semibold tabular-nums text-white">{i + 1}</span>
                  {e.momento && <span className="text-[12px] text-neutral-500">{e.momento}</span>}
                </div>
                <p className="min-w-0 flex-1 text-[15px] leading-6 text-neutral-200">{e.descripcion}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {rows.length > 0 && (
        <Card i={nx()} title="Análisis">
          <dl className="divide-y divide-white/[0.06]">
            {rows.map(([label, text]) => (
              <div key={label} className="px-4 py-3">
                <dt className="text-[12px] text-neutral-500">{label}</dt>
                <dd className="mt-0.5 text-[14px] leading-6 text-neutral-300">{text}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {plan.pregunta_seguimiento && (
        <p style={step(nx())} className="cs-in text-neutral-400">{plan.pregunta_seguimiento}</p>
      )}

      <div style={step(nx())} className="cs-in flex flex-wrap gap-2 pt-0.5">
        <CopyBtn label="Copiar plan" text={planToText(plan)} />
        {idea_principal && <CopyBtn label="Copiar idea" text={idea_principal} />}
      </div>
    </div>
  );
}

// ── Cartel de introducción ───────────────────────────────────
const INTRO_KEY = 'virax_ideas_intro_seen';
const readIntroSeen  = () => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; } };
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
        <h2 id="ideas-intro-title" style={step(1)} className="cs-in mb-2 text-lg font-semibold text-white">
          Convierte tu idea en un video
        </h2>
        <p style={step(2)} className="cs-in text-[14px] leading-relaxed text-neutral-300">
          Cuéntale a VIRAX qué quieres grabar: elige el tipo de hook que mejor funciona y te arma la idea y la ejecución.
        </p>
        <button
          onClick={onClose}
          style={step(3)}
          className="cs-in mt-5 w-full rounded-full bg-white py-3 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          Entendido
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Pantalla principal ───────────────────────────────────────
export default function ChatScreen({
  supabase,
  userIcon,
  onBack,
  onBeforeSend,
  onSendError = null, // opcional: se llama si el envío falla (p. ej. para devolver las gemas)
  businessContext = null,
  gems = null,
  messageCost = 25,
}) {
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [platform,     setPlatform]     = useState('tiktok');
  const [tokensUsed,   setTokensUsed]   = useState(0);
  const [showIntro,    setShowIntro]    = useState(() => !readIntroSeen());
  const [thinkingText, setThinkingText] = useState('');

  const limitReached = tokensUsed >= SESSION_TOKEN_LIMIT;
  const tokenPct     = Math.min(100, Math.round((tokensUsed / SESSION_TOKEN_LIMIT) * 100));
  const listRef      = useRef(null);
  const taRef        = useRef(null);
  const sendingRef   = useRef(false); // evita doble envío antes de que React actualice `loading`
  const chatIdRef    = useRef(0);     // identifica la conversación: las respuestas viejas se descartan
  const abortRef     = useRef(null);  // cancela la llamada en curso al reiniciar o desmontar
  const dictation    = useDictation(setInput);
  const isEmpty      = messages.length === 0 && !loading;

  const dismissIntro = () => { writeIntroSeen(); setShowIntro(false); };

  const resetChat = () => {
    abortRef.current?.abort();
    chatIdRef.current += 1;
    sendingRef.current = false;
    dictation.stop();
    setMessages([]);
    setTokensUsed(0);
    setInput('');
    setThinkingText('');
    setLoading(false);
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, thinkingText]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  const send = async () => {
    const content = input.trim();
    if (!content || loading || limitReached || sendingRef.current) return;
    sendingRef.current = true;
    dictation.stop();

    if (onBeforeSend) {
      let ok = false;
      try { ok = await onBeforeSend(); } catch (e) { console.error('onBeforeSend error:', e); }
      if (!ok) { sendingRef.current = false; return; }
    }

    const myChat = chatIdRef.current;
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const prevMessages = messages;
    const next = [...prevMessages, { role: 'user', text: content }];
    setMessages(next);
    setInput('');
    setThinkingText('');
    setLoading(true);

    try {
      const history = prevMessages
        .filter((m) => !m.isError)
        .slice(-MAX_HISTORY_TURNS)
        .map((m) => ({ role: m.role, text: historyText(m) }));

      const lastPlan = [...prevMessages].reverse().find((m) => m.plan?.tipo === 'plan')?.plan ?? null;

      // Las preguntas se cuentan sobre TODO el chat (el historial recortado las perdía)
      const questionsAsked = prevMessages.filter((m) => m.plan?.tipo === 'pregunta').length;

      const out = await runIdeaPipeline({
        supabase,
        model:           REVIEW_CONFIG.coach.model,
        idea:            content,
        history,
        platform,
        lastPlan,
        businessContext,
        trendContext:    null,
        questionsAsked,
        signal:          ctrl.signal,
        onThinking: (chunk) => {
          if (chatIdRef.current === myChat) setThinkingText((prev) => prev + chunk);
        },
      });

      if (chatIdRef.current !== myChat) return; // el chat se reinició mientras esperaba

      const rawPlan = out?.plan ?? out?.resultado ?? out?.result ?? out?.data ?? out?.response ?? out?.respuesta ?? out?.text;
      setTokensUsed((t) => t + (Number(out?.tokens) || 0));
      try { if (out?.trace) console.table(out.trace); } catch { /* trace opcional */ }

      const parsed = normalizePlan(rawPlan);
      if (!isRenderable(parsed)) {
        console.error('Formato inesperado. Salida cruda del pipeline:', out);
        throw new Error('La IA devolvió un formato inesperado. Inténtalo de nuevo.');
      }

      setThinkingText('');
      setMessages([...next, { role: 'bot', plan: parsed, text: parsed.mensaje ?? '' }]);
    } catch (err) {
      if (err?.name === 'AbortError' || chatIdRef.current !== myChat) return;
      console.error('ChatScreen error:', err);
      if (err.tokens) setTokensUsed((t) => t + err.tokens);
      setThinkingText('');
      setInput(content); // el texto vuelve al cuadro; el mensaje fallido sale de la lista para no duplicarse
      try { onSendError?.(err); } catch (e) { console.error('onSendError error:', e); }
      setMessages([
        ...prevMessages,
        { role: 'bot', text: `${friendlyError(err)} Tu mensaje quedó en el cuadro para reenviarlo.`, isError: true },
      ]);
    } finally {
      if (chatIdRef.current === myChat) {
        sendingRef.current = false;
        setLoading(false);
      }
    }
  };

  const pickSuggestion = (text) => {
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
        .cs-dot { width: 6px; height: 6px; border-radius: 9999px; background: #8c8c8c; animation: cs-dot 1.2s ease-in-out infinite; }
        .cs-in { animation: cs-in .5s cubic-bezier(.22,1,.36,1) both; animation-delay: calc(min(var(--i, 0), 12) * 70ms); }
        @keyframes cs-in { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        .cs-scroll::-webkit-scrollbar { width: 6px }
        .cs-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 10px }
        @media (prefers-reduced-motion: reduce) { .cs-dot, .cs-in { animation: none } }
      `}</style>

      {/* Encabezado: volver + plataforma + nuevo chat */}
      <header className="flex items-center gap-1 border-b border-white/[0.07] px-2 py-2">
        <button
          onClick={onBack}
          aria-label="Volver"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="inline-flex min-w-0 max-w-[280px] flex-1 rounded-full bg-[#111111] p-0.5 ring-1 ring-white/[0.06]" role="tablist" aria-label="Plataforma">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={platform === p.id}
              onClick={() => setPlatform(p.id)}
              className={`flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                platform === p.id ? 'bg-[#262626] text-white' : 'text-neutral-500 hover:text-neutral-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {!isEmpty && (
            <button
              onClick={resetChat}
              className="rounded-full px-3 py-1.5 text-[13px] text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-neutral-200"
            >
              Nuevo chat
            </button>
          )}
          {gems != null && (
            <div className="mr-1 flex items-center gap-1.5 rounded-full bg-[#111111] px-3 py-1.5 text-[13px] text-neutral-200 ring-1 ring-white/[0.06]">
              <Gem className="h-3.5 w-3.5 text-emerald-400" fill="currentColor" />
              <span className="tabular-nums">{gems}</span>
            </div>
          )}
        </div>
      </header>

      {/* Mensajes */}
      <div ref={listRef} className="cs-scroll flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-[26px] px-4 py-6">

          {isEmpty && (
            <div className="my-auto py-6 text-center">
              <div style={step(1)} className="cs-in mx-auto mb-[22px] flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-[20px] bg-[#111111] ring-1 ring-white/10">
                {userIcon ? (
                  <img src={userIcon} alt="VIRAX" className="h-10 w-10 object-contain" />
                ) : (
                  <span className="text-[28px] font-bold text-white">V</span>
                )}
              </div>
              <h2 style={step(2)} className="cs-in text-[27px] font-semibold leading-tight tracking-tight text-white">
                ¿Qué querés grabar hoy?
              </h2>
              <p style={step(3)} className="cs-in mx-auto mt-2 max-w-sm text-[15px] leading-6 text-neutral-500">
                Contame tu idea: VIRAX elige el tipo de hook y te arma el plan.
              </p>
              <ul style={step(4)} className="cs-in mx-auto mt-[30px] max-w-[430px] divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-[#111111] text-left ring-1 ring-white/[0.06]">
                {SUGGESTIONS.map((s) => (
                  <li key={s.label}>
                    <button
                      onClick={() => pickSuggestion(s.text)}
                      className="block w-full px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="block text-[14px] font-semibold text-white">{s.label}</span>
                      <span className="block text-[13px] text-neutral-500">{s.hint}</span>
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
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-[22px] bg-[#1a1a1a] px-4 py-2.5 text-[15px] leading-relaxed text-white">
                    {m.text}
                  </p>
                </div>
              );
            }
            const isPlan = Boolean(m.plan?.idea_principal || m.plan?.ejecucion?.length);
            return (
              <div key={i} className="flex items-start gap-3">
                <Avatar logo={userIcon} />
                <div className="min-w-0 flex-1">
                  {isPlan ? (
                    <PlanCard plan={m.plan} />
                  ) : (
                    <p
                      className={`cs-in whitespace-pre-wrap pt-1 text-[15px] leading-7 ${
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

          {loading && <Thinking text={thinkingText} logo={userIcon} />}
        </div>
      </div>

      {/* Cuadro de escritura */}
      <div className="px-3 pt-1" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto w-full max-w-3xl">
          {dictation.voiceError && (
            <p className="mb-2 px-3 text-[12px] text-red-300">{dictation.voiceError}</p>
          )}

          {limitReached ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-[#1a1a1a] px-5 py-4 text-center">
              <p className="text-[14px] text-neutral-300">
                Esta conversación llegó a su límite. Empieza una nueva para seguir.
              </p>
              <button
                onClick={resetChat}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Nueva conversación
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1.5 rounded-[28px] bg-[#1a1a1a] py-2 pl-5 pr-2 ring-1 ring-white/[0.07] transition-shadow focus-within:ring-white/25">
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    if (dictation.listening) dictation.stop(); // si escribe a mano, se frena el dictado
                    setInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={dictation.listening ? 'Escuchando…' : 'Escribí tu idea'}
                  className="max-h-40 flex-1 resize-none border-none bg-transparent py-2.5 text-[16px] leading-snug text-white outline-none placeholder:text-neutral-500"
                />
                {dictation.supported && (
                  <button
                    type="button"
                    onClick={() => (dictation.listening ? dictation.stop() : dictation.start(input))}
                    disabled={loading}
                    aria-label={dictation.listening ? 'Detener dictado' : 'Dictar por voz'}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${
                      dictation.listening
                        ? 'animate-pulse bg-red-500/20 text-red-300'
                        : 'text-neutral-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {dictation.listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
                  </button>
                )}
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  aria-label="Enviar"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-black transition-opacity active:scale-95 disabled:bg-neutral-700 disabled:text-neutral-500"
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