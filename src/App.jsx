import { createClient } from '@supabase/supabase-js';
import {
  Activity,
  BarChart3,
  Bot,
  CheckSquare,
  Compass,
  FileText,
  ListChecks,
  MessageSquare,
  Microscope,
  RotateCcw,
  Send,
  Square // <--- Nuevos íconos
  ,
  Target,
  Upload,
  X,
  Zap
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Inicializar Supabase
const supabase = createClient(
  'https://mvmilbpraefwprexgnpz.supabase.co',
  'sb_publishable_us-Tbuike3PH_Z2P-y8e4w_i0wYopmr'
);

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const App = () => {
  // NUEVOS ESTADOS
  const [step, setStep] = useState('upload'); // upload, script_input, analyzing, results
  const [analysisMode, setAnalysisMode] = useState('video'); // 'video' o 'script'
  const [scriptText, setScriptText] = useState("");
  const [completedSteps, setCompletedSteps] = useState([]); // Para la hoja de ruta interactiva
  
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [aiResult, setAiResult] = useState(null);
  const [userCount, setUserCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [statusText, setStatusText] = useState("");
  
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { if (showChat) scrollToBottom(); }, [chatMessages, isTyping]);

  useEffect(() => {
    const fetchAndUpdateCounter = async () => {
      try {
        const storedUserId = localStorage.getItem('redxax_user_id');
        const userId = storedUserId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (!storedUserId) localStorage.setItem('redxax_user_id', userId);

        const { error: insertError } = await supabase.from('user_visits').insert({ user_id: userId });
        const { data: statsData } = await supabase.from('app_stats').select('total_users').eq('id', 1).single();
        const currentCount = statsData?.total_users || 0;

        if (!insertError) {
          const newCount = Math.min(currentCount + 1, 500);
          await supabase.from('app_stats').update({ total_users: newCount }).eq('id', 1);
          setUserCount(newCount);
        } else {
          setUserCount(currentCount);
        }
      } catch (error) { console.error('Error en contador:', error); } 
      finally { setIsLoadingCount(false); }
    };
    fetchAndUpdateCounter();
  }, []);

  const fetchWithRetry = async (url, options, retries = 5, backoff = 1000) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Error ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  };

  const systemInstructions = `Actúa como un analista senior de agencia enfocado en retención y conversión. Precisión 500%.
  TONO: Neutro, técnico, implacable. Especialista en optimizar hooks para nichos competitivos (ej. Real Estate, Gaming, E-commerce).
  OBJETIVO: Evaluar potencial viral (0-100%) y prevenir fracasos de producción.
  RESPONDE ÚNICAMENTE CON JSON PURO:
  {
    "potentialScore": número,
    "performanceScenario": "string",
    "honestVerdict": "string",
    "vision": { "niche": "string", "type": "string", "audience": "string", "promise": "string" },
    "retentionData": { "at3s": "X%", "at10s": "X%", "final": "X%" },
    "retentionCurve": [15 valores numéricos del 0 al 100],
    "roadmap": ["Paso técnico 1", "Paso técnico 2", "Paso técnico 3", "Paso técnico 4"]
  }`;

  const captureFrames = (url) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = "anonymous";
      video.muted = true;
      const frames = [];
      
      video.onloadedmetadata = async () => {
        const duration = video.duration;
        const points = [0.1, 1.5, 3.0, duration * 0.5, duration * 0.9]; 
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        for (let i = 0; i < points.length; i++) {
          const targetTime = Math.min(points[i], duration);
          setStatusText(`Analizando estructura visual y ritmo... ${i+1}/${points.length}`);
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

  const runNeuralAnalysis = async (url) => {
    setStep('analyzing');
    setAnalysisMode('video');
    try {
      const base64Frames = await captureFrames(url);
      const payload = {
        contents: [{
          role: "user",
          parts: [
            { text: `${systemInstructions}\n\nAnaliza la retención visual de estos frames.` },
            ...base64Frames.map(data => ({ inlineData: { mimeType: "image/jpeg", data } }))
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const rawText = result.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawText);

      setAiResult(parsed);
      setCompletedSteps([]); // Resetear checklist
      setChatMessages([{ role: 'bot', text: `Análisis de video finalizado. Potencial: ${parsed.potentialScore}%. ¿Qué dudas tienes sobre la corrección del Hook?` }]);
      setAnalysisProgress(100);
      setTimeout(() => setStep('results'), 500);
    } catch (err) {
      console.error("Error Video:", err);
      setStep('upload');
    }
  };

  // NUEVA FUNCIÓN: Análisis de Fase 0 (Guion)
  const runScriptAnalysis = async () => {
    if (!scriptText.trim()) return;
    setStep('analyzing');
    setAnalysisMode('script');
    setAnalysisProgress(30);
    setStatusText("Evaluando psicología del texto y fricción de lectura...");
    
    try {
      const payload = {
        contents: [{
          role: "user",
          parts: [{ text: `${systemInstructions}\n\nAnaliza este concepto/guion antes de que sea grabado y predice su desempeño. Guion: "${scriptText}"` }]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
      };

      setAnalysisProgress(60);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setAnalysisProgress(90);
      const rawText = result.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawText);

      setAiResult(parsed);
      setCompletedSteps([]);
      setChatMessages([{ role: 'bot', text: `Análisis de Pre-producción listo. Potencial proyectado: ${parsed.potentialScore}%. Ajusta el guion según mis métricas antes de encender la cámara.` }]);
      setAnalysisProgress(100);
      setTimeout(() => setStep('results'), 500);
    } catch (err) {
      console.error("Error Script:", err);
      setStep('upload');
    }
  };

  // CHATBOT CON MEMORIA INYECTADA
  const sendMessage = async () => {
    if (!userInput.trim() || isTyping) return;
    const newMessages = [...chatMessages, { role: 'user', text: userInput }];
    setChatMessages(newMessages);
    setUserInput("");
    setIsTyping(true);

    try {
      // INYECCIÓN DE CONTEXTO: La IA sabe exactamente qué está evaluando
      const contextMessage = {
        role: "user",
        parts: [{ text: `CONTEXTO INTERNO: Eres el Consultor REDxax. Acabas de analizar un ${analysisMode === 'video' ? 'video' : 'guion'} que obtuvo un ${aiResult.potentialScore}% de potencial. Los datos exactos del análisis son: ${JSON.stringify(aiResult)}. Usa estos datos para responder al usuario. Responde de forma técnica, como un editor senior hablando con otro profesional.` }]
      };
      const contextAcknowledge = { role: "model", parts: [{ text: "Contexto asimilado. Responderé basándome en los datos específicos de este análisis." }] };

      const conversationHistory = newMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const payload = {
        contents: [contextMessage, contextAcknowledge, ...conversationHistory],
        generationConfig: { temperature: 0.7 }
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setChatMessages([...newMessages, { role: 'bot', text: result.candidates[0].content.parts[0].text }]);
    } catch (err) {
      setChatMessages([...newMessages, { role: 'bot', text: "Error de conexión con el núcleo analítico." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleStep = (index) => {
    if (completedSteps.includes(index)) {
      setCompletedSteps(completedSteps.filter(i => i !== index));
    } else {
      setCompletedSteps([...completedSteps, index]);
    }
  };

  const progressPercent = (userCount / 500) * 100;

  return (
    <div className="min-h-screen bg-[#020203] text-white font-sans selection:bg-purple-500/50 overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] bg-purple-600/[0.04] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[45%] h-[45%] bg-blue-600/[0.04] blur-[120px] rounded-full" />
      </div>

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
          </>
        )}
      </div>

      <header className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-xl shadow-lg">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter italic uppercase">RED<span className="text-purple-500">xax</span> VISION</h1>
        </div>
        {step === 'results' && (
          <button onClick={() => window.location.reload()} className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 hover:bg-white/10">
            <RotateCcw className="w-3 h-3" /> Nuevo Análisis
          </button>
        )}
      </header>

      <main className="relative z-10 max-w-6xl mx-auto p-4 py-12">
        {step === 'upload' && (
          <div className="text-center space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                <Microscope className="w-3 h-3" /> Fase de Pre-producción y Edición
              </div>
              <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter leading-none uppercase">
                Asegura tu <br/><span className="bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent">Éxito.</span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl font-medium">
                No edites a ciegas. Valida tu guion antes de grabar, o analiza tu video crudo antes de publicarlo.
              </p>
            </div>  

            {/* DUAL UPLOAD ZONE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div 
                onClick={() => setStep('script_input')}
                className="group relative border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/[0.02] rounded-[3rem] p-12 transition-all cursor-pointer overflow-hidden hover:bg-white/[0.04]"
              >
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-500" />
                <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-2">Validar Guion</h3>
                <p className="text-sm text-slate-500">Analiza el hook y la idea (Fase 0)</p>
              </div>

              <label className="group relative block border-2 border-dashed border-white/10 hover:border-purple-500/50 bg-white/[0.02] rounded-[3rem] p-12 transition-all cursor-pointer overflow-hidden hover:bg-white/[0.04]">
                <Upload className="w-12 h-12 text-slate-600 mx-auto mb-4 group-hover:text-purple-400 group-hover:scale-110 transition-all duration-500" />
                <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-2">Analizar Video</h3>
                <p className="text-sm text-slate-500">Sube material crudo o finalizado</p>
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
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-10">
            <div className="bg-white/[0.02] border border-white/10 rounded-[3rem] p-8 shadow-2xl">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-4 flex items-center gap-3">
                <FileText className="text-indigo-400" /> Laboratorio de Guiones
              </h3>
              <p className="text-slate-400 mb-6">Pega aquí los primeros segundos de tu diálogo o el concepto general del video. La IA detectará si tu Hook es lo suficientemente fuerte para retener a la audiencia.</p>
              
              <textarea 
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Ej: '¿Sabías que el 90% de los agentes inmobiliarios cometen este error al mostrar un departamento? Hoy te enseño...'"
                className="w-full h-48 bg-black/50 border border-white/10 rounded-[2rem] p-6 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none mb-6"
              />
              <div className="flex justify-end gap-4">
                <button onClick={() => setStep('upload')} className="px-6 py-3 rounded-full text-sm font-bold text-slate-400 hover:text-white transition-colors">Cancelar</button>
                <button 
                  onClick={runScriptAnalysis}
                  disabled={!scriptText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full text-sm font-black italic uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                >
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
                <div className="bg-[#111] rounded-[3.5rem] p-8 border border-white/10 aspect-[9/16] relative shadow-2xl flex flex-col">
                  <div className="flex items-center gap-2 mb-4 text-indigo-400">
                    <FileText className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">Guion Analizado</span>
                  </div>
                  <p className="text-slate-300 italic text-sm leading-relaxed overflow-y-auto custom-scrollbar flex-1">"{scriptText}"</p>
                </div>
              )}

              <div className="bg-gradient-to-br from-zinc-900 to-black p-10 rounded-[3.5rem] border border-white/10 shadow-2xl space-y-8">
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 italic mb-4">Potencial de Éxito</p>
                  <div className={`text-8xl font-black italic tracking-tighter tabular-nums ${aiResult.potentialScore >= 80 ? 'text-green-400' : aiResult.potentialScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {aiResult.potentialScore}%
                  </div>
                  <div className="mt-4 inline-block bg-white/5 text-slate-300 px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                    Escenario: {aiResult.performanceScenario}
                  </div>
                </div>  
                
                <div className="pt-8 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className={`w-4 h-4 ${analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'}`} />
                    <p className={`text-[10px] font-black uppercase tracking-[0.4em] italic ${analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'}`}>Veredicto Honesto</p>
                  </div>
                  <p className="text-sm font-bold italic leading-relaxed text-slate-300">"{aiResult.honestVerdict}"</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white/[0.03] border border-white/5 p-10 rounded-[3.5rem] space-y-6">
                <div className="flex items-center gap-4">
                  <Compass className={analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'} />
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter">Visión Estratégica</h3>
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
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">3s (Hook)</p>
                      <p className="text-xl font-black italic">{aiResult.retentionData.at3s}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">10s (Desarrollo)</p>
                      <p className="text-xl font-black italic">{aiResult.retentionData.at10s}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Final (CTA)</p>
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

              {/* HOJA DE RUTA INTERACTIVA */}
              <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-8">
                <div className="flex items-center gap-4">
                  <ListChecks className="text-green-500" />
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter">Hoja de Ruta (Checklist)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(aiResult.roadmap || []).map((step, i) => {
                    const isCompleted = completedSteps.includes(i);
                    return (
                      <div 
                        key={i} 
                        onClick={() => toggleStep(i)}
                        className={`flex items-center gap-6 p-6 rounded-[2.5rem] transition-all cursor-pointer border ${isCompleted ? 'bg-green-500/10 border-green-500/30' : 'bg-black/40 border-white/5 hover:border-white/20'}`}
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
                <button onClick={() => setShowChat(true)} className="w-full flex items-center justify-center gap-3 p-8 bg-zinc-600/10 hover:bg-zinc-600/20 border border-white/10 rounded-[3rem] text-slate-300 font-black italic uppercase tracking-tighter transition-all">
                  <MessageSquare className="w-5 h-5" /> Consultar Detalles con la IA
                </button>
              ) : (
                <div className="bg-[#0a0a0c] border border-white/10 rounded-[3.5rem] overflow-hidden flex flex-col h-[550px] shadow-2xl animate-in slide-in-from-bottom-10">
                  <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                      <div className="bg-zinc-800 p-2 rounded-xl border border-white/10"><Bot className="w-4 h-4 text-white" /></div>
                      <h3 className="font-black italic uppercase tracking-tighter text-sm text-zinc-400">Consultor REDxax</h3>
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
                    {isTyping && <div className="text-[10px] text-zinc-500 animate-pulse font-black uppercase ml-2 italic tracking-widest">Analizando parámetros...</div>}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-6 bg-black/50 border-t border-white/10">
                    <div className="bg-white/5 rounded-full p-2 flex items-center gap-2 px-6">
                      <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Ej: ¿Qué gancho visual sugieres para el segundo 2?" className="bg-transparent border-none outline-none flex-1 text-sm text-white py-2 italic" />
                      <button onClick={sendMessage} className="bg-zinc-700 hover:bg-zinc-600 p-3 rounded-full transition-all active:scale-90"><Send className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              )}
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