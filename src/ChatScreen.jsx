import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Copy, Gem, Mic, RotateCcw, Send, Sparkles, Square } from 'lucide-react';
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
  { tag: 'Producto', text: 'Quiero vender un producto de skincare con un video corto' },
  { tag: 'Inmobiliaria', text: 'Tengo una inmobiliaria y no sé cómo mostrar una propiedad' },
  { tag: 'Restaurante', text: 'Idea para promocionar mi restaurante sin parecer anuncio' },
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
  if (p.errores_a_evitar?.length) L.push('EVITÁ', ...p.errores_a_evitar.map((x) => `- ${x}`), '');
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
    return 'Algo falló de nuestro lado. Probá de nuevo.';
  }
  if (/non-2xx|Edge Function|402|RESOURCE_EXHAUSTED/i.test(msg)) {
    return 'El servicio está con mucha demanda. Probá de nuevo en unos minutos.';
  }
  return msg || 'Se cortó la conexión. Intentá de nuevo.';
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
        setVoiceError('Permití el acceso al micrófono para dictar.');
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
const Label = ({ children, className = 'text-amber-300/80' }) => (
  <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] mb-2.5 ${className}`}>{children}</p>
);

const Avatar = ({ logo }) => (
  <div className="w-8 h-8 rounded-full bg-[#0c0c12] border border-amber-400/25 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden shadow-[0_0_18px_rgba(251,191,36,0.12)]">
    {logo ? <img src={logo} alt="VIRAX" className="w-5 h-5 object-contain" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
  </div>
);

function CopyBtn({ text, label, primary = false }) {
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
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-semibold tracking-wide transition-all active:scale-95 ${
        primary
          ? 'bg-amber-400/90 hover:bg-amber-300 text-black'
          : 'border border-white/10 text-white/55 hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      {ok ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
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
    <div className="flex items-start gap-3 cs-rise">
      <Avatar logo={logo} />
      <div className="w-full max-w-[85%] rounded-3xl rounded-tl-md border border-white/[0.07] bg-white/[0.025] p-4 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-end gap-[3px] h-3.5">
            {[5, 9, 13, 9, 5].map((h, k) => (
              <span key={k} className="cs-bar" style={{ height: h, animationDelay: `${k * 0.15}s` }} />
            ))}
          </div>
          <span className="text-[11px] font-medium text-amber-200/70">{THINKING_STEPS[i]}…</span>
        </div>
        <div className="cs-skel h-2.5 w-11/12 rounded-full" />
        <div className="cs-skel h-2.5 w-8/12 rounded-full" />
        <div className="cs-skel h-2.5 w-10/12 rounded-full" />
      </div>
    </div>
  );
}

const LEVELS = {
  bajo: { n: 1, bar: 'bg-red-400', text: 'text-red-300' },
  medio: { n: 2, bar: 'bg-amber-400', text: 'text-amber-300' },
  alto: { n: 3, bar: 'bg-emerald-400', text: 'text-emerald-300' },
};

function PlanCard({ plan }) {
  const { hook, escenas, cta, errores_a_evitar, veredicto } = plan;
  const [showAlt, setShowAlt] = useState(false);
  const alternativas = hook?.alternativas ?? [];
  const level = LEVELS[String(veredicto?.nivel ?? '').toLowerCase()];
  const frase = hook?.recomendado ?? hook?.frase_hablada;
  const rise = (i) => ({ animationDelay: `${i * 80}ms` });

  return (
    <div className="space-y-4">
      {plan.titulo && (
        <h4 className="cs-rise text-[19px] font-bold tracking-tight text-white leading-tight" style={rise(0)}>
          {plan.titulo}
        </h4>
      )}

      {veredicto && (
        <div className="cs-rise rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4" style={rise(1)}>
          <div className="flex items-center justify-between mb-3">
            <Label className={`!mb-0 ${level?.text ?? 'text-white/50'}`}>Potencial {veredicto.nivel}</Label>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span key={n} className={`h-1.5 w-7 rounded-full ${level && n <= level.n ? level.bar : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
          {veredicto.razon && <p className="text-[13px] text-white/70 leading-relaxed">{veredicto.razon}</p>}
        </div>
      )}

      {hook && (
        <div className="cs-rise relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.09] to-transparent p-5" style={rise(2)}>
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-amber-400/15 blur-3xl" />
          <Label>Gancho · 0–3 s{hook.tipo ? ` · ${hook.tipo}` : ''}</Label>
          {frase && (
            <p className="font-serif italic text-[21px] leading-snug text-white mb-3">“{frase}”</p>
          )}
          {hook.texto_en_pantalla && (
            <p className="text-[12px] text-white/55 mb-1.5">
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">Pantalla</span>
              {hook.texto_en_pantalla}
            </p>
          )}
          {hook.visual && (
            <p className="text-[12px] text-white/55 mb-1.5">
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">Visual</span>
              {hook.visual}
            </p>
          )}
          {(hook.mecanismo || hook.por_que_funciona) && (
            <p className="mt-3 text-[11px] italic text-white/35 leading-relaxed">{hook.mecanismo ?? hook.por_que_funciona}</p>
          )}

          {alternativas.length > 0 && (
            <div className="mt-4 border-t border-white/[0.07] pt-3">
              <button
                onClick={() => setShowAlt((v) => !v)}
                className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/80"
              >
                Otros ganchos ({alternativas.length})
                <ChevronDown className={`h-4 w-4 transition-transform ${showAlt ? 'rotate-180' : ''}`} />
              </button>
              {showAlt && (
                <ul className="mt-3 space-y-3">
                  {alternativas.map((a, i) => (
                    <li key={i} className="text-[13px] text-white/70 leading-snug">
                      <span className="mr-2 text-[9px] font-semibold uppercase tracking-wider text-amber-300/70">{a.tipo}</span>
                      <span className="font-serif italic">“{a.frase_hablada}”</span>
                      {a.texto_en_pantalla && (
                        <span className="mt-0.5 block text-[11px] text-white/35">Pantalla: {a.texto_en_pantalla}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {escenas?.length > 0 && (
        <div className="cs-rise rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5" style={rise(3)}>
          <Label className="text-violet-300/80">Guion por escenas</Label>
          <ol>
            {escenas.map((e, i) => (
              <li key={i} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/10 text-[10px] font-bold text-violet-200">
                    {i + 1}
                  </span>
                  {i < escenas.length - 1 && <span className="my-1 w-px flex-1 bg-white/10" />}
                </div>
                <div className="flex-1 pb-5">
                  <span className="mb-1.5 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white/45">
                    {e.tiempo}
                  </span>
                  <p className="text-[13px] leading-relaxed text-white/80">{e.accion}</p>
                  {e.dialogo && (
                    <p className="mt-2 border-l-2 border-violet-400/30 pl-3 font-serif text-[13px] italic text-white/55">“{e.dialogo}”</p>
                  )}
                  {e.texto_pantalla && (
                    <p className="mt-1.5 text-[11px] text-white/35">Texto en pantalla: {e.texto_pantalla}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {cta && (
        <div className="cs-rise rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4" style={rise(4)}>
          <Label className="text-emerald-300/80">Cierre</Label>
          <p className="text-[13px] leading-relaxed text-white/80">{cta}</p>
        </div>
      )}

      {errores_a_evitar?.length > 0 && (
        <div className="cs-rise px-1" style={rise(5)}>
          <Label className="text-red-300/70">Evitá esto</Label>
          <ul className="space-y-1.5">
            {errores_a_evitar.map((x, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-white/50">
                <span className="text-red-400/60">✕</span>{x}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.pregunta_seguimiento && (
        <p className="border-t border-white/[0.06] pt-3 text-[12px] italic text-violet-200/70">{plan.pregunta_seguimiento}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <CopyBtn primary label="Copiar plan" text={planToText(plan)} />
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
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ideas-intro-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-amber-400/20 bg-[#0d0d0f] p-8 md:p-10 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-amber-400/20 blur-[70px]" />
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 shadow-[0_0_30px_rgba(251,191,36,0.25)]">
            <Sparkles className="h-7 w-7 text-amber-300" />
          </div>
          <h2 id="ideas-intro-title" className="cs-gold mb-4 text-5xl font-black italic uppercase tracking-tighter">Nuevo</h2>
          <p className="text-sm leading-relaxed text-slate-300 md:text-[15px]">
            Convierte cualquier idea en una <span className="font-bold text-white">estrategia de video ganadora</span>.
            Contale tu idea, el formato o el objetivo de tu video, y VIRAX te arma al instante una estrategia
            completa: desde el gancho inicial hasta el guion paso a paso y el llamado a la acción.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Gancho', 'Guion paso a paso', 'Llamado a la acción'].map((chip) => (
              <span key={chip} className="rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-200/90">
                {chip}
              </span>
            ))}
          </div>
          <button
            onClick={onClose}
            className="mt-8 w-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-8 py-4 text-sm font-bold uppercase tracking-wider text-black shadow-[0_0_24px_rgba(251,191,36,0.35)] transition-all active:scale-95"
          >
            Entiendo →
          </button>
        </div>
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
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
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
      if (!isRenderable(parsed)) throw new Error('La IA devolvió un formato inesperado. Probá de nuevo.');
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
      className="fixed inset-0 z-[90] flex flex-col bg-[#050507] text-white"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {showIntro && <IdeasIntroModal onClose={dismissIntro} />}
      <style>{`
        @keyframes cs-shimmer { 0% { background-position: 200% center } 100% { background-position: -200% center } }
        @keyframes cs-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes cs-bar { 0%, 100% { transform: scaleY(0.35); opacity: .35 } 50% { transform: scaleY(1); opacity: 1 } }
        .cs-gold { background: linear-gradient(90deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: cs-shimmer 3s linear infinite; }
        .cs-rise { animation: cs-rise .5s cubic-bezier(.22,1,.36,1) both; }
        .cs-bar { width: 3px; border-radius: 2px; background: rgba(251,191,36,.7); transform-origin: bottom; animation: cs-bar 1.1s ease-in-out infinite; }
        .cs-skel { background: linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.1), rgba(255,255,255,.04)); background-size: 200% 100%; animation: cs-shimmer 1.6s linear infinite; }
        .cs-scroll::-webkit-scrollbar { width: 4px }
        .cs-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 10px }
        @media (prefers-reduced-motion: reduce) { .cs-rise, .cs-bar, .cs-skel, .cs-gold { animation: none } }
      `}</style>

      {/* Fondo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-amber-400/[0.07] blur-[110px]" />
        <div className="absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-emerald-500/[0.06] blur-[110px]" />
      </div>

      {/* Encabezado */}
      <header className="relative z-10 flex items-center gap-3 border-b border-white/[0.06] bg-black/40 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={onBack}
          aria-label="Volver"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] transition-colors hover:bg-white/[0.09] active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-white/60" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
            <Sparkles className="h-4 w-4 text-amber-300" /> Empieza a imaginar
          </h3>
          <p className="truncate text-[11px] text-white/35">Convertí tu idea en un plan listo para grabar</p>
        </div>
        {gems != null && (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
            <Gem className="h-3.5 w-3.5 text-emerald-400" fill="currentColor" />
            <span className="text-sm font-bold tabular-nums text-emerald-300">{gems}</span>
          </div>
        )}
      </header>

      {/* Plataforma */}
      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-3">
        <div className="inline-flex rounded-full border border-white/[0.07] bg-white/[0.04] p-1">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wide transition-all ${
                platform === p.id ? 'bg-amber-400/90 text-black' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mensajes */}
      <div ref={listRef} className="cs-scroll relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col space-y-6 px-4 py-5">
          {messages.length === 0 && !loading && (
            <div className="cs-rise my-auto flex flex-col items-center py-6 text-center">
              <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 shadow-[0_0_40px_rgba(251,191,36,0.2)]">
                <Sparkles className="h-7 w-7 text-amber-300" />
              </div>
              <h2 className="mb-2 text-[26px] font-bold leading-tight tracking-tight">¿Qué querés grabar hoy?</h2>
              <p className="mb-8 max-w-xs text-sm leading-relaxed text-white/45">
                Contame tu idea y te devuelvo el gancho, las escenas y el cierre.
              </p>
              <div className="flex w-full max-w-md flex-col gap-2.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.tag}
                    onClick={() => useSuggestion(s.text)}
                    className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5 text-left transition-all hover:border-amber-400/30 hover:bg-white/[0.05] active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/70">{s.tag}</p>
                      <p className="text-[13px] leading-snug text-white/65 group-hover:text-white/90">{s.text}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-white/20 transition-colors group-hover:text-amber-300" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} className="cs-rise flex justify-end">
                  <p className="max-w-[82%] whitespace-pre-wrap rounded-3xl rounded-br-md border border-emerald-400/20 bg-emerald-500/[0.12] px-4 py-3 text-[14px] leading-relaxed text-emerald-50/95">
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
                      {m.text && <p className="cs-rise mb-3 text-[14px] leading-relaxed text-white/70">{m.text}</p>}
                      <PlanCard plan={m.plan} />
                    </>
                  ) : (
                    <p
                      className={`cs-rise inline-block max-w-[92%] whitespace-pre-wrap rounded-3xl rounded-tl-md border px-4 py-3 text-[14px] leading-relaxed ${
                        m.isError
                          ? 'border-red-400/25 bg-red-500/[0.07] text-red-100/80'
                          : 'border-white/[0.07] bg-white/[0.03] text-white/80'
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
      <div className="relative z-10 px-4 pt-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto w-full max-w-2xl">
          {dictation.voiceError && <p className="mb-2 px-2 text-[11px] text-red-300/80">{dictation.voiceError}</p>}

          {limitReached ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-center">
              <p className="text-[12px] text-white/50">Esta conversación llegó a su límite. Empezá una nueva para seguir.</p>
              <button
                onClick={resetChat}
                className="flex items-center gap-2 rounded-full bg-amber-400/90 px-5 py-2.5 text-[12px] font-semibold text-black transition-all hover:bg-amber-300 active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Nueva conversación
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-2 pl-5 backdrop-blur-xl transition-all focus-within:border-amber-400/40 focus-within:shadow-[0_0_0_4px_rgba(251,191,36,0.07)]">
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
                  }}
                  placeholder={dictation.listening ? 'Escuchando…' : 'Describí tu idea, producto o público…'}
                  className="flex-1 resize-none border-none bg-transparent py-2.5 text-[16px] leading-snug text-white outline-none placeholder:text-white/25"
                />
                {dictation.supported && (
                  <button
                    type="button"
                    onClick={() => (dictation.listening ? dictation.stop() : dictation.start(input))}
                    disabled={loading}
                    aria-label={dictation.listening ? 'Detener dictado' : 'Dictar por voz'}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-30 ${
                      dictation.listening ? 'animate-pulse bg-red-500/20 text-red-300' : 'text-white/45 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {dictation.listening ? <Square className="h-4 w-4" /> : <Mic className="h-[18px] w-[18px]" />}
                  </button>
                )}
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  aria-label="Enviar"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.25)] transition-all active:scale-90 disabled:opacity-30 disabled:shadow-none"
                >
                  <Send className="h-[18px] w-[18px]" />
                </button>
              </div>

              <div className="flex items-center justify-between px-3 pt-2 text-[10px] text-white/30">
                <span className="flex items-center gap-1">
                  <Gem className="h-3 w-3 text-emerald-400/70" fill="currentColor" /> {messageCost} por mensaje
                </span>
                <span className="flex items-center gap-2">
                  Sesión {tokenPct}%
                  <span className="h-[3px] w-14 overflow-hidden rounded-full bg-white/[0.08]">
                    <span
                      className={`block h-full rounded-full transition-all duration-500 ${tokenPct >= 85 ? 'bg-red-400' : 'bg-amber-400/80'}`}
                      style={{ width: `${tokenPct}%` }}
                    />
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}