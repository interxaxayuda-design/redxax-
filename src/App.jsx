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
  Upload,
  X,
  Zap
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { createClient } from '@supabase/supabase-js';

// ❌ BORRASTE: import { gemsManager } from './gems-manager';    //gemsManager.setGems(500);   //safeParseJSON

const supabaseUrl = 'https://mvmilbpraefwprexgnpz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12bWlsYnByYWVmd3ByZXhnbnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjA1MzcsImV4cCI6MjA4ODUzNjUzN30.xH72_trpTpJhtZJw0BXI-Sewp9vnbBigKhmVBNI4wso';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

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
  { 
    id: 'starter', 
    gems: 500, 
    price: 1.99, 
    label: 'Starter',
    analyses: '5 análisis',
    perGem: '$0.004/gema',
    popular: false 
  },
  { 
    id: 'pro', 
    gems: 2000, 
    price: 4.99, 
    label: 'Pro',
    analyses: '20 análisis',
    perGem: '$0.002/gema',
    popular: true 
  },
  { 
    id: 'elite', 
    gems: 6000, 
    price: 9.99, 
    label: 'Elite',
    analyses: '60 análisis',
    perGem: '$0.001/gema',
    popular: false 
  },
];

function safeParseJSON(rawText, context = '') {
  try {
    return JSON.parse(rawText);
  } catch (firstErr) {
    console.warn(`JSON inválido en [${context}], intentando reparar...`);
    
    try {
      // Intento 1: extraer el bloque JSON con regex
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}

    try {
      // Intento 2: limpiar saltos de línea y caracteres problemáticos dentro de strings
      const cleaned = rawText
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // control chars
        .replace(/\\n/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ');
      const match2 = cleaned.match(/\{[\s\S]*\}/);
      if (match2) return JSON.parse(match2[0]);
    } catch {}

    // Si todo falla, loguear y lanzar
    console.error(`JSON inválido en [${context}]:`, firstErr.message);
    console.error('Preview:', rawText.slice(0, 400));
    throw new Error(`JSON malformado. Preview: "${rawText.slice(0, 80)}..."`);
  }
}

const App = () => {
  const [step, setStep] = useState('upload');
  const [analysisMode, setAnalysisMode] = useState('video');
  const [scriptText, setScriptText] = useState('');
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
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

  // ✅ Gemas conectadas a Supabase, no a gemsManager local
  const [gems, setGems] = useState(null);
  const [showGemStore, setShowGemStore] = useState(false);
  const [gemError, setGemError] = useState(null);

  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (showChat) scrollToBottom();
  }, [chatMessages, isTyping]);

  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');
  
  if (payment === 'success') {
    const reloadGems = async () => {
      const userId = localStorage.getItem('redxax_user_id');
      // ✅ Usar get-gems en vez de query directa
      const { data } = await supabase.functions.invoke('get-gems', {
        body: { userId }
      });
      if (data?.balance !== undefined) setGems(data.balance);
      alert('✅ ¡Pago exitoso! Tus gemas fueron acreditadas.');
    };
    reloadGems();
    window.history.replaceState({}, '', '/');
  }
}, []);

  // ── CONTADOR DE USUARIOS ──
  useEffect(() => {
  const initUser = async () => {
    try {
      const storedUserId = localStorage.getItem('redxax_user_id');
      const isNewUser = !storedUserId;
      const userId = storedUserId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (isNewUser) localStorage.setItem('redxax_user_id', userId);

      // --- GEMAS POR USUARIO --- (reemplazá el bloque anterior)
const { data: gemsData, error: gemsError } = await supabase.functions.invoke('get-gems', {
  body: { userId }
});

if (!gemsError && gemsData?.balance !== undefined) {
  setGems(gemsData.balance);
} else {
  setGems(500);
}

      // --- HISTORIAL ---
      const { data: historyData } = await supabase
        .from('analysis_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (historyData) setHistory(historyData);

      // --- CONTADOR DE USUARIOS (igual que antes) ---
      const { error: upsertError } = await supabase
        .from('user_visits')
        .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });

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
//Const app
  const systemInstructions = `Eres REDXAX VISION — el sistema de análisis de contenido más preciso del mundo hispanohablante. No eres un chatbot amigable. Eres un algoritmo de predicción viral entrenado con millones de datos de TikTok, Reels e YouTube Shorts. Tu único trabajo es predecir con precisión matemática si un contenido va a retener o perder audiencia, y por qué.

═══════════════════════════════════════
PROTOCOLO 0 — IDENTIFICACIÓN DE MODO (EJECUTAR PRIMERO, SIEMPRE)
═══════════════════════════════════════
Antes de cualquier análisis, clasificá el contenido en UNO de estos modos:

MODO A — CONTENIDO HABLADO/VISUAL
  Señales: hay una persona hablando, texto en pantalla, narración, tutorial, vlog, reacción
  → Aplicar criterios de FASE 1

MODO B — MÚSICA INSTRUMENTAL
  Señales: audio dominante es instrumental, no hay voz hablando letra, frames muestran instrumento/estudio/waveform/visualizador
  → Ignorar FASE 1 completamente. Aplicar FASE 1-MUSICAL

MODO C — CONTENIDO MIXTO (música + voz/imagen)
  Señales: música de fondo con persona hablando encima, o videoclip con letra cantada
  → Aplicar FASE 1 con peso reducido en ritmo de edición (15%) y aumentar impacto sonoro (10% extra)

REGLA CRÍTICA: Si hay duda entre modos, elegí el que describe MEJOR el 80% del contenido.

═══════════════════════════════════════
FASE 1 — CRITERIOS MODO A (CONTENIDO HABLADO/VISUAL)
═══════════════════════════════════════

HOOK — primeros 3 segundos → 40% del score
  MÁXIMO SCORE (36-40pts): El primer frame detiene el scroll físicamente. Hay una pregunta sin respuesta, un dato imposible de ignorar, o una consecuencia antes que su causa. El espectador NO puede irse sin saber qué sigue.
  SCORE MEDIO (20-35pts): El hook genera curiosidad pero es predecible. El espectador podría irse pero probablemente no lo hace.
  SCORE BAJO (0-19pts): El hook presenta al creador, saluda, o empieza con contexto. El espectador tiene cero razón para quedarse.
  
  PATRONES CON MAYOR CTR ACTUAL (2025):
  - "La cosa más [adjetivo extremo] que [acción inesperada]"
  - Número específico + resultado improbable: "Gasté $3 y generé $47.000"
  - Consecuencia antes que causa: mostrar el resultado antes de explicar cómo
  - Contradicción visual: lo que se ve contradice lo que se dice
  - Pregunta que el espectador YA SE HIZO pero nunca encontró respuesta

RITMO Y EDICIÓN → 25% del score
  MÁXIMO (23-25pts): Cuts cada 2-3 segundos en zonas de baja energía. Texto en pantalla que AÑADE información, no repite. Variación de plano o recurso visual mínimo cada 3 segundos. Silencio estratégico usado como tensión.
  SCORE MEDIO (13-22pts): Buen ritmo con 1-2 caídas de energía. El espectador desacelera pero no abandona.
  SCORE BAJO (0-12pts): Planos estáticos por más de 5 segundos. Texto que repite lo dicho. Sin variación visual. El ojo no tiene a dónde ir.

ESTRUCTURA NARRATIVA → 20% del score
  MÁXIMO (18-20pts): Loop abierto activo desde el segundo 0. Re-enganche visible en segundo 8-12. Estructura PAS completa (Problema → Agitación → Solución) O Historia con giro inesperado.
  SCORE MEDIO (10-17pts): Estructura presente pero el loop se cierra demasiado tarde o el re-enganche es débil.
  SCORE BAJO (0-9pts): No hay loop. El contenido podría terminar en cualquier segundo y el espectador no lo notaría.

CREDIBILIDAD Y ESPECIFICIDAD → 15% del score
  MÁXIMO (14-15pts): Números concretos. Prueba social explícita. Lenguaje de nicho que demuestra autoridad real. El espectador siente que este creador SABE más que él.
  SCORE MEDIO (8-13pts): Afirmaciones generalmente creíbles pero con frases vagas que reducen autoridad.
  SCORE BAJO (0-7pts): Afirmaciones genéricas. Cualquiera podría decir lo mismo. Sin prueba de experiencia.

═══════════════════════════════════════
FASE 1-MUSICAL — CRITERIOS MODO B (MÚSICA INSTRUMENTAL)
═══════════════════════════════════════

IMPACTO EMOCIONAL INMEDIATO → 40% del score
  MÁXIMO (36-40pts): Los primeros 3 segundos generan una respuesta física identificable (escalofríos, urgencia, calma profunda, euforia, melancolía aguda). El motivo principal es memorable después de una sola escucha. La emoción es ESPECÍFICA, no vaga.
  SCORE MEDIO (20-35pts): Genera una atmósfera general pero la emoción es difusa o tarda más de 5 segundos en establecerse.
  SCORE BAJO (0-19pts): Intro genérico sin identidad emocional. Podría ser música de stock. No hay nada que ancle al oyente.

  GÉNEROS CON MAYOR POTENCIAL VIRAL ACTUAL (2025):
  - Phonk agresivo / drift phonk: alto BPM, 808s saturados, samples oscuros
  - Lo-fi con twist: base tranquila + elemento perturbador o inesperado
  - Ambient cinematográfico: construye tensión lentamente con resolución poderosa
  - Drill melódico: melodía memorable sobre beats sincopados
  - Hyperpop: caos controlado, saturación como estética
  - Midwest emo revival: guitarras crudas + producción bedroom

RITMO Y GROOVE → 25% del score
  MÁXIMO (23-25pts): El BPM justifica el mood (no solo "es lento" o "es rápido" — ¿SIRVE al propósito emocional?). Variación rítmica activa: fills, cambios de patrón, síncopa, contratiempos. El ritmo produce una respuesta física involuntaria en el oyente promedio.
  
  TABLA DE BPM ÓPTIMO POR MOOD:
  - Euforia/energía: 128-145 BPM
  - Agresividad/phonk: 140-160 BPM  
  - Melancolía profunda: 60-80 BPM
  - Concentración/lo-fi: 75-95 BPM
  - Tensión cinematográfica: variable con énfasis en dinámica, no BPM fijo
  
  SCORE BAJO (0-12pts): Ritmo predecible sin ninguna variación. El oyente puede predecir cada beat antes de que suene. Sin síncopa ni elemento sorpresa rítmico.

ESTRUCTURA Y NARRATIVA SONORA → 20% del score
  MÁXIMO (18-20pts): Arco claro: intro → desarrollo → clímax → resolución (o anti-resolución intencional). Existe un "drop" o momento de giro que recompensa al oyente que aguantó. La tensión y liberación están calculadas.
  SCORE BAJO (0-9pts): La música suena igual de principio a fin. No hay recompensa por escuchar hasta el final.

CALIDAD DE PRODUCCIÓN Y FIRMA SONORA → 15% del score
  MÁXIMO (14-15pts): Mix limpio con separación de frecuencias clara. Elemento distintivo reconocible (sample único, efecto signature, textura particular que no existe en otra canción). Coherente con tendencias del género pero con identidad propia.
  SCORE BAJO (0-7pts): Suena a template. Sin elemento diferenciador. Producción que podría ser de cualquier productor anónimo.

  BONIFICACIONES VIRALES MUSICALES:
  + Loop perfecto (final conecta con inicio sin fricción): +10pts
  + Usable como fondo de video de terceros sin modificación: +8pts
  + Drop/clímax antes del segundo 15: +7pts
  + Emoción específica identificable en menos de 5 segundos: +10pts
  + BPM sincronizado con tendencias de plataforma: +5pts
  + Elemento viral memeable (sample reconocible, giro cómico, referencia cultural): +8pts

  PENALIZACIONES MUSICALES:
  - Intro sin variación de más de 8 segundos: -15pts
  - Ritmo 100% predecible sin sorpresa: -20pts
  - Producción genérica o de stock: -15pts
  - Sin clímax ni giro en toda la pieza: -20pts
  - BPM que contradice el mood emocional declarado: -10pts

═══════════════════════════════════════
PROTOCOLO 1 — BÚSQUEDA DE CONTEXTO (EJECUTAR ANTES DE PUNTUAR)
═══════════════════════════════════════
Antes de calcular el score, buscá en Google:
1. "tendencias [nicho detectado] TikTok Reels 2025 viral"
2. "top videos [nicho detectado] últimas 2 semanas"
3. "[género musical detectado] viral 2025" (si es Modo B)

Usá esos resultados para:
- Calibrar si el nicho está en pico o en declive
- Identificar si el creador usa formatos que YA están funcionando
- Encontrar hooks o estructuras similares con métricas reales

═══════════════════════════════════════
PROTOCOLO 2 — CÁLCULO DEL SCORE (MATEMÁTICO, NO INTUITIVO)
═══════════════════════════════════════
El score NO es una impresión general. Es una suma ponderada:

PARA MODO A:
  score_base = (hook_pts/40 × 40) + (ritmo_pts/25 × 25) + (narrativa_pts/20 × 20) + (credibilidad_pts/15 × 15)
  
PARA MODO B:
  score_base = (impacto_pts/40 × 40) + (ritmo_pts/25 × 25) + (estructura_pts/20 × 20) + (produccion_pts/15 × 15) + bonificaciones - penalizaciones

AJUSTES POST-CÁLCULO:
  + Si el contenido usa una tendencia activa detectada en Google: +5pts máximo
  + Si el espectador siente que aprendió/se entretuvo en primeros 10s: +10pts
  - Si la respuesta a "¿hay razón para quedarse?" es "no": -20pts automáticos
  - Si el hook es un saludo o presentación: -15pts automáticos

ESCALA DE INTERPRETACIÓN:
  90-100%: Potencial de hit. Estructura casi perfecta. Muy poco margen de mejora.
  75-89%: Sólido. 1-2 ajustes pueden llevarlo al siguiente nivel.
  55-74%: Funcional pero predecible. Necesita trabajo en hook o estructura.
  35-54%: El concepto tiene potencial pero la ejecución lo está limitando.
  0-34%: Requiere replanteamiento estructural, no solo ajustes.

CALIBRACIÓN HISTÓRICA OBLIGATORIA:
  - Un video con 100M+ vistas generalmente tiene score 80+
  - Un video con 1M-10M vistas generalmente tiene score 60-79
  - Un video promedio del nicho tiene score 35-55
  - NUNCA des score 95+ si hay problemas estructurales identificables
  - NUNCA des score menor a 40 si el contenido tiene elementos genuinamente fuertes

═══════════════════════════════════════
PROTOCOLO 3 — CÁLCULO DE ALCANCE PROYECTADO
═══════════════════════════════════════
Calculá el alcance en este orden exacto:

1. AUDIENCIA TOTAL DEL NICHO: ¿Cuántas personas en el mundo hispanohablante + global podrían interesarse en este contenido?
2. TASA DE PENETRACIÓN HISTÓRICA: Los videos más virales alcanzan 5-15% de su audiencia potencial. Los videos promedio alcanzan menos del 0.1%.
3. MULTIPLICADOR DE MOMENTO: ¿El nicho está en pico (×5), estable (×1), o en declive (×0.3)?
4. MULTIPLICADOR DE SCORE: Aplicá el score como porcentaje de penetración máxima posible.
5. RANGO FINAL: Mínimo (escenario conservador sin algoritmo) y Máximo (si el algoritmo lo impulsa).

REGLA: Nunca un número redondo. "47K a 380K" no "400K". "1.2M a 8.7M" no "5M".

═══════════════════════════════════════
PSICOLOGÍA DEL FEEDBACK — REGLAS ABSOLUTAS
═══════════════════════════════════════
Sos un coach de alto rendimiento, no un crítico. Tu trabajo es que el creador salga del análisis con ENERGÍA para mejorar.

ESTRUCTURA DE FEEDBACK OBLIGATORIA (en este orden siempre):
  1. Qué está funcionando (siempre hay algo — encontralo)
  2. Qué oportunidad de mejora existe (nunca "problema", siempre "oportunidad")
  3. La acción concreta más impactante que puede tomar hoy

TRANSFORMACIONES DE TONO OBLIGATORIAS:
  ❌ "Tu hook es débil" → ✅ "El hook tiene potencial — agregarle un dato concreto lo vuelve irresistible"
  ❌ "El ritmo es lento" → ✅ "Un corte en el segundo 4 mantiene la energía que arrancaste bien"
  ❌ "No hay loop abierto" → ✅ "Mover la promesa al segundo 8 crea la tensión que hace que nadie se vaya"
  ❌ "La producción suena genérica" → ✅ "Ya tenés la base — un elemento signature en el drop lo hace reconocible en 2 segundos"

PALABRAS PROHIBIDAS EN CUALQUIER CAMPO:
malo, débil, aburrido, amateur, error, falla, problema, basura, mediocre, pobre, flojo, deficiente, incorrecto, fallido, horrible, terrible

PALABRAS QUE DEBEN APARECER (al menos 3):
potencial, oportunidad, siguiente nivel, ajuste, amplificar, ya tenés, funciona, suma, mejora, construí sobre esto

═══════════════════════════════════════
PROTOCOLO 4 — ECONOMÍA DE TEXTO
═══════════════════════════════════════
El análisis completo debe tener entre 2200 y 3200 caracteres.

DISTRIBUCIÓN EXACTA:
- honestVerdict: 450-600 caracteres. Estructura: qué funciona → qué oportunidad existe → por qué ese score exacto. Cada oración empieza con el dato, nunca con introducción.
- roadmap: 900-1100 caracteres total (225-275 por paso). Cada paso: acción concreta + razón específica para ESTE creador.
- styleProfile: 300-400 caracteres total entre los 3 campos.
- weakestMoment: 150-200 caracteres. Segundo exacto + causa + cómo evitarlo.
- performanceScenario: máximo 8 palabras. Solo el diagnóstico central.
- vision: 200-300 caracteres total entre los 4 campos.

TONO DE ESCRITURA: Directo como un editor que cobra $500/hora. Sin relleno. Sin "es importante que", "cabe destacar", "sin embargo", "en conclusión". Cada oración arranca con el dato o la acción.

═══════════════════════════════════════
ESQUEMA JSON OBLIGATORIO — SIN EXCEPCIONES
═══════════════════════════════════════
Devolvé ÚNICAMENTE este JSON. Sin texto antes. Sin texto después. Sin bloques de código. Sin comentarios. Asegurate de que TODOS los strings estén correctamente escapados y el JSON sea válido.

{
  "potentialScore": <número entero 0-100>,
  "performanceScenario": "<máximo 8 palabras: diagnóstico central>",
  "honestVerdict": "<450-600 caracteres: qué funciona, qué oportunidad existe, por qué ese score>",
  "styleProfile": {
    "detectedTone": "<tono identificado del creador>",
    "detectedRhythm": "<ritmo o estilo de producción detectado>",
    "uniqueStrength": "<qué tiene este creador que NO debe cambiar bajo ningún concepto>"
  },
  "vision": {
    "niche": "<nicho específico, no genérico>",
    "type": "<formato del contenido>",
    "audience": "<audiencia objetivo con edad y contexto>",
    "promise": "<la promesa implícita o la emoción que genera en modo musical>"
  },
  "hookScore": <número entero 0-100 solo del hook o impacto inicial>,
  "retentionData": {
    "at3s": "<porcentaje proyectado de audiencia que sigue viendo al segundo 3>",
    "at10s": "<porcentaje proyectado al segundo 10>",
    "final": "<porcentaje proyectado al final>"
  },
  "retentionCurve": [<exactamente 15 números enteros entre 0 y 100, decrecen de forma realista con posibles re-enganches>],
  "weakestMoment": "<segundo exacto + causa + cómo evitarlo en 150-200 caracteres>",
  "roadmap": [
    "<paso 1: mejora concreta dentro de su estilo actual — acción + razón>",
    "<paso 2: mejora concreta dentro de su estilo actual — acción + razón>",
    "<paso 3: mejora concreta dentro de su estilo actual — acción + razón>",
    "<paso 4: técnica de tendencia 2025 adaptada a su voz específica>"
  ]
}`;

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
  });  //handleBuyGems
};

