import { ArrowLeft, ArrowUp, Check, ChevronDown, Copy, Gem, Mic, RotateCcw, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { runIdeaPipeline } from './ideaPipeline.js';
import { REVIEW_CONFIG } from './prompts.js';

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'reels', label: 'Reels' },
  { id: 'shorts', label: 'Shorts' },
];

// Sugerencias cortas, como chips (estilo ChatGPT)
const SUGGESTIONS = [
  { label: 'Vender skincare', text: 'Quiero vender un producto de skincare con un video corto' },
  { label: 'Mostrar una propiedad', text: 'Tengo una inmobiliaria y no sé cómo mostrar una propiedad' },
  { label: 'Promocionar mi restaurante', text: 'Idea para promocionar mi restaurante sin parecer anuncio' },
];

const THINKING_STEPS = ['Pensando el gancho', 'Armando las escenas', 'Puliendo el cierre'];
const MAX_HISTORY_TURNS = 6;
const SESSION_TOKEN_LIMIT = 80000;

// ── Lógica (sin cambios de comportamiento) ──
const pick = (o, keys) => {
  for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k];
  return undefined;
};

const normalizePlan = (p) => {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const plan = { ...p };
  if (typeof plan.hook === 'string') plan.hook = { recomendado: plan.hook };
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
  <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 text-[12px] font-semibold text-neutral-300">
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
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
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
      <div className="flex items-center gap-2.5 pt-2">
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
  bajo: 'bg-red-400',
  medio: 'bg-amber-400',
  alto: 'bg-emerald-400',
};

