import { ArrowLeft, Check, Copy, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { REVIEW_CONFIG, buildIdeaStructurePrompt } from './prompts.js';

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'reels',  label: 'Reels'  },
  { id: 'shorts', label: 'Shorts' },
];

const SUGGESTIONS = [
  'Quiero vender un producto de skincare con un video corto',
  'Tengo una inmobiliaria y no sé cómo mostrar una propiedad',
  'Idea para promocionar mi restaurante sin parecer anuncio',
];

const MAX_HISTORY_TURNS = 6;
const MAX_OUTPUT_TOKENS = 8192;      // el razonamiento también consume de este tope
const SESSION_TOKEN_LIMIT = 30000;   // tope total por sesión de chat


// ── Helpers (locales para evitar import circular con App.jsx) ──
const parsePlan = (raw) => {
  if (!raw) return null;
  const s = raw.replace(/```json|```/g, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
};

const extractText = (data) => {
  if (data?.error) throw new Error(`${data.error} ${data.message ?? ''}`);
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = parts?.map((p) => p.text).filter(Boolean).join('') ?? data?.text;
  if (!text) throw new Error(data?.promptFeedback?.blockReason ?? 'Respuesta vacía de la IA');
  return text;
};

const planToText = (p) => {
  if (!p) return '';
  const L = [];
  if (p.titulo) L.push(p.titulo, '');
  if (p.resumen) L.push(p.resumen, '');
  if (p.hook) {
    L.push('HOOK');
    if (p.hook.frase_hablada) L.push(`Dicho: ${p.hook.frase_hablada}`);
    if (p.hook.texto_en_pantalla) L.push(`Pantalla: ${p.hook.texto_en_pantalla}`);
    if (p.hook.visual) L.push(`Visual: ${p.hook.visual}`);
    L.push('');
  }
  if (p.escenas?.length) {
    L.push('ESCENAS');
    p.escenas.forEach((e, i) =>
      L.push(`${i + 1}. [${e.tiempo}] ${e.accion}${e.dialogo ? ` — "${e.dialogo}"` : ''}`));
    L.push('');
  }
  if (p.cta) L.push(`CTA: ${p.cta}`, '');
  if (p.errores_a_evitar?.length) L.push('EVITÁ', ...p.errores_a_evitar.map((x) => `- ${x}`), '');
  if (p.checklist_grabacion?.length) L.push('CHECKLIST', ...p.checklist_grabacion.map((x) => `- ${x}`));
  return L.join('\n').trim();
};

// ── UI atoms ──
const SectionLabel = ({ children, color = 'text-emerald-400' }) => (
  <p className={`text-[10px] font-black uppercase tracking-[0.25em] mb-3 ${color}`}>{children}</p>
);

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1800); })}
      className="self-start flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
    >
      {ok ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      <span className={ok ? 'text-green-400' : ''}>{ok ? 'Copiado' : 'Copiar plan'}</span>
    </button>
  );
}