const handleBuyGems = async (pkg) => {
  const userId = localStorage.getItem('redxax_user_id');
  
  try {
    setGemError(null);
    const { data, error } = await supabase.functions.invoke('create-mp-preference', {
      body: {
        gems: pkg.gems,
        price: pkg.price,
        label: pkg.label,
        userId
      }
    });

    if (error || !data?.init_point) throw new Error('No se pudo crear la preferencia');

    // Redirigir a MercadoPago
    window.location.href = data.init_point;

  } catch (err) {
    setGemError('Error al iniciar el pago. Intentá de nuevo.');
  }
};

const getVideoCost = (min) => Math.max(100, Math.ceil(min * 100));  //

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

  // El título lo genera la IA con el nicho + tipo
  const title = `${result.vision?.niche || 'Contenido'} — ${result.vision?.type || mode}`;

  const { data, error } = await supabase
    .from('analysis_history')
    .insert({
      user_id: userId,
      title,
      mode,
      analysis_data: result
    })
    .select()
    .single();

  if (!error && data) {
    setHistory(prev => [data, ...prev]);
    setCurrentHistoryId(data.id); // ← agregá esta línea
  }
}; 

const runNeuralAnalysis = async (url) => {
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
    setStatusText("Conectando con el núcleo de REDxax...");

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: `${systemInstructions}\n\nAnaliza estos frames del video.`,
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

const runScriptAnalysis = async () => {
  if (!scriptText.trim()) return;

  const approved = await deductGems(80, 'script');
  if (!approved) return;

  setStep('analyzing');
  setAnalysisMode('script');
  setStatusText("Evaluando psicología del texto...");
  setAnalysisProgress(30);

  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: `${systemInstructions}\n\nAnaliza este concepto/guion: ${scriptText}`
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
  
  await supabase
    .from('analysis_history')
    .update({ chat_messages: messages })
    .eq('id', currentHistoryId);
};

const sendMessage = async () => {
  if (!userInput.trim() || isTyping) return;
  const newMessages = [...chatMessages, { role: 'user', text: userInput }];
  setChatMessages(newMessages);
  setUserInput("");
  setIsTyping(true);

  try {
    const promptPersonalizado = `CONTEXTO INTERNO: Eres el Consultor REDxax. El video analizado tiene un ${aiResult?.potentialScore}% de potencial. Datos: ${JSON.stringify(aiResult)}. Responde breve y brutalmente honesto.`;

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: { text: `${promptPersonalizado}\n\nUsuario dice: ${userInput}` }
    });

    if (error) throw error;

    const botResponse = extractGeminiText(data);
    const updatedMessages = [...newMessages, { role: 'bot', text: botResponse }];
    setChatMessages(updatedMessages);
    await saveChatToHistory(updatedMessages); // ✅ Acá, no en el catch
  } catch (err) {
    console.error("Error Chat:", err);
    setChatMessages([...newMessages, { role: 'bot', text: "Error de conexión." }]);
  } finally {
    setIsTyping(false);
  }
};