// El plan se lee como una respuesta de chat: texto simple, sin tarjetas
function PlanCard({ plan }) {
  const { hook, escenas, cta, errores_a_evitar, veredicto } = plan;
  const [showAlt, setShowAlt] = useState(false);
  const alternativas = hook?.alternativas ?? [];
  const dot = LEVELS[String(veredicto?.nivel ?? '').toLowerCase()] ?? 'bg-neutral-500';
  const frase = hook?.recomendado ?? hook?.frase_hablada;

  return (
    <div className="space-y-5 text-[15px] leading-7 text-neutral-200">
      {plan.titulo && <h3 className="text-[19px] font-semibold leading-snug text-white">{plan.titulo}</h3>}

      {veredicto && (
        <p>
          <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${dot}`} />
          <span className="font-medium text-white">Potencial {veredicto.nivel}.</span>{' '}
          {veredicto.razon}
        </p>
      )}

      {hook && (
        <section>
          <H>Gancho (0–3 s){hook.tipo ? `, ${hook.tipo}` : ''}</H>
          {frase && (
            <blockquote className="my-2 border-l-2 border-neutral-600 pl-4 text-white">“{frase}”</blockquote>
          )}
          {hook.texto_en_pantalla && (
            <p className="text-neutral-300"><span className="text-neutral-500">En pantalla:</span> {hook.texto_en_pantalla}</p>
          )}
          {hook.visual && (
            <p className="text-neutral-300"><span className="text-neutral-500">Visual:</span> {hook.visual}</p>
          )}
          {(hook.mecanismo || hook.por_que_funciona) && (
            <p className="mt-2 text-[14px] text-neutral-500">{hook.mecanismo ?? hook.por_que_funciona}</p>
          )}

          {alternativas.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowAlt((v) => !v)}
                className="flex items-center gap-1 text-[14px] text-neutral-400 hover:text-white"
              >
                Ver otros ganchos ({alternativas.length})
                <ChevronDown className={`h-4 w-4 transition-transform ${showAlt ? 'rotate-180' : ''}`} />
              </button>
              {showAlt && (
                <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-neutral-600">
                  {alternativas.map((a, i) => (
                    <li key={i}>
                      <span className="text-neutral-500">{a.tipo}:</span> “{a.frase_hablada}”
                      {a.texto_en_pantalla && (
                        <span className="block text-[14px] text-neutral-500">En pantalla: {a.texto_en_pantalla}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {escenas?.length > 0 && (
        <section>
          <H>Escenas</H>
          <ol className="list-decimal space-y-3 pl-5 marker:text-neutral-500">
            {escenas.map((e, i) => (
              <li key={i} className="pl-1">
                <span className="mr-2 text-[13px] text-neutral-500">{e.tiempo}</span>
                {e.accion}
                {e.dialogo && <span className="mt-1 block text-neutral-400">“{e.dialogo}”</span>}
                {e.texto_pantalla && (
                  <span className="block text-[14px] text-neutral-500">Texto en pantalla: {e.texto_pantalla}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {cta && (
        <section>
          <H>Cierre</H>
          <p>{cta}</p>
        </section>
      )}

      {errores_a_evitar?.length > 0 && (
        <section>
          <H>Evita esto</H>
          <ul className="list-disc space-y-1 pl-5 marker:text-neutral-600">
            {errores_a_evitar.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </section>
      )}

      {plan.pregunta_seguimiento && <p className="text-neutral-400">{plan.pregunta_seguimiento}</p>}

      <div className="-ml-2.5 flex flex-wrap gap-1 pt-1">
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
      <div className="w-full max-w-sm rounded-2xl bg-[#2b2b2b] p-6 shadow-2xl">
        <h2 id="ideas-intro-title" className="mb-2 text-lg font-semibold text-white">Convierte tu idea en un video</h2>
        <p className="text-[14px] leading-relaxed text-neutral-300">
          Cuéntale a VIRAX qué quieres grabar y te arma el gancho, el guion escena por escena y el cierre.
        </p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-white py-3 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 active:scale-[0.98]"
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

      const { plan, tokens, trace } = await runIdeaPipeline({
        supabase,
        model: REVIEW_CONFIG.coach.model,
        idea: content,
        history,
        platform,
        lastPlan,
        businessContext,
        trendContext: null,
      });

      setTokensUsed((t) => t + tokens);
      console.table(trace);

      const parsed = normalizePlan(plan);
      if (!isRenderable(parsed)) throw new Error('La IA devolvió un formato inesperado. Inténtalo de nuevo.');
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
      className="fixed inset-0 z-[90] flex flex-col bg-[#212121] text-neutral-100"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {showIntro && <IdeasIntroModal onClose={dismissIntro} />}
      <style>{`
        @keyframes cs-dot { 0%, 80%, 100% { opacity: .25; transform: scale(.8) } 40% { opacity: 1; transform: scale(1) } }
        .cs-dot { width: 6px; height: 6px; border-radius: 9999px; background: #a3a3a3; animation: cs-dot 1.2s ease-in-out infinite; }
        .cs-scroll::-webkit-scrollbar { width: 6px }
        .cs-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 10px }
        @media (prefers-reduced-motion: reduce) { .cs-dot { animation: none } }
      `}</style>

      {/* Encabezado */}
      <header className="flex items-center gap-1 px-2 py-2">
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
                  platform === p.id ? 'bg-[#3a3a3a] text-white' : 'text-neutral-400 hover:text-neutral-200'
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
            <div className="my-auto flex flex-col items-center py-10 text-center">
              <h2 className="text-[28px] font-semibold leading-tight text-white">¿Qué quieres grabar hoy?</h2>
              <p className="mt-2 max-w-xs text-[15px] text-neutral-400">
                Cuéntame tu idea y te armo el gancho, las escenas y el cierre.
              </p>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-[#2f2f2f] px-4 py-2.5 text-[15px] leading-relaxed text-white">
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
                      {m.text && <p className="mb-4 text-[15px] leading-7 text-neutral-200">{m.text}</p>}
                      <PlanCard plan={m.plan} />
                    </>
                  ) : (
                    <p
                      className={`whitespace-pre-wrap pt-0.5 text-[15px] leading-7 ${
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
      <div className="px-3 pt-1" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto w-full max-w-3xl">
          {dictation.voiceError && <p className="mb-2 px-3 text-[12px] text-red-300">{dictation.voiceError}</p>}

          {limitReached ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-[#2f2f2f] px-5 py-4 text-center">
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
              {isEmpty && (
                <div className="mb-3 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => useSuggestion(s.text)}
                      className="rounded-full border border-white/15 px-3.5 py-2 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-1 rounded-[28px] bg-[#2f2f2f] p-2 pl-5">
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