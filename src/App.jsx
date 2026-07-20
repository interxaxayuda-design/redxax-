import {
  BrainCircuit,
  FileText, Gem,
  MessageSquare, Microscope, RotateCcw, Send,
  Target, TrendingUp,
  Upload,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import logo from './logo.png';
import { buildChatContextBlock, buildChatSystemPrompt } from './prompt';
import {
  REVIEW_CONFIG,
  buildDesarrolloAnalysisPrompt,
  buildFinalReviewPrompt,
  buildHookAnalysisPrompt,
  buildNicheSuggestionPrompt,
} from './prompts.js';

import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://mvmilbpraefwprexgnpz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12bWlsYnByYWVmd3ByZXhnbnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjA1MzcsImV4cCI6MjA4ODUzNjUzN30.xH72_trpTpJhtZJw0BXI-Sewp9vnbBigKhmVBNI4wso';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);


const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

const PLATFORMS = [
  { id: 'tiktok',   label: 'TikTok',               emoji: '🎵' }, 
  { id: 'reels',    label: 'Instagram Reels',        emoji: '📸' },
  { id: 'shorts',   label: 'YouTube Shorts',         emoji: '▶️' }, 
  { id: 'all',      label: 'Todas las plataformas',  emoji: '🌐' },
];

const FOLLOWER_RANGES = [
  { id: 'new',   label: 'Cuenta nueva',    range: '0 – 1K',      emoji: '🌱' },
  { id: 'small', label: 'Cuenta pequeña',  range: '1K – 10K',    emoji: '📈' },
  { id: 'mid',   label: 'Cuenta media',    range: '10K – 100K',  emoji: '🔥' },
  { id: 'large', label: 'Cuenta grande',   range: '100K – 500K', emoji: '⚡' }, //const researchResponse = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
  { id: 'mega',  label: 'Mega cuenta',     range: '500K+',       emoji: '👑' },
];

export function extractGeminiText(data) {//const flagsDeterministic = {
  if (data?.error) {
    throw new Error(`Edge Function error: ${data.error} — ${data.message ?? data.raw ?? ''}`);
  }
  if (!data?.candidates || data.candidates.length === 0) {
    const reason = data?.promptFeedback?.blockReason ?? 'Sin candidates en la respuesta';
    throw new Error(`Gemini no devolvió candidates: ${reason}`);
  }
  const raw = data.candidates[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('La respuesta de Gemini no contiene texto en parts[0]');
  return raw.replace(/```json|```/g, '').trim();
}

const GEM_PACKAGES = [
  { id: 'starter', gems: 500,  price: 3,  label: 'Starter', analyses: '5 análisis',  popular: false },
  { id: 'pro',     gems: 1000, price: 6,  label: 'Pro',     analyses: '10 análisis', popular: true  },
  { id: 'elite',   gems: 6000, price: 15, label: 'Elite',   analyses: '60 análisis', popular: false },
];

export const safeParseJSON = (rawText, context = '') => {
  const aggressiveClean = (str) => {
    let s = str.replace(/```json|```/g, '').trim();
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No se encontró objeto JSON');
    s = s.slice(start, end + 1);

    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i]; //const perceptionParaScoring = {
      if (escape) {
        if (['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(ch)) {
          result += ch;
        } else {
          result += ch;
        }
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) { result += ch; escape = true; continue; }
      if (ch === '"') {
        if (!inString) { inString = true; result += ch; }
        else {
          let j = i + 1;
          while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j++;
          const next = s[j];
          if ([',', '}', ']', ':'].includes(next) || j >= s.length) {
            inString = false; result += ch;
          } else {
            result += "'";
          }
        }
        continue;
      }
      if (inString) {
        if (ch === '\n' || ch === '\r') { result += ' '; continue; }
        if (ch === '\t') { result += ' '; continue; }
      }
      result += ch;
    }
    return result;
  };

   
  try { return JSON.parse(aggressiveClean(rawText)); }
  catch (err1) { console.warn(`[${context}] Intento 1 falló:`, err1.message); }



  try {
    const nuclear = rawText.replace(/```json|```/g, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim();
    const start = nuclear.indexOf('{');
    const end = nuclear.lastIndexOf('}');
    if (start !== -1 && end !== -1) return JSON.parse(nuclear.slice(start, end + 1));
  } catch (err2) { console.warn(`[${context}] Intento 2 falló:`, err2.message); }

  // Intento 3: reparar JSON truncado — cerrar strings/arrays/objects abiertos
  try {
    let s = rawText.replace(/```json|```/g, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim();
    const start = s.indexOf('{');
    if (start !== -1) s = s.slice(start);

    // Remover coma trailing antes de cerrar
    s = s.replace(/,\s*([\]}])/g, '$1');

    // Contar llaves/corchetes para cerrar lo que falta
    let opens = 0, opensArr = 0, inStr = false, esc = false;
    for (const ch of s) {
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') opens++;
      if (ch === '}') opens--;
      if (ch === '[') opensArr++;
      if (ch === ']') opensArr--;
    }
    // Cerrar lo que quedó abierto
    let closing = '';
    for (let i = 0; i < opensArr; i++) closing += ']';
    for (let i = 0; i < opens; i++) closing += '}';
    const repaired = s.trimEnd().replace(/,\s*$/, '') + closing;
    return JSON.parse(repaired);
  } catch (err3) { console.warn(`[${context}] Intento 3 (reparación) falló:`, err3.message); }

  throw new Error(`JSON malformado. Preview: "${rawText.slice(0, 80)}..."`);
};






const NivelBadge = ({ score, size = 'lg' }) => {
  const nivel = getNivel(score);
  const isExcelente = nivel.cls === 'excelente';
  const padding = size === 'lg' ? 'px-5 py-2 text-[13px]' : 'px-3 py-1.5 text-[11px]';
  return (
    <span className={`virax-badge vb-${nivel.cls} ${padding}`}>
      <span className="vb-shimmer" />
      {isExcelente && <>
        <span className="vb-spark" style={{ '--tx':'-8px','--ty':'-10px', top:'30%', left:'10%',  animation:'spark 2.1s 0.1s ease-in-out infinite' }} />
        <span className="vb-spark" style={{ '--tx':'10px','--ty':'-12px', top:'20%', right:'15%', animation:'spark 2.1s 0.6s ease-in-out infinite' }} />
        <span className="vb-spark" style={{ '--tx':'-6px','--ty':'8px',   bottom:'25%', left:'20%', animation:'spark 2.1s 1.1s ease-in-out infinite' }} />
        <span className="vb-spark" style={{ '--tx':'8px', '--ty':'10px',  bottom:'20%', right:'10%',animation:'spark 2.1s 0.3s ease-in-out infinite' }} />
      </>}
      {nivel.label}
    </span>
  );
};


const ShinyCard = ({ children, className = '', tilt }) => {
  const sheenX = (((tilt?.x ?? 0) + 1) / 2) * 100;
  const sheenY = (((tilt?.y ?? 0) + 1) / 2) * 100;

  return (
    <div className={`relative ${className}`}>
      {/* Borde con reflejo — sigue exactamente la forma de la tarjeta */}
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-all duration-75"
        style={{
          borderRadius: 'inherit',
          padding: '1px',
          background: `radial-gradient(circle at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 40%, transparent 70%)`,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      {children}
    </div>
  );
};

function renderBotText(text) {
  if (!text) return null;
  return text.split('\n').map((line, lineIdx) => {
    // ── Detecta subtítulo tipo "## Texto" ──
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      return (
        <p key={lineIdx} className={`text-base font-black italic text-purple-300 uppercase tracking-wide ${lineIdx > 0 ? 'mt-4 mb-1' : 'mb-1'}`}>
          {headerMatch[1]}
        </p>
      );
    }

    // ── Línea normal (con soporte de negrita, como ya tenías) ──
    return (
      <p key={lineIdx} className={lineIdx > 0 ? 'mt-2' : ''}>
        {line.split(/(\*\*[^*]+\*\*)/).map((part, partIdx) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={partIdx} className="text-white font-black">{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

const PHRASES = [
  'Analizando consulta',
  'Procesando solicitud',
  'Iniciando análisis',
  'Evaluando parámetros',
];

// Reemplazá el TypingIndicator completo por este:
function TypingIndicator({ logo }) {
  const [displayed, setDisplayed] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const phrase = PHRASES[phraseIdx % PHRASES.length];
    if (charIdx < phrase.length) {
      timerRef.current = setTimeout(() => setCharIdx(i => i + 1), 55);
    } else {
      timerRef.current = setTimeout(() => {
        setCharIdx(0);
        setPhraseIdx(i => i + 1);
      }, 900);
    }
    setDisplayed(phrase.substring(0, charIdx));
    return () => clearTimeout(timerRef.current);
  }, [charIdx, phraseIdx]);

  return (
    <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-7 h-7 rounded-full bg-[#0f0f18] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
        <img src={logo} alt="VIRAX" className="w-5 h-5 object-contain" />
      </div>
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3 flex items-center gap-3">
        <div className="flex items-end gap-[3px] h-4">
          {[
            { h: 5,  delay: '0s'    },
            { h: 9,  delay: '0.15s' },
            { h: 14, delay: '0.3s'  },
            { h: 9,  delay: '0.45s' },
            { h: 5,  delay: '0.6s'  },
          ].map(({ h, delay }, i) => (
            <span key={i} className="virax-bar" style={{ height: h, animationDelay: delay }} />
          ))}
        </div>
        <span className="font-mono text-[9.5px] tracking-[0.12em] uppercase text-white/30">
          {displayed}
          <span className="virax-cursor" />
        </span>
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="self-start flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all duration-200"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-400">Copiado</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copiar</span>
        </>
      )}
    </button>
  );
}

function DottedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf, t = 0;
    const spacing = 26;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      t += 0.004;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cols = Math.ceil(canvas.width / spacing) + 1;
      const rows = Math.ceil(canvas.height / spacing) + 1;

      // Centro que se mueve lento y de forma orgánica
      const cx = canvas.width * (0.5 + 0.35 * Math.sin(t * 0.7));
      const cy = canvas.height * (0.5 + 0.35 * Math.cos(t * 0.5));
      const maxDist = Math.hypot(canvas.width, canvas.height) * 0.5;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing, y = j * spacing;
          const dist = Math.hypot(x - cx, y - cy);
          const proximity = Math.max(0, 1 - dist / maxDist);
          const radius = 0.6 + proximity * 1.8;
          const alpha = 0.04 + proximity * 0.22;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`; // combina con tu paleta purple
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

function MorphingTitle({ phrases, interval = 3000, className = '' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef({ particles: [], phraseIndex: 0, phase: 'idle', phaseStart: 0 });

  const sampleTextPoints = (text, width, height) => {
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const octx = off.getContext('2d');
    octx.fillStyle = '#fff';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';

    let fontSize = height * 0.5;
    octx.font = `900 italic ${fontSize}px sans-serif`;
    while (octx.measureText(text).width > width * 0.94 && fontSize > 10) {
      fontSize -= 2;
      octx.font = `900 italic ${fontSize}px sans-serif`;
    }
    octx.fillText(text, width / 2, height / 2);

    const data = octx.getImageData(0, 0, width, height).data;
    const step = 4; // ↓ más partículas (más costo) | ↑ menos partículas (más performance)
    const points = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (data[(y * width + x) * 4 + 3] > 128) points.push({ x, y });
      }
    }
    return points;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');

    const buildParticlesFor = (index, immediate) => {
      const points = sampleTextPoints(phrases[index], canvas.width, canvas.height);
      stateRef.current.particles = points.map(p => ({
        x: immediate ? p.x : p.x + (Math.random() - 0.5) * 300,
        y: immediate ? p.y : p.y + (Math.random() - 0.5) * 300,
        tx: p.x, ty: p.y, ox: p.x, oy: p.y,
        r: 1 + Math.random() * 1.4,
      }));
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      buildParticlesFor(stateRef.current.phraseIndex, true);
    };
    resize();
    window.addEventListener('resize', resize);

    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const easeIn = t => t * t * t;
    let raf;

    const loop = (now) => {
      const st = stateRef.current;
      if (!st.phaseStart) st.phaseStart = now;
      const elapsed = now - st.phaseStart;

      if (st.phase === 'idle' && elapsed > interval) { st.phase = 'out'; st.phaseStart = now; }
      else if (st.phase === 'out' && elapsed > 500) {
        st.phraseIndex = (st.phraseIndex + 1) % phrases.length;
        buildParticlesFor(st.phraseIndex, false);
        st.phase = 'in'; st.phaseStart = now;
      } else if (st.phase === 'in' && elapsed > 700) { st.phase = 'idle'; st.phaseStart = now; }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const outT = st.phase === 'out' ? Math.min(elapsed / 500, 1) : 0;
      const inT = st.phase === 'in' ? Math.min(elapsed / 700, 1) : 1;

      st.particles.forEach(p => {
        let x, y, alpha, blur;
        if (st.phase === 'out') {
          const t = easeOut(outT);
          x = p.ox + (p.ox - canvas.width / 2) * t * 0.6;
          y = p.oy + (p.oy - canvas.height / 2) * t * 0.6;
          alpha = 1 - t; blur = t * 14;
        } else if (st.phase === 'in') {
          const t = easeIn(inT);
          x = p.x + (p.tx - p.x) * t;
          y = p.y + (p.ty - p.y) * t;
          alpha = t; blur = (1 - t) * 14;
        } else { x = p.tx; y = p.ty; alpha = 1; blur = 0; }

        ctx.globalAlpha = alpha;
        ctx.filter = blur > 0.5 ? `blur(${blur}px)` : 'none';
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [phrases, interval]);

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', height: '160px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

const App = () => {
  const [step, setStep] = useState('upload');
  const [analysisMode, setAnalysisMode] = useState('video');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [selectedFollowerRange, setSelectedFollowerRange] = useState(null);
  const [selectedObjetivo, setSelectedObjetivo] = useState('ventas');
  const [selectedNicho, setSelectedNicho] = useState('producto_fisico');
  const [pendingVideoFile, setPendingVideoFile] = useState(null);
  const [pendingVideoUrl, setPendingVideoUrl] = useState(null); 
  const [scriptText, setScriptText] = useState('');
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);
  const [history, setHistory] = useState([]);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [aiResult, setAiResult] = useState(null);
  const [userCount, setUserCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [statusText, setStatusText] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [gems, setGems] = useState(null);
  const [showGemStore, setShowGemStore] = useState(false);
  const [gemError, setGemError] = useState(null);
  const [uploadedVideoPath, setUploadedVideoPath] = useState(null);
  const [uploadedVideoMime, setUploadedVideoMime] = useState(null);

  // ← DESPUÉS de todos los useState
  const CHAT_MESSAGE_LIMIT = 20;
  const chatLimitReached = chatMessages.length >= CHAT_MESSAGE_LIMIT;

  const countWords = (str) => str.trim() === '' ? 0 : str.trim().split(/\s+/).length;
  const CHAT_WORD_LIMIT = 1000;
  const toggleStep = (index) => {
    setCompletedSteps(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };
  
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
useEffect(() => {
  const handleOrientation = (e) => {
    const x = Math.min(Math.max(e.gamma / 90, -1), 1);
    const y = Math.min(Math.max(e.beta / 90, -1), 1);   //captureFrames
    setTilt({ x, y });
  };
  window.addEventListener('deviceorientation', handleOrientation);                 //const [selectedObjetivo, setSelectedObjetivo] = useState('ventas');
  return () => window.removeEventListener('deviceorientation', handleOrientation);
}, []);

  const chatEndRef = useRef(null);
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });   //<header className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto border-b border-white/5 backdrop-blur-md">

  useEffect(() => {
    if (showChat) scrollToBottom();    //detectCutRate
  }, [chatMessages, isTyping]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      window.history.replaceState({}, '', '/');
      const reloadGems = async () => {
        const userId = localStorage.getItem('redxax_user_id');
        await new Promise(r => setTimeout(r, 4000));
        const { data } = await supabase.functions.invoke('get-gems', { body: { userId } });
        if (data?.balance !== undefined) {
          setGems(data.balance);
          alert('✅ ¡Pago exitoso! Tus gemas fueron acreditadas.');
        } else {
          alert('⏳ Pago procesado. Si las gemas no aparecen, recargá la página.');
        } //const points = [
      };
      reloadGems();
    }
  }, []);

  useEffect(() => {
    const initUser = async () => {
      try {
        const storedUserId = localStorage.getItem('redxax_user_id');
        const isNewUser = !storedUserId;
        const userId = storedUserId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (isNewUser) localStorage.setItem('redxax_user_id', userId);

        const { data: gemsData, error: gemsError } = await supabase.functions.invoke('get-gems', { body: { userId } });
        setGems(!gemsError && gemsData?.balance !== undefined ? gemsData.balance : 150);

        const { data: historyData } = await supabase
          .from('analysis_history').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(20);
        if (historyData) setHistory(historyData);

        const { error: upsertError } = await supabase
          .from('user_visits').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
        const { data: statsData } = await supabase
          .from('app_stats').select('total_users').eq('id', 1).single();
        const currentCount = statsData?.total_users || 0;
        if (isNewUser && !upsertError) {
          const newCount = Math.min(currentCount + 1, 500);
          await supabase.from('app_stats').update({ total_users: newCount }).eq('id', 1);
          setUserCount(newCount);
        } else {
          setUserCount(currentCount);
        }
      } catch (error) {
        console.error('Error init:', error);
      } finally {
        setIsLoadingCount(false);
      }
    };
    initUser();
  }, []);

  

  const handleBuyGems = async (pkg) => {
    const userId = localStorage.getItem('redxax_user_id');
    try {
      setGemError(null);
      const { data, error } = await supabase.functions.invoke('create-mp-preference', {
        body: { gems: pkg.gems, price: pkg.price, label: pkg.label, userId }
      });
      if (error || !data?.init_point) throw new Error('No se pudo crear la preferencia');
      window.location.href = data.init_point;
    } catch (err) {
      setGemError('Error al iniciar el pago. Intentá de nuevo.');
    }
  };

  // ── FIX: deductGems ──────────────────────────────────────────
// El cambio está en el bloque if (error): ahora lee el body real 
// de la respuesta para que puedas ver qué está tirando la función.

// ── FIX: deductGems ──────────────────────────────────────────
// El cambio está en el bloque if (error): ahora lee el body real
// de la respuesta para que puedas ver qué está tirando la función.

const deductGems = async (amount, reason) => {
  let userId = localStorage.getItem('redxax_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('redxax_user_id', userId);
    await supabase.functions.invoke('get-gems', { body: { userId } });
  }

  try {
    const { data, error } = await supabase.functions.invoke('deduct-gems', {
      body: { userId, amount, reason }
    });

    if (error) {
      // ── ESTO ES LO QUE CAMBIA: leer el body real del error ──
      let errorBody = '';
      try {
        // Supabase guarda la Response original en error.context
        errorBody = await error.context?.text?.();
      } catch (_) {}

      console.error('deduct-gems error (status):', error.message);
      console.error('deduct-gems error (body):', errorBody);  // ← ACÁ vas a ver el error real

      
      const legibleError = errorBody || error.message || 'Error desconocido';
      alert(`Error al procesar las gemas:\n${legibleError}\n\nCopiá este mensaje y revisá los logs de tu Edge Function en Supabase.`);
      return false;
    }

    if (!data?.success) {
      if (data?.error === 'Saldo insuficiente') {
        alert(`Gemas insuficientes. Tenés ${data.balance} y necesitás ${amount}.`);
        setShowGemStore(true);
      } else {
        console.error('deduct-gems logic error:', data);
        alert(`Error al procesar las gemas: ${data?.error || 'Error desconocido'}. Intentá de nuevo.`);
      }
      return false;
    }

    setGems(data.newBalance);
    return true;

  } catch (err) {
    console.error('deduct-gems exception:', err);
    alert('Error inesperado al procesar las gemas. Intentá de nuevo.');
    return false;
  }
};

const saveChatToHistory = async (messages) => {
  if (!currentHistoryId) return;
  await supabase
    .from('analysis_history')
    .update({ chat_messages: messages })
    .eq('id', currentHistoryId);
};

  const saveAnalysisToHistory = async (result, mode) => {
  const userId = localStorage.getItem('redxax_user_id');
  if (!userId) return;
  const title = `${result.industria || 'Contenido'} — ${result.platform || mode}`;
    const { data, error } = await supabase
      .from('analysis_history')
      .insert({ user_id: userId, title, mode, analysis_data: result })
      .select().single();
    if (!error && data) {
      setHistory(prev => [data, ...prev]);
      setCurrentHistoryId(data.id);
    } //className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-full text-sm font-black italic uppercase tracking-wider transition-all"
  };

const extractFlags = (strategyText) => {
  try {
    const match = strategyText.match(/---FLAGS---\s*([\s\S]*?)\s*---END---/);
    if (!match) {
      console.warn('[extractFlags] Bloque FLAGS no encontrado');
      return {};
    }
    return JSON.parse(match[1]);
  } catch (err) {
    console.warn('[extractFlags] Error parseando FLAGS:', err.message);
    return {};
  }
};

const stripFlags = (strategyText) =>
  strategyText.replace(/---FLAGS---[\s\S]*?---END---/, '').trim();






const [nichoSugerido, setNichoSugerido] = useState('');

const runNicheSuggestion = async (videoFile, platform) => {
  setStep('analyzing');
  setAnalysisMode('video');
  setStatusText("Viendo el video...");
  setAnalysisProgress(15);

  const safeName = videoFile?.name
    ?.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '') || 'video.mp4';
  const storagePath = `temp-analysis/${Date.now()}-${safeName}`;
  const mimeType = videoFile.type || 'video/mp4';

  try {
    const { error: uploadError } = await supabase.storage
      .from('videos').upload(storagePath, videoFile, { contentType: mimeType, upsert: true });
    if (uploadError) throw new Error("Error subiendo video: " + uploadError.message);

    setUploadedVideoPath(storagePath);   // ← agregar acá
    setUploadedVideoMime(mimeType);      // ← agregar acá

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildNicheSuggestionPrompt(),
        storagePath,
        videoMimeType: mimeType,
        videoFps: REVIEW_CONFIG.nicheSuggestion.videoFps,
        expectsJson: false,
        temperature: REVIEW_CONFIG.nicheSuggestion.temperature,
        maxOutputTokens: 30,
      }
    });
    if (error) throw new Error(error.message);

    const sugerido = extractGeminiText(data).trim();
    setNichoSugerido(sugerido || '');
    setAnalysisProgress(100);
    setTimeout(() => setStep('validation'), 300);

  } catch (err) {
    console.warn('No se pudo sugerir nicho, seguimos sin sugerencia:', err.message);
    setNichoSugerido(''); // el usuario completa a mano, no bloqueamos el flujo
    setStep('validation');
  }
};

const runDeepAnalysis = async (videoFile, platform, industria) => {
  const cost = 100; 
  const approved = await deductGems(cost, 'video:deep_analysis');
  if (!approved) return;

  setStep('analyzing');
  setAnalysisMode('video');
  setAnalysisProgress(20);
  setStatusText('Analizando el hook...');

  try {
    let storagePath = uploadedVideoPath;
    let mimeType = uploadedVideoMime;

    // Fallback: si por algo no quedó subido antes, lo subimos ahora
    if (!storagePath) {
      const safeName = videoFile?.name
        ?.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '') || 'video.mp4';
      storagePath = `temp-analysis/${Date.now()}-${safeName}`;
      mimeType = videoFile.type || 'video/mp4';
      const { error: uploadError } = await supabase.storage
        .from('videos').upload(storagePath, videoFile, { contentType: mimeType, upsert: true });
      if (uploadError) throw new Error('Error subiendo video: ' + uploadError.message);
    }

    const cfg = REVIEW_CONFIG;

    const [hookRes, desarrolloRes] = await Promise.all([
      supabase.functions.invoke('gemini-proxy', {
        body: {
          text: buildHookAnalysisPrompt(platform, industria, selectedObjetivo),
          storagePath,
          videoMimeType: mimeType,
          videoFps: cfg.hook.videoFps,
          temperature: cfg.hook.temperature,
          expectsJson: false,
          maxOutputTokens: 2048,
        },
      }),
      supabase.functions.invoke('gemini-proxy', {
        body: {
          text: buildDesarrolloAnalysisPrompt(platform, industria, selectedObjetivo),
          storagePath,
          videoMimeType: mimeType,
          videoFps: cfg.desarrollo.videoFps,
          temperature: cfg.desarrollo.temperature,
          expectsJson: false,
          maxOutputTokens: 2048,
        },
      }),
    ]);

    if (hookRes.error) throw new Error(hookRes.error.message);
    if (desarrolloRes.error) throw new Error(desarrolloRes.error.message);

    const hookAnalysis = extractGeminiText(hookRes.data);
    const desarrolloAnalysis = extractGeminiText(desarrolloRes.data);

    setAnalysisProgress(70);
    setStatusText('Redactando la devolución final...');

    const { data: sintesisData, error: sintesisError } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildFinalReviewPrompt(hookAnalysis, desarrolloAnalysis, platform, industria, selectedObjetivo),
        // sin storagePath: la síntesis no necesita ver el video de nuevo
        temperature: cfg.sintesis.temperature,
        expectsJson: false,
        maxOutputTokens: 3072,
      },
    });
    if (sintesisError) throw new Error(sintesisError.message);

    const reviewText = extractGeminiText(sintesisData);

    const finalResult = {
      reviewText,
      hookAnalysis,
      desarrolloAnalysis,
      industria,
      platform,
      objetivo: selectedObjetivo,
    };

    setAiResult(finalResult);
    setCompletedSteps([]);
    setChatMessages([{
      role: 'bot',
      text: '¡Listo! Analicé el video completo. ¿Sobre qué parte querés que profundicemos?',
    }]);

    setAnalysisProgress(100);
    await saveAnalysisToHistory(finalResult, 'video');
    setTimeout(() => setStep('results'), 300);

  } catch (err) {
    console.error('Error en análisis de video:', err);
    alert('Error en el análisis: ' + err.message);
    setStep('upload');
  }
};

const runScriptAnalysis = async (platform, followerRange) => {
  if (!scriptText.trim()) {
    alert('Escribí el guion antes de analizar.');
    return;
  }

  const cost = 50;
  const approved = await deductGems(cost, 'script');
  if (!approved) return;

  setStep('analyzing');
  setAnalysisMode('script');
  setStatusText("Leyendo el guion...");
  setAnalysisProgress(15);

  try {
    setAnalysisProgress(25);
    setStatusText("Analizando estructura del guion...");

    const viewerPrompt = `
${buildViewerBrainPrompt(platform, selectedNicho)}

IMPORTANTE: No hay video. Analizá únicamente el texto del guion que sigue.
Evaluá el hook, el ritmo narrativo, las capas de compra y la retención basándote
solo en las palabras, el orden de las ideas y la estructura del mensaje.
Lo que no se puede evaluar sin video (producción, música, edición) marcalo como "No evaluable — solo guion".

GUION A ANALIZAR:
"${scriptText}"
`;

    const { data: call1Data, error: call1Error } = await supabase.functions.invoke('gemini-proxy', {
      body: { text: viewerPrompt, maxOutputTokens: 4096 }
    });
    if (call1Error) throw call1Error;
    const viewerAnalysis = extractGeminiText(call1Data);

    setAnalysisProgress(50);
    setStatusText("Evaluando potencial de ventas...");

    const { data: call2Data, error: call2Error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildStrategyBrainPrompt(viewerAnalysis, platform, selectedObjetivo, {
        industria: selectedNicho,
        palanca_psicologica: 'Curiosidad / Retención',
        criterio_evaluacion: '',
        }, {}),
        maxOutputTokens: 6144
      }
    });
    if (call2Error) throw call2Error;
    const strategyRaw = extractGeminiText(call2Data);

    const flags = extractFlags(strategyRaw);
    const strategyAnalysis = stripFlags(strategyRaw);
    console.log('[VIRAX Script] Flags detectados:', flags);

    setAnalysisProgress(80);
    setStatusText("Calculando scores...");

    const { data: call3Data, error: call3Error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildScoringBrainPrompt(
  '',
  strategyAnalysis,
  viewerAnalysis,
  platform,
  selectedObjetivo,
  {
    industria: selectedNicho,
    palanca_psicologica: 'Curiosidad / Retención',
    palanca_detectada: 'Curiosidad / Retención',
    criterio_evaluacion: '',
  },
  flags,
  null,
  null
),
        expectsJson: true,
        maxOutputTokens: 8192
      }
    });
    if (call3Error) throw call3Error;

    const parsed = safeParseJSON(extractGeminiText(call3Data), 'scoring-script');

    // ← scoring determinístico encima de lo que tiró la IA
    const parsedFinal = applyDeterministicScoring(parsed, flags, selectedNicho);

    setAnalysisProgress(95);
    setStatusText("Preparando tu análisis...");

    const finalResult = {
      ...parsedFinal,
      objetivo: selectedObjetivo,
      _flags: flags,
    };

    setAiResult(finalResult);
    setCompletedSteps([]);
    setChatMessages([{
      role: 'bot',
      text: `Guion analizado. Potencial de venta: ${finalResult.salesScore?.score ?? '—'}% | Potencial viral: ${finalResult.viralScore?.score ?? '—'}%. ¿Querés mejorar algo específico?`
    }]);

    setAnalysisProgress(100);
    await saveAnalysisToHistory(finalResult, 'script');
    setTimeout(() => setStep('results'), 500);

  } catch (err) {
    console.error('Error análisis de guion:', err);
    alert('Error en el análisis. Revisá la consola.');
    setStep('upload');
  }
};


const sendMessage = async () => {
  if (!userInput.trim() || isTyping) return;

  const newMessages = [...chatMessages, { role: 'user', text: userInput }];
  setChatMessages(newMessages);
  setUserInput("");
  setIsTyping(true);

  try {
    // ── FIX: nombres correctos, coinciden con lo que devuelve runVideoReview ──
    const aiContext = {
      reviewText: aiResult?.reviewText,
      hookAnalysis: aiResult?._hookAnalysis,
      desarrolloAnalysis: aiResult?._desarrolloAnalysis,
      industria: aiResult?.industria,
      platform: aiResult?.platform,
      objetivo: aiResult?.objetivo,
    };

    const systemPrompt = buildChatSystemPrompt();
    const contextBlock = buildChatContextBlock(aiContext);

    // DESPUÉS (con límite):
    const MAX_HISTORY_TURNS = 8;
    const history = newMessages.slice(0, -1).slice(-MAX_HISTORY_TURNS);
    const currentMessage = newMessages[newMessages.length - 1];

    const historyFormatted = history
      .map(m => `${m.role === 'user' ? '👤 USUARIO' : '🤖 VIRAX'}: ${m.text}`)
      .join('\n\n');

    // ── FIX: el contexto ahora SÍ está en el prompt final ──
    const fullPrompt = `
${systemPrompt}

════════════════════════════════
CONTEXTO DEL VIDEO ANALIZADO:
${contextBlock}
════════════════════════════════
HISTORIAL DE CONVERSACIÓN:
${historyFormatted || '(primera interacción)'}
════════════════════════════════

👤 USUARIO AHORA DICE:
${currentMessage.text}

🤖 VIRAX RESPONDE:`;

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: { text: fullPrompt, maxOutputTokens: 2048, temperature: 0.75 }
    });

    if (error) {
      let rawBody = '';
      try { rawBody = await error.context?.text?.(); } catch (_) {}
      throw new Error(rawBody || error.message || 'Error en Edge Function');
    }
    if (!data) throw new Error('Respuesta vacía del proxy');

    const botResponse =
      data?.candidates?.[0]?.content?.parts?.[0]?.text
      ?? data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('')
      ?? data?.text
      ?? null;

    if (!botResponse) {
      console.error('Respuesta inesperada del proxy:', JSON.stringify(data));
      throw new Error('No se pudo extraer texto de la respuesta');
    }

    const updatedMessages = [...newMessages, { role: 'bot', text: botResponse }];
    setChatMessages(updatedMessages);
    await saveChatToHistory(updatedMessages);

  } catch (err) {
    console.error("Error Chat:", err);
    setChatMessages([...newMessages, {
      role: 'bot',
      text: `❌ Error: ${err.message || 'Se cortó la conexión. Intentá de nuevo.'}`
    }]);
  } finally {
    setIsTyping(false);
  }
};

  const progressPercent = (userCount / 500) * 100;

  const platformColors = {
    tiktok: 'text-pink-400',
    reels:  'text-purple-400',
    shorts: 'text-red-400',
  };

  const platformBars = {
    tiktok: 'bg-pink-500/30 border-pink-500/40',
    reels:  'bg-purple-500/30 border-purple-500/40',
    shorts: 'bg-red-500/30 border-red-500/40',
  };

  const objetivo = aiResult?.objetivo || 'ventas';  // ← acá} //setAiResult(parsed);

  return (
    <div className="min-h-screen bg-[#020203] text-white font-sans selection:bg-purple-500/50 overflow-x-hidden">
      <DottedBackground />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] bg-purple-600/[0.04] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[45%] h-[45%] bg-blue-600/[0.04] blur-[120px] rounded-full" />
      </div>

      {/* GEM STORE */}
      {showGemStore && (
        <>
          <style>{`
            @keyframes shimmer-gold {
              0%   { background-position: -200% center; }
              100% { background-position:  200% center; }
            }
            .elite-shimmer-border {
              background: linear-gradient(90deg, #78350f 0%, #fbbf24 30%, #fef9c3 50%, #fbbf24 70%, #78350f 100%);
              background-size: 200% auto;
              animation: shimmer-gold 2.5s linear infinite;
              padding: 1px;
              border-radius: 2rem;
            }
          `}</style>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#0d0d0f] border border-white/10 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                    Recargar <span className="text-purple-400">Gemas</span>
                  </h2>
                  <p className="text-slate-500 text-sm font-bold mt-1">
                    Saldo actual: <span className="text-purple-300">{gems} 💎</span>
                  </p>
                </div>
                <button onClick={() => setShowGemStore(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="space-y-3 mb-8">
                {GEM_PACKAGES.map((pkg) => {
                  const savings = pkg.id === 'pro' ? 'Ahorrás 50% vs Starter' : pkg.id === 'elite' ? 'Ahorrás 75% vs Starter' : null;
                  const cardInner = (
                    <div
                      className={`relative flex items-center justify-between p-5 cursor-pointer transition-all hover:scale-[1.02]
                        ${pkg.id === 'elite' ? 'rounded-[1.9rem] bg-[#0d0d0f] hover:bg-yellow-500/10'
                        : pkg.popular ? 'rounded-[2rem] border border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/15'
                        : 'rounded-[2rem] border border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                      onClick={() => handleBuyGems(pkg)}
                    >
                      {pkg.id === 'elite' && <div className="absolute -top-3 left-6 bg-yellow-500 text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">⚡ Más popular</div>}
                      {pkg.popular && <div className="absolute -top-3 left-6 bg-purple-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">🔥 Mejor valor</div>}
                      <div className="flex items-center gap-4">
                        <Gem className={`w-6 h-6 ${pkg.id === 'elite' ? 'text-yellow-400' : 'text-purple-400'}`} fill="currentColor" />
                        <div>
                          <p className="font-black italic text-white text-lg">{pkg.gems.toLocaleString()} gemas</p>
                          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{pkg.analyses} · {pkg.perGem}</p>
                          {savings && <p className="text-green-400 text-[10px] font-black uppercase tracking-wider mt-0.5">✓ {savings}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-xl ${pkg.id === 'elite' ? 'text-yellow-400' : 'text-white'}`}>${pkg.price}</p>
                        <p className="text-slate-500 text-[10px]">USD</p>
                      </div>
                    </div>
                  );
                  return pkg.id === 'elite' ? (
                    <div key={pkg.id} className="relative elite-shimmer-border mt-4">{cardInner}</div>
                  ) : (
                    <div key={pkg.id} className="relative">{cardInner}</div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2 mb-6 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                <span>🔒</span><span>Pago seguro · Las gemas no vencen · Sin suscripción</span>
              </div>
              <div id="paypal-button-container" className="min-h-[50px]" />
              {gemError && <p className="text-red-400 text-xs font-bold text-center mt-4">{gemError}</p>}
            </div>
          </div>
        </>
      )} 

<header className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto border-b border-white/5 backdrop-blur-md">
  <style>{`
    @keyframes viraxShimmer {
      0%   { background-position: 200% center;  letter-spacing: -0.05em; }
      14%  { background-position: -200% center; letter-spacing: -0.04em; }
      20%  { background-position: -200% center; letter-spacing: -0.05em; }
      100% { background-position: -200% center; letter-spacing: -0.05em; }
    }
    @keyframes subtagPulse {
      0%   { opacity: 0.4; transform: translateX(0px); }
      12%  { opacity: 0.9; transform: translateX(3px); }
      20%  { opacity: 0.4; transform: translateX(0px); }
      100% { opacity: 0.4; transform: translateX(0px); }
    }
    .virax-text {
      background: linear-gradient(90deg,
        #ffffff 0%, #ffffff 25%,
        #ff6b6b 38%, #ffaaaa 50%, #ff6b6b 62%,
        #ffffff 75%, #ffffff 100%
      );
      background-size: 250% auto;
      background-position: 200% center;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: viraxShimmer 5s cubic-bezier(0.22, 1, 0.36, 1) 2.1s infinite;
    }
    .subtag-pulse {
      animation: subtagPulse 5s cubic-bezier(0.22, 1, 0.36, 1) 2.2s infinite;
    }
  `}</style>

  <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
<img
  src={logo}
  alt="Virax logo"
  className="w-14 h-14 rounded-full object-contain shadow-lg"
/>
    <div className="flex flex-col leading-tight">
      <h1 className="virax-text text-2xl font-black tracking-tighter italic uppercase">
        VIRAX
      </h1>
      <span className="subtag-pulse text-[10px] italic text-slate-500 font-medium tracking-wide">
        Hecha por InterXAX
      </span>
    </div>
  </div>

  <div className="flex items-center gap-4">
    <div onClick={() => setShowGemStore(true)}
      className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all hover:bg-purple-500/20 cursor-pointer">
      <Gem className="w-4 h-4 text-purple-400" fill="currentColor" />
      <span className="text-purple-300 font-black italic tracking-tighter tabular-nums text-lg leading-none">{gems}</span>
    </div>
    {step === 'results' && (
      <button onClick={() => window.location.reload()} className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 hover:bg-white/20 active:scale-95">
        <RotateCcw className="w-3 h-3" /> Nuevo Test
      </button>
    )}
  </div>
</header>

      <main className="relative z-10 max-w-6xl mx-auto p-4 py-12">

      {/* ── UPLOAD ── */}
{step === 'upload' && (
  <div className="text-center space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
    <div className="space-y-4">
      <style>{`
        @keyframes slideBlurIn {
          from { opacity: 0; transform: translateY(30px); filter: blur(14px); }
          to   { opacity: 1; transform: translateY(0px);  filter: blur(0px);  }
        }
        .title-line1 {
          animation: slideBlurIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .title-line2 {
          opacity: 0;
          animation: slideBlurIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) 1s forwards;
        }
        @keyframes ventasPulse {
          /* —— Reposo —— */
          0% {
            opacity: 1;
            transform: translateY(0px) scaleX(1) scaleY(1);
            filter: blur(0px) drop-shadow(0 0 0px transparent);
            background-position: -200% center;
          }
          /* —— Salida: compresión + desliz arriba + blur —— */
          6% {
            opacity: 1;
            transform: translateY(-4px) scaleX(1.06) scaleY(0.88);
            filter: blur(0px) drop-shadow(0 0 8px #4ade8066);
            background-position: -200% center;
          }
          12% {
            opacity: 0;
            transform: translateY(-28px) scaleX(0.92) scaleY(0.7);
            filter: blur(10px) drop-shadow(0 0 0px transparent);
            background-position: -200% center;
          }
          /* —— Reset invisible abajo —— */
          13% {
            opacity: 0;
            transform: translateY(32px) scaleX(0.92) scaleY(0.7);
            filter: blur(10px);
            background-position: 200% center;
          }
          /* —— Entrada: sube + desenfoca + shimmer sweep —— */
          26% {
            opacity: 1;
            transform: translateY(-5px) scaleX(1.04) scaleY(1.08);
            filter: blur(0px) drop-shadow(0 0 18px #4ade8088);
            background-position: 0% center;
          }
          /* —— Rebote de asentamiento —— */
          30% {
            transform: translateY(3px) scaleX(0.99) scaleY(0.97);
            filter: blur(0px) drop-shadow(0 0 6px #4ade8044);
            background-position: -60% center;
          }
          35% {
            transform: translateY(0px) scaleX(1) scaleY(1);
            filter: blur(0px) drop-shadow(0 0 0px transparent);
            background-position: -200% center;
          }
          /* —— Reposo hasta próximo ciclo —— */
          100% {
            opacity: 1;
            transform: translateY(0px) scaleX(1) scaleY(1);
            filter: blur(0px) drop-shadow(0 0 0px transparent);
            background-position: -200% center;
          }
        }
        .shimmer-ventas {
          display: inline-block;
          background: linear-gradient(90deg, #16a34a 0%, #4ade80 35%, #bbf7d0 50%, #4ade80 65%, #16a34a 100%);
          background-size: 250% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: ventasPulse 5s cubic-bezier(0.22, 1, 0.36, 1) 2.5s infinite;
        }
        .gold-viral {
          background: linear-gradient(90deg, #b8860b, #ffd700, #fffacd, #ffd700, #b8860b);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
      <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
        <Microscope className="w-3 h-3" /> Precisión 500% — Analista Neutro
      </div>
      <MorphingTitle
        phrases={[
          'Empieza a potenciar tus videos ahora mismo 💪',
          'Empieza hoy',
          'Transforma la calidad de tus videos',
          'No dejes que te detengan',
          'Puedes hacerlo',
        ]}
        interval={3000}
        className="mx-auto max-w-5xl"
      />
      <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl font-medium">
        La IA analiza tu video y te dice exactamente<br/>
        <span className="text-slate-500">qué está funcionando y qué te está frenando.</span>
      </p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto px-4">
      <div onClick={() => setStep('script_input')}
        className="group relative block border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/[0.02] rounded-[4rem] p-24 md:p-36 transition-all cursor-pointer overflow-hidden shadow-2xl">
        <FileText className="w-16 h-16 text-slate-800 mx-auto mb-6 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-500" />
        <p className="text-3xl font-black italic tracking-tighter uppercase">Validar Guion</p>
        <p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-widest">Fase 0: Estructura y Texto</p>
      </div>
      <label className="group relative block border-2 border-dashed border-white/10 hover:border-purple-500/50 bg-white/[0.02] rounded-[4rem] p-24 md:p-36 transition-all cursor-pointer overflow-hidden shadow-2xl">
        <Upload className="w-16 h-16 text-slate-800 mx-auto mb-6 group-hover:text-purple-400 group-hover:scale-110 transition-all duration-500" />
        <p className="text-3xl font-black italic tracking-tighter uppercase">Cargar Video</p>
        <p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-widest">Fase 1: Edición y Ritmo</p>
        <input type="file" className="hidden" accept="video/*" onChange={(e) => {
          const file = e.target.files[0];
          if (file) {
            const url = URL.createObjectURL(file);
            setVideoPreviewUrl(url);
            setPendingVideoFile(file);
            setPendingVideoUrl(url);
            setAnalysisMode('video');
            setStep('platform_select');
          }
        }} />
      </label>
    </div>
  </div>
)}
        {step === 'platform_select' && (
  <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-10 duration-500">
    <div className="bg-white/[0.02] border border-white/10 rounded-[4rem] p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[88vh]">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
          <TrendingUp className="w-3 h-3" /> Paso previo al análisis
        </div>
        <h3 className="text-3xl font-black italic uppercase tracking-tighter">
          Configurá el análisis
        </h3>
        <p className="text-slate-400 mt-3 font-medium">
          El algoritmo se calibra según tu plataforma y tamaño de cuenta.
        </p>
      </div>

      {/* ── PLATAFORMA ── */}
<div className="mb-8">
  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 mb-4">
    Plataforma objetivo
  </p>
  <div className="grid grid-cols-3 gap-2">
    {[
      { id: 'tiktok', name: 'TikTok',  sub: 'FYP',     icon: '🎵' },
      { id: 'reels',  name: 'Reels',   sub: 'Explorar', icon: '📸' },
      { id: 'shorts', name: 'Shorts',  sub: 'Feed',     icon: '▶️' },
    ].map((p) => (
      <button
        key={p.id}
        onClick={() => setSelectedPlatform(p.id)}
        className={`relative flex flex-col items-center gap-1.5 p-4 rounded-[1.25rem] border transition-all duration-200 overflow-hidden
          ${selectedPlatform === p.id
            ? 'border-purple-500/50 bg-purple-500/[0.08]'
            : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] hover:-translate-y-px'}`}
      >
        <div className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full border transition-all duration-200
          ${selectedPlatform === p.id ? 'bg-purple-500 border-purple-500' : 'border-purple-500/40'}`} />
        <span className="text-lg leading-none">{p.icon}</span>
        <span className={`text-[11px] font-black uppercase tracking-wide transition-colors duration-200
          ${selectedPlatform === p.id ? 'text-slate-200' : 'text-slate-500'}`}>
          {p.name}
        </span>
        <span className={`text-[10px] italic font-bold transition-colors duration-200
          ${selectedPlatform === p.id ? 'text-purple-400' : 'text-slate-700'}`}>
          {p.sub}
        </span>
      </button>
    ))}
  </div>
</div>

{/* ── SEGUIDORES ── */}
<div className="mb-8">
  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 mb-4">
    Tamaño de cuenta
  </p>
  <div className="grid grid-cols-2 gap-2">
    {[
      { id: 'nano',  range: '0 – 1K',      label: 'Nano'  },
      { id: 'micro', range: '1K – 10K',    label: 'Micro' },
      { id: 'mid',   range: '10K – 100K',  label: 'Mid'   },
      { id: 'macro', range: '100K+',       label: 'Macro' },
    ].map((r) => (
      <button
        key={r.id}
        onClick={() => setSelectedFollowerRange(r.id)}
        className={`relative flex items-center justify-between px-5 py-4 rounded-[1.25rem] border transition-all duration-200 overflow-hidden text-left
          ${selectedFollowerRange === r.id
            ? 'border-purple-500/50 bg-purple-500/[0.08]'
            : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:-translate-y-px'}`}
      >
        <div>
          <p className={`text-[15px] font-black italic tracking-tight transition-colors duration-200
            ${selectedFollowerRange === r.id ? 'text-white' : 'text-slate-500'}`}>
            {r.range}
          </p>
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-200
            ${selectedFollowerRange === r.id ? 'text-purple-700' : 'text-slate-800'}`}>
            {r.label}
          </p>
        </div>
        <div className={`w-1.5 h-1.5 rounded-full border transition-all duration-200 shrink-0
          ${selectedFollowerRange === r.id ? 'bg-purple-500 border-purple-500' : 'border-purple-500/40'}`} />
        {/* barra inferior animada */}
        <div className={`absolute bottom-0 left-0 h-[2px] bg-purple-500 rounded-r-full transition-all duration-300
          ${selectedFollowerRange === r.id ? 'w-full' : 'w-0'}`} />
      </button>
    ))}
  </div>
</div> 

{/* ── NICHO ── */}
<div className="mb-8">
  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 mb-4">
    Tipo de contenido
  </p>
  <div className="grid grid-cols-2 gap-2">
    {[
  { id: 'producto_fisico',    label: 'Producto físico'       },
  { id: 'curso',              label: 'Curso / Info'          },
  { id: 'servicio',           label: 'Servicio'              },
  { id: 'inmobiliaria',       label: 'Inmobiliaria'          },
  { id: 'app_software',       label: 'App / Software'        },
  { id: 'restaurante_comida', label: 'Restaurante / Comida'  },
  { id: 'otro',               label: 'Otro / General'        },
].map((n) => (
      <button
        key={n.id}
        onClick={() => setSelectedNicho(n.id)}
        className={`relative flex items-center justify-between px-5 py-4 rounded-[1.25rem] border transition-all duration-200 text-left
          ${selectedNicho === n.id
            ? 'border-purple-500/50 bg-purple-500/[0.08]'
            : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:-translate-y-px'}`}
      >
        <p className={`text-[13px] font-black italic tracking-tight transition-colors duration-200
          ${selectedNicho === n.id ? 'text-white' : 'text-slate-500'}`}>
          {n.label}
        </p>
        <div className={`w-1.5 h-1.5 rounded-full border transition-all duration-200 shrink-0
          ${selectedNicho === n.id ? 'bg-purple-500 border-purple-500' : 'border-purple-500/40'}`} />
      </button>
    ))}
  </div>
</div>

      <div className="flex justify-between items-center">
        <button onClick={() => { setStep('upload'); setPendingVideoUrl(null); setSelectedPlatform(null); setSelectedFollowerRange(null); }}
          className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">
          ← Volver
        </button>
        <button
  disabled={!selectedPlatform || !selectedFollowerRange}
  onClick={() => {
    if (analysisMode === 'video' && pendingVideoFile) {
      runNicheSuggestion(pendingVideoFile, selectedPlatform);
    } else {
      runScriptAnalysis(selectedPlatform, selectedFollowerRange);
    }
  }}
  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-full text-sm font-black italic uppercase tracking-wider transition-all"
>
  Iniciar Análisis →
</button>
      </div>
    </div>
  </div>
)}

{step === 'validation' && (
  <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-500">
    <div className="bg-white/[0.02] border border-white/10 rounded-[4rem] p-8 md:p-12 shadow-2xl">
      <div className="mb-10 text-center">
        <h3 className="text-3xl font-black italic uppercase tracking-tighter">Confirmá el nicho</h3>
        <p className="text-slate-400 mt-3 font-medium">
          {nichoSugerido ? 'Esto es lo que detectamos — corregilo si hace falta.' : 'No pudimos sugerir un nicho, escribilo vos.'}
        </p>
      </div>

      <textarea
        rows={2}
        value={nichoSugerido}
        onChange={(e) => setNichoSugerido(e.target.value)}
        placeholder="Ej. Estética facial, comida rápida, fitness..."
        className="bg-transparent text-lg text-white font-bold outline-none border-b border-white/10 focus:border-purple-500 pb-1 w-full resize-none mb-10"
      />

      <div className="flex justify-between items-center">
        <button onClick={() => setStep('upload')} className="text-sm font-bold text-slate-400 hover:text-white uppercase tracking-widest">
          ← Volver
        </button>
        <button
          disabled={!nichoSugerido.trim()}
          onClick={() => runDeepAnalysis(pendingVideoFile, selectedPlatform, nichoSugerido.trim())}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-8 py-4 rounded-full text-sm font-black italic uppercase tracking-wider"
        >
          Confirmar y Analizar →
        </button>
      </div>
    </div>
  </div>
)}

        {/* ── SCRIPT INPUT ── */}
        {step === 'script_input' && (
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-10 duration-500">
            <div className="bg-white/[0.02] border border-white/10 rounded-[4rem] p-12 md:p-16 shadow-2xl">
              <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-4 flex items-center gap-3">
                <BrainCircuit className="text-indigo-400 w-8 h-8" /> Laboratorio de Guiones
              </h3>
              <p className="text-slate-400 mb-6 font-medium">Pega aquí los primeros segundos de tu diálogo o el concepto general del video.</p>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Ej: '¿Sabías que el 90% de los agentes inmobiliarios cometen este error...'"
                className="w-full h-56 bg-black/50 border border-white/10 rounded-[2rem] p-6 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none mb-6 italic"
              />
              <div className="flex justify-between items-center">
                <button onClick={() => setStep('upload')} className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">← Volver</button>
                <button
                  onClick={() => { setAnalysisMode('script'); setStep('platform_select'); }}
                  disabled={!scriptText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-full text-sm font-black italic uppercase tracking-wider transition-all"
                >
                  Elegir Plataforma →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYZING ── */}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-12">
            <div className="relative">
              <div className={`w-56 h-56 rounded-full border-[8px] border-white/5 animate-spin ${analysisMode === 'video' ? 'border-t-purple-600' : 'border-t-indigo-600'}`} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-black italic">{analysisProgress}%</span>
              </div>
            </div>
            <p className={`${analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'} font-bold animate-pulse text-lg tracking-tight uppercase`}>{statusText}</p>
            <p className="text-slate-600 text-[11px] font-medium italic tracking-wide text-center max-w-xs"
            style={{
    background: 'linear-gradient(90deg, #475569 0%, #94a3b8 40%, #cbd5e1 50%, #94a3b8 60%, #475569 100%)',
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'shimmer-text 3s linear infinite',
  }}>
  Virax puede tardar entre 1 y 2 minutos en el análisis, dependiendo de tu calidad de WIFI o video.
</p>
          </div>
        )}

        {/* ── RESULTS ── */}
{step === 'results' && aiResult && (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-right-10 duration-700">
    <div className="lg:col-span-4 space-y-6">

      {/* Preview */}
      {analysisMode === 'video' ? (
        <ShinyCard tilt={tilt} className="bg-[#111] rounded-[3.5rem] overflow-hidden border border-white/10 aspect-[9/16] relative shadow-2xl">
          {videoPreviewUrl && <video src={videoPreviewUrl} className="w-full h-full object-cover" controls autoPlay loop muted />}
        </ShinyCard>
      ) : (
        <ShinyCard tilt={tilt} className="bg-[#111] rounded-[3.5rem] p-10 border border-white/10 aspect-[9/16] relative shadow-2xl flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4 text-indigo-400">
            <FileText className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Guion Escaneado</span>
          </div>
          <p className="text-slate-300 italic text-sm font-medium leading-relaxed overflow-y-auto custom-scrollbar flex-1">"{scriptText}"</p>
        </ShinyCard>
      )}


<div className="p-6 bg-black/50 border-t border-white/10">
  {/* contador */}
  {countWords(userInput) > 800 && (
    <p className={`text-[10px] font-black uppercase tracking-wider mb-2 text-right transition-colors ${
      countWords(userInput) >= CHAT_WORD_LIMIT ? 'text-red-400' : 'text-yellow-500'
    }`}>
      {countWords(userInput)}/{CHAT_WORD_LIMIT} palabras
    </p>
  )}
  <div className="bg-white/5 rounded-full p-2 flex items-center gap-2 px-6">
    <input
      type="text"
      value={userInput}
      onChange={(e) => {
        const words = countWords(e.target.value);
        if (words <= CHAT_WORD_LIMIT) setUserInput(e.target.value);
      }}
      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
      placeholder={countWords(userInput) >= CHAT_WORD_LIMIT ? 'Límite alcanzado...' : 'Escribe tu consulta...'}
      className="bg-transparent border-none outline-none flex-1 text-sm text-white py-2 italic"
    />
    <button
      onClick={sendMessage}
      disabled={isTyping || !userInput.trim()}
      className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 p-3 rounded-full transition-all active:scale-90"
    >
      <Send className="w-4 h-4" />
    </button>
  </div>
</div>

{/* PHASE SCORES */}
<div className="space-y-3">
  <ShinyCard tilt={tilt} className="bg-black/30 border border-white/5 rounded-[2rem] p-5">
    <div className="flex flex-wrap gap-2">
      <span className="text-[10px] font-black uppercase bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-1 rounded-full">
        {aiResult.industria}
      </span>
      <span className="text-[10px] font-black uppercase bg-white/5 border border-white/10 text-slate-400 px-3 py-1 rounded-full">
        {aiResult.platform}
      </span>
    </div>
  </ShinyCard>
</div>
</div>

    <div className="lg:col-span-8 space-y-6">
  <ShinyCard tilt={tilt} className="bg-white/[0.02] border border-white/10 p-10 rounded-[4rem]">
    <div className="flex items-center gap-4 mb-6">
      <Target className="text-purple-400 w-5 h-5" />
      <h3 className="text-2xl font-black italic uppercase tracking-tighter">Devolución</h3>
    </div>
    <div className="text-sm leading-relaxed text-slate-300">
      {renderBotText(aiResult.reviewText)}
    </div>
  </ShinyCard>
  
{!showChat ? (
  <button onClick={() => setShowChat(true)} className="w-full flex items-center justify-center gap-3 p-8 bg-zinc-600/10 hover:bg-zinc-600/20 border border-white/10 rounded-[3rem] text-slate-400 font-black italic uppercase tracking-tighter transition-all">
    <MessageSquare className="w-5 h-5" /> Consultoría Técnica de Visión
  </button>
) : (
  <div className="bg-[#050507] border border-white/[0.07] rounded-[3.5rem] overflow-hidden flex flex-col h-[550px] shadow-2xl animate-in slide-in-from-bottom-10">

    {/* HEADER */}
    <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center bg-[#0a0a0f]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#0f0f18] border border-white/10 flex items-center justify-center overflow-hidden">
          <img src={logo} alt="VIRAX" className="w-6 h-6 object-contain" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-black uppercase tracking-widest text-xs text-white/90">VIRAX</h3>
          </div>
          <p className="text-[10px] text-white/30 tracking-widest uppercase">Analista Vision REDxax</p>
        </div>
      </div>
      <button onClick={() => setShowChat(false)} className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
        <X className="w-3.5 h-3.5 text-white/40" />
      </button>
    </div>

{/* MESSAGES */}
<div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">

  {chatMessages.map((msg, i) => (
    <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>

      {msg.role === 'bot' && (
        <div className="w-7 h-7 rounded-full bg-[#0f0f18] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
          <img src={logo} alt="VIRAX" className="w-5 h-5 object-contain" />
        </div>
      )}
      {msg.role === 'user' && (
        <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[9px] font-black text-purple-300">TÚ</span>
        </div>
      )}

      {/* Bubble + botón copiar agrupados */}
      <div className="flex flex-col gap-1 max-w-[78%]">
        <div className={`px-4 py-3 text-sm leading-relaxed font-medium ${
          msg.role === 'user'
            ? 'bg-purple-600/15 border border-purple-500/20 rounded-sm rounded-tl-2xl rounded-bl-2xl rounded-br-2xl text-purple-100/90'
            : 'bg-white/[0.03] border border-white/[0.07] rounded-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl text-white/80'
        }`}>
          {msg.role === 'bot' ? renderBotText(msg.text) : msg.text}
        </div>

        {/* Botón copiar — solo en mensajes del bot */}
        {msg.role === 'bot' && (
          <CopyButton text={msg.text} />
        )}
      </div>

    </div>
  ))}

  {isTyping && <TypingIndicator logo={logo} />}

  <div ref={chatEndRef} />
</div>

{/* INPUT */}
<div className="p-4 bg-black/50 border-t border-white/10">
  {chatLimitReached ? (
    <div className="flex items-center justify-center gap-2 py-3 px-5 bg-white/[0.03] border border-white/[0.07] rounded-2xl">
      <span className="text-lg">🔒</span>
      <p className="text-[11px] font-black uppercase tracking-widest text-white/30">
        Límite de consultas alcanzado
      </p>
    </div>
  ) : (
    <div className="bg-white/5 rounded-full p-2 flex items-center gap-2 px-6">
      <input
        type="text"
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !chatLimitReached && sendMessage()}
        placeholder="Escribe tu consulta..."
        className="bg-transparent border-none outline-none flex-1 text-sm text-white py-2 italic"
      />
      <button
        onClick={sendMessage}
        disabled={isTyping || !userInput.trim()}
        className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 p-3 rounded-full transition-all active:scale-90"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )}
</div>

</div>
)}
</div>
</div>
)}

{/* HISTORIAL */}
{history.length > 0 && step === 'upload' && (
  <div className="mt-20 max-w-5xl mx-auto px-4">
    <div className="flex items-center gap-3 mb-6">
      <div className="h-px flex-1 bg-white/5" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Análisis anteriores</p>
      <div className="h-px flex-1 bg-white/5" />
    </div>
    <div className="flex flex-wrap gap-3">
      {history.map((item) => (
        <button key={item.id}
          onClick={() => {
            setAiResult(item.analysis_data);
            setCurrentHistoryId(item.id);
            setAnalysisMode(item.mode);
            setCompletedSteps([]);
            setChatMessages(
  item.chat_messages?.length > 0
    ? item.chat_messages
    : [{ role: 'bot', text: `Análisis cargado: ${item.analysis_data.industria || 'contenido'}.` }]
);
            setStep('results');
          }}
          className="group flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-500/30 px-5 py-3 rounded-full transition-all"
        >
          <div className={`w-2 h-2 rounded-full ${item.mode === 'video' ? 'bg-purple-500' : 'bg-indigo-500'}`} />
          <span className="text-sm font-bold italic text-slate-300 group-hover:text-white transition-colors">{item.title}</span>
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
            {new Date(item.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
          </span>
        </button>
      ))}
    </div>
  </div>
)}
</main>

<style>{`
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
  @keyframes shimmer-text {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
  @keyframes virax-bar {
    0%, 100% { transform: scaleY(0.35); opacity: 0.35; }
    50%       { transform: scaleY(1);    opacity: 1;    }
  }
  @keyframes virax-cursor {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  .virax-bar {
    width: 2.5px;
    border-radius: 2px;
    background: rgba(168, 85, 247, 0.5);
    animation: virax-bar 1.1s ease-in-out infinite;
  }
  .virax-cursor {
    display: inline-block;
    width: 1.5px;
    height: 9px;
    background: rgba(192, 132, 252, 0.6);
    vertical-align: middle;
    margin-left: 1px;
    animation: virax-cursor 0.9s step-end infinite;
  }
`}</style>
</div>
);
};

export default App;