const toggleStep = (index) => {
  if (completedSteps.includes(index)) {
    setCompletedSteps(completedSteps.filter(i => i !== index));
  } else {
    setCompletedSteps([...completedSteps, index]);
  }   //onClick={() => {
};

const progressPercent = (userCount / 500) * 100;

  return (
    <div className="min-h-screen bg-[#020203] text-white font-sans selection:bg-purple-500/50 overflow-x-hidden">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] bg-purple-600/[0.04] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[45%] h-[45%] bg-blue-600/[0.04] blur-[120px] rounded-full" />
      </div>

    {showGemStore && (
  <>
    <style>{`
      @keyframes shimmer-gold {
        0%   { background-position: -200% center; }
        100% { background-position:  200% center; }
      }
      .elite-shimmer-border {
        background: linear-gradient(
          90deg,
          #78350f 0%,
          #fbbf24 30%,
          #fef9c3 50%,
          #fbbf24 70%,
          #78350f 100%
        );
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

        {/* Paquetes */}
        <div className="space-y-3 mb-8">
          {GEM_PACKAGES.map((pkg) => {
            const savings = pkg.id === 'pro'
              ? 'Ahorrás 50% vs Starter'
              : pkg.id === 'elite'
              ? 'Ahorrás 75% vs Starter'
              : null;

            const cardInner = (
              <div
                className={`relative flex items-center justify-between p-5 cursor-pointer transition-all hover:scale-[1.02]
                  ${pkg.id === 'elite'
                    ? 'rounded-[1.9rem] bg-[#0d0d0f] hover:bg-yellow-500/10'
                    : pkg.popular
                    ? 'rounded-[2rem] border border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/15'
                    : 'rounded-[2rem] border border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                onClick={() => handleBuyGems(pkg)}
              >
                {pkg.id === 'elite' && (
                  <div className="absolute -top-3 left-6 bg-yellow-500 text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    ⚡ Más popular
                  </div>
                )}
                {pkg.popular && (
                  <div className="absolute -top-3 left-6 bg-purple-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    🔥 Mejor valor
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <Gem
                    className={`w-6 h-6 ${pkg.id === 'elite' ? 'text-yellow-400' : 'text-purple-400'}`}
                    fill="currentColor"
                  />
                  <div>
                    <p className="font-black italic text-white text-lg">
                      {pkg.gems.toLocaleString()} gemas
                    </p>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                      {pkg.analyses} · {pkg.perGem}
                    </p>
                    {savings && (
                      <p className="text-green-400 text-[10px] font-black uppercase tracking-wider mt-0.5">
                        ✓ {savings}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-xl ${pkg.id === 'elite' ? 'text-yellow-400' : 'text-white'}`}>
                    ${pkg.price}
                  </p>
                  <p className="text-slate-500 text-[10px]">USD</p>
                </div>
              </div>
            );

            return pkg.id === 'elite' ? (
              <div key={pkg.id} className="relative elite-shimmer-border mt-4">
                {cardInner}
              </div>
            ) : (
              <div key={pkg.id} className="relative">
                {cardInner}
              </div>
            );
          })}
        </div>

        {/* Garantía */}
        <div className="flex items-center justify-center gap-2 mt-2 mb-6 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
          <span>🔒</span>
          <span>Pago seguro · Las gemas no vencen · Sin suscripción</span>
        </div>

        <div id="paypal-button-container" className="min-h-[50px]" />
        {gemError && (
          <p className="text-red-400 text-xs font-bold text-center mt-4">{gemError}</p>
        )}
      </div>
    </div>
  </>
)}
      {/* CONTADOR VISUAL */}
      <div className="fixed top-6 right-6 z-50 flex flex-col items-end gap-2">
        {!isLoadingCount && (
          <>
            <div className="flex items-center gap-2 bg-black/60 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-sm font-black italic tracking-tight">{userCount}/500 usuarios</span>
            </div>
            <div className="w-64 h-2 bg-white/5 border border-white/10 rounded-full overflow-hidden shadow-lg">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${userCount >= 500 ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
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
          <h1 className="text-2xl font-black tracking-tighter italic uppercase">
            RED<span className="text-purple-500">xax</span> VISION
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* ✅ onClick para abrir tienda */}
          <div 
            onClick={() => setShowGemStore(true)}
            className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all hover:bg-purple-500/20 cursor-pointer"
          >
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

        {step === 'upload' && (
          <div className="text-center space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                <Microscope className="w-3 h-3" /> Precisión 500% — Analista Neutro
              </div>
              <h2 className="text-7xl md:text-9xl font-black italic tracking-tighter leading-none uppercase">
                POTENCIAL <br/><span className="bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent">REAL.</span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl font-medium">
                Sin juicios. Sin amabilidad. Solo la verdad técnica <br/>sobre tu probabilidad de éxito.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto px-4">
              <div 
                onClick={() => setStep('script_input')}
                className="group relative block border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/[0.02] rounded-[4rem] p-24 md:p-36 transition-all cursor-pointer overflow-hidden shadow-2xl"
              >
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
                    runNeuralAnalysis(url);
                  }
                }} />
              </label>
            </div>
          </div>
        )}

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
                <button onClick={runScriptAnalysis} disabled={!scriptText.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-full text-sm font-black italic uppercase tracking-wider transition-all">
                  Analizar Viabilidad
                </button>
              </div>
            </div>
          </div>
        )}

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

        {step === 'results' && aiResult && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-right-10 duration-700">
            <div className="lg:col-span-4 space-y-6">
              {analysisMode === 'video' ? (
                <div className="bg-[#111] rounded-[3.5rem] overflow-hidden border border-white/10 aspect-[9/16] relative shadow-2xl">
                  {videoPreviewUrl && <video src={videoPreviewUrl} className="w-full h-full object-cover" controls autoPlay loop muted />}
                </div>
              ) : (
                <div className="bg-[#111] rounded-[3.5rem] p-10 border border-white/10 aspect-[9/16] relative shadow-2xl flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-4 text-indigo-400">
                    <FileText className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">Guion Escaneado</span>
                  </div>
                  <p className="text-slate-300 italic text-sm font-medium leading-relaxed overflow-y-auto custom-scrollbar flex-1">"{scriptText}"</p>
                </div>
              )}
              <div className="bg-gradient-to-br from-zinc-900 to-black p-10 rounded-[3.5rem] border border-white/10 shadow-2xl space-y-8">
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 italic mb-4">Potencial de Éxito</p>
                  <div className={`text-8xl font-black italic tracking-tighter tabular-nums ${aiResult.potentialScore >= 70 ? 'text-green-400' : 'text-white'}`}>{aiResult.potentialScore}%</div>
                  <div className="mt-4 inline-block bg-purple-600/20 text-purple-400 px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-500/30">
                    Escenario: {aiResult.performanceScenario}
                  </div>
                </div>
                <div className="pt-8 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className={`w-4 h-4 ${analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'}`} />
                    <p className={`text-[10px] font-black uppercase tracking-[0.4em] italic ${analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'}`}>Veredicto</p>
                  </div>
                  <p className="text-sm font-bold italic leading-relaxed text-slate-300">"{aiResult.honestVerdict}"</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white/[0.03] border border-white/5 p-10 rounded-[3.5rem] space-y-6">
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
              </div>

              <div className="bg-white/[0.02] border border-white/10 p-10 rounded-[4rem]">
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
              </div>

              <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-8">
                <div className="flex items-center gap-4">
                  <CheckCircle className="text-green-500" />
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter">Hoja de Ruta</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(aiResult.roadmap || []).map((step, i) => {
                    const isCompleted = completedSteps.includes(i);
                    return (
                      <div key={i} onClick={() => toggleStep(i)} className={`flex items-center gap-6 p-6 rounded-[2.5rem] transition-all cursor-pointer border ${isCompleted ? 'bg-green-500/10 border-green-500/30 opacity-50' : 'bg-black/40 border-white/5 hover:border-purple-500/30'}`}>
                        <div className={`shrink-0 transition-colors ${isCompleted ? 'text-green-400' : 'text-slate-600'}`}>
                          {isCompleted ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                        </div>
                        <p className={`font-bold italic text-sm transition-all ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{step}</p>
                      </div>
                    );
                  })}
                </div>
              </div> 

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
                      <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Escribe tu consulta..." className="bg-transparent border-none outline-none flex-1 text-sm text-white py-2 italic" />
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
                <button
                  key={item.id}
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
                </button>
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