function Thinking() {
  return (
    <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <BotAvatar />
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3 flex items-center gap-3">
        <div className="flex items-end gap-[3px] h-4">
          {[5, 9, 14, 9, 5].map((h, i) => (
            <span key={i} className="cs-bar" style={{ height: h, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <span className="font-mono text-[9.5px] tracking-[0.12em] uppercase text-white/30">
          Estructurando tu idea
        </span>
      </div>
    </div>
  );
}

const BotAvatar = () => (
  <div className="w-7 h-7 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
    <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
  </div>
);

const UserAvatar = ({ src }) => (
  <div className="w-7 h-7 rounded-full bg-[#0f0f18] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
    <img src={src} alt="Tú" className="w-full h-full object-cover" />
  </div>
);

function PlanCard({ plan }) {
  const { hook, escenas, cta, errores_a_evitar, checklist_grabacion } = plan;
  return (
    <div className="space-y-5">
      {plan.titulo && (
        <h4 className="text-lg font-black italic uppercase tracking-tighter text-white leading-tight">
          {plan.titulo}
        </h4>
      )}
      {plan.resumen && <p className="text-white/60 text-[13px] leading-relaxed">{plan.resumen}</p>}

      {hook && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
          <SectionLabel>Hook · 0–3s</SectionLabel>
          {hook.frase_hablada && (
            <p className="text-white font-bold text-[15px] leading-snug mb-2">"{hook.frase_hablada}"</p>
          )}
          {hook.texto_en_pantalla && (
            <p className="text-[12px] text-white/50 mb-1">
              <span className="text-emerald-400 font-black uppercase text-[10px] tracking-wider mr-2">Pantalla</span>
              {hook.texto_en_pantalla}
            </p>
          )}
          {hook.visual && (
            <p className="text-[12px] text-white/50 mb-1">
              <span className="text-emerald-400 font-black uppercase text-[10px] tracking-wider mr-2">Visual</span>
              {hook.visual}
            </p>
          )}
          {hook.por_que_funciona && (
            <p className="text-[11px] italic text-white/35 mt-2">{hook.por_que_funciona}</p>
          )}
        </div>
      )}

      {escenas?.length > 0 && (
        <div>
          <SectionLabel color="text-purple-300">Guion por escenas</SectionLabel>
          <ol className="space-y-2.5">
            {escenas.map((e, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="w-6 h-6 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                  {i < escenas.length - 1 && <span className="flex-1 w-px bg-white/10 mt-1" />}
                </div>
                <div className="pb-2 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/30">{e.tiempo}</p>
                  <p className="text-[13px] text-white/80 leading-snug">{e.accion}</p>
                  {e.dialogo && <p className="text-[12px] italic text-white/50 mt-1">"{e.dialogo}"</p>}
                  {e.texto_pantalla && (
                    <p className="text-[11px] text-white/35 mt-1">Texto: {e.texto_pantalla}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {cta && (
        <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/[0.05] p-4">
          <SectionLabel color="text-yellow-400">Cierre / CTA</SectionLabel>
          <p className="text-[13px] text-white/80 leading-snug">{cta}</p>
        </div>
      )}

      {errores_a_evitar?.length > 0 && (
        <div>
          <SectionLabel color="text-red-400">Evitá esto</SectionLabel>
          <ul className="space-y-1.5">
            {errores_a_evitar.map((x, i) => (
              <li key={i} className="text-[12px] text-white/55 flex gap-2">
                <span className="text-red-400/70">✕</span>{x}
              </li>
            ))}
          </ul>
        </div>
      )}

      {checklist_grabacion?.length > 0 && (
        <div>
          <SectionLabel color="text-slate-400">Checklist de grabación</SectionLabel>
          <ul className="space-y-1.5">
            {checklist_grabacion.map((x, i) => (
              <li key={i} className="text-[12px] text-white/55 flex gap-2">
                <span className="text-emerald-400/70">✓</span>{x}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.pregunta_seguimiento && (
        <p className="text-[12px] text-purple-300/80 italic border-t border-white/5 pt-3">
          {plan.pregunta_seguimiento}
        </p>
      )}
    </div>
  );
}

// ── Pantalla principal ──
export default function ChatScreen({ supabase, userIcon, onBack, onBeforeSend }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState('tiktok');
  const [tokensUsed, setTokensUsed] = useState(0);
  const limitReached = tokensUsed >= SESSION_TOKEN_LIMIT;
  const tokenPct = Math.min(100, Math.round((tokensUsed / SESSION_TOKEN_LIMIT) * 100));
  const endRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  const send = async (override) => {
  const content = (override ?? input).trim();
  if (!content || loading || limitReached) return;

  // El tope se chequea ANTES de cobrar gemas
  if (onBeforeSend) {
    const ok = await onBeforeSend();
    if (!ok) return;
  }

  const next = [...messages, { role: 'user', text: content }];
  setMessages(next);
  setInput('');
  setLoading(true);

  try {
    const history = next.slice(0, -1).slice(-MAX_HISTORY_TURNS).map((m) => ({
      role: m.role,
      text: m.role === 'bot' ? (m.plan ? planToText(m.plan) : m.text) : m.text,
    }));

    const prompt = buildIdeaStructurePrompt({ idea: content, history, platform });
    const cfg = REVIEW_CONFIG.sintesis;

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: prompt,
        model: cfg.model,
        thinkingLevel: 'low',              // deja presupuesto para el JSON
        temperature: 0.7,
        expectsJson: true,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });

    if (error) {
      let body = '';
      try { body = await error.context?.text?.(); } catch (_) {}
      throw new Error(body || error.message);
    }

    // ── Conteo de tokens (usa el dato real de Gemini; si no viene, estima) ──
    const candidate = data?.candidates?.[0];
    const outText = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '';
    const used = data?.usageMetadata?.totalTokenCount
      ?? Math.ceil((prompt.length + outText.length) / 4);
    setTokensUsed((t) => t + used);

    // ── Respuesta cortada por falta de tokens ──
    if (candidate?.finishReason === 'MAX_TOKENS' && !outText) {
      throw new Error('La respuesta se cortó por longitud. Probá con una idea más puntual.');
    }

    const raw = extractText(data);
    const parsed = parsePlan(raw);

    setMessages([...next, parsed
      ? { role: 'bot', plan: parsed, text: parsed.mensaje ?? '' }
      : { role: 'bot', text: raw.replace(/```json|```/g, '').trim() }]);
  } catch (err) {
    console.error('ChatScreen error:', err);
    setMessages([...next, { role: 'bot', text: `Error: ${err.message || 'Se cortó la conexión. Intentá de nuevo.'}`, isError: true }]);
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-500">
      <style>{`
        @keyframes cs-bar { 0%,100% { transform: scaleY(.35); opacity:.35 } 50% { transform: scaleY(1); opacity:1 } }
        .cs-bar { width:2.5px; border-radius:2px; background: rgba(250,204,21,.55); animation: cs-bar 1.1s ease-in-out infinite; }
        .cs-scroll::-webkit-scrollbar { width: 4px; }
        .cs-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 10px; }
      `}</style>

      <div className="bg-[#050507] border border-white/[0.07] rounded-[3rem] overflow-hidden flex flex-col h-[78vh] min-h-[520px] shadow-2xl">

        {/* HEADER */}
        <div className="px-5 py-4 border-b border-white/[0.06] bg-[#0a0a0f] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-white/50" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <h3 className="font-black uppercase tracking-widest text-xs text-white/90">Empieza a imaginar</h3>
              </div>
              <p className="text-[10px] text-white/30 tracking-widest uppercase truncate">Creá tu idea antes de publicar</p>
            </div>
          </div>

          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.07] rounded-full p-1">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all
                  ${platform === p.id ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/30 hover:text-white/60'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* MENSAJES */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 cs-scroll">
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-5">
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </div>
              <p className="text-xl font-black italic uppercase tracking-tighter text-white mb-2">Contame tu idea</p>
              <p className="text-slate-500 text-sm max-w-sm mb-6">
                La IA la convierte en un plan listo para grabar: hook, escenas, cierre y checklist.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-md">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-[12px] text-slate-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.07] hover:border-yellow-500/30 rounded-2xl px-4 py-3 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'user' ? <UserAvatar src={userIcon} /> : <BotAvatar />}
              <div className={`flex flex-col gap-1 ${m.plan ? 'w-full max-w-[92%]' : 'max-w-[78%]'}`}>
                <div className={`px-4 py-3 text-sm leading-relaxed font-medium
                  ${m.role === 'user'
                    ? 'bg-emerald-600/15 border border-emerald-500/20 rounded-sm rounded-tl-2xl rounded-bl-2xl rounded-br-2xl text-emerald-100/90'
                    : m.isError
                      ? 'bg-red-500/[0.07] border border-red-500/25 rounded-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl text-red-200/80'
                      : 'bg-white/[0.03] border border-white/[0.07] rounded-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl text-white/80'}`}
                >
                  {m.plan ? (
                    <>
                      {m.text && <p className="mb-4 text-white/70">{m.text}</p>}
                      {(m.plan.hook || m.plan.escenas) && <PlanCard plan={m.plan} />}
                      {!m.plan.hook && !m.plan.escenas && m.plan.pregunta_seguimiento && (
                        <p>{m.plan.pregunta_seguimiento}</p>
                      )}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}
                </div>
                {m.plan?.hook && <CopyBtn text={planToText(m.plan)} />}
              </div>
            </div>
          ))}

          {loading && <Thinking />}
          <div ref={endRef} />
        </div>

        {/* INPUT */}
        <div className="p-4 bg-black/50 border-t border-white/10">
          <div className="mb-3 px-1">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1.5">
              <span className="text-white/25">Capacidad de la sesión</span>
              <span className={tokenPct >= 85 ? 'text-red-400' : 'text-white/25'}>{tokenPct}%</span>
            </div>
            <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${tokenPct >= 85 ? 'bg-red-400' : 'bg-yellow-400'}`}
                style={{ width: `${tokenPct}%` }}
              />
            </div>
          </div>

          {limitReached ? (
            <div className="flex items-center justify-center gap-2 py-3 px-5 bg-white/[0.03] border border-white/[0.07] rounded-2xl">
              <span className="text-lg">🔒</span>
              <p className="text-[11px] font-black uppercase tracking-widest text-white/30">
                Límite de la sesión alcanzado
              </p>
            </div>
          ) : (
            <div className="bg-white/5 rounded-[1.75rem] p-2 pl-5 flex items-end gap-2">
              <textarea
                ref={taRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="Describí tu idea, producto o público..."
                className="bg-transparent border-none outline-none flex-1 text-sm text-white py-2.5 italic resize-none placeholder-slate-600"
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="bg-yellow-500 hover:bg-yellow-400 text-black disabled:opacity-30 p-3 rounded-full transition-all active:scale-90"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}