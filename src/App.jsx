import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle,
  CheckSquare,
  Compass,
  FileText,
  Gem,
  MessageSquare,
  Microscope,
  RotateCcw,
  Send,
  Square,
  Target,
  TrendingUp,
  Upload,
  X,
  Zap
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { createClient } from '@supabase/supabase-js'; //phaseScores

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
  { id: 'large', label: 'Cuenta grande',   range: '100K – 500K', emoji: '⚡' },
  { id: 'mega',  label: 'Mega cuenta',     range: '500K+',       emoji: '👑' },
];

function extractGeminiText(data) {
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
  { id: 'starter', gems: 500,  price: 1.00, label: 'Starter', analyses: '5 análisis',  perGem: '$0.00002/gema', popular: false },
  { id: 'pro',     gems: 1000, price: 2.00, label: 'Pro',     analyses: '20 análisis', perGem: '$0.002/gema',   popular: true  },
  { id: 'elite',   gems: 6000, price: 5.00, label: 'Elite',   analyses: '60 análisis', perGem: '$0.001/gema',   popular: false },
];

function safeParseJSON(rawText, context = '') {
  try {
    return JSON.parse(rawText);
  } catch (firstErr) {
    console.warn(`JSON inválido en [${context}], intentando reparar...`);
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    try {
      const cleaned = rawText
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
        .replace(/\\n/g, ' ').replace(/\\t/g, ' ')
        .replace(/\n/g, ' ').replace(/\r/g, ' ');
      const match2 = cleaned.match(/\{[\s\S]*\}/);
      if (match2) return JSON.parse(match2[0]);
    } catch {}
    console.error(`JSON inválido en [${context}]:`, firstErr.message);
    throw new Error(`JSON malformado. Preview: "${rawText.slice(0, 80)}..."`);
  }
}


