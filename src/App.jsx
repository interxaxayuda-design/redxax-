import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Zap, BarChart3, MessageSquare, 
  RotateCcw, BrainCircuit, Eye, Target, 
  ShieldCheck, Send, Bot, X, 
  Activity, TrendingUp, AlertCircle, ListChecks,
  Compass, Microscope
} from 'lucide-react';

import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase
const supabase = createClient(
  'https://mvmilbpraefwprexgnpz.supabase.co',
  'sb_publishable_us-Tbuike3PH_Z2P-y8e4w_i0wYopmr'
);

// Se define la constante para la API Key. En este entorno, se deja vacía según el flujo de trabajo. <ListChecks className="text-green-500" />
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const App = () => {
  const [step, setStep] = useState('upload'); 
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [aiResult, setAiResult] = useState(null);
  // Estado para el contador de usuarios
  const [userCount, setUserCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [statusText, setStatusText] = useState("");
  
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (showChat) scrollToBottom();
  }, [chatMessages, isTyping]);

 useEffect(() => {
  const fetchAndUpdateCounter = async () => {
    try {
      // Generar o recuperar ID único del usuario
      const storedUserId = localStorage.getItem('redxax_user_id');
      const userId = storedUserId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (!storedUserId) {
        localStorage.setItem('redxax_user_id', userId);
      }

      // Intentar insertar el user_id en user_visits (falla si ya existe)
      const { data: insertResult, error: insertError } = await supabase
        .from('user_visits')
        .insert({ user_id: userId });

      // Si NO hay error → es un usuario NUEVO
      if (!insertError) {
        // Obtener contador actual
        const { data } = await supabase
          .from('app_stats')
          .select('total_users')
          .eq('id', 1)
          .single();

        const currentCount = data?.total_users || 0;
        const newCount = Math.min(currentCount + 1, 500);

        // Actualizar el contador
        await supabase
          .from('app_stats')
          .update({ total_users: newCount })
          .eq('id', 1);

        setUserCount(newCount);
      } else {
        // Si hay error (usuario ya existe) → solo mostrar el contador
        const { data } = await supabase
          .from('app_stats')
          .select('total_users')
          .eq('id', 1)
          .single();
        setUserCount(data?.total_users || 0);
      }
    } catch (error) {
      console.error('Error:', error);
      setUserCount(1);
    } finally {
      setIsLoadingCount(false);
    }
  };

  fetchAndUpdateCounter();
}, []);

  // Implementación de fetch con reintentos y backoff exponencial para estabilidad
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
        // Puntos estratégicos para analizar el hook (inicio), desarrollo y cierre
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
          // Calidad 0.5 para optimizar el payload
          frames.push(canvas.toDataURL('image/jpeg', 0.5).split(',')[1]);
        }
        resolve(frames);
      };
    });
  };

  const runNeuralAnalysis = async (url) => {
    setStep('analyzing');
    try {
      const base64Frames = await captureFrames(url);
      
      const systemInstructions = `Actúa como un analista experto en comportamiento del espectador. Precisión 500%.
      TONO: Neutro, técnico, analítico.
      OBJETIVO: Evaluar potencial (0-100%), definir nicho y generar retención.
      RESPONDE ÚNICAMENTE CON JSON PURO:
      {
        "potentialScore": número,
        "performanceScenario": "string",
        "honestVerdict": "string",
        "vision": { "niche": "string", "type": "string", "audience": "string", "promise": "string" },
        "aiVision": "string",
        "retentionData": { "at3s": "X%", "at10s": "X%", "final": "X%" },
        "retentionCurve": [15 valores del 0 al 100],
        "roadmap": ["paso1", "paso2", "paso3", "paso4"]
      }`;

      const payload = {
        contents: [{
          role: "user",
          parts: [
            { text: `${systemInstructions}\n\nAnaliza estos frames del video. Devuelve el JSON.` },
            ...base64Frames.map(data => ({ inlineData: { mimeType: "image/jpeg", data } }))
          ]
        }],
        generationConfig: { 
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      };

     // Dentro de runNeuralAnalysis (aprox. línea 166)
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const result = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const rawText = result.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(rawText);

      setAiResult(parsed);
      setChatMessages([{
        role: 'bot',
        text: `Protocolo REDxax: Análisis de ${parsed.vision.niche} finalizado. Potencial: ${parsed.potentialScore}%. ¿Deseas profundizar en la consultoría?`
      }]);
      setAnalysisProgress(100);
      setTimeout(() => setStep('results'), 500);
    } catch (err) {
      console.error("DETALLE DEL ERROR:", err);
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
      const payload = {
        contents: newMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        })),
        generationConfig: { temperature: 0.7 }
      };

    // Dentro de sendMessage (aprox. línea 204)
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
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

  // ⬇️ AQUÍ VA
  const progressPercent = (userCount / 500) * 100;

  return (
    <div className="min-h-screen bg-[#020203] text-white font-sans selection:bg-purple-500/50 overflow-x-hidden">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] bg-purple-600/[0.04] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[45%] h-[45%] bg-blue-600/[0.04] blur-[120px] rounded-full" />
      </div>

  {/* 🟢 CONTADOR VISUAL */}
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
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-xl shadow-lg">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter italic uppercase">RED<span className="text-purple-500">xax</span> VISION</h1>
        </div>
        {step === 'results' && (
          <button onClick={() => window.location.reload()} className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 hover:bg-white/10">
            <RotateCcw className="w-3 h-3" /> Nuevo Test
          </button>
        )}
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

            <div className="max-w-3xl mx-auto">
              <label className="group relative block border-2 border-dashed border-white/10 hover:border-purple-500/50 bg-white/[0.02] rounded-[4rem] p-24 md:p-36 transition-all cursor-pointer overflow-hidden shadow-2xl">
                <Upload className="w-16 h-16 text-slate-800 mx-auto mb-6 group-hover:text-purple-400 group-hover:scale-110 transition-all duration-500" />
                <p className="text-3xl font-black italic tracking-tighter uppercase">Cargar Video</p>
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

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-12">
            <div className="relative">
              <div className="w-56 h-56 rounded-full border-[8px] border-white/5 border-t-purple-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-black italic">{analysisProgress}%</span>
              </div>
            </div>
            <p className="text-purple-400 font-bold animate-pulse text-lg tracking-tight uppercase">{statusText}</p>
          </div>
        )}

        {step === 'results' && aiResult && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-right-10 duration-700">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#111] rounded-[3.5rem] overflow-hidden border border-white/10 aspect-[9/16] relative shadow-2xl">
                {videoPreviewUrl && <video src={videoPreviewUrl} className="w-full h-full object-cover" controls autoPlay loop muted />}
              </div>

              <div className="bg-gradient-to-br from-zinc-900 to-black p-10 rounded-[3.5rem] border border-white/10 shadow-2xl space-y-8">
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 italic mb-4">Potencial de Éxito</p>
                  <div className="text-8xl font-black italic tracking-tighter text-white tabular-nums">{aiResult.potentialScore}%</div>
                  <div className="mt-4 inline-block bg-purple-600/20 text-purple-400 px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-500/30">
                    Escenario: {aiResult.performanceScenario}
                  </div>
                </div>  
                
                <div className="pt-8 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-purple-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-400 italic">Veredicto</p>
                  </div>
                  <p className="text-sm font-bold italic leading-relaxed text-slate-300">"{aiResult.honestVerdict}"</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white/[0.03] border border-white/5 p-10 rounded-[3.5rem] space-y-6">
                <div className="flex items-center gap-4">
                  <Compass className="text-purple-400" />
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
                    <BarChart3 className="text-purple-400" />
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
                        className={`w-full rounded-t-lg transition-all duration-700 ${val < 40 ? 'bg-red-500/30 border-red-500/40' : 'bg-purple-600/30 border-purple-600/40'} border-x border-t`}
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
                  {(aiResult.roadmap || []).map((step, i) => (
                    <div key={i} className="flex items-center gap-6 bg-black/40 border border-white/5 p-6 rounded-[2.5rem] hover:border-purple-500/30 transition-all group">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-all">{i+1}</div>
                      <p className="font-bold italic text-slate-400 group-hover:text-slate-200 transition-colors text-sm">{step}</p>
                    </div>
                  ))}
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
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
      `}</style>
    </div>
  );  //runNeuralAnalysis
};

export default App;