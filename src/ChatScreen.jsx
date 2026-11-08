import { ArrowLeft, ArrowUp, Check, Copy, Gem, Mic, RotateCcw, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { REVIEW_CONFIG } from './prompts.js';
import { runIdeaPipeline } from './viraxPipeline.js';

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

// ── Estilos (réplica exacta del diseño del artifact, con la paleta de la app) ──
// Todo va con prefijo "vx-" y dentro de .vx para no chocar con el CSS ni con Tailwind del resto de la app.
const CSS = `
.vx{--bg:#000;--card:#111111;--bubble:#1a1a1a;--ink:#f2f2f2;--mut:#8c8c8c;--line:rgba(255,255,255,.07);--ok:#34d399;--warn:#fbbf24;--bad:#f87171;
position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;height:100dvh;padding-top:env(safe-area-inset-top,0px);
background:var(--bg);color:var(--ink);line-height:1.6}
.vx *,.vx *::before,.vx *::after{box-sizing:border-box}
.vx button{font:inherit;color:inherit;cursor:pointer}
.vx-hd{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line)}
.vx-back{flex:none;width:36px;height:36px;border:0;background:none;border-radius:50%;display:grid;place-items:center;color:var(--mut)}
.vx-back:hover{background:var(--card);color:var(--ink)}
.vx-tabs{display:inline-flex;min-width:0;flex:1;max-width:280px;background:var(--card);border-radius:999px;padding:2px}
.vx-tabs button{flex:1;border:0;background:none;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:500;color:var(--mut)}
.vx-tabs button[aria-selected="true"]{background:var(--bubble);color:var(--ink)}
.vx-right{margin-left:auto;display:flex;align-items:center;gap:4px}
.vx-reset{border:0;background:none;color:var(--mut);font-size:13px;padding:6px 10px;border-radius:999px}
.vx-reset:hover{background:var(--card)}
.vx-gems{display:flex;align-items:center;gap:6px;background:var(--card);border-radius:999px;padding:5px 12px;font-size:13px}
.vx-list{flex:1;overflow-y:auto;padding:24px 16px}
.vx-list::-webkit-scrollbar{width:6px}.vx-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:10px}
.vx-col{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:26px;min-height:100%}
.vx-in{animation:vx-in .5s cubic-bezier(.22,1,.36,1) both;animation-delay:calc(min(var(--i,0),12)*70ms)}
@keyframes vx-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.vx-empty{margin:auto;text-align:center;padding:24px 0}
.vx-logo{width:68px;height:68px;border-radius:20px;background:var(--card);border:1px solid var(--line);display:grid;place-items:center;font-size:28px;font-weight:700;margin:0 auto 22px;overflow:hidden}
.vx-logo img{width:40px;height:40px;object-fit:contain}
.vx-h2{font-size:27px;margin:0;letter-spacing:-.02em;line-height:1.2;font-weight:700}
.vx-empty p{color:var(--mut);margin:8px auto 0;max-width:380px;font-size:16px}
.vx-sug{list-style:none;margin:30px auto 0;padding:0;max-width:430px;background:var(--card);border-radius:16px;overflow:hidden;text-align:left;border:1px solid var(--line)}
.vx-sug li+li{border-top:1px solid var(--line)}
.vx-sug button{display:block;width:100%;background:none;border:0;text-align:left;padding:13px 16px}
.vx-sug button:hover{background:var(--bubble)}
.vx-sug b{display:block;font-size:14px;font-weight:600}
.vx-sug span{font-size:13px;color:var(--mut)}
.vx-u{align-self:flex-end;max-width:85%;background:var(--bubble);padding:10px 16px;border-radius:22px;white-space:pre-wrap;font-size:16px}
.vx-b{display:flex;gap:12px;align-items:flex-start}
.vx-av{flex:none;margin-top:4px;width:28px;height:28px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;font-size:12px;font-weight:600;color:var(--mut);overflow:hidden}
.vx-av img{width:16px;height:16px;object-fit:contain}
.vx-bc{min-width:0;flex:1;font-size:16px}
.vx-err{color:var(--bad);margin:4px 0 0}
.vx-txt{margin:4px 0 0;white-space:pre-wrap}
.vx-dots{display:flex;gap:10px;align-items:center;color:var(--mut);font-size:13px;padding-top:6px}
.vx-dots i{width:6px;height:6px;border-radius:50%;background:var(--mut);animation:vx-d 1.2s infinite}
.vx-dots i:nth-child(2){animation-delay:.16s}.vx-dots i:nth-child(3){animation-delay:.32s}
@keyframes vx-d{0%,80%,100%{opacity:.25;transform:scale(.8)}40%{opacity:1;transform:none}}
.vx-think{margin:0;padding-top:6px;color:var(--mut);font-size:13px;line-height:1.6;white-space:pre-wrap}
.vx-plan{display:flex;flex-direction:column;gap:14px;font-size:16px}
.vx-plan h3{font-size:20px;line-height:1.3;margin:0;letter-spacing:-.01em;font-weight:700}
.vx-card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.vx-ch{display:flex;justify-content:space-between;gap:10px;padding:9px 16px;border-bottom:1px solid var(--line);font-size:14px;font-weight:600}
.vx-ch span{font-weight:400;font-size:12px;color:var(--mut);text-align:right}
.vx-pad{padding:14px 16px}
.vx-vt{display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:14px}
.vx-bars{display:flex;gap:4px}.vx-bars i{width:24px;height:6px;border-radius:3px;background:var(--line)}
.vx-ver p{margin:8px 0 0;color:var(--mut);font-size:14px}
.vx-mo{display:flex;gap:16px;padding:13px 16px}.vx-mo+.vx-mo{border-top:1px solid var(--line)}
.vx-mo .n{flex:none;width:56px}.vx-mo .n b{display:block;font-size:14px}.vx-mo .n span{font-size:12px;color:var(--mut)}
.vx-mo p{margin:0}
.vx-an div{padding:11px 16px}.vx-an div+div{border-top:1px solid var(--line)}
.vx-an small{display:block;font-size:12px;color:var(--mut)}
.vx-an p{margin:2px 0 0;font-size:14px;opacity:.85}
.vx-fq{color:var(--mut);margin:0}
.vx-acts{display:flex;gap:8px;flex-wrap:wrap}
.vx-cp{display:flex;align-items:center;gap:6px;border:1px solid var(--line);background:none;border-radius:999px;padding:7px 14px;font-size:12px;font-weight:500;color:var(--mut)}
.vx-cp:hover{background:var(--card);color:var(--ink)}
.vx-dock{padding:4px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom,0px))}
.vx-box{max-width:760px;margin:0 auto;display:flex;align-items:flex-end;gap:6px;background:var(--bubble);border-radius:28px;padding:8px 8px 8px 20px;border:1px solid var(--line)}
.vx-box:focus-within{border-color:var(--mut)}
.vx-box textarea{flex:1;resize:none;border:0;background:none;outline:0;color:var(--ink);font:inherit;font-size:16px;line-height:1.4;padding:9px 0;max-height:160px}
.vx-box textarea::placeholder{color:var(--mut)}
.vx-mic{flex:none;width:40px;height:40px;border-radius:50%;border:0;background:none;display:grid;place-items:center;color:var(--mut)}
.vx-mic:hover{color:var(--ink)}.vx-mic:disabled{opacity:.3;cursor:default}
.vx-mic.on{background:rgba(248,113,113,.18);color:var(--bad);animation:vx-pulse 1.4s infinite}
@keyframes vx-pulse{50%{opacity:.55}}
.vx-send{flex:none;width:40px;height:40px;border-radius:50%;border:0;background:var(--ok);color:#000;display:grid;place-items:center}
.vx-send:disabled{background:var(--line);color:var(--mut);cursor:default}
.vx-note{display:flex;justify-content:center;align-items:center;gap:10px;text-align:center;font-size:12px;color:var(--mut);margin:8px 0 0;flex-wrap:wrap}
.vx-note svg{vertical-align:-2px}
.vx-limit{max-width:760px;margin:0 auto;background:var(--bubble);border-radius:24px;padding:16px 20px;text-align:center;font-size:14px}
.vx-limit p{margin:0 0 12px}
.vx-limit button{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;background:#fff;color:#000;padding:10px 20px;font-size:13px;font-weight:600}
.vx-vmsg{color:var(--bad);font-size:12px;margin:0 0 8px;padding:0 12px;text-align:center}
@media (prefers-reduced-motion:reduce){.vx-in,.vx-dots i,.vx-mic.on{animation:none}}
`;

// ── Piezas de interfaz ───────────────────────────────────────
const Avatar = ({ logo }) => (
  <div className="vx-av vx-in">{logo ? <img src={logo} alt="VIRAX" /> : 'V'}</div>
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
    <button className="vx-cp" onClick={copy}>
      {ok ? <Check size={14} /> : <Copy size={14} />}
      {ok ? 'Copiado' : label}
    </button>
  );
}