const buildSystemInstructions = (platform, followerRange, mode = 'video') => {
  // 1. CONSTANTES DE APOYO (Definidas antes de usarse)
  const platformNames = {
    tiktok: 'TikTok', 
    reels: 'Instagram Reels',
    shorts: 'YouTube Shorts', 
    all: 'TikTok, Instagram Reels y YouTube Shorts'
  };

  const followerLabels = {
    new: '0–1K seguidores', 
    small: '1K–10K', 
    mid: '10K–100K',
    large: '100K–500K', 
    mega: '500K+'
  };

  // 2. LÓGICA DE PRECISIÓN MUSICAL
  const musicLogic = `
BÚSQUEDA DE MÚSICA VIRAL — PROTOCOLO DE PRECISIÓN QUIRÚRGICA:

PASO 1 — EXTRACCIÓN DE ADN AUDITIVO:
Antes de buscar, definí estas 3 etiquetas obligatorias:
1. GÉNERO DEL VIDEO: (Terror, Humor, Educativo, Gaming, Estético, etc.)
2. INTENSIDAD: (Baja: relajante | Media: constante | Alta: frenética)
3. TONALIDAD: (Menor: triste/tenso | Mayor: alegre/épico)

PASO 2 — BÚSQUEDA CRUZADA (GOOGLE SEARCH):
Realizá búsquedas combinando el nicho y el ADN. Ejemplo de queries que DEBES usar:
- "best viral music for [GÉNERO DEL VIDEO] videos on ${platformNames[platform]} 2026"
- "trending [INTENSIDAD] bpm background music for [nicho] ${platformNames[platform]}"
- "what songs are creators using for [GÉNERO DEL VIDEO] right now"

PASO 3 — FILTRO DE COMPATIBILIDAD:
Prohibido sugerir una canción si su ritmo no coincide con el "Ritmo detectado" del video.
Si el video es de TERROR, buscá específicamente "Dark Ambient" o "Tension cinematic". 
Si es de HUMOR, buscá "Silly Jazz" o "Upbeat Lo-fi".`;

  // 3. INSTRUCCIONES DE FASES
  const phaseInstructions = mode === 'video'
    ? `Analizá estas 4 fases adaptadas al formato visual:
- FASE 1 — Hook: ¿El primer frame detiene el scroll?
- FASE 2 — Estructura: ¿Hay un arco o recompensa final?
- FASE 3 — Edición (Ritmo & Energía): ¿Los cortes coinciden con la energía del video? REGLA CRÍTICA: La clave "edicion" debe estar siempre en el JSON.
- FASE 4 — Autenticidad: ¿Se siente genuino dentro de su nicho?`
    : `Analizá estas 3 fases para el guion:
- FASE 1 — Hook: ¿El texto atrapa en 3 segundos?
- FASE 2 — Estructura: ¿La narrativa mantiene el interés?
- FASE 3 — Credibilidad: ¿El lenguaje suena a experto?`;

  // 4. EL PROMPT FINAL (Un solo return con todo integrado)
  return `Sos REDXAX VISION, un analista experto en contenido viral para redes sociales.
Tu trabajo es ayudar al creador a maximizar el potencial en ${platformNames[platform]}.
La cuenta tiene ${followerLabels[followerRange]}.

${musicLogic}

PASO OBLIGATORIO — INVESTIGACIÓN EN TIEMPO REAL:
Antes de analizar, buscá en Google qué es viral hoy en el nicho de este video en ${platformNames[platform]}. 
Compará el video con los 3 más virales del mes. No adivines.

REGLA DE ORO PARA EL ANÁLISIS:
Si el video no tiene voz, evaluá el impacto visual. No penalices la falta de voz si el formato es visual/estético.

ANÁLISIS POR FASES:
${phaseInstructions}

FORMA DE HABLAR:
Hablá como un editor senior de InterXAX: directo, simple, sin términos complejos que un chico de 15 años no entienda.

Devolvé ÚNICAMENTE este JSON sin texto extra:
{
  "potentialScore": 0,
  "performanceScenario": "",
  "honestVerdict": "",
  "trendContext": "",
  "phaseScores": {
    "hook": { "score": 0, "label": "Hook & Primeros 3s", "verdict": "", "consequence": "" },
    "estructura": { "score": 0, "label": "Estructura & Narrativa", "verdict": "", "consequence": "" }${mode === 'video' ? `,
    "edicion": { "score": 0, "label": "Ritmo & Energía", "verdict": "", "consequence": "" }` : ''},
    "credibilidad": { "score": 0, "label": "Autenticidad & Nicho", "verdict": "", "consequence": "" }
  },
  "platformScores": {
    "tiktok": { "score": 0, "verdict": "", "topTip": "" },
    "reels": { "score": 0, "verdict": "", "topTip": "" },
    "shorts": { "score": 0, "verdict": "", "topTip": "" }
  },
  "styleProfile": { "detectedTone": "", "detectedRhythm": "", "uniqueStrength": "" },
  "vision": { "niche": "", "type": "", "audience": "", "promise": "" },
  "hookScore": 0,
  "retentionData": { "at3s": "", "at10s": "", "final": "" },
  "retentionCurve": [],
  "weakestMoment": "",
  "musicSuggestions": [
    { "title": "", "artist": "", "why": "", "available": "" },
    { "title": "", "artist": "", "why": "", "available": "" },
    { "title": "", "artist": "", "why": "", "available": "" }
  ],
  "roadmap": ["", "", "", ""]
}`;
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

const App = () => {
  const [step, setStep] = useState('upload');
  const [analysisMode, setAnalysisMode] = useState('video');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [selectedFollowerRange, setSelectedFollowerRange] = useState(null);
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
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
useEffect(() => {
  const handleOrientation = (e) => {
    const x = Math.min(Math.max(e.gamma / 90, -1), 1);
    const y = Math.min(Math.max(e.beta / 90, -1), 1);
    setTilt({ x, y });
  };
  window.addEventListener('deviceorientation', handleOrientation);
  return () => window.removeEventListener('deviceorientation', handleOrientation);
}, []);

  const chatEndRef = useRef(null);
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    if (showChat) scrollToBottom();
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
        }
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
        setGems(!gemsError && gemsData?.balance !== undefined ? gemsData.balance : 500);

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

  const captureFrames = (url) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.preload = "auto";
      const frames = [];
      video.onloadedmetadata = async () => {
        const duration = video.duration;
        const points = [0.1, 1.5, 3.0, duration * 0.5, duration * 0.9];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < points.length; i++) {
          const targetTime = Math.min(points[i], duration);
          setStatusText(`Analizando estructura visual... ${i+1}/${points.length}`);
          setAnalysisProgress(Math.round(10 + (i * 18)));
          video.currentTime = targetTime;
          await new Promise(r => {
            const onSeeked = () => { video.removeEventListener('seeked', onSeeked); r(); };
            video.addEventListener('seeked', onSeeked);
          });
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.5).split(',')[1]);
        }
        resolve(frames);
      };
    });
  };  //Potencial Real

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

  const deductGems = async (amount, reason) => {
    const userId = localStorage.getItem('redxax_user_id');
    const { data, error } = await supabase.functions.invoke('deduct-gems', {
      body: { userId, amount, reason }
    });
    if (error || !data?.success) {
      if (data?.error === 'Saldo insuficiente') {
        alert(`Gemas insuficientes. Tenés ${data.balance} y necesitás ${amount}.`);
        setShowGemStore(true);
      } else {
        alert('Error al procesar las gemas. Intentá de nuevo.');
      }
      return false;
    }
    setGems(data.newBalance);
    return true;
  };

  const saveAnalysisToHistory = async (result, mode) => {
    const userId = localStorage.getItem('redxax_user_id');
    if (!userId) return;
    const title = `${result.vision?.niche || 'Contenido'} — ${result.vision?.type || mode}`;
    const { data, error } = await supabase
      .from('analysis_history')
      .insert({ user_id: userId, title, mode, analysis_data: result })
      .select().single();
    if (!error && data) {
      setHistory(prev => [data, ...prev]);
      setCurrentHistoryId(data.id);
    }
  };

  const runNeuralAnalysis = async (url, platform, followerRange) => {
  const duration = await new Promise((resolve) => {
    const v = document.createElement('video');
    v.src = url;
    v.onloadedmetadata = () => resolve(v.duration);
  });
  const minutes = Math.ceil(duration / 60);
  const cost = Math.min(minutes * 100, 600);
  const approved = await deductGems(cost, `video:${minutes}`);
  if (!approved) return;

  setStep('analyzing');
  setAnalysisMode('video');
  setStatusText("Iniciando escaneo de InterXAX...");
  setAnalysisProgress(10);

  try {
    const base64Frames = await captureFrames(url);
    setAnalysisProgress(80);
    setStatusText("Investigando tendencias y conectando con REDxax...");

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        // CAMBIO AQUÍ: Se agregó 'video'
        text: `${buildSystemInstructions(platform, followerRange, 'video')}\n\nAnaliza estos frames del video.`,
        frames: base64Frames
      }
    });

    if (error) throw error;

    const rawText = extractGeminiText(data);
    const parsed = safeParseJSON(rawText, 'runNeuralAnalysis');

    setAiResult(parsed);
    setCompletedSteps([]);
    setChatMessages([{
      role: 'bot',
      text: `Protocolo REDxax: Análisis de ${parsed.vision?.niche || 'contenido'} finalizado. Potencial: ${parsed.potentialScore}%. ¿Deseas profundizar en la consultoría?`
    }]);

    setAnalysisProgress(100);
    await saveAnalysisToHistory(parsed, 'video');
    setTimeout(() => setStep('results'), 500);
  } catch (err) {
    console.error("DETALLE DEL ERROR VIDEO:", err);
    alert("Error en el análisis de video. Revisa la consola.");
    setStep('upload');
  }
};
  const runScriptAnalysis = async (platform, followerRange) => {
  if (!scriptText.trim()) return;
  const approved = await deductGems(80, 'script');
  if (!approved) return;

  setStep('analyzing');
  setAnalysisMode('script');
  setStatusText("Investigando tendencias y evaluando guion...");
  setAnalysisProgress(30);

  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        // CAMBIO AQUÍ: Se agregó 'script'
        text: `${buildSystemInstructions(platform, followerRange, 'script')}\n\nAnaliza este concepto/guion: ${scriptText}`
      }
    });

    if (error) throw error;

      setAnalysisProgress(90);
      const rawText = extractGeminiText(data);
      const parsed = safeParseJSON(rawText, 'runScriptAnalysis');

      setAiResult(parsed);
      setCompletedSteps([]);
      setChatMessages([{
        role: 'bot',
        text: `Protocolo REDxax: Análisis de Pre-producción listo. Potencial proyectado: ${parsed.potentialScore}%. ¿Deseas optimizar el texto?`
      }]);

      setAnalysisProgress(100);
      await saveAnalysisToHistory(parsed, 'script');
      setTimeout(() => setStep('results'), 500);
    } catch (err) {
      console.error("Error Script:", err);
      alert("Error al analizar el guion.");
      setStep('upload');
    }
  };

  const saveChatToHistory = async (messages) => {
    if (!currentHistoryId) return;
    await supabase.from('analysis_history').update({ chat_messages: messages }).eq('id', currentHistoryId);
  };

  const sendMessage = async () => {
  if (!userInput.trim() || isTyping) return;

  const newMessages = [...chatMessages, { role: 'user', text: userInput }];
  setChatMessages(newMessages);
  setUserInput("");
  setIsTyping(true);

  try {
    // 1. Preparamos el contexto de música (lo que ya investigó la visión)
    const musicContext = aiResult?.musicSuggestions?.length
      ? `\n\n⚠️ MÚSICA INVESTIGADA PARA ESTE VIDEO:
${aiResult.musicSuggestions.map((m, i) =>
        `${i + 1}. "${m.title}" de ${m.artist}
         → Match: ${m.why}
         → Plataformas: ${m.available}`
      ).join('\n')}`
      : '';

    // 2. Definimos el System Prompt que te pasé (El que le da el "vibe" de consultor)
    const systemPrompt = `Sos el Consultor Senior de REDxax VISION. 
Tu objetivo es que el usuario entienda la relación entre lo que VE y lo que ESCUCHA.

ANÁLISIS DE ATMÓSFERA:
- Nicho: ${aiResult?.vision?.niche || 'General'}
- Estilo: ${aiResult?.styleProfile?.detectedRhythm || 'Normal'}
- Tono: ${aiResult?.styleProfile?.detectedTone || 'Neutro'}

${musicContext}

REGLAS CRÍTICAS DE RESPUESTA:
1. Si preguntan por música: Usá SOLO las de arriba. Explicá el 'Match' técnico (ej. "encaja con tus cortes").
2. Validación de Universo: Si el video es de ${aiResult?.vision?.niche}, asegurate que la música sea coherente (ej: Phonk para Gaming, Cinematic para Terror).
3. Honestidad Brutal: Si la música de tendencia no pega con el tono "${aiResult?.styleProfile?.detectedTone}", decilo.
4. Regla de Cards: Si preguntan por edición, usá los datos de "phaseScores.edicion" del análisis JSON.

ANÁLISIS COMPLETO DEL VIDEO (JSON): ${JSON.stringify(aiResult)}`;

    const conversationHistory = newMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    // 3. Llamada a tu proxy de Gemini
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: systemPrompt,
        messages: conversationHistory
      }
    });

    if (error) throw error;

    const botResponse = extractGeminiText(data);
    const updatedMessages = [...newMessages, { role: 'bot', text: botResponse }];
    setChatMessages(updatedMessages);
    
    await saveChatToHistory(updatedMessages);

  } catch (err) {
    console.error("Error Chat:", err);
    setChatMessages([...newMessages, { role: 'bot', text: "Che, se cortó la conexión. Intentá de nuevo." }]);
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

  return (
    <div className="min-h-screen bg-[#020203] text-white font-sans selection:bg-purple-500/50 overflow-x-hidden">
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

      {/* CONTADOR */}
      <div className="fixed top-6 right-6 z-50 flex flex-col items-end gap-2">
        {!isLoadingCount && (
          <>
            <div className="flex items-center gap-2 bg-black/60 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-sm font-black italic tracking-tight">{userCount}/500 usuarios</span>
            </div>
            <div className="w-64 h-2 bg-white/5 border border-white/10 rounded-full overflow-hidden shadow-lg">
              <div className={`h-full rounded-full transition-all duration-500 ${userCount >= 500 ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}
                style={{ width: `${progressPercent}%` }} />
            </div>
            {userCount >= 500 && <div className="text-2xl animate-bounce">🎉</div>}
          </>
        )}
      </div>

      <header className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-xl shadow-lg transition-transform group-hover:scale-110">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter italic uppercase">RED<span className="text-purple-500">xax</span> VISION</h1>
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
      <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
        <Microscope className="w-3 h-3" /> Precisión 500% — Analista Neutro
      </div>
      <h2 className="text-7xl md:text-9xl font-black italic tracking-tighter leading-none uppercase">
        ¿TU VIDEO<br/>
        <span className="bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent">VA A VIRAL?</span>
      </h2>
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
            setPendingVideoUrl(url);
            setAnalysisMode('video');
            setStep('platform_select');
          }
        }} />
      </label>
    </div>
  </div>
)}
        {/* ── SELECCIÓN DE PLATAFORMA ── */}
        {step === 'platform_select' && (
          <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-10 duration-500">
            <div className="bg-white/[0.02] border border-white/10 rounded-[4rem] p-12 md:p-16 shadow-2xl">
              <div className="mb-10 text-center">
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                  <TrendingUp className="w-3 h-3" /> Paso previo al análisis
                </div>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">
                  ¿Dónde vas a publicar?
                </h3>
                <p className="text-slate-400 mt-3 font-medium">
                  Cada plataforma tiene su propio algoritmo.<br/>El análisis se calibra según tu objetivo.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 mb-10">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatform(p.id)}
                    className={`flex items-center gap-4 p-5 rounded-[2rem] border transition-all text-left
                      ${selectedPlatform === p.id
                        ? 'border-purple-500/60 bg-purple-500/15 scale-[1.02]'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'}`}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <div>
                      <p className="font-black italic text-white">{p.label}</p>
                      {selectedPlatform === p.id && (
                        <p className="text-purple-400 text-[10px] font-black uppercase tracking-wider mt-0.5">✓ Seleccionado</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <button onClick={() => { setStep('upload'); setPendingVideoUrl(null); setSelectedPlatform(null); }}
                  className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">
                  ← Volver
                </button>
                <button
                  disabled={!selectedPlatform}
                  onClick={() => {
                    if (analysisMode === 'video' && pendingVideoUrl) {
                      runNeuralAnalysis(pendingVideoUrl, selectedPlatform);
                    } else {
                      runScriptAnalysis(selectedPlatform);
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

      {/* PHASE SCORES */}
      <div className="space-y-3">
        {/* Score general */}
        <ShinyCard tilt={tilt} className="flex items-center justify-between bg-black/40 border border-white/10 rounded-[2rem] px-6 py-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-1">Score General</p>
            <p className="text-[10px] font-bold italic text-slate-400">{aiResult.performanceScenario}</p>
          </div>
          <span className={`text-5xl font-black italic tabular-nums ${aiResult.potentialScore >= 70 ? 'text-green-400' : aiResult.potentialScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {aiResult.potentialScore}%
          </span>
        </ShinyCard>

        {/* Tarjetas de fases */}
        {aiResult.phaseScores && Object.values(aiResult.phaseScores).map((phase, i) => {
          if (!phase) return null;
          const isCritical = phase.score < 50;
          return (
            <ShinyCard key={i} tilt={tilt} className={`rounded-[2rem] border p-5 transition-all ${
              isCritical
                ? 'border-red-500/40 bg-red-500/[0.08]'
                : phase.score >= 75
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-white/10 bg-white/[0.02]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isCritical && (
                    <span className="bg-red-500 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                      CRÍTICO
                    </span>
                  )}
                  <p className={`text-xs font-black uppercase tracking-wider ${isCritical ? 'text-red-400' : 'text-slate-300'}`}>
                    {phase.label}
                  </p>
                </div>
                <span className={`text-2xl font-black italic tabular-nums ${
                  isCritical ? 'text-red-400' : phase.score >= 75 ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {phase.score}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isCritical ? 'bg-gradient-to-r from-red-600 to-red-400'
                    : phase.score >= 75 ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                    : 'bg-gradient-to-r from-yellow-500 to-amber-400'
                  }`}
                  style={{ width: `${phase.score}%` }}
                />
              </div>
              <p className={`text-xs font-bold italic ${isCritical ? 'text-red-300/80' : 'text-slate-400'}`}>
                {phase.verdict}
              </p>
              {isCritical && phase.consequence && (
                <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-[1rem] p-3">
                  <span className="text-red-400 text-xs mt-0.5">⚠</span>
                  <p className="text-red-300 text-[11px] font-bold leading-relaxed">{phase.consequence}</p>
                </div>
              )}
            </ShinyCard>
          );
        })}

        {/* Trend context */}
        {aiResult.trendContext && (
          <ShinyCard tilt={tilt} className="bg-black/30 border border-white/5 rounded-[2rem] p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-green-400">Tendencias Detectadas</p>
            </div>
            <p className="text-xs font-bold italic leading-relaxed text-slate-400">"{aiResult.trendContext}"</p>
          </ShinyCard>
        )}

        {/* Veredicto */}
        <ShinyCard tilt={tilt} className="bg-black/30 border border-white/5 rounded-[2rem] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Target className={`w-3 h-3 ${analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'}`} />
            <p className={`text-[9px] font-black uppercase tracking-[0.4em] ${analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'}`}>Veredicto</p>
          </div>
          <p className="text-xs font-bold italic leading-relaxed text-slate-300">"{aiResult.honestVerdict}"</p>
        </ShinyCard>
      </div>
    </div>

    <div className="lg:col-span-8 space-y-6">

      {/* PLATFORM SCORES */}
      {aiResult.platformScores && (
        <ShinyCard tilt={tilt} className="bg-white/[0.02] border border-white/10 p-10 rounded-[4rem] space-y-6">
          <div className="flex items-center gap-4">
            <TrendingUp className="text-green-400" />
            <h3 className="text-2xl font-black italic uppercase tracking-tighter">Score por Plataforma</h3>
          </div>
          <div className="space-y-4">
            {[
              { key: 'tiktok',  label: 'TikTok',          emoji: '🎵' },
              { key: 'reels',   label: 'Instagram Reels',  emoji: '📸' },
              { key: 'shorts',  label: 'YouTube Shorts',   emoji: '▶️' },
            ].map(({ key, label, emoji }) => {
              const p = aiResult.platformScores[key];
              if (!p) return null;
              return (
                <div key={key} className="bg-black/30 rounded-[2rem] p-6 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{emoji}</span>
                      <div>
                        <p className="font-black italic text-white text-sm">{label}</p>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{p.verdict}</p>
                      </div>
                    </div>
                    <span className={`text-2xl font-black italic tabular-nums ${platformColors[key]}`}>
                      {p.score}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        key === 'tiktok' ? 'bg-gradient-to-r from-pink-500 to-red-500' :
                        key === 'reels'  ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                        'bg-gradient-to-r from-red-500 to-orange-500'
                      }`}
                      style={{ width: `${p.score}%` }}
                    />
                  </div>
                  <p className="text-slate-400 text-xs font-bold italic">💡 {p.topTip}</p>
                </div>
              );
            })}
          </div>
        </ShinyCard>
      )}

      {/* VISIÓN */}
      <ShinyCard tilt={tilt} className="bg-white/[0.03] border border-white/5 p-10 rounded-[3.5rem] space-y-6">
        <div className="flex items-center gap-4">
          <Compass className={analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'} />
          <h3 className="text-2xl font-black italic uppercase tracking-tighter">La Visión</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-white/5 pt-6">
          <div><p className="text-[9px] font-black uppercase text-slate-500 mb-1">Nicho</p><p className="text-sm font-bold italic text-white">{aiResult.vision.niche}</p></div>
          <div><p className="text-[9px] font-black uppercase text-slate-500 mb-1">Tipo</p><p className="text-sm font-bold italic text-white">{aiResult.vision.type}</p></div>
          <div><p className="text-[9px] font-black uppercase text-slate-500 mb-1">Público</p><p className="text-sm font-bold italic text-white">{aiResult.vision.audience}</p></div>
          <div><p className="text-[9px] font-black uppercase text-slate-500 mb-1">Promesa</p><p className="text-sm font-bold italic text-white">{aiResult.vision.promise}</p></div>
        </div>
      </ShinyCard>

      {/* RETENCIÓN */}
      <ShinyCard tilt={tilt} className="bg-white/[0.02] border border-white/10 p-10 rounded-[4rem]">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <BarChart3 className={analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'} />
            <h3 className="text-xl font-black italic uppercase tracking-tight">Proyección de Retención</h3>
          </div>
          <div className="grid grid-cols-3 gap-8">
            <div className="text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">3s</p><p className="text-xl font-black italic">{aiResult.retentionData.at3s}</p></div>
            <div className="text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">10s</p><p className="text-xl font-black italic">{aiResult.retentionData.at10s}</p></div>
            <div className="text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">Final</p><p className="text-xl font-black italic">{aiResult.retentionData.final}</p></div>
          </div>
        </div>
        <div className="relative h-48 w-full flex items-end gap-1 px-2 border-b border-white/5">
          {(aiResult.retentionCurve || []).map((val, i) => (
            <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
              <div
                className={`w-full rounded-t-lg transition-all duration-700 ${val < 40 ? 'bg-red-500/30 border-red-500/40' : (analysisMode === 'video' ? 'bg-purple-600/30 border-purple-600/40' : 'bg-indigo-600/30 border-indigo-600/40')} border-x border-t`}
                style={{ height: `${val}%` }}
              />
            </div>
          ))}
        </div>
      </ShinyCard>

      {/* HOJA DE RUTA */}
      <ShinyCard tilt={tilt} className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-8">
        <div className="flex items-center gap-4">
          <CheckCircle className="text-green-500" />
          <h3 className="text-2xl font-black italic uppercase tracking-tighter">Hoja de Ruta</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(aiResult.roadmap || []).map((step, i) => {
            const isCompleted = completedSteps.includes(i);
            return (
              <div key={i} onClick={() => toggleStep(i)}
                className={`flex items-center gap-6 p-6 rounded-[2.5rem] transition-all cursor-pointer border ${isCompleted ? 'bg-green-500/10 border-green-500/30 opacity-50' : 'bg-black/40 border-white/5 hover:border-purple-500/30'}`}>
                <div className={`shrink-0 transition-colors ${isCompleted ? 'text-green-400' : 'text-slate-600'}`}>
                  {isCompleted ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                </div>
                <p className={`font-bold italic text-sm transition-all ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{step}</p>
              </div>
            );
          })}
        </div>
      </ShinyCard>

      {/* CHAT */}
      {!showChat ? (
        <button onClick={() => setShowChat(true)} className="w-full flex items-center justify-center gap-3 p-8 bg-zinc-600/10 hover:bg-zinc-600/20 border border-white/10 rounded-[3rem] text-slate-400 font-black italic uppercase tracking-tighter transition-all">
          <MessageSquare className="w-5 h-5" /> Consultoría Técnica de Visión
        </button>
      ) : (
        <div className="bg-[#0a0a0c] border border-white/10 rounded-[3.5rem] overflow-hidden flex flex-col h-[550px] shadow-2xl animate-in slide-in-from-bottom-10">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="bg-zinc-800 p-2 rounded-xl border border-white/10"><Bot className="w-4 h-4 text-white" /></div>
              <h3 className="font-black italic uppercase tracking-tighter text-sm text-zinc-400">Analista Vision REDxax</h3>
            </div>
            <button onClick={() => setShowChat(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-5 rounded-[2rem] ${msg.role === 'user' ? 'bg-white text-black rounded-br-none' : 'bg-white/5 border border-white/10 text-slate-300 rounded-bl-none'}`}>
                  <p className="text-sm font-bold italic leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            {isTyping && <div className="text-[10px] text-zinc-500 animate-pulse font-black uppercase ml-2 italic tracking-widest">Calculando respuesta técnica...</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-6 bg-black/50 border-t border-white/10">
            <div className="bg-white/5 rounded-full p-2 flex items-center gap-2 px-6">
              <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Escribe tu consulta..."
                className="bg-transparent border-none outline-none flex-1 text-sm text-white py-2 italic" />
              <button onClick={sendMessage} className="bg-zinc-700 hover:bg-zinc-600 p-3 rounded-full transition-all active:scale-90"><Send className="w-4 h-4" /></button>
            </div>
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
                        : [{ role: 'bot', text: `Análisis cargado: ${item.analysis_data.vision?.niche || 'contenido'}. Potencial: ${item.analysis_data.potentialScore}%.` }]
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
                </button>  //{/* ── UPLOAD ── */}
              ))}
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;