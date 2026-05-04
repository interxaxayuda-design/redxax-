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
  Users,
  X,
  Zap
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import logo from './assets/logo.png';

import { createClient } from '@supabase/supabase-js'; //phaseScores  //toggleStep

const supabaseUrl = 'https://mvmilbpraefwprexgnpz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12bWlsYnByYWVmd3ByZXhnbnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjA1MzcsImV4cCI6MjA4ODUzNjUzN30.xH72_trpTpJhtZJw0BXI-Sewp9vnbBigKhmVBNI4wso';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

const PLATFORMS = [
  { id: 'tiktok',   label: 'TikTok',               emoji: '🎵' }, //text: `${buildSystemInstructions(platform, followerRange, 'script', {}, selectedObjetivo)}\n\nAnaliza este concepto/guion: ${scriptText}`
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
  { id: 'starter', gems: 500,  price: 3,  label: 'Starter', analyses: '5 análisis',  popular: false },
  { id: 'pro',     gems: 1000, price: 6,  label: 'Pro',     analyses: '10 análisis', popular: true  },
  { id: 'elite',   gems: 6000, price: 15, label: 'Elite',   analyses: '60 análisis', popular: false },
];

function safeParseJSON(rawText, context = '') {
  try {
    return JSON.parse(rawText);
  } catch (firstErr) {
    console.warn(`JSON inválido en [${context}], intentando reparar...`);
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);       //REDxax VISION
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


const buildVideoAnalysisPrompt = (platform, followerRange, objetivo = 'ventas') => {

  const platformNames = {
    tiktok: 'TikTok', reels: 'Instagram Reels',
    shorts: 'YouTube Shorts', all: 'TikTok, Reels y Shorts'
  };

  const nicheFrameworks = {
    inmobiliaria: `
CRITERIOS DE VENTA — INMOBILIARIA:
- ¿Se ve el interior del inmueble en los primeros 3s?
- ¿El precio o rango de precio es visible o mencionado?
- ¿Hay una emoción de "quiero vivir ahí"?
- ¿Se muestra la zona o ubicación como beneficio?
- ¿Hay urgencia real (pocas unidades, oferta limitada)?
- ¿El llamado a la acción dice exactamente qué hacer?
Si faltan 3 o más → el video NO convierte consultas.`,

    producto_fisico: `
CRITERIOS DE VENTA — PRODUCTO FÍSICO:
- ¿Se ve el producto en uso en los primeros 3s?
- ¿El resultado del producto es visible y deseable?
- ¿Hay prueba social (testimonio, cantidad de ventas)?
- ¿El precio aparece antes del CTA?
- ¿La compra parece fácil e inmediata?
Si faltan 3 o más → el video NO genera compras impulsivas.`,

    digital: `
CRITERIOS DE VENTA — PRODUCTO DIGITAL / CURSO:
- ¿El problema que resuelve queda claro en 3s?
- ¿Muestra resultado concreto (no el proceso, el resultado)?
- ¿Hay credibilidad del creador visible?
- ¿El precio o acceso está claro?
- ¿El CTA es específico (no "más info", sino qué hacer ahora)?
Si faltan 3 o más → el video NO convierte leads.`,

    impulsivo: `
CRITERIOS DE VENTA — COMPRA IMPULSIVA:
- ¿Genera FOMO (miedo a perdérselo) en los primeros 5s?
- ¿El precio parece una ganga obvia?
- ¿La compra se puede hacer en menos de 2 clics?
- ¿Hay escasez visible (últimas unidades, tiempo limitado)?
Si faltan 2 o más → el video pierde la venta por fricción.`
  };

  const retentionRules = {
    tiktok:  'Corte cada 2-3s. Hook en segundo 0. Texto en pantalla obligatorio.',
    reels:   'Hook visual en segundo 0-1. Ritmo constante. Audio trending suma.',
    shorts:  'Primer frame debe ser el momento más impactante. Sin intros.',
    all:     'Hook en segundo 0. Ritmo alto. Texto en pantalla. Sin intros.'
  };

  return `Sos un analizador de videos de ventas para redes sociales. Tu trabajo es evaluar si este video específico vende y retiene, usando criterios concretos. No investigues. No supongas. Solo analizá lo que ves.

CONTEXTO:
Plataforma: ${platformNames[platform]}
Seguidores: ${followerRange}
Objetivo del creador: ${objetivo.toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 1 — IDENTIFICÁ EL NICHO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Determiná a cuál pertenece este video:
- Inmobiliaria / Real Estate
- Producto Físico
- Producto Digital / Curso
- Compra Impulsiva / Ecommerce

Esto define qué criterios aplicar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2 — EVALUÁ LA RETENCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reglas fijas para ${platformNames[platform]}:
${retentionRules[platform]}

Evaluá estos 5 puntos con SÍ o NO y por qué:
1. ¿El hook detiene el scroll en 0-2 segundos?
2. ¿Hay cambio visual o de información cada 3-5 segundos?
3. ¿El cerebro tiene razones para seguir viendo?
4. ¿Genera una emoción concreta (curiosidad, deseo, sorpresa)?
5. ¿El ritmo es acorde a la plataforma?

Si 2 o más son NO → retención baja. Penalizá fuerte el score.

HOOK — analizalo con estos 4 criterios:
- ¿Interrumpe el patrón visual del feed?
- ¿En 2 segundos queda claro de qué trata?
- ¿Genera curiosidad o hace una promesa implícita?
- ¿Hay emoción o movimiento visible desde el primer frame?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 3 — EVALUÁ LA VENTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aplicá el framework según el nicho detectado:

${Object.values(nicheFrameworks).join('\n')}

Además, evaluá estos 5 elementos universales de venta:
1. Problema claro → el espectador se identifica
2. Deseo fuerte → muestra el resultado que quiere
3. Prueba o credibilidad → genera confianza
4. Claridad de oferta → qué es exactamente lo que se vende
5. Llamado a la acción → qué hacer ahora mismo

Si faltan más de 2 → el video NO vende. Decilo claro.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 4 — SIMULÁ UN USUARIO REAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este usuario está scrolleando sin pensar, distraído, buscando entretenimiento.
Respondé:
1. ¿Para el scroll en el segundo 0-1? ¿Por qué sí o no?
2. ¿Sigue viendo hasta el segundo 3?
3. ¿En qué segundo exacto pierde interés?
4. ¿Siente alguna emoción? ¿Cuál?
5. ¿Tiene razones para quedarse hasta el final?

Sé brutal y realista. Si el video no frenaría a alguien distraído, penalizá fuerte.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 5 — CALCULÁ LOS SCORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETENCIÓN (suma estos 4, resultado sobre 100):
- Hook inicial: 0-25
- Ritmo y cortes: 0-25
- Claridad del mensaje: 0-25
- Curiosidad o emoción generada: 0-25

VENTA (suma estos 4, resultado sobre 100):
- Claridad de oferta: 0-25
- Deseo generado: 0-25
- Confianza transmitida: 0-25
- Llamado a la acción: 0-25

REGLA ESTRICTA: No podés dar un score alto si tu explicación es débil. Si dudás, bajá el score.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÓMO ESCRIBIR LAS RESPUESTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Escribí como si le hablaras a alguien que nunca estudió marketing
- Si usás una palabra técnica, explicala entre paréntesis
- Sé directo: si el video no vende, decilo sin rodeos pero con empatía
- Nada de frases vacías como "es un buen comienzo"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — SOLO JSON, NADA MÁS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "00_razonamiento_interno": "<Análisis técnico interno. Máx 300 chars.>",
  "objetivo": "${objetivo}",
  "nicheDetected": "<inmobiliaria | producto_fisico | digital | impulsivo>",

  "vision": {
    "niche": "<Nicho detectado en palabras simples>",
    "type": "<Formato del video>",
    "audience": "<Quién miraría esto, explicado simple>",
    "promise": "<Qué promete el video>"
  },

  "viralScore": {
    "score": <0-100>,
    "titulo": "Potencial de Visualizaciones",
    "verdict": "<Veredicto simple, máx 10 palabras>",
    "razon_principal": "<Por qué se quedarían mirando o no. Sin tecnicismos.>",
    "accion_clave": "<Un cambio concreto para mejorar la retención>"
  },

  "salesScore": {
    "score": <0-100>,
    "titulo": "Potencial de Venta",
    "verdict": "<Veredicto simple, máx 10 palabras>",
    "razon_principal": "<Por qué genera o no ganas de comprar. Simple.>",
    "accion_clave": "<Un cambio concreto para vender más>"
  },

  "productAnalysis": {
    "type": "<alto valor | bajo valor | digital | impulsivo>",
    "buyingBehavior": "<Cómo decide comprar ese cliente, explicado simple>",
    "missingElements": ["<Qué falta para que venda, uno por item>"]
  },

  "salesAngle": {
    "type": "<Problema | Deseo | Oportunidad | Prueba social>",
    "clarity": <0-100>,
    "improvement": "<Cómo mejorar el ángulo de venta, simple>"
  },

  "psicologiaVentas": {
    "emocionGenerada": "<Qué emoción genera o debería generar>",
    "momentoDeseo": "<Segundo donde dan ganas de comprar, o 'ninguno'>",
    "conversionScore": <0-100>
  },

  "dropOffPoints": [
    {
      "second": <número>,
      "reason": "<Por qué la gente se va en ese momento, simple>",
      "fix": "<Qué cambiar para evitarlo>"
    }
  ],

  "hookDNA": {
    "pattern": "<Tipo de gancho: Curiosidad | Problema | Sorpresa | Deseo>",
    "strength": <0-100>,
    "missingElement": "<Qué le falta al gancho>",
    "optimizedHook": "<Ejemplo concreto de cómo empezar el video para atrapar más>"
  },

  "honestVerdict": "<300-400 chars. Resumen directo y empático. Como si le hablaras a alguien que no sabe nada de marketing. Decile si vende o no, y por qué.>",

  "roadmap": [
    "<Acción 1: [Segundo exacto] → [Qué cambiar] → [Por qué funciona, sin tecnicismos]>",
    "<Acción 2: [Segundo exacto] → [Qué ajustar] → [Explicación simple]>",
    "<Acción 3: [Cambio rápido] → [Por qué aumenta ventas o vistas]>"
  ]
}`;
};

const buildResearchPrompt = (fase1Result, platform, objetivo) => {

  const platformNames = {
    tiktok: 'TikTok', reels: 'Instagram Reels',
    shorts: 'YouTube Shorts', all: 'TikTok, Reels y Shorts'
  };

  return `Sos un investigador de tendencias de contenido para redes sociales. 
Tenés los datos de un video ya analizado y tu trabajo es buscar qué está funcionando HOY para ese nicho específico.

DATOS DEL VIDEO ANALIZADO:
- Nicho: ${fase1Result.vision?.niche}
- Tipo de producto: ${fase1Result.productAnalysis?.type}
- Hook detectado: ${fase1Result.hookDNA?.pattern} (fuerza: ${fase1Result.hookDNA?.strength}/100)
- Plataforma: ${platformNames[platform]}
- Objetivo: ${objetivo}
- Lo que le falta al hook: ${fase1Result.hookDNA?.missingElement}
- Elementos de venta que faltan: ${fase1Result.productAnalysis?.missingElements?.join(', ')}

TU TAREA — Investigá estas 3 cosas con búsqueda real:

1. HOOKS VIRALES HOY
¿Qué tipo de hooks están funcionando en ${platformNames[platform]} para el nicho "${fase1Result.vision?.niche}" en este momento?
Buscá ejemplos recientes. No inventes. Si no encontrás datos concretos, decilo.

2. ESTRUCTURA QUE CONVIERTE
¿Qué estructura de video está generando más ventas o consultas para este tipo de producto en ${platformNames[platform]} actualmente?

3. COMPARACIÓN DIRECTA
Comparando lo que tiene este video con lo que está funcionando hoy:
¿Cuál es la brecha más grande?
¿Qué cambio único generaría el mayor impacto?

REGLAS:
- Solo reportá lo que encontrés con búsqueda real
- Si algo no está claro, decí "no encontré datos suficientes sobre esto"
- No mezcles tu opinión con los datos encontrados
- Sé específico: ejemplos concretos, no generalidades

RESPONDE SOLO EN ESTE JSON, SÉ CONCISO:
{
  "trendResearch": {
    "hooksWorking": "<Máx 100 chars: hooks que funcionan HOY>",
    "topStructure": "<Máx 100 chars: estructura que más convierte>",
    "sourceQuality": "<alta | media | baja>",
    "researchDate": "<fecha>"
  },
  "gapAnalysis": {
    "biggestGap": "<Máx 80 chars: diferencia más grande>",
    "quickWin": "<Máx 80 chars: cambio de mayor impacto>",
    "competitiveAdvantage": "<Máx 80 chars: qué hace bien el video>"
  },
  "updatedHook": "<Máx 120 chars: hook optimizado>",
  "updatedRoadmap": [
    "<Acción 1, máx 80 chars>",
    "<Acción 2, máx 80 chars>",
    "<Acción 3, máx 80 chars>"
  ]
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
  const [selectedObjetivo, setSelectedObjetivo] = useState('ventas'); // ← agregá esto
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
  window.addEventListener('deviceorientation', handleOrientation);
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

  const captureFrames = (url) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const frames = [];

      // 4 frames estratégicos con propósito específico
      const points = [
       // DESPUÉS
{ t: duration * 0.05, label: 'inicio',     isHook: true  },
{ t: duration * 0.35, label: 'desarrollo', isHook: false },
{ t: duration * 0.70, label: 'escalada',   isHook: false },
{ t: duration * 0.92, label: 'climax',     isHook: false },
      ];

      for (let i = 0; i < points.length; i++) {
        const { t, label, isHook } = points[i];
        setStatusText(`Escaneando frame ${i + 1}/4 — ${label}...`);
        setAnalysisProgress(Math.round(5 + i * 12));

        video.currentTime = Math.min(t, duration);
        await new Promise(r => {
          const h = () => { video.removeEventListener('seeked', h); r(); };
          video.addEventListener('seeked', h);
        });

        // Resolución reducida — suficiente para análisis visual
        canvas.width = 480;
        canvas.height = Math.round(480 * (video.videoHeight / video.videoWidth));
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        frames.push({
          base64: canvas.toDataURL('image/jpeg', 0.4).split(',')[1],
          timestamp: t.toFixed(1),
          label,
          isHook
        });
      } //Cargar Video

      resolve(frames);
    };
  });
};    //const finalResult = { ...parsed };

const detectCutRate = async (url) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 36; // ← más pequeño
      const ctx = canvas.getContext('2d');
      
      let cuts = 0;
      let prevData = null;
      let cutTimestamps = [];
      const step = 0.5; // ← cada 500ms en vez de 200ms
      const maxSamples = Math.min(Math.floor(duration / step), 60); // ← máx 60 samples

      for (let i = 0; i < maxSamples; i++) {
        video.currentTime = i * step;
        await new Promise(r => {
          const h = () => { video.removeEventListener('seeked', h); r(); };
          video.addEventListener('seeked', h);
        });
        ctx.drawImage(video, 0, 0, 64, 36);
        const data = ctx.getImageData(0, 0, 64, 36).data;
        
        if (prevData) {
          let diff = 0;
          for (let j = 0; j < data.length; j += 4) {
            diff += Math.abs(data[j] - prevData[j]) +
                    Math.abs(data[j+1] - prevData[j+1]) +
                    Math.abs(data[j+2] - prevData[j+2]);
          }
          const avgDiff = diff / (64 * 36 * 3);
          if (avgDiff > 35) {
            cuts++;
            cutTimestamps.push(parseFloat((i * step).toFixed(1)));
          }
        }
        prevData = new Uint8ClampedArray(data);   //const [selectedObjetivo, setSelectedObjetivo] = useState('ventas'); // ← agregá esto
      }

      let rhythmVariance = 0;
      if (cutTimestamps.length > 2) {
        const intervals = cutTimestamps.slice(1).map((t, i) => t - cutTimestamps[i]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        rhythmVariance = Math.sqrt(
          intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length
        );
      }

      resolve({
        cuts,
        cutsPerMinute: Math.round((cuts / duration) * 60),
        duration: Math.round(duration),
        cutTimestamps: cutTimestamps.slice(0, 10),
        rhythmVariance: parseFloat(rhythmVariance.toFixed(2)),
        rhythmType: rhythmVariance < 0.5 ? 'constante' : rhythmVariance < 1.5 ? 'variable' : 'errático',
        hookCuts: cutTimestamps.filter(t => t <= 5).length
      });
    };
  });
};

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
  // Fix causa 1 y 2: asegurar que userId existe antes de continuar
  let userId = localStorage.getItem('redxax_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('redxax_user_id', userId);
    // Crear el usuario en Supabase antes de descontar
    await supabase.functions.invoke('get-gems', { body: { userId } });
  } //uploadVideoToFileAPI

  try {
    const { data, error } = await supabase.functions.invoke('deduct-gems', {
      body: { userId, amount, reason }
    });

    // Fix causa 3: loguear el error real para diagnosticar
    if (error) {
      console.error('deduct-gems network/function error:', error);
      alert('Error de conexión al procesar las gemas. Revisá tu internet e intentá de nuevo.');
      return false;
    }

    if (!data?.success) {
      if (data?.error === 'Saldo insuficiente') {
        alert(`Gemas insuficientes. Tenés ${data.balance} y necesitás ${amount}.`);
        setShowGemStore(true);
      } else {
        // Mostrar el error real en vez de mensaje genérico
        console.error('deduct-gems logic error:', data);
        alert(`Error al procesar las gemas: ${data?.error || 'Error desconocido'}. Intentá de nuevo.`);
      }
      return false;
    }

    setGems(data.newBalance);
    return true;

  } catch (err) {
    console.error('deduct-gems exception:', err);
    alert('Error inesperado al procesar las gemas. Intentá de nuevo.'); //const [selectedPlatform, setSelectedPlatform] = useState(null);
    return false;
  } //RETENCIÓN
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
    } //className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-full text-sm font-black italic uppercase tracking-wider transition-all"
  };

  // Guardar predicción para calibración futura
const trackPrediction = async (result) => {
  const userId = localStorage.getItem('redxax_user_id');   //TREND CONTEXT
  await supabase.from('prediction_tracking').insert({
    user_id: userId,
    predicted_score: result.potentialScore,
    niche: result.vision?.niche,
    platform: result.platformScores ? Object.keys(result.platformScores)[0] : 'unknown',
    cut_rate: result.cutRateData?.cutsPerMinute,
    hook_score: result.hookScore,
    predicted_retention_3s: result.retentionData?.at3s,
    created_at: new Date().toISOString(),
    actual_views: null,    // Se rellena después
    actual_viral: null     // Se rellena después
  });
};

// Botón "Reportar resultado real" — el creador sube sus views después de publicar
const reportActualOutcome = async (historyId, actualViews) => {
  await supabase.from('prediction_tracking')
    .update({ 
      actual_views: actualViews,
      actual_viral: actualViews > 50000 
    })
    .eq('history_id', historyId);
  
  // Mostrar accuracy del sistema al usuario
  const { data } = await supabase
    .from('prediction_tracking')
    .select('predicted_score, actual_viral')
    .not('actual_viral', 'is', null);
  
  if (data && data.length > 10) {
    const correct = data.filter(d => 
      (d.predicted_score >= 65) === d.actual_viral
    ).length;
    const accuracy = Math.round((correct / data.length) * 100);
    console.log(`Precisión actual del sistema: ${accuracy}% en ${data.length} videos`);
  } //onChange={(e) => {
};

const runNeuralAnalysis = async (url, platform, followerRange, videoFile) => {

  if (videoFile.size > 45 * 1024 * 1024) {
    alert(`El video pesa ${(videoFile.size / 1024 / 1024).toFixed(1)}MB. El límite es 50MB. Comprimí el video antes de subirlo.`);
    return;
  }

  const duration = await new Promise((resolve) => {
    const v = document.createElement('video');
    v.src = url;
    v.onloadedmetadata = () => resolve(v.duration);
  });

  const cost = 100;
  const approved = await deductGems(cost, `video:${Math.ceil(duration / 60)}`);
  if (!approved) return;

  setStep('analyzing');
  setAnalysisMode('video');
  setStatusText("Subiendo video para análisis...");
  setAnalysisProgress(10);

  const storagePath = `temp-analysis/${Date.now()}-${videoFile.name}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, videoFile, { upsert: true });

    if (uploadError) throw new Error("Error subiendo video: " + uploadError.message);

    // ── FASE 1 — Análisis del video ──
    setAnalysisProgress(30);
    setStatusText("Analizando tu video con IA...");

    const { data: fase1Data, error: fase1Error } = await supabase.functions.invoke('gemini-proxy', {
  body: {
    text: buildVideoAnalysisPrompt(platform, followerRange, selectedObjetivo),
    storagePath,
    videoMimeType: videoFile.type || 'video/mp4',   //<header className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto border-b border-white/5 backdrop-blur-md">
    duration: Math.round(duration),
    maxOutputTokens: 8192  // ← cambiado
  }
});

    if (fase1Error) throw fase1Error;

    const rawFase1 = extractGeminiText(fase1Data);
    const parsed = safeParseJSON(rawFase1, 'fase1-video');

    // ── FASE 2 — Investigación con Search ──
    setAnalysisProgress(65);
    setStatusText("Investigando tendencias reales para tu nicho...");

    // ✅ Ahora
    const { data: fase2Data, error: fase2Error } = await supabase.functions.invoke('gemini-proxy', {
    body: {
    text: buildResearchPrompt(parsed, platform, selectedObjetivo),
    useSearch: true,
    maxOutputTokens: 8192  // ← subís a 8192
  }
});

    if (fase2Error) throw fase2Error;

    const rawFase2 = extractGeminiText(fase2Data);
    const fase2Result = safeParseJSON(rawFase2, 'fase2-research');

    // ── MERGE — Combinamos los dos resultados ──
    setAnalysisProgress(90);
    setStatusText("Preparando tu análisis completo...");

    const finalResult = {
      ...parsed,
      objetivo: selectedObjetivo,
      trendResearch: fase2Result.trendResearch,
      gapAnalysis: fase2Result.gapAnalysis,
      updatedHook: fase2Result.updatedHook,  //tu video
      updatedRoadmap: fase2Result.updatedRoadmap
    };

    setAiResult(finalResult);
    setCompletedSteps([]);
    setChatMessages([{
      role: 'bot',
      text: `Análisis completado. Potencial de venta: ${finalResult.salesScore?.score ?? '—'}% | Potencial viral: ${finalResult.viralScore?.score ?? '—'}%. ¿Querés profundizar en algo?`
    }]);

    setAnalysisProgress(100);
    await saveAnalysisToHistory(finalResult, 'video');
    await trackPrediction(finalResult);
    setTimeout(() => setStep('results'), 500);

  } catch (err) {
    console.error('Error análisis:', err);
    alert('Error en el análisis. Revisá la consola.');
    setStep('upload');
  } finally {
    await supabase.storage.from('videos').remove([storagePath]);
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
        text: `${buildSystemInstructions(platform, followerRange, 'script', {}, selectedObjetivo)}\n\nAnaliza este concepto/guion: ${scriptText}`,  // ← coma acá
        maxOutputTokens: 4096  // ← nueva línea
      }
    });
 
    if (error) throw error;
 
    setAnalysisProgress(90);
    const rawText = extractGeminiText(data);
    const parsed = safeParseJSON(rawText, 'runScriptAnalysis');
    const finalResult = { ...parsed, objetivo: selectedObjetivo };
 
    setAiResult(finalResult);
    setCompletedSteps([]);
    setChatMessages([{
      role: 'bot',
      text: `Análisis de pre-producción listo. Potencial de venta: ${finalResult.salesScore?.score ?? '—'}% | Potencial viral: ${finalResult.viralScore?.score ?? '—'}%. ¿Querés optimizar el texto?`
    }]);
 
    setAnalysisProgress(100);
    // ✅ FIX 3: guarda finalResult, no parsed
    await saveAnalysisToHistory(finalResult, 'script');
    setTimeout(() => setStep('results'), 500);
 
  } catch (err) {
    console.error("Error Script:", err);
    alert("Error al analizar el guion.");
    setStep('upload');
  }
};
//duration: Math.round(duration)
  const sendMessage = async () => {
  if (!userInput.trim() || isTyping) return;

  const newMessages = [...chatMessages, { role: 'user', text: userInput }];
  setChatMessages(newMessages); //maxOutputTokens
  setUserInput("");
  setIsTyping(true);  //Proyección de Retención

  try {
    // 1. Preparamos el contexto de música (lo que ya investigó la visión)
    const musicContext = aiResult?.musicSuggestions?.length
      ? `\n\n⚠️ MÚSICA INVESTIGADA PARA ESTE VIDEO:
${aiResult.musicSuggestions.map((m, i) =>
        `${i + 1}. "${m.title}" de ${m.artist}
         → Match: ${m.why}
         → Plataformas: ${m.available}`  //<p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-widest">Fase 1: Edición y Ritmo</p>
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

    // POR esto — todo en un solo campo text:
const historyText = newMessages
  .slice(0, -1)
  .map(m => `${m.role === 'user' ? 'USUARIO' : 'ASISTENTE'}: ${m.text}`)
  .join('\n\n');

const { data, error } = await supabase.functions.invoke('gemini-proxy', {
  body: {
    text: `${systemPrompt}\n\n═══ HISTORIAL ═══\n${historyText || '(inicio)'}\n\n═══ MENSAJE ACTUAL ═══\n${userInput}`
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

  const objetivo = aiResult?.objetivo || 'ventas';  // ← acá} //setAiResult(parsed);

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
    <img
      src={logo}
      alt="Viraz logo"
      className="w-10 h-10 rounded-xl object-contain transition-transform group-hover:scale-110 shadow-lg"
    />
    <div className="flex flex-col leading-tight">
      <h1 className="text-2xl font-black tracking-tighter italic uppercase text-white">
        VIR<span className="text-red-500">AZ</span>
      </h1>
      <span className="text-[10px] italic text-slate-500 font-medium tracking-wide">Hecha por REDxax</span>
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
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .title-line1 {
          animation: slideBlurIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .title-line2 {
          opacity: 0;
          animation: slideBlurIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) 1s forwards;
        }
        .shimmer-ventas {
          background: linear-gradient(90deg, #16a34a 0%, #4ade80 35%, #bbf7d0 50%, #4ade80 65%, #16a34a 100%);
          background-size: 250% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 1.4s linear 1.2s 1 both;
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
      <h2 className="text-7xl md:text-9xl font-black italic tracking-tighter leading-none uppercase">
        <span className="block title-line1">
          No es <span className="gold-viral">viral</span><br/>lo que necesitás.
        </span>
        <span className="block title-line2">
          Son <span className="shimmer-ventas">Ventas.</span>
        </span>
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
    <div className="bg-white/[0.02] border border-white/10 rounded-[4rem] p-12 md:p-16 shadow-2xl">
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

      {/* Plataforma */}
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3">¿Dónde publicás?</p>
      <div className="grid grid-cols-1 gap-3 mb-8">
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

      {/* Objetivo */}
<p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3">
  ¿Qué querés lograr con este video?
</p>
<div className="grid grid-cols-1 gap-3 mb-10">
  {[
    { id: 'ventas', emoji: '💰', label: 'Quiero vender',        desc: 'Consultas, compras, DMs, visitas' },
    { id: 'viral',  emoji: '🔥', label: 'Quiero alcance viral', desc: 'Shares, views masivos, llegar a nuevas personas' },
    { id: 'ambas',  emoji: '⚡', label: 'Las dos cosas',        desc: 'Viralizarse Y convertir' },
  ].map((o) => (
    <button key={o.id} onClick={() => setSelectedObjetivo(o.id)}
      className={`flex items-center gap-4 p-5 rounded-[2rem] border transition-all text-left
        ${selectedObjetivo === o.id
          ? 'border-yellow-500/60 bg-yellow-500/10 scale-[1.02]'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'}`}>
      <span className="text-2xl">{o.emoji}</span>
      <div>
        <p className="font-black italic text-white">{o.label}</p>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{o.desc}</p>
        {selectedObjetivo === o.id && (
          <p className="text-yellow-400 text-[10px] font-black uppercase tracking-wider mt-0.5">✓ Seleccionado</p>
        )}
      </div>
    </button>
  ))}