// Pensamiento real de Gemini en streaming; puntitos + "Pensando…" mientras no llega nada.
function Thinking({ text, logo }) {
  const visible = text.length > MAX_THINKING_VISIBLE ? '…' + text.slice(-MAX_THINKING_VISIBLE) : text;
  return (
    <div className="vx-b">
      <Avatar logo={logo} />
      <div className="vx-bc">
        {visible ? (
          <p className="vx-think">{visible}</p>
        ) : (
          <div className="vx-dots"><i /><i /><i /><span>Pensando…</span></div>
        )}
      </div>
    </div>
  );
}

const LEVELS = {
  bajo:  { n: 1, color: 'var(--bad)' },
  medio: { n: 2, color: 'var(--warn)' },
  alto:  { n: 3, color: 'var(--ok)' },
};

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
  const nx = () => step(k++);

  return (
    <div className="vx-plan">
      {plan.titulo && <h3 className="vx-in" style={nx()}>{plan.titulo}</h3>}

      {veredicto && (
        <div className="vx-card vx-ver vx-in" style={{ ...nx(), padding: '14px 16px' }}>
          <div className="vx-vt">
            <span style={{ color: level.color }}>{veredicto.nivel ? `Potencial ${veredicto.nivel}` : 'Potencial'}</span>
            <span className="vx-bars" aria-hidden="true">
              {[1, 2, 3].map((n) => <i key={n} style={n <= level.n ? { background: level.color } : undefined} />)}
            </span>
          </div>
          {veredicto.razon && <p>{veredicto.razon}</p>}
        </div>
      )}

      {idea_principal && (
        <div className="vx-card vx-in" style={nx()}>
          <div className="vx-ch">Idea{tipo_hook && <span>Hook elegido: {tipo_hook}</span>}</div>
          <div className="vx-pad">{idea_principal}</div>
        </div>
      )}

      {ejecucion?.length > 0 && (
        <div className="vx-card vx-in" style={nx()}>
          <div className="vx-ch">Ejecución<span>{ejecucion.length} {ejecucion.length === 1 ? 'momento' : 'momentos'}</span></div>
          {ejecucion.map((e, i) => (
            <div className="vx-mo" key={i}>
              <div className="n"><b>{i + 1}</b>{e.momento && <span>{e.momento}</span>}</div>
              <p>{e.descripcion}</p>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="vx-card vx-an vx-in" style={nx()}>
          <div className="vx-ch">Análisis</div>
          {rows.map(([label, text]) => (
            <div key={label}><small>{label}</small><p>{text}</p></div>
          ))}
        </div>
      )}

      {plan.pregunta_seguimiento && <p className="vx-fq vx-in" style={nx()}>{plan.pregunta_seguimiento}</p>}

      <div className="vx-acts vx-in" style={nx()}>
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
      <div className="w-full max-w-sm rounded-2xl bg-[#141414] p-6 shadow-2xl">
        <h2 id="ideas-intro-title" className="mb-2 text-lg font-semibold text-white">
          Convierte tu idea en un video
        </h2>
        <p className="text-[14px] leading-relaxed text-neutral-300">
          Cuéntale a VIRAX qué quieres grabar: elige el tipo de hook que mejor funciona y te arma la idea y la ejecución.
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
    <div className="vx">
      <style>{CSS}</style>
      {showIntro && <IdeasIntroModal onClose={dismissIntro} />}

      {/* Encabezado */}
      <header className="vx-hd">
        <button className="vx-back" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} /></button>
        <div className="vx-tabs" role="tablist" aria-label="Plataforma">
          {PLATFORMS.map((p) => (
            <button key={p.id} role="tab" aria-selected={platform === p.id} onClick={() => setPlatform(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="vx-right">
          <button className="vx-reset" onClick={resetChat}>Nuevo chat</button>
          {gems != null && (
            <div className="vx-gems">
              <Gem size={14} fill="currentColor" style={{ color: 'var(--ok)' }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{gems}</span>
            </div>
          )}
        </div>
      </header>

      {/* Mensajes */}
      <div className="vx-list" ref={listRef}>
        <div className="vx-col">
          {isEmpty && (
            <div className="vx-empty">
              <div className="vx-logo vx-in">
                {userIcon ? <img src={userIcon} alt="VIRAX" /> : 'V'}
              </div>
              <h2 className="vx-h2 vx-in" style={step(1)}>¿Qué querés grabar hoy?</h2>
              <p className="vx-in" style={step(2)}>Contame tu idea: VIRAX elige el tipo de hook y te arma el plan.</p>
              <ul className="vx-sug vx-in" style={step(3)}>
                {SUGGESTIONS.map((s) => (
                  <li key={s.label}>
                    <button onClick={() => pickSuggestion(s.text)}>
                      <b>{s.label}</b>
                      <span>{s.hint}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === 'user') return <div key={i} className="vx-u vx-in">{m.text}</div>;
            const isPlan = Boolean(m.plan?.idea_principal || m.plan?.ejecucion?.length);
            return (
              <div key={i} className="vx-b">
                <Avatar logo={userIcon} />
                <div className="vx-bc">
                  {isPlan ? (
                    <PlanCard plan={m.plan} />
                  ) : (
                    <p className={`vx-txt vx-in ${m.isError ? 'vx-err' : ''}`}>{m.text}</p>
                  )}
                </div>
              </div>
            );
          })}

          {loading && <Thinking text={thinkingText} logo={userIcon} />}
        </div>
      </div>

      {/* Cuadro de escritura */}
      <div className="vx-dock">
        {dictation.voiceError && <p className="vx-vmsg">{dictation.voiceError}</p>}

        {limitReached ? (
          <div className="vx-limit">
            <p>Esta conversación llegó a su límite. Empieza una nueva para seguir.</p>
            <button onClick={resetChat}><RotateCcw size={14} /> Nueva conversación</button>
          </div>
        ) : (
          <>
            <div className="vx-box">
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
              />
              {dictation.supported && (
                <button
                  type="button"
                  className={`vx-mic ${dictation.listening ? 'on' : ''}`}
                  onClick={() => (dictation.listening ? dictation.stop() : dictation.start(input))}
                  disabled={loading}
                  aria-label={dictation.listening ? 'Detener dictado' : 'Dictar por voz'}
                >
                  {dictation.listening ? <Square size={16} /> : <Mic size={20} />}
                </button>
              )}
              <button className="vx-send" onClick={send} disabled={loading || !input.trim()} aria-label="Enviar">
                <ArrowUp size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="vx-note">
              {isEmpty && <span>VIRAX elige por vos el tipo de hook y arma el plan.</span>}
              <span><Gem size={12} fill="currentColor" /> {messageCost} por mensaje</span>
              <span style={tokenPct >= 85 ? { color: 'var(--bad)' } : undefined}>Sesión {tokenPct}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}