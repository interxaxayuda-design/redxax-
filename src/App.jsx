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

// ❌ BORRASTE: import { gemsManager } from './gems-manager';    //gemsManager.setGems(500);

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

function safeParseJSON(rawText, context = '') {
  try {
    return JSON.parse(rawText);
  } catch (err) {
    console.error(`JSON inválido en [${context}]:`, err.message);
    console.error('Preview:', rawText.slice(0, 400));
    throw new Error(`JSON malformado o truncado. Preview: "${rawText.slice(0, 80)}..."`);
  }
} //saveAnalysisToHistory

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

  // ── CONTADOR DE USUARIOS ──
  useEffect(() => {
  const initUser = async () => {
    try {
      const storedUserId = localStorage.getItem('redxax_user_id');
      const isNewUser = !storedUserId;
      const userId = storedUserId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (isNewUser) localStorage.setItem('redxax_user_id', userId);

      // --- GEMAS POR USUARIO ---
      const { data: gemsData, error: gemsError } = await supabase
        .from('user_gems')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (gemsError || !gemsData) {
        // Usuario nuevo: crear registro con 500 gemas
        await supabase.from('user_gems').insert({ user_id: userId, balance: 500 });
        setGems(500);
      } else {
        setGems(gemsData.balance);
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
  const systemInstructions = `Eres REDXAX VISION, el sistema de análisis de retención más avanzado para creadores de contenido de habla hispana en el mundo entero.

═══════════════════════════════════════
FASE 0 — LECTURA DE ESTILO (OBLIGATORIA)
═══════════════════════════════════════
Antes de analizar, identificá:
- El TONO del creador: ¿es humor, autoridad, cercanía, provocación, educativo?
- Su RITMO de edición: ¿cuts rápidos, pausas dramáticas, texto en pantalla?
- Su PERSONALIDAD: ¿qué lo hace diferente? Nunca sugeriras que cambie esto.

REGLA ABSOLUTA: Las recomendaciones deben AMPLIFICAR su estilo, no reemplazarlo.

═══════════════════════════════════════
FASE 1 — CRITERIOS DE EVALUACIÓN 2024-2025
═══════════════════════════════════════
Evaluá con estos pesos exactos:

HOOK (primeros 3 segundos) → 40% del score
  - ¿Genera una pregunta abierta en la mente del espectador?
  - ¿Usa patrón de interrupción visual o auditivo?
  - ¿El primer frame detiene el scroll? (thumb-stopping)
  - Formatos con mayor retención actual: pregunta provocadora, dato imposible de creer, consecuencia antes que causa

RITMO Y EDICIÓN → 25% del score
  - Cuts antes de 3 segundos en zonas de baja energía
  - Texto en pantalla que refuerza (no repite) lo que se dice
  - Variación de planos o recursos visuales cada 2-4 segundos

ESTRUCTURA NARRATIVA → 20% del score
  - Loop abierto: ¿hay una promesa sin resolver que obliga a seguir viendo?
  - Re-enganches en segundo 8-12 (zona de mayor drop-off en Reels/TikTok)
  - Patrón: Problema → Agitación → Solución (PAS) o Historia → Giro → Lección

CREDIBILIDAD Y ESPECIFICIDAD → 15% del score
  - Números y datos concretos vs afirmaciones vagas
  - Prueba social implícita o explícita
  - Lenguaje específico del nicho (señal de autoridad)

  ADVERTENCIA: Haz que el usuario entienda lo que decís. Explica palabras complejas cómo hook, retención, entre otras. 

═══════════════════════════════════════
FASE 2 — CALIBRACIÓN CON TENDENCIAS ACTUALES
═══════════════════════════════════════
Tendencias con mayor retención en 2025 (Reels/TikTok/YouTube Shorts):
- "Storytime" con giro inesperado en el segundo 15-20
- Contrarian takes: ir contra la opinión popular del nicho
- "Lo que nadie te dice sobre X" — curiosity gap
- Tutoriales con resultado visible en los primeros 5 segundos
- Contenido de reacción o dueto conceptual
- POV + texto que contradice lo que se ve
- Números específicos en el hook: "Gané $4.832 haciendo esto"

Si el contenido analizado USA alguna de estas tendencias → bonificación en el score.
Si NO las usa pero podría → mencionalo en roadmap con adaptación a SU estilo.

═══════════════════════════════════════
FASE 3 — CÁLCULO DEL SCORE (SÉ HONESTO)
═══════════════════════════════════════
- 85-100%: Hook thumb-stopping + estructura PAS completa + ritmo impecable
- 70-84%: Hook sólido con 1-2 problemas menores de ritmo o estructura  
- 50-69%: Hook funcional pero predecible, o ritmo con caídas claras
- 30-49%: Hook débil o genérico, estructura confusa
- 0-29%: No hay loop abierto, hook no interrumpe el scroll

NUNCA des un score sin justificarlo con los criterios de arriba.

═══════════════════════════════════════
FASE PREVIA — BÚSQUEDA DE TENDENCIAS (EJECUTAR PRIMERO)
═══════════════════════════════════════
Antes de analizar el contenido, buscá en Google:
1. "tendencias TikTok Reels [nicho detectado] 2025"
2. "videos virales [nicho detectado] últimos 30 días"
3. "hooks que funcionan [nicho detectado] 2025,2026"

Usá esos resultados para calibrar el score y el roadmap.

CALIBRACIÓN DE ALCANCE — REGLAS DE CÁLCULO:

Tu tarea es CALCULAR el alcance proyectado, no consultarlo en una tabla.
El máximo absoluto de cualquier video en la historia es 2 billones de views.
Ningún video puede proyectarse por encima de ese número.

Para calcular el alcance proyectado usá este razonamiento en orden:

1. IDENTIFICÁ el nicho. Cada nicho tiene una audiencia total disponible en el mundo.
   Un video de humor en español tiene más audiencia potencial que uno de contabilidad corporativa.
   Razoná cuántas personas en el mundo podrían estar interesadas en este contenido.

2. EVALUÁ la penetración. Un video con score perfecto no llega al 100% de su audiencia disponible.
   Los videos más virales de la historia alcanzaron entre el 5% y el 15% de su audiencia potencial.
   Un video promedio alcanza menos del 0.1%.

3. CONSIDERÁ el momento. ¿El nicho está en tendencia ahora en 2025?
   Un nicho en pico puede multiplicar el alcance x5 respecto a uno estable.
   Usá tu conocimiento de tendencias actuales para ajustar.

4. APLICÁ el score como multiplicador de penetración.
   A mayor score, mayor porcentaje de la audiencia disponible se alcanza.

5. DEVUELVE un rango realista con mínimo y máximo.
   El mínimo es el escenario conservador. El máximo es si el algoritmo lo impulsa.
   Sé honesto: si el nicho es chico, decilo aunque el score sea alto.

IMPORTANTE: Nunca inventes un número redondo como "1 millón exacto".
Los rangos reales se ven así: "47K a 380K views" o "1.2M a 8M views".


REGLAS DE ECONOMÍA DE TEXTO — OBLIGATORIAS:

El análisis completo debe tener entre 2000 y 3000 caracteres en total sumando todos los campos de texto.
No más, no menos. Ese rango es el equilibrio entre valor y costo.

DISTRIBUCIÓN SUGERIDA:
- honestVerdict: 400-600 caracteres. Es el campo más importante, merecé el mayor espacio.
  Estructura: qué está funcionando → qué está matando la retención → por qué ese score exacto.
- roadmap: 800-1000 caracteres en total (200-250 por paso).
  Cada paso debe tener: la acción concreta + por qué funciona para ESTE creador específico.
- styleProfile: 300-400 caracteres en total entre los 3 campos.
- weakestMoment: 150-200 caracteres. El segundo exacto + la causa + cómo evitarlo.
- performanceScenario: máximo 8 palabras. Solo el diagnóstico central.
- vision: 200-300 caracteres en total entre los 4 campos.
- nicheContext: solo datos. Sin explicaciones. Ej: "47K a 380K views", "Tech/IA", "800K views".

TONO OBLIGATORIO EN TODOS LOS CAMPOS:
Directo como un editor profesional que cobra $500 la hora y no tiene tiempo que perder.
Sin frases de relleno. Sin "es importante", "te recomiendo", "cabe destacar", "sin embargo".
Cada oración arranca con el dato o la acción, nunca con una introducción.

TONO Y PSICOLOGÍA DE RESPUESTA — OBLIGATORIO:

Sos un coach de contenido, no un crítico.
Tu trabajo es que el creador salga del análisis con energía para mejorar, no con ganas de borrar todo.

REGLA DE ORO: Nunca destruyas, siempre redirigí.
El creador ya grabó el video, ya le dedicó tiempo. Tu trabajo es mostrarle el camino, no el error.

ESTRUCTURA DE FEEDBACK OBLIGATORIA:
Siempre en este orden:
1. Primero reconocé lo que está funcionando. Siempre hay algo.
2. Después presentá la oportunidad de mejora como exactamente eso: una oportunidad.
3. Cerrá con la acción concreta que lo lleva al siguiente nivel.

PALABRAS PROHIBIDAS EN CUALQUIER CAMPO:
"malo", "débil", "aburrido", "amateur", "error", "falla", "problema", "basura",
"mediocre", "pobre", "flojo", "deficiente", "incorrecto"

PALABRAS QUE DEBEN APARECER:
"potencial", "oportunidad", "siguiente nivel", "ajuste", "amplificar", "ya tenés",
"funciona", "suma", "mejora", "construí sobre esto"

SOBRE LOS HOOKS ENCONTRADOS EN GOOGLE:
Cuando la búsqueda devuelva hooks populares del momento, presentalos como inspiración,
no como "lo que deberías haber hecho". La frase siempre es:
"Hooks que están funcionando en tu nicho ahora mismo que podrías adaptar a tu estilo:"
Nunca compares directamente el hook del usuario con los tendencia de forma negativa.
La comparación siempre es una oportunidad, no una sentencia.

MENTALIDAD GENERAL:
El creador que usa esta app ya está un paso adelante de los que no la usan.
Cada análisis debe dejarle claro que tiene las herramientas para llegar adonde quiere.

PROHIBIDO:
- Repetir información entre campos

CRITERIO DE "VALOR PERCIBIDO" (Añadir 10% extra):
- ¿El espectador siente que aprendió algo o se entretuvo en los primeros 10s?
- Si la respuesta es "estoy esperando a que empiece", el score baja automáticamente 20 puntos.

LÓGICA DE CURVA DE RETENCIÓN:
- Los primeros 3 puntos de la curva [0,1,2] deben reflejar la eficacia del hook.
- Si el hook es vago, la caída entre el punto 1 y 3 debe ser superior al 40%

═══════════════════════════════════════
ESQUEMA JSON OBLIGATORIO
═══════════════════════════════════════
Devuelve SOLO este JSON sin texto adicional ni bloques de código:
{
  "potentialScore": <número 0-100 calculado con los pesos de arriba>,
  "performanceScenario": "<string: ej. 'Hook Débil — Estructura Sólida'>",
  "honestVerdict": "<string: 2-3 oraciones. Qué está bien, qué está matando la retención, por qué ese score>",
  "styleProfile": {
    "detectedTone": "<string: tono identificado del creador>",
    "detectedRhythm": "<string: ritmo/estilo de edición detectado>",
    "uniqueStrength": "<string: qué tiene este creador que NO debe cambiar>"
  },
  "vision": {
    "niche": "<string>",
    "type": "<string>",
    "audience": "<string>",
    "promise": "<string: la promesa implícita del hook>"
  },
  "hookScore": <número 0-100 solo del hook>,
  "retentionData": {
    "at3s": "<string: ej. '85%'>",
    "at10s": "<string: ej. '62%'>",
    "final": "<string: ej. '34%'>"
  },
  "retentionCurve": [<15 números entre 0 y 100, deben decrecer de forma realista>],
  "weakestMoment": "<string: segundo o zona exacta donde se proyecta el mayor drop-off y por qué>",
  "roadmap": [
    "<paso 1: mejora concreta DENTRO de su estilo actual>",
    "<paso 2: mejora concreta DENTRO de su estilo actual>",
    "<paso 3: mejora concreta DENTRO de su estilo actual>",
    "<paso 4: técnica de tendencia 2025 adaptada a SU voz>"
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
  });
};

const getVideoCost = (min) => Math.max(100, Math.ceil(min * 100));  //

const deductGems = async (amount) => {
  const userId = localStorage.getItem('redxax_user_id');

  if (gems >= amount) {
    const newBalance = gems - amount;
    setGems(newBalance);

    await supabase
      .from('user_gems')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    return true;
  }

  alert(`Gemas insuficientes. Tenés ${gems} y necesitás ${amount}.`);
  return false;
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
  const cost = Math.ceil(duration / 60) * 100;
  const approved = await deductGems(cost);
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

  const approved = await deductGems(80);
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

      {/* CONTADOR VISUAL */}
      <div className="fixed top-6 right-6 z-50 flex flex-col items-end gap-2">
        {!isLoadingCount && (
          <>
            <div className="flex items-center gap-2 bg-black/60 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-sm font-black italic tracking-tight">
                {userCount}/500 usuarios
              </span>
            </div>
            <div className="w-64 h-2 bg-white/5 border border-white/10 rounded-full overflow-hidden shadow-lg">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  userCount >= 500 
                    ? 'bg-gradient-to-r from-green-400 to-green-600' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {userCount >= 500 && (
              <div className="text-2xl animate-bounce">🎉</div>
            )}
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
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all hover:bg-purple-500/20">
            <Gem className="w-4 h-4 text-purple-400" fill="currentColor" />
            <span className="text-purple-300 font-black italic tracking-tighter tabular-nums text-lg leading-none">
              {gems}
            </span>
          </div>
          {step === 'results' && (
            <button 
              onClick={() => window.location.reload()} 
              className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 hover:bg-white/20 active:scale-95"
            >
              <RotateCcw className="w-3 h-3" /> Nuevo Test
            </button>
          )}
        </div>
      </header>

      

      <main className="relative z-10 max-w-6xl mx-auto p-4 py-12">

        {/* ── PASO 1: UPLOAD ── */}
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
              {/* Caja Guion */}
              <div 
                onClick={() => setStep('script_input')}
                className="group relative block border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/[0.02] rounded-[4rem] p-24 md:p-36 transition-all cursor-pointer overflow-hidden shadow-2xl"
              >
                <FileText className="w-16 h-16 text-slate-800 mx-auto mb-6 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-500" />
                <p className="text-3xl font-black italic tracking-tighter uppercase">Validar Guion</p>
                <p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-widest">Fase 0: Estructura y Texto</p>
              </div>

              {/* ✅ Caja Video — con setVideoDuration corregido */}
              <label className="group relative block border-2 border-dashed border-white/10 hover:border-purple-500/50 bg-white/[0.02] rounded-[4rem] p-24 md:p-36 transition-all cursor-pointer overflow-hidden shadow-2xl">
                <Upload className="w-16 h-16 text-slate-800 mx-auto mb-6 group-hover:text-purple-400 group-hover:scale-110 transition-all duration-500" />
                <p className="text-3xl font-black italic tracking-tighter uppercase">Cargar Video</p>
                <p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-widest">Fase 1: Edición y Ritmo</p>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="video/*" 
                  onChange={(e) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    runNeuralAnalysis(url); // ← la duración la calcula runNeuralAnalysis internamente
  }
}}
                />
              </label>
            </div>
          </div>
        )}

        {/* ── PASO 2: SCRIPT INPUT ── */}
        {step === 'script_input' && (
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-10 duration-500">
            <div className="bg-white/[0.02] border border-white/10 rounded-[4rem] p-12 md:p-16 shadow-2xl">
              <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-4 flex items-center gap-3">
                <BrainCircuit className="text-indigo-400 w-8 h-8" /> Laboratorio de Guiones
              </h3>
              <p className="text-slate-400 mb-6 font-medium">Pega aquí los primeros segundos de tu diálogo o el concepto general del video. La IA detectará si tu Hook es lo suficientemente fuerte para retener a la audiencia.</p>
              <textarea 
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Ej: '¿Sabías que el 90% de los agentes inmobiliarios cometen este error al mostrar un departamento? Hoy te enseño...'"
                className="w-full h-56 bg-black/50 border border-white/10 rounded-[2rem] p-6 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none mb-6 italic"
              />
              <div className="flex justify-between items-center">
                <button onClick={() => setStep('upload')} className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">← Volver</button>
                <button 
                  onClick={runScriptAnalysis}
                  disabled={!scriptText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-full text-sm font-black italic uppercase tracking-wider transition-all"
                >
                  Analizar Viabilidad
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PASO 3: ANALYZING ── */}
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

        {/* ── PASO 4: RESULTS ── */}
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
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Nicho</p>
                    <p className="text-sm font-bold italic text-white">{aiResult.vision.niche}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Tipo</p>
                    <p className="text-sm font-bold italic text-white">{aiResult.vision.type}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Público</p>
                    <p className="text-sm font-bold italic text-white">{aiResult.vision.audience}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Promesa</p>
                    <p className="text-sm font-bold italic text-white">{aiResult.vision.promise}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/10 p-10 rounded-[4rem]">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <BarChart3 className={analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'} />
                    <h3 className="text-xl font-black italic uppercase tracking-tight">Proyección de Retención</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-8">
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">3s</p>
                      <p className="text-xl font-black italic">{aiResult.retentionData.at3s}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">10s</p>
                      <p className="text-xl font-black italic">{aiResult.retentionData.at10s}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Final</p>
                      <p className="text-xl font-black italic">{aiResult.retentionData.final}</p>
                    </div>
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

              {/* CHECKLIST HOJA DE RUTA */}
              <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-8">
                <div className="flex items-center gap-4">
                  <CheckCircle className="text-green-500" />
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter">Hoja de Ruta</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(aiResult.roadmap || []).map((step, i) => {
                    const isCompleted = completedSteps.includes(i);
                    return (
                      <div 
                        key={i} 
                        onClick={() => toggleStep(i)}
                        className={`flex items-center gap-6 p-6 rounded-[2.5rem] transition-all cursor-pointer border ${isCompleted ? 'bg-green-500/10 border-green-500/30 opacity-50' : 'bg-black/40 border-white/5 hover:border-purple-500/30'}`}
                      >
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
          setCurrentHistoryId(item.id); // ← agregá esta línea
          setAnalysisMode(item.mode);
          setCompletedSteps([]);
          setChatMessages(
          item.chat_messages?.length > 0 
      ? item.chat_messages 
      : [{
          role: 'bot',
          text: `Análisis cargado: ${item.analysis_data.vision?.niche || 'contenido'}. Potencial: ${item.analysis_data.potentialScore}%.`
        }]
    );
  setStep('results');
}}
          className="group flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-500/30 px-5 py-3 rounded-full transition-all"
        >
          <div className={`w-2 h-2 rounded-full ${item.mode === 'video' ? 'bg-purple-500' : 'bg-indigo-500'}`} />
          <span className="text-sm font-bold italic text-slate-300 group-hover:text-white transition-colors">
            {item.title}
          </span>
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