</div>

      {/* Seguidores */}
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3">¿Cuántos seguidores tenés?</p>
      <div className="grid grid-cols-1 gap-3 mb-10">
        {FOLLOWER_RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedFollowerRange(r.id)}
            className={`flex items-center justify-between p-5 rounded-[2rem] border transition-all text-left
              ${selectedFollowerRange === r.id
                ? 'border-indigo-500/60 bg-indigo-500/15 scale-[1.02]'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'}`}
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{r.emoji}</span>
              <div>
                <p className="font-black italic text-white">{r.label}</p>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{r.range}</p>
              </div>
            </div>
            {selectedFollowerRange === r.id && (
              <p className="text-indigo-400 text-[10px] font-black uppercase tracking-wider">✓</p>
            )}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <button onClick={() => { setStep('upload'); setPendingVideoUrl(null); setSelectedPlatform(null); setSelectedFollowerRange(null); }}
          className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">
          ← Volver
        </button>
        <button
          disabled={!selectedPlatform || !selectedFollowerRange}
          onClick={() => {
            if (analysisMode === 'video' && pendingVideoUrl) {
             runNeuralAnalysis(pendingVideoUrl, selectedPlatform, selectedFollowerRange, pendingVideoFile); // ← cambiás esta línea
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
       {/* DUAL SCORE — Ventas + Viral */}
{aiResult.salesScore && aiResult.viralScore && (() => {
  const primero = objetivo === 'viral'
    ? aiResult.viralScore
    : aiResult.salesScore;
  const segundo = objetivo === 'viral'
    ? aiResult.salesScore
    : aiResult.viralScore;
  const colorPrimero = primero.score >= 70 ? 'text-green-400' : primero.score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const colorSegundo = segundo.score >= 70 ? 'text-green-400' : segundo.score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const borderPrimero = primero.score >= 70 ? 'border-green-500/40 bg-green-500/5' : primero.score >= 50 ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-red-500/40 bg-red-500/5';
  const borderSegundo = 'border-white/10 bg-white/[0.02]';

  return (
    <div className="space-y-3">
      {/* Tarjeta primaria — grande */}
      <ShinyCard tilt={tilt} className={`rounded-[2.5rem] border p-6 ${borderPrimero}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">
                {objetivo === 'ambas' ? '⚡ Objetivo Principal' : '★ Tu Objetivo'}
              </span>
            </div>
            <p className="text-base font-black italic uppercase tracking-tight text-white">
              {primero.titulo}
            </p>
            <p className="text-xs font-bold italic text-slate-400 mt-1 max-w-[180px] leading-relaxed">
              {primero.verdict}
            </p>
          </div>
          <span className={`text-6xl font-black italic tabular-nums ${colorPrimero}`}>
            {primero.score}%
          </span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
          <div className={`h-full rounded-full transition-all duration-700 ${
            primero.score >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
            primero.score >= 50 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
            'bg-gradient-to-r from-red-600 to-red-400'
          }`} style={{ width: `${primero.score}%` }} />
        </div>
        <p className="text-[11px] font-bold italic text-slate-400 leading-relaxed">
          {primero.razon_principal}
        </p>
        {primero.accion_clave && (
          <div className="mt-3 flex items-start gap-2 bg-white/5 border border-white/10 rounded-[1rem] p-3">
            <span className="text-xs">→</span>
            <p className="text-[11px] font-black italic text-white">{primero.accion_clave}</p>
          </div>
        )}
      </ShinyCard>

      {/* Tarjeta secundaria — más pequeña */}
      <ShinyCard tilt={tilt} className={`rounded-[2rem] border p-5 ${borderSegundo}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-1">
              También medimos
            </p>
            <p className="text-sm font-black italic uppercase tracking-tight text-slate-300">
              {segundo.titulo}
            </p>
          </div>
          <span className={`text-3xl font-black italic tabular-nums ${colorSegundo}`}>
            {segundo.score}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all duration-700 ${
            segundo.score >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
            segundo.score >= 50 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
            'bg-gradient-to-r from-red-600 to-red-400'
          }`} style={{ width: `${segundo.score}%` }} />
        </div>
        <p className="text-[10px] font-bold italic text-slate-500">{segundo.verdict}</p>
        {segundo.accion_clave && (
          <p className="text-[10px] font-bold italic text-slate-400 mt-2">
            → {segundo.accion_clave}
          </p>
        )}
      </ShinyCard>

      {/* Score combinado — pequeño, abajo */}
      <ShinyCard tilt={tilt} className="flex items-center justify-between bg-black/40 border border-white/10 rounded-[1.5rem] px-5 py-3">
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">
          Score Combinado · {aiResult.performanceScenario}
        </p>
        <span className={`text-2xl font-black italic tabular-nums ${
          aiResult.potentialScore >= 70 ? 'text-green-400' :
          aiResult.potentialScore >= 50 ? 'text-yellow-400' : 'text-red-400'
        }`}>{aiResult.potentialScore}%</span>
      </ShinyCard>
    </div>
  );
})()}
        {/* SCROLL STOP SCORE */}
{aiResult.scrollStopScore && (
  <ShinyCard tilt={tilt} className={`rounded-[2rem] border p-5 ${
    aiResult.scrollStopScore.score >= 70
      ? 'border-green-500/30 bg-green-500/5'
      : aiResult.scrollStopScore.score >= 45
      ? 'border-yellow-500/30 bg-yellow-500/5'
      : 'border-red-500/40 bg-red-500/[0.08]'
  }`}>
    <div className="flex items-center justify-between mb-3">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1">Scroll-Stop Power</p>
        <p className="text-[10px] font-bold italic text-slate-400">Frame 0 Analysis</p>
      </div>
      <span className={`text-3xl font-black italic tabular-nums ${
        aiResult.scrollStopScore.score >= 70 ? 'text-green-400' :
        aiResult.scrollStopScore.score >= 45 ? 'text-yellow-400' : 'text-red-400'
      }`}>{aiResult.scrollStopScore.score}%</span>
    </div>
    <div className="grid grid-cols-3 gap-2 mb-3">
      {[
        { label: 'Cara', value: aiResult.scrollStopScore.faceDetected, type: 'bool' },
        { label: 'Texto', value: aiResult.scrollStopScore.textOnScreen, type: 'bool' },
        { label: 'Contraste', value: aiResult.scrollStopScore.contrastLevel, type: 'text' },
      ].map((item, i) => (
        <div key={i} className="bg-black/40 rounded-[1rem] p-2.5 text-center">
          <p className="text-[8px] font-black uppercase tracking-wider text-slate-500 mb-1">{item.label}</p>
          {item.type === 'bool' ? (
            <span className={`text-xs font-black ${item.value ? 'text-green-400' : 'text-red-400'}`}>
              {item.value ? '✓ SÍ' : '✗ NO'}
            </span>
          ) : (
            <span className={`text-xs font-black capitalize ${
              item.value === 'alto' ? 'text-green-400' :
              item.value === 'medio' ? 'text-yellow-400' : 'text-red-400'
            }`}>{item.value}</span>
          )}
        </div>
      ))}
    </div>
    {aiResult.scrollStopScore.emotionVisible && aiResult.scrollStopScore.emotionVisible !== 'ninguna' && (
      <p className="text-[10px] font-bold italic text-slate-400">
        Emoción detectada: <span className="text-white">{aiResult.scrollStopScore.emotionVisible}</span>
        {aiResult.scrollStopScore.emotionIntensity && ` (intensidad ${aiResult.scrollStopScore.emotionIntensity}/10)`}
      </p>
    )}
    <p className="text-[10px] font-bold italic text-slate-500 mt-1">{aiResult.scrollStopScore.verdict}</p>
  </ShinyCard>
)}

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

        {/* COMMENT TRIGGER */}
{aiResult.commentTrigger && (
  <ShinyCard tilt={tilt} className="bg-black/30 border border-white/5 rounded-[2rem] p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3 h-3 text-blue-400" />
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400">Trigger de Comentarios</p>
      </div>
      <span className={`text-xl font-black italic tabular-nums ${
        aiResult.commentTrigger.probability >= 65 ? 'text-green-400' :
        aiResult.commentTrigger.probability >= 35 ? 'text-yellow-400' : 'text-red-400'
      }`}>{aiResult.commentTrigger.probability}%</span>
    </div>
    <span className="inline-block text-[9px] font-black uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 text-blue-300 px-3 py-1 rounded-full mb-2 capitalize">
      {aiResult.commentTrigger.triggerType}
    </span>
    {aiResult.commentTrigger.suggestedCTA && (
      <p className="text-[10px] font-bold italic text-slate-400 mt-2">
        CTA sugerido: <span className="text-white">"{aiResult.commentTrigger.suggestedCTA}"</span>
      </p>
    )}
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

      {/* VIEWS PREDICTION + FIRST HOUR */}
{(aiResult.viewsPrediction || aiResult.firstHourStrategy) && (
  <ShinyCard tilt={tilt} className="bg-white/[0.02] border border-white/10 p-8 rounded-[3.5rem] space-y-6">
    <div className="flex items-center gap-3">
      <Users className="text-blue-400 w-5 h-5" />
      <h3 className="text-xl font-black italic uppercase tracking-tighter">Proyección & Estrategia</h3>
    </div>
    
    {aiResult.viewsPrediction && (
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sin viralidad', value: aiResult.viewsPrediction.scenario_low, color: 'text-slate-400', bg: 'bg-white/[0.03] border-white/10' },
          { label: 'Viralidad mod.', value: aiResult.viewsPrediction.scenario_mid, color: 'text-yellow-400', bg: 'bg-yellow-500/5 border-yellow-500/20' },
          { label: 'Viral real', value: aiResult.viewsPrediction.scenario_high, color: 'text-green-400', bg: 'bg-green-500/5 border-green-500/20' },
        ].map((s, i) => (
          <div key={i} className={`rounded-[1.5rem] p-4 border ${s.bg} text-center`}>
            <p className="text-[8px] font-black uppercase tracking-wider text-slate-500 mb-1">{s.label}</p>
            <p className={`text-sm font-black italic ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    )}
    {aiResult.viewsPrediction?.probability_viral && (
      <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
        Probabilidad de viral real: <span className="text-white">{aiResult.viewsPrediction.probability_viral}</span>
      </p>
    )}

    {aiResult.firstHourStrategy && (
      <div className="border-t border-white/5 pt-5 space-y-3">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-400">Estrategia Primera Hora Post-Publicación</p>
        {[
          { icon: '🕐', label: 'Horario óptimo', value: aiResult.firstHourStrategy.optimalPostTime },
          { icon: '⚡', label: 'Acción inmediata', value: aiResult.firstHourStrategy.firstActionAfterPost },
          { icon: '💬', label: 'Primer comentario', value: `"${aiResult.firstHourStrategy.commentSeed}"` },
          { icon: '🚀', label: 'Boost engagement', value: aiResult.firstHourStrategy.engagementBoost },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3 bg-black/30 rounded-[1.5rem] p-4 border border-white/5">
            <span className="text-base mt-0.5">{item.icon}</span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">{item.label}</p>
              <p className="text-xs font-bold italic text-slate-300">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </ShinyCard>  //potentialScore
)}

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
        </ShinyCard> //Score general 
      )}

      {/* HOOK DNA */}
{aiResult.hookDNA && (
  <ShinyCard tilt={tilt} className="bg-white/[0.02] border border-white/10 p-8 rounded-[3.5rem]">
    <div className="flex items-center gap-3 mb-6">
      <div className="bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-xl">
        <Zap className="w-4 h-4 text-white" fill="white" />
      </div>
      <h3 className="text-xl font-black italic uppercase tracking-tighter">Hook DNA</h3>
      <span className={`ml-auto text-2xl font-black italic tabular-nums ${
        aiResult.hookDNA.strength >= 70 ? 'text-green-400' :
        aiResult.hookDNA.strength >= 45 ? 'text-yellow-400' : 'text-red-400'
      }`}>{aiResult.hookDNA.strength}%</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <div className="bg-black/40 rounded-[1.5rem] p-4 border border-white/5">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Patrón Detectado</p>
        <p className="text-sm font-black italic text-white capitalize">{aiResult.hookDNA.pattern}</p>
      </div>
      <div className="bg-black/40 rounded-[1.5rem] p-4 border border-white/5">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Elemento Faltante</p>
        <p className="text-sm font-bold italic text-orange-300">{aiResult.hookDNA.missingElement}</p>
      </div>
    </div>
    {aiResult.hookDNA.optimizedHook && (
      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-[1.5rem] p-5">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-400 mb-2">✦ Hook Optimizado por REDXAX</p>
        <p className="text-sm font-bold italic text-white leading-relaxed">"{aiResult.hookDNA.optimizedHook}"</p>
      </div>
    )}  
  </ShinyCard>
)}      

{/* STEPPS VIRAL COEFFICIENT */}
{aiResult.steppsScore && (
  <ShinyCard tilt={tilt} className="bg-white/[0.02] border border-white/10 p-8 rounded-[3.5rem]">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <BrainCircuit className="text-indigo-400 w-5 h-5" />
        <h3 className="text-xl font-black italic uppercase tracking-tighter">STEPPS Score</h3>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Wharton Framework</span>
      </div>
      <div className="text-right">
        <span className={`text-3xl font-black italic tabular-nums ${
          aiResult.steppsScore.viralCoefficient >= 7.5 ? 'text-green-400' :
          aiResult.steppsScore.viralCoefficient >= 5 ? 'text-yellow-400' : 'text-red-400'
        }`}>{aiResult.steppsScore.viralCoefficient?.toFixed(1)}</span>
        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">/10.0</p>
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
      {[
        { key: 'socialCurrency', label: 'Social Currency', icon: '💎' },
        { key: 'triggers', label: 'Triggers', icon: '⚡' },
        { key: 'emotion', label: 'Emoción', icon: '🔥' },
        { key: 'public', label: 'Público', icon: '👁' },
        { key: 'practicalValue', label: 'Valor Práctico', icon: '🛠' },
        { key: 'stories', label: 'Narrativa', icon: '📖' },
      ].map(({ key, label, icon }) => {
        const val = aiResult.steppsScore[key];
        return (
          <div key={key} className="bg-black/40 rounded-[1.5rem] p-3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">{icon}</span>
              <span className={`text-lg font-black italic tabular-nums ${
                val >= 7 ? 'text-green-400' : val >= 5 ? 'text-yellow-400' : 'text-red-400'
              }`}>{val}</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-1.5">
              <div className={`h-full rounded-full ${
                val >= 7 ? 'bg-green-400' : val >= 5 ? 'bg-yellow-400' : 'bg-red-400'
              }`} style={{ width: `${val * 10}%` }} />
            </div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p>
          </div>
        );
      })}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-green-500/10 border border-green-500/20 rounded-[1.5rem] p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-green-400 mb-1">✦ Fortaleza</p>
        <p className="text-xs font-bold italic text-slate-300">{aiResult.steppsScore.dominantFactor}</p>
      </div>
      <div className="bg-red-500/10 border border-red-500/20 rounded-[1.5rem] p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-400 mb-1">✦ Punto Débil</p>
        <p className="text-xs font-bold italic text-slate-300">{aiResult.steppsScore.weakestFactor}</p>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between">
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Motivación de sharing</p>
      <span className="text-xs font-black italic text-indigo-300 capitalize bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
        {aiResult.steppsScore.shareMotivation}
      </span>
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
{aiResult.retentionData && (
  <ShinyCard tilt={tilt} className="bg-white/[0.02] border border-white/10 p-10 rounded-[4rem]">
    <div className="flex items-center justify-between mb-10">
      <div className="flex items-center gap-4">
        <BarChart3 className={analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'} />
        <h3 className="text-xl font-black italic uppercase tracking-tight">Proyección de Retención</h3>
      </div>
      <div className="grid grid-cols-3 gap-8">
        <div className="text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">3s</p><p className="text-xl font-black italic">{aiResult.retentionData?.at3s ?? '—'}</p></div>
        <div className="text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">10s</p><p className="text-xl font-black italic">{aiResult.retentionData?.at10s ?? '—'}</p></div>
        <div className="text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">Final</p><p className="text-xl font-black italic">{aiResult.retentionData?.final ?? '—'}</p></div>
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
)}

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