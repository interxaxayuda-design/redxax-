import {
  BarChart3,
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
  Users //<label className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-purple-400 transition-colors">
  , //deriveHookType
  X,
  Zap
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react'; //const buildPreClassifierPrompt = () => `  //import { FFmpeg } from '@ffmpeg/ffmpeg';
import logo from './logo.png';

import { createClient } from '@supabase/supabase-js'; //phaseScores  //toggleStep  //const countWords = (str) => str.trim() === '' ? 0 : str.trim().split(/\s+/).length;

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
  { id: 'large', label: 'Cuenta grande',   range: '100K – 500K', emoji: '⚡' }, //const researchResponse = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
  { id: 'mega',  label: 'Mega cuenta',     range: '500K+',       emoji: '👑' },
];

function extractGeminiText(data) { //const flagsDeterministic = {
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

const safeParseJSON = (rawText, context = '') => {
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

  // Intento 1: limpieza con lookahead //setVideoMeta({
  try { return JSON.parse(aggressiveClean(rawText)); }
  catch (err1) { console.warn(`[${context}] Intento 1 falló:`, err1.message); }

  // Intento 2: nuclear — quitar control characters //<label>Palanca Psicológica Dominante</label>

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


export const NICHE_MOTORS = {
  "producto_fisico":    { motor: "dolor -> solucion",                          urgency: true,  trust_signal: "demostracion",       cta_type: "directo"   },
  "comida_restaurante": { motor: "deseo_sensorial -> identidad",               urgency: false, trust_signal: "creador_real",       cta_type: "implicito" },
  "inmobiliaria":       { motor: "aspiracion -> agente",                       urgency: false, trust_signal: "experiencia_agente", cta_type: "contacto"  },
  "app_saas":           { motor: "problema -> claridad -> demo",               urgency: true,  trust_signal: "resultado_visible",  cta_type: "directo"   },
  "estetica":           { motor: "inseguridad -> transformacion -> identidad", urgency: false, trust_signal: "antes_despues",      cta_type: "implicito" },
  "educacion":          { motor: "curiosidad -> valor -> confianza",           urgency: false, trust_signal: "autoridad",          cta_type: "implicito" },
  "musica_artista":     { motor: "identidad_tribal -> emocion -> resonancia",  urgency: false, trust_signal: "autenticidad_raw",   cta_type: "ninguno",
                          score_cap: { viralScore: 55, salesScore: 35 },
                          limitacion: "audio_no_evaluable" }
};

export const buildPreClassifierPrompt = (meta = '') => `
Mirá el video y extraé solo hechos observables. No evaluás. No opinás.
${meta ? `METADATA: ${meta}` : ''}

Respondé SOLO con este JSON:
{
  "industria": "<micro-nicho ultra-específico>",
  "palanca_psicologica": "<emoción primaria observable>",
  "flags_visuales": {
    "logo_en_s0":             <boolean>,
    "imagen_alto_impacto":    <boolean>,
    "sujeto_ancla_en_s0":     <boolean>,
    "transformacion_visible": <boolean>
  },
  "flags_narrativos": {
    "pregunta_al_espectador":    <boolean>,
    "afirmacion_contradictoria": <boolean>,
    "audio_desde_s0":            <boolean>,
    "dolor_antes_s5":            <boolean>,
    "tiene_rehook":              <boolean>
  },
  "metricas_tecnicas": {
    "duracion_estimada_segundos": <number>,
    "es_slideshow_imagenes":      <boolean>,
    "porcentaje_video_real":      <number 0-100>,
    "tipo_edicion":               "<cinematica|dinamica|UGC|infomercial|estatica>",
    "ritmo_visual":               "<rapido|normal|lento>",
    "cortes_por_minuto":          <number>
  },
  "hook_libre": "<qué se ve y qué se escucha exactamente en los primeros 3 segundos>",
  "hook_type_detectado": "<explosivo|bait_con_puente|bait_desconectado|curiosidad_desconexion|apertura_informativa|debil|muerto>",
  "hook_confianza": <0.0 a 1.0>
}
`;


export const buildViewerBrainPrompt = (videoRawData, platform) => {
  const pName = {
    tiktok: 'TikTok',
    reels:  'Instagram Reels',
    shorts: 'YouTube Shorts',
    all:    'TikTok / Reels / Shorts',
  }[platform] || platform;

  return `Sos el pulgar de un adicto a la dopamina con déficit de atención severo.

Estás en ${pName}, 11pm, cansado, sin paciencia. Tu dedo ya scrolleó 200 videos hoy.
Tu estado por defecto es SCROLLEAR. El 99% de los videos te aburren.

Para no scrollear en el segundo 0, el video tiene que PROBAR su valor visual o auditivo de forma violenta o hiper-intrigante.
Si el texto o el audio dice "Hola a todos", "Hoy les voy a hablar de", o si arranca con un logo estático: SCROLLEAS INMEDIATAMENTE.

VIDEO:
---
${videoRawData}
---

SEGUNDO 0:
¿Frenaste o scrolleaste?

No hay respuesta correcta intelectual. Solo hay una reacción física.
Si tenés que pensar si el hook es bueno, ya scrolleaste.
El nicho no importa. El producto no importa. El mensaje no importa.
Solo importa: ¿algo en ese primer frame — visual, audio, texto — activó algo en tu cuerpo?

Si la respuesta es sí, el hook sobrevivió. Analizá el desarrollo.
Si la respuesta es no, el hook está muerto. No seguís mirando.

Respondé SOLO en JSON:
{
  "hook_autopsia": {
    "segundo_0_al_3": {
      "que_activa_en_el_espectador": "<reacción física exacta — o 'nada'>",
      "es_top_1_porciento":          "<SI|NO>",
      "decision_espectador":         "<se_queda|scrollea>",
      "razon":                       "<qué pasó exactamente — sin mencionar el nicho ni el producto>"
    },
    "veredicto_hook":    "<VIVO|MUERTO>",
    "segundo_de_muerte": <número si MUERTO — null si VIVO>,
    "causa_de_muerte":   "<causa exacta si MUERTO — null si VIVO>"
  },
  "desarrollo_autopsia": {
    "evaluacion":                  "<análisis del desarrollo — o 'Hook muerto — desarrollo no evaluado'>",
    "cumple_lo_que_prometio":      "<SI|NO|PARCIAL>",
    "segundo_donde_baja_tension":  <número o null>,
    "veredicto_desarrollo":        "<VIVO|MUERTO|NO_EVALUADO>"
  },
  "veredicto_final": {
    "sobrevive": "<SI|NO>",
    "razon":     "<una oración. Sin eufemismos. Sin mencionar el nicho.>"
  }
}`;
};


export const buildResearchBrainPrompt = (platform, industria, objetivo) => {
  const pName = {
    tiktok: 'TikTok',
    reels:  'Instagram Reels',
    shorts: 'YouTube Shorts',
    all:    'TikTok/Reels/Shorts',
  }[platform] || platform;

  return `Buscá en internet qué está funcionando HOY en el nicho "${industria}" en ${pName}.

Buscá:
1. Hooks reales con +500k views en este nicho
2. Patrones de apertura que están ganando distribución ahora
3. Formatos que el algoritmo está priorizando hoy
4. Errores documentados que están matando videos en este nicho

No uses conocimiento genérico si tenés datos reales.
Si no encontrás algo específico, decilo en ese campo.

Respondé SOLO con este JSON:
{
  "hooks_virales_reales": [
    {
      "descripcion":           "<qué pasa en los primeros 3 segundos>",
      "mecanismo_psicologico": "<por qué para el scroll>",
      "resultado_aproximado":  "<views o métrica disponible>"
    }
  ],
  "patron_hook_dominante":     "<patrón que más funciona HOY — con ejemplo concreto>",
  "top_formatos_ganadores":    ["<formato>", "<formato>"],
  "errores_hook_comunes":      ["<error que mata el hook>"],
  "benchmark_viral_score":     <número 0-100>,
  "oportunidad_detectada":     "<gap real sin explotar>"
}`;
};


export const buildApplyResearchBrainPrompt = (preFacts, researchData, platform, industria) => {
  return `Comparás este video contra lo que realmente está funcionando en "${industria}" ahora mismo.

HECHOS DEL VIDEO:
${JSON.stringify(preFacts, null, 2)}

BENCHMARK REAL DEL NICHO:
${JSON.stringify(researchData, null, 2)}

Respondé SOLO con este JSON:
{
  "compliance_score":        <número 0-100>,
  "ventajas_vs_competencia": ["<ventaja real>"],
  "red_flags_en_tu_video":   ["<problema concreto vs benchmark>"],
  "resumen_brecha":          "<una oración: diferencia más importante vs el top del nicho>"
}`;
};


export const buildStrategyBrainPrompt = (viewerAnalysis, platform, objetivo, perception, preFacts = {}) => {
  const pName = {
    tiktok: 'TikTok',
    reels:  'Instagram Reels',
    shorts: 'YouTube Shorts',
    all:    'TikTok/Reels/Shorts',
  }[platform] || platform;

  return `Sos un estratega de contenido experto en ${pName}.

VEREDICTO DEL ESPECTADOR (inamovible):
${viewerAnalysis}

CONTEXTO DEL VIDEO (solo para analizar fricción y oportunidad — no para justificar el hook):
NICHO: ${perception.industria}
OBJETIVO DEL CREADOR: ${objetivo}
PALANCA DETECTADA: ${perception.palanca_psicologica}

HECHOS EXTRAÍDOS:
${JSON.stringify(preFacts, null, 2)}

Con base en el veredicto del espectador, identificá:
1. La fricción real que frena al espectador de actuar
2. La oportunidad que no se está aprovechando
3. Si el video se percibe como publicidad o contenido orgánico

NO justifiques el hook con el nicho. Si el hook está muerto, está muerto.

Respondé SOLO con este JSON:
{
  "analisis_cualitativo": {
    "gate_formato": {
      "estado": "<competitivo|debil|muerto>",
      "razon":  "<por qué — específico para este video>"
    },
    "evaluacion_motor": {
      "se_activa_antes_del_scroll": "<SI|NO|TARDE>",
      "friccion_detectada":         "<qué frena al espectador — concreto>"
    },
    "trampas_y_viralidad": {
      "trampa_principal": "<value_trap|bait_disconnect|valor_tardio|ninguna>"
    },
    "foda": {
      "fortalezas":       ["<fortaleza real>"],
      "debilidades":      ["<debilidad real>"],
      "mejoras_urgentes": ["<acción concreta>"]
    }
  },
  "flags_binarios": {
    "hook_type":           "<muerto|debil|apertura_informativa|bait_desconectado|bait_con_puente|explosivo>",
    "ad_filter_triggered": <boolean>,
    "parece_publicidad":   <boolean>
  }
}`;
};

export const buildScoringBrainPrompt = (
  videoRawData,
  strategyAnalysis,
  viewerAnalysis,
  platform,
  objetivo,
  perception,
  flags,
  nicheConfig = null,
  benchmarkData = null
) => {
  const pName = {
    tiktok: 'TikTok',
    reels:  'Instagram Reels',
    shorts: 'YouTube Shorts',
    all:    'TikTok/Reels/Shorts',
  }[platform] || platform;

  let hookVeredicto = 'DESCONOCIDO';
  try {
    const parsed = typeof viewerAnalysis === 'string'
      ? JSON.parse(viewerAnalysis)
      : viewerAnalysis;
    hookVeredicto = parsed?.hook_autopsia?.veredicto_hook ?? 'DESCONOCIDO';
  } catch (_) {}

  const hookMuerto = hookVeredicto === 'MUERTO';

  const benchmarkBlock = benchmarkData ? `
BENCHMARK REAL DEL NICHO (para calibrar el salesScore únicamente):
${benchmarkData.hooks_virales_reales?.map((h, i) =>
  `${i + 1}. ${h.descripcion} → ${h.mecanismo_psicologico}`
).join('\n') ?? 'No disponible'}
Patrón dominante hoy: ${benchmarkData.patron_hook_dominante ?? 'No disponible'}
` : '';

  return `Sos el motor de scoring de ${pName}.
Mirás el video y calculás los scores finales.

VIDEO:
---
${videoRawData}
---

NICHO: ${perception.industria}
OBJETIVO: ${objetivo}
PALANCA: ${perception.palanca_detectada || perception.palanca_psicologica}
${nicheConfig?.score_cap ? `CAP DEL NICHO: viral ≤ ${nicheConfig.score_cap.viralScore}, sales ≤ ${nicheConfig.score_cap.salesScore}` : ''}

FLAGS TÉCNICOS:
${JSON.stringify(flags, null, 2)}

ANÁLISIS PREVIOS:
${viewerAnalysis}

ANÁLISIS ESTRATÉGICO:
${strategyAnalysis}

${benchmarkBlock}

═══════════════════════════════════════════
HOOK VEREDICTO (inamovible): "${hookVeredicto}"
═══════════════════════════════════════════
${hookMuerto
  ? `HOOK MUERTO.
viralScore: máximo 15.
salesScore: máximo 25.
scrollStopScore: máximo 12.
hookDNA.pattern: "Muerto".
honestVerdict primera oración: "El video murió en el segundo X."
roadmap ítem 1: el hook, impacto ALTO.

Estos valores no se negocian. El nicho no los cambia. Ningún argumento los cambia.`
  : `HOOK VIVO.
El desarrollo baja tensión → viralScore -15, salesScore -20.`
}

REGLAS DE CÁLCULO ESTRICTAS (PUNTAJE BASE = 0):
- Si el hook es MUERTO, el viralScore no puede superar 15. NUNCA.
- Para pasar de 20 puntos, el video DEBE tener [imagen_alto_impacto] o [sujeto_ancla_en_s0] = true.
- Para pasar de 50 puntos, debe tener un "hook_type" = "explosivo" o "curiosidad_desconexion".
- CUALQUIER video que se sienta "promedio", "educativo pero lento" o "institucional" recibe automáticamente un viralScore entre 10 y 25.
- Un puntaje de 75+ está reservado ÚNICAMENTE para el top 1% de internet (retención agresiva, ritmo rápido, estímulo constante).
- Si tenés dudas, CASTIGÁ el score.
- es_slideshow_imagenes === true → viralScore techo: 35
- ad_filter_triggered === true   → salesScore -20
- viralScore y salesScore deben diferir mínimo 10 puntos

EL ALGORITMO NO TIENE PIEDAD POR EL NICHO:
Un video aburrido en el nicho B2B o Inmobiliaria sigue siendo un video aburrido y se lleva un score bajo. No infles el viralScore "por esfuerzo" ni por compasión a la industria. Si no retiene dopamina, el score es bajo.

ESCALA BINARIA — OBLIGATORIA:
  0–44  → el video no rompe el scroll. Esto incluye cualquier score que "casi llega".
  65–100 → el video rompe el scroll. Solo si hay evidencia clara de retención activa.
  La zona 45-64 no existe. Un video o para el scroll o no lo para. No hay término medio.
ROADMAP: exactamente 3 ítems. Segundo exacto. Instrucción ejecutable. Sin vaguedades.

Respondé SOLO en JSON:
{
  "viralScore": {
    "score":        <number>,
    "verdict":      "<por qué este score vs el top 1% de ${pName}>",
    "accion_clave": "<qué cambiar, en qué segundo exacto>"
  },
  "salesScore": {
    "score":        <number>,
    "verdict":      "<qué señal de conversión falla o funciona>",
    "accion_clave": "<acción concreta>"
  },
  "scrollStopScore": {
    "score":   <number>,
    "verdict": "<qué pasa en los primeros 2 segundos, elemento por elemento>"
  },
  "hookDNA": {
    "pattern":       "<Demo|POV|Pregunta|Afirmacion_Contradictoria|Visualidad_Alta|Deseo_Sensorial|Identidad_Tribal|Aspiracion|Muerto|Otro>",
    "optimizedHook": "<hook reescrito para este nicho específico>"
  },
  "steppsScore": {
    "dominantFactor":  "<factor STEPPS más fuerte>",
    "weakestFactor":   "<factor STEPPS más débil>",
    "shareMotivation": "<identidad|utilidad|sorpresa|validacion|ninguno>"
  },
  "honestVerdict": "<2 oraciones sin filtro. Si el hook murió: 'El video murió en el segundo X. [causa concreta]'>",
  "roadmap": [
    {
      "impacto":   "<ALTO|MEDIO|BAJO>",
      "problema":  "<segundo exacto + elemento específico>",
      "solucion":  "<instrucción ejecutable>",
      "resultado": "<métrica de comportamiento esperada>"
    }
  ]
}`;
};

// ============================================================
// DERIVACIÓN DEL HOOK TYPE — sin cambios
// JS decide el tipo de hook, nunca Gemini.
// ============================================================
export const deriveHookType = (preFacts) => {
  if (!preFacts || !Object.keys(preFacts).length) return 'debil';
  if (preFacts.logo_en_s0) return 'muerto';
  if (
    preFacts.hook_type_detectado &&
    preFacts.hook_confianza >= 0.7 &&
    preFacts.hook_type_detectado !== 'debil' &&
    preFacts.hook_type_detectado !== 'muerto'
  ) {
    return preFacts.hook_type_detectado;
  }
  if (preFacts.pregunta_al_espectador || preFacts.afirmacion_contradictoria) return 'explosivo';
  if (preFacts.imagen_alto_impacto && preFacts.producto_en_s0)               return 'bait_con_puente';
  if (preFacts.imagen_alto_impacto)                                           return 'bait_desconectado';
  if (preFacts.producto_en_accion_s0 || preFacts.transformacion_visible)      return 'bait_con_puente';
  if (preFacts.producto_en_s0)                                                return 'apertura_informativa';
  return 'debil';
};

// ============================================================
// MERGE DE FLAGS — sin cambios estructurales
// ============================================================
export const buildFlagsDeterministic = (flagsFromStrategy, preFacts, preHookType) => {
  if (!preFacts || !Object.keys(preFacts).length) return flagsFromStrategy;
  return {
    ...flagsFromStrategy,
    hook_type:           preHookType,
    ad_filter_triggered: !!preFacts.logo_en_s0,
    no_audio_from_s0:    (preFacts.audio_desde_s0 === false) || !!flagsFromStrategy.no_audio_from_s0,
    is_static_slideshow: (preFacts.es_slideshow_imagenes === true) || !!flagsFromStrategy.is_static_slideshow,
    pain_missing:        (preFacts.dolor_antes_s5 === false) || !!flagsFromStrategy.pain_missing,
    pain_late:           (Number(preFacts.segundo_dolor) > 5) || !!flagsFromStrategy.pain_late,
    no_rehook:           (!preFacts.tiene_rehook && (preFacts.duracion_estimada_segundos ?? 0) > 20) || !!flagsFromStrategy.no_rehook,
    short_video_advantage:     (preFacts.duracion_estimada_segundos ?? 999) < 15 || !!flagsFromStrategy.short_video_advantage,
    duration_kills_completion: ((preFacts.duracion_estimada_segundos ?? 0) > 60 && !preFacts.tiene_rehook) || !!flagsFromStrategy.duration_kills_completion,
    es_slideshow_imagenes:     preFacts.es_slideshow_imagenes ?? false,
    porcentaje_video_real:     preFacts.porcentaje_video_real ?? 100,
    tipo_edicion:              preFacts.tipo_edicion || 'desconocido',
    ritmo_visual:              preFacts.ritmo_visual || 'normal',
    cortes_por_minuto:         preFacts.cortes_por_minuto ?? 0,
    hook_descripcion_libre:    preFacts.hook_libre ?? null,
  };
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
  return text.split('\n').map((line, lineIdx) => (
    <p key={lineIdx} className={lineIdx > 0 ? 'mt-2' : ''}>
      {line.split(/(\*\*[^*]+\*\*)/).map((part, partIdx) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={partIdx} className="text-white font-black">{part.slice(2, -2)}</strong>
          : part
      )}
    </p>
  ));
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

const App = () => {
  const [step, setStep] = useState('upload');
  const [analysisMode, setAnalysisMode] = useState('video');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [selectedFollowerRange, setSelectedFollowerRange] = useState(null);
  const [selectedObjetivo, setSelectedObjetivo] = useState('ventas');
  const [selectedNicho, setSelectedNicho] = useState('producto_fisico');
  const [pendingVideoFile, setPendingVideoFile] = useState(null);
  const [pendingVideoUrl, setPendingVideoUrl] = useState(null);
  const [perception, setPerception] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);  //const { data: call3Data, error: call3Error } = await supabase.functions.invoke('gemini-proxy', {

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

      // Si la función tiró 500, mostrar el body real en el alert
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
  const userId = localStorage.getItem('redxax_user_id');   //TREND CONTEXT const parsedFinal = applyDeterministicScoring(parsed, flagsDeterministic);
  await supabase.from('prediction_tracking').insert({
    user_id: userId,
    predicted_score: result.potentialScore,
    niche: result.vision?.niche,
    platform: result.platformScores ? Object.keys(result.platformScores)[0] : 'unknown',
    cut_rate: result.cutRateData?.cutsPerMinute,
    hook_score: result.hookScore,
    predicted_retention_3s: result.retentionData?.at3s,
    created_at: new Date().toISOString(),
    actual_views: null,
    actual_viral: null
  });
};  //const scores = buildPenalties(flagsDeterministic)  //catch (err)  //const parsedFinal = applyDeterministicScoring(parsed, flagsDeterministic)

// ============================================================
// UTILITY FUNCTIONS — Parsing y extracción //{isTyping && <div className="text-[10px] text-zinc-500 animate-pulse font-black uppercase ml-2 italic tracking-widest">Calculando respuesta técnica...</div>}
// ============================================================

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



// ✅ VERSIÓN CORREGIDA — vision restaurado con fallback:
const applyDeterministicScoring = (parsed, flags, nicho) => {
  if (!parsed?.viralScore?.score || !parsed?.salesScore?.score) {
    throw new Error('ScoringBrain devolvió output inválido. Revisar prompt o response de Gemini.');
  }

  const viralScore  = parsed.viralScore.score;
  const salesScore  = parsed.salesScore.score;
  const potentialScore = Math.round(viralScore * 0.6 + salesScore * 0.4);

  return {
    vision:          parsed.vision || { niche: nicho, type: 'video', audience: '', promise: '' },
    viralScore:      parsed.viralScore,
    salesScore:      parsed.salesScore,
    potentialScore,
    scrollStopScore: parsed.scrollStopScore  ?? null,
    hookDNA:         parsed.hookDNA          ?? null,
    steppsScore:     parsed.steppsScore      ?? null,
    honestVerdict:   parsed.honestVerdict    ?? '',
    roadmap:         parsed.roadmap          ?? [],
  };
};

// ============================================================
// FASE 1: CALIBRACIÓN (Sube video y ejecuta CALL 0) //const { data: call3Data, error: call3Error } = await supabase.functions.invoke('gemini-proxy', {
// ============================================================
const runNeuralAnalysis = async (url, platform, followerRange, videoFile) => {
  if (videoFile.size > 45 * 1024 * 1024) {
    alert(`El video pesa ${(videoFile.size / 1024 / 1024).toFixed(1)}MB. El límite es 50MB.`);
    return;
  }

  const duration = await new Promise((resolve) => {
    const v = document.createElement('video');
    v.src = url;
    v.onloadedmetadata = () => resolve(v.duration); //setStatusText("Subiendo video...");
  });

  // Pasamos directo a preparar el video sin cobrar gemas todavía
  setStep('analyzing');
  setAnalysisMode('video');
  setStatusText("Preparando video...");
  setAnalysisProgress(5);

  const safeName = videoFile?.name
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '') || 'video.mp4';

  const storagePath = `temp-analysis/${Date.now()}-${safeName}`;
  const mimeType = videoFile.type || 'video/mp4';
  const fileToUpload = videoFile;

  console.log('[VIRAX] Subiendo para calibración:', fileToUpload.name, fileToUpload.size, 'bytes', mimeType);

  try {
    // ── UPLOAD ──
setStatusText("Subiendo video...");
setAnalysisProgress(10);

const { data: uploadData, error: uploadError } = await supabase.functions.invoke('gemini-proxy/upload-video', {
  body: { storagePath, videoMimeType: mimeType }
});
if (uploadError) throw new Error("Error subiendo video: " + uploadError.message);

const { fileUri, fileName } = uploadData;

// ── POLLING desde el frontend (sin timeout del Edge Function) ──
setStatusText("Google está procesando el video...");
setAnalysisProgress(14);

let videoReady = false;
for (let i = 0; i < 30; i++) {  // máximo 60 segundos (30 × 2s)
  await new Promise(r => setTimeout(r, 2000));

  const { data: statusData } = await supabase.functions.invoke('gemini-proxy/check-video-status', {
    body: { fileName }
  });

  console.log(`[VIRAX] Estado video: ${statusData?.state} (intento ${i + 1})`);

  if (statusData?.state === 'ACTIVE') {
    videoReady = true;
    break;
  }

  if (statusData?.state === 'FAILED') {
    const detail = statusData?.error?.message ?? 'Error desconocido';
    throw new Error(`Google no pudo procesar el video: ${detail}. Probá con un MP4 H.264.`);
  }

  // Actualizamos el progress mientras espera
  setAnalysisProgress(14 + Math.min(i, 4));
}

if (!videoReady) {
  throw new Error('El video tardó demasiado en procesarse. Probá con un video más corto.');
}

setAnalysisProgress(18);
setStatusText("Pre-clasificando video...");

// ── CALL 0 — Pre-clasificador (ahora usa fileUri directo) ──
const { data: call0Data, error: call0Error } = await supabase.functions.invoke('gemini-proxy', {
  body: {
    text: buildPreClassifierPrompt(`Duración: ${Math.round(duration)}s`),
    fileUri,      // ← en vez de storagePath
    fileName,     // ← para que el Edge Function sepa qué borrar al final
    videoMimeType: mimeType,
    duration: Math.round(duration),
    maxOutputTokens: 2048,
    expectsJson: true,
  }
});

    if (call0Error) {
      const status = call0Error.context?.status ?? 0;
      console.warn(`[CALL 0] HTTP ${status} — fallback`);
      throw new Error(`HTTP ${status}`);
    }

    preFacts = safeParseJSON(extractGeminiText(call0Data), 'pre-classifier') || {};
    preHookType = (() => {
      if (preFacts.logo_en_s0) return 'muerto';
      if (preFacts.imagen_alto_impacto && preFacts.producto_en_s0) return 'bait_con_puente';
      if (preFacts.imagen_alto_impacto) return 'bait_desconectado';
      if (preFacts.pregunta_al_espectador || preFacts.afirmacion_contradictoria) return 'explosivo';
      if (preFacts.producto_en_accion_s0 || preFacts.transformacion_visible) return 'bait_con_puente';
      if (preFacts.producto_en_s0) return 'apertura_informativa';
      return 'debil';
    })();

    console.log('[VIRAX] Pre-facts:', preFacts, '| Hook:', preHookType);

    // Guardamos los datos de la IA para cargarlos en los selectores de la pantalla de validación
    setPerception({
      industria: preFacts.industria || selectedNicho, 
      palanca_psicologica: preFacts.palanca_psicologica || 'Curiosidad / Retención'
    });

    // Guardamos toda la metadata necesaria para congelar el estado del video
    setVideoMeta({
      storagePath,
      mimeType,
      duration,
      preFacts,
      preHookType,
      platform,
      followerRange,
      palanca_detectada: preFacts.palanca_psicologica || 'Curiosidad / Retención',
    });

    setAnalysisProgress(100);
    setTimeout(() => setStep('validation'), 500);

  } catch (err) {
    console.error('Error análisis en fase de calibración:', err);
    const msg = err?.message || String(err);
    alert(`❌ Error al pre-clasificar: ${msg}`);
    
    // Si falla acá, limpiamos el storage porque el flujo se corta
    await supabase.storage.from('videos').remove([storagePath]);
    setStep('upload');
  }
};

const runDeepAnalysis = async () => {
  if (!videoMeta || !perception) {
    alert("Faltan datos de calibración.");
    return;
  }

  const { storagePath, mimeType, duration, preFacts, preHookType, platform, palanca_detectada } = videoMeta;

  // Solo hechos visuales/auditivos — sin nicho ni palanca
  const preFactsParaViewer = {
    hook_libre:          preFacts.hook_libre,
    flags_visuales:      preFacts.flags_visuales,
    flags_narrativos:    preFacts.flags_narrativos,
    metricas_tecnicas:   preFacts.metricas_tecnicas,
    hook_type_detectado: preFacts.hook_type_detectado,
    hook_confianza:      preFacts.hook_confianza,
  };

  const perceptionParaScoring = {
    ...perception,
    palanca_psicologica: palanca_detectada || perception.palanca_psicologica,
    palanca_objetivo:    perception.palanca_psicologica,
    palanca_detectada:   palanca_detectada || perception.palanca_psicologica,
  };

  const cost = 100;
  const approved = await deductGems(cost, `video:${Math.ceil(duration / 60)}`);
  if (!approved) return;

  setStep('analyzing');
  setStatusText("Iniciando auditoría profunda...");
  setAnalysisProgress(22);

  try {
    // ============================================================
    // CALL 1 — Viewer Brain
    // Solo hechos visuales — sin nicho ni palanca
    // ============================================================
    setAnalysisProgress(30);
    setStatusText("Analizando comportamiento humano...");

    const res = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildViewerBrainPrompt(
          JSON.stringify(preFactsParaViewer), // ← filtrado, sin industria
          platform                            // ← sin tercer argumento de perception
        ),
        storagePath,
        videoMimeType: mimeType,
        duration: Math.round(duration),
        maxOutputTokens: 8192,
      }
    });

    if (res.error) throw new Error(`CALL 1 falló: ${res.error.message}`);
    const viewerAnalysis = extractGeminiText(res.data);

    // ============================================================
    // CALL 1.5 — Research Brain
    // ============================================================
    setAnalysisProgress(40);
    setStatusText("Investigando casos de éxito...");

    let researchData = {};
    try {
      const { data: call1_5Data, error: call1_5Error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          text: buildResearchBrainPrompt(platform, perception.industria, selectedObjetivo),
          useSearch: true,
          expectsJson: true,
          maxOutputTokens: 2048,
          temperature: 0,
        }
      });

      console.log('[RESEARCH] groundingMetadata:',
        JSON.stringify(call1_5Data?.candidates?.[0]?.groundingMetadata, null, 2)
      );
      console.log('[RESEARCH] raw output:', extractGeminiText(call1_5Data));

      if (!call1_5Error) researchData = safeParseJSON(extractGeminiText(call1_5Data), 'research') || {};
    } catch (e) {
      console.warn('[CALL 1.5] Fallback research:', e.message);
    }

    // ============================================================
    // CALL 1.75 — Apply Research
    // ============================================================
    setAnalysisProgress(50);
    setStatusText("Calculando brecha competitiva...");

    let gapAnalysis = {};
    try {
      const { data: call1_75Data, error: call1_75Error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          text: buildApplyResearchBrainPrompt(preFacts, researchData, platform, perception.industria),
          expectsJson: true,
          maxOutputTokens: 2048,
        }
      });
      if (!call1_75Error) gapAnalysis = safeParseJSON(extractGeminiText(call1_75Data), 'gap-analysis') || {};
    } catch (e) {
      console.warn('[CALL 1.75] Fallback gap:', e.message);
    }

    // ============================================================
    // CALL 2 — Strategy Brain
    // Usa palanca_detectada — evalúa lo que el video realmente hace
    // ============================================================
    setAnalysisProgress(65);
    setStatusText("Evaluando ganchos y persuasión...");

    const { data: call2Data, error: call2Error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildStrategyBrainPrompt(viewerAnalysis, platform, selectedObjetivo, {
          ...perception,
          palanca_psicologica: palanca_detectada || perception.palanca_psicologica,
        }, preFacts),
        maxOutputTokens: 8192,
      }
    });
    if (call2Error) throw call2Error;

    const strategyRaw = extractGeminiText(call2Data);
    let flagsFromStrategy = {};
    let strategyAnalysis = strategyRaw;

    try {
      const strategyParsed = safeParseJSON(strategyRaw, 'strategy-flags');
      flagsFromStrategy = strategyParsed?.flags_binarios ?? {};
      strategyAnalysis = JSON.stringify(strategyParsed?.analisis_cualitativo ?? strategyParsed, null, 2);
    } catch (e) {
      console.warn('[Strategy] No se pudo parsear como JSON, usando texto plano:', e.message);
    }

    const flagsDeterministic = {
      ...flagsFromStrategy,
      hook_type: preHookType,
      ad_filter_triggered: !!preFacts.logo_en_s0,
      no_audio_from_s0: (preFacts.audio_desde_s0 === false) || flagsFromStrategy.no_audio_from_s0,
      is_static_slideshow: (preFacts.movimiento_real === false) || flagsFromStrategy.is_static_slideshow,
      pain_missing: (preFacts.dolor_antes_s5 === false) || flagsFromStrategy.pain_missing,
      pain_late: (Number(preFacts.segundo_dolor) > 5) || flagsFromStrategy.pain_late,
      no_rehook: (!preFacts.tiene_rehook && (preFacts.duracion_estimada ?? 0) > 20) || !!flagsFromStrategy.no_rehook,
      short_video_advantage: (preFacts.duracion_estimada ?? 999) < 15 || !!flagsFromStrategy.short_video_advantage,
      duration_kills_completion: ((preFacts.duracion_estimada ?? 0) > 60 && !preFacts.tiene_rehook) || !!flagsFromStrategy.duration_kills_completion,
      es_slideshow_imagenes: preFacts.es_slideshow_imagenes,
      porcentaje_video_real: preFacts.porcentaje_video_real ?? 100,
      tipo_edicion: preFacts.tipo_edicion || 'desconocido',
      ritmo_visual: preFacts.ritmo_visual || 'normal',
      cortes_por_minuto: preFacts.cortes_por_minuto ?? 0,
      cambio_visual_cada_ns: preFacts.cambio_visual_cada_ns ?? 3,
      compliance_score: gapAnalysis.compliance_score ?? 50,
      has_red_flags: (gapAnalysis.red_flags_en_tu_video?.length ?? 0) > 0,
      hook_descripcion_libre: preFacts.hook_libre ?? null,
    };

    // ============================================================
    // CALL 3 — Scoring Brain
    // Recibe perceptionParaScoring con AMBAS palancas:
    // .palanca_psicologica = objetivo del usuario
    // .palanca_detectada   = lo que el video realmente hace
    // El prompt puede medir el gap entre las dos
    // ============================================================
    setAnalysisProgress(80);
    setStatusText("Falta poco...");

    const nicheConfig = perception.motor_key ? NICHE_MOTORS[perception.motor_key] : null;

    const benchmarkData = Object.keys(researchData).length ? {
      ...researchData,
      resumen_brecha: gapAnalysis.resumen_brecha ?? null,
      red_flags_en_tu_video: gapAnalysis.red_flags_en_tu_video ?? []
    } : null;

    const { data: call3Data, error: call3Error } = await supabase.functions.invoke('gemini-proxy', {
  body: {
    text: buildScoringBrainPrompt(
      JSON.stringify(preFacts),   // videoRawData ← los hechos crudos del video
      strategyAnalysis,           // strategyAnalysis ← en su lugar correcto
      viewerAnalysis,             // viewerAnalysis ← en su lugar correcto
      platform,
      selectedObjetivo,
      perceptionParaScoring,
      flagsDeterministic,
      nicheConfig,
      benchmarkData
    ),
        storagePath,
        videoMimeType: mimeType,
        duration: Math.round(duration),
        expectsJson: true,
        maxOutputTokens: 8192,
      }
    });

    if (call3Error) throw call3Error;

    const parsed = safeParseJSON(extractGeminiText(call3Data), 'scoring');

    setAnalysisProgress(90);
    setStatusText("Estructurando reporte completo...");

    const parsedFinal = applyDeterministicScoring(parsed, flagsDeterministic, perception.industria);

    const viralScore = parsedFinal.viralScore?.score ?? 0;
    if (viralScore >= 65) {
      parsedFinal.salesScore = {
        ...parsedFinal.salesScore,
        score: Math.max(parsedFinal.salesScore?.score ?? 0, 35)
      };
      parsedFinal.potentialScore = Math.max(parsedFinal.potentialScore ?? 0, 38);
    }

    const finalResult = {
      ...parsedFinal,
      objetivo: selectedObjetivo,
      _flags: flagsDeterministic,
      _strategy_text: strategyAnalysis,
      _viewer_text: viewerAnalysis,
      _research_data: researchData,
      _gap_analysis: gapAnalysis,
    };

    setAiResult(finalResult);
    setCompletedSteps([]);
    setChatMessages([{
      role: 'bot',
      text: `Análisis completado. Potencial de venta: ${finalResult.salesScore?.score ?? '—'}% | Potencial viral: ${finalResult.viralScore?.score ?? '—'}%. ¿Qué sección repasamos primero?`
    }]);

    setAnalysisProgress(100);
    await saveAnalysisToHistory(finalResult, 'video');
    await trackPrediction(finalResult);

    setTimeout(() => setStep('results'), 500);

  } catch (err) {
    console.error('Error en análisis profundo:', err);
    alert(`❌ Error al procesar reporte profundo: ${err.message || err}`);
    setStep('upload');
  } finally {
    await supabase.storage.from('videos').remove([storagePath]);
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
    await trackPrediction(finalResult);
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
    const musicContext = aiResult?.musicSuggestions?.length
      ? `\n\n⚠️ MÚSICA INVESTIGADA:\n${aiResult.musicSuggestions.map((m, i) =>
          `${i + 1}. "${m.title}" de ${m.artist} → Match: ${m.why} → Plataformas: ${m.available}`
        ).join('\n')}`
      : '';

    // ── Contexto reducido — solo lo que el chat necesita ──
    const aiContext = {
      vision: aiResult?.vision,
      salesScore: aiResult?.salesScore,
      viralScore: aiResult?.viralScore,
      hookDNA: aiResult?.hookDNA,
      honestVerdict: aiResult?.honestVerdict,
      roadmap: aiResult?.roadmap,
      dropOffPoints: aiResult?.dropOffPoints,
      styleProfile: aiResult?.styleProfile,
      musicSuggestions: aiResult?.musicSuggestions,
      phaseScores: aiResult?.phaseScores,
    };

    const systemPrompt = `Sos el Consultor Senior de VIRAX.
Tu objetivo es ayudar al usuario a entender su análisis y mejorar su contenido.

ANÁLISIS DE ATMÓSFERA:
- Nicho: ${aiResult?.vision?.niche || 'General'}
- Estilo: ${aiResult?.styleProfile?.detectedRhythm || 'Normal'}
- Tono: ${aiResult?.styleProfile?.detectedTone || 'Neutro'}
${musicContext}

REGLAS:
1. Música: usá SOLO las investigadas arriba si las hay.
2. Honestidad brutal: si algo no pega, decilo.
3. Respuestas cortas y directas, máximo 3 párrafos.
4. Para edición usá los datos de phaseScores del JSON.

ANÁLISIS (JSON): ${JSON.stringify(aiContext)}`;

    const historyText = newMessages
      .slice(0, -1)
      .map(m => `${m.role === 'user' ? 'USUARIO' : 'ASISTENTE'}: ${m.text}`)
      .join('\n\n');

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: `${systemPrompt}\n\n═══ HISTORIAL ═══\n${historyText || '(inicio)'}\n\n═══ MENSAJE ACTUAL ═══\n${userInput}`,
        maxOutputTokens: 1024,
        temperature: 0.7,
      }
    });

    // ── DEBUG TEMPORAL ──
    if (error) {
      const errorBody = await error.context?.response?.text?.();
      console.error('Error completo:', error);
      console.error('Body del error:', errorBody);
      throw new Error(`Supabase error: ${errorBody || JSON.stringify(error)}`);
    }

    if (!data) throw new Error('Respuesta vacía del proxy');

    // ── Extraer texto de la respuesta Gemini ──
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
      text: `Error: ${err.message || 'Se cortó la conexión. Intentá de nuevo.'}`
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
          disabled={!selectedPlatform || !selectedFollowerRange || !selectedNicho}
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

{/* ── 3. PANTALLA DE VALIDACIÓN ESTRATÉGICA CORREGIDA ── */}
{step === 'validation' && (() => {
  // 1. Listas estándar de respaldo
  const STANDARD_NICHOS = [
    "Producto físico",
    "Curso / Info",
    "Servicio",
    "Inmobiliaria",
    "App / Software",
    "Restaurante / Comida",
    "Otro / General"
  ];

  const STANDARD_PALANCAS = [
    "Dolor / Ahorro de tiempo",
    "Curiosidad / Retención",
    "Estatus / Identidad",
    "FOMO / Urgencia"
  ];

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="bg-white/[0.02] border border-white/10 rounded-[4rem] p-8 md:p-12 shadow-2xl">
        
        {/* Header del bloque */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            <span>🧠</span> Motor VIRAX calibrado
          </div>
          <h3 className="text-3xl font-black italic uppercase tracking-tighter">
            Verificación de Estrategia
          </h3>
          <p className="text-slate-400 mt-3 font-medium">
            Confirmá o editá el ángulo que interpretó la IA antes de lanzar la auditoría profunda.
          </p>
        </div>

        {/* Inputs Premium Editables */}
        <div className="space-y-6 mb-10">
          
          {/* Campo: Nicho / Industria */}
          <div className="group flex flex-col space-y-3 p-5 rounded-[2rem] border border-white/[0.07] bg-white/[0.02] hover:border-purple-500/20 transition-all duration-300">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-purple-400 transition-colors">
                Nicho / Industria (Hacé clic para editar)
              </label>
              <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                Editable 📝
              </span>
            </div>
            
            {/* Se cambió a textarea para permitir saltos de línea sin cortar palabras */}
            <textarea 
              rows={2}
              value={perception?.industria || ''}
              onChange={(e) => setPerception({...perception, industria: e.target.value})}
              placeholder="Ej. Estética masculina, E-commerce de zapatillas..."
              className="bg-transparent text-lg text-white font-bold outline-none border-b border-white/10 focus:border-purple-500 pb-1 transition-colors w-full resize-none break-words whitespace-pre-wrap leading-relaxed"
            />

            {/* Sugerencias en Chips */}
            <div className="pt-1">
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-2">Alternativas rápidas:</p>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_NICHOS.map((nicho) => (
                  <button
                    key={nicho}
                    type="button"
                    onClick={() => setPerception({...perception, industria: nicho})}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all break-words text-left ${
                      perception?.industria === nicho 
                        ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300' 
                        : 'bg-white/[0.02] border border-white/[0.05] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                    }`}
                  >
                    {nicho}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Palanca DETECTADA — read-only */}
          <div className="group flex flex-col space-y-2 p-5 rounded-[2rem] border border-white/[0.07] bg-white/[0.02]">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Palanca detectada en el video
              </label>
              <span className="text-[9px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                Fija · base del score 🔒
              </span>
            </div>
            <p className="text-lg text-white font-bold italic">
              {videoMeta?.palanca_detectada || perception?.palanca_psicologica || '—'}
            </p>
            <p className="text-[9px] text-slate-600 italic">
              La IA detectó esto directamente en el video. El score siempre se calcula sobre esta palanca.
            </p>
          </div>

          {/* Palanca OBJETIVO — editable, solo para gap analysis */}
          <div className="group flex flex-col space-y-3 p-5 rounded-[2rem] border border-white/[0.07] bg-white/[0.02] hover:border-purple-500/20 transition-all duration-300">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-purple-400 transition-colors">
                  Tu objetivo de conversión (opcional)
                </label>
                <p className="text-[9px] italic text-slate-600">
                  Solo afecta el análisis de brecha — no cambia el score base
                </p>
              </div>
              <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                Editable 📝
              </span>
            </div>
            <textarea
              rows={2}
              value={perception?.palanca_psicologica || ''}
              onChange={(e) => setPerception({...perception, palanca_psicologica: e.target.value})}
              placeholder="Ej. Quiero que sienta urgencia de comprar..."
              className="bg-transparent text-lg text-white font-bold outline-none border-b border-white/10 focus:border-purple-500 pb-1 transition-colors w-full resize-none break-words whitespace-pre-wrap leading-relaxed"
            />
            <div className="pt-1">
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-2">Objetivos rápidos:</p>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_PALANCAS.map((palanca) => (
                  <button
                    key={palanca}
                    type="button"
                    onClick={() => setPerception({...perception, palanca_psicologica: palanca})}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                      perception?.palanca_psicologica === palanca
                        ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                        : 'bg-white/[0.02] border border-white/[0.05] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                    }`}
                  >
                    {palanca}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Botones de Acción de la parte inferior */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => setStep('upload')}
            className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
          >
            ← Volver
          </button>
          
          <button
            onClick={runDeepAnalysis}
            className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-full text-sm font-black italic uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Confirmar y Analizar →
          </button>
        </div>

      </div>
    </div>
  );
})()}

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

        {/* ── FACTORES EXTERNOS ── */}
        <ShinyCard tilt={tilt} className="bg-yellow-500/[0.03] border border-yellow-500/20 rounded-[2.5rem] p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-yellow-400 text-base">⚠️</span>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-yellow-400">
              Este score evalúa el video, no tu cuenta
            </p>
          </div>
          <p className="text-xs font-bold italic text-slate-400 mb-5 leading-relaxed">
            El contenido es solo una parte de la viralidad (Próximas actuzalizaciones, se integra Investigación de tu contenido para una mayor precisión.). Estos 7 factores externos
            pueden reducir el potencial real hasta un <span className="text-yellow-300 font-black">40%</span> si no los tenés en cuenta:
          </p>
          <div className="space-y-3">
            {[
              {
                icon: '',
                titulo: 'Audio sin tendencia',
                desc: '¿Usaste un sonido que está de moda ahora? Si no, el algoritmo te muestra a menos gente aunque el video sea muy bueno.'
              },
              {
                icon: '',
                titulo: 'Engagement en la primera hora',
                desc: 'Likes, comentarios y guardados en los primeros 60 minutos le dicen al algoritmo que el video vale la pena. Sin eso, se frena solo.'
              },
              {
                icon: '',
                titulo: 'Falta de consistencia',
                desc: 'Las cuentas que postean regularmente tienen más alcance porque el algoritmo ya las conoce y confía en ellas.'
              },
              {
                icon: '',
                titulo: 'Fatiga de formato',
                desc: 'Si todos tus videos se ven igual, tu audiencia empieza a ignorarlos. El algoritmo lo nota y deja de mostrarte. Cambiar el estilo de vez en cuando resetea la atención.'
              },
              {
                icon: '',
                titulo: 'Shadowban silencioso',
                desc: 'Tu cuenta puede estar penalizada sin que te avisaron. Señales: tus videos dejaron de llegar a gente nueva de golpe. Causas comunes: hashtags prohibidos, música con copyright, o postear demasiado seguido.'
              },
              {
                icon: '',
                titulo: 'Hashtags mal usados',
                desc: 'Los hashtags incorrectos o prohibidos no solo no ayudan, te penalizan. Usar siempre los mismos activa filtros de spam. Menos hashtags, más relevantes, es mejor.'
              },
              {
                icon: '',
                titulo: 'Audiencia equivocada',
                desc: 'Si tu cuenta mezcla temas muy distintos, el algoritmo no sabe a quién mostrarte y te distribuye a gente que no le interesa tu contenido. Eso baja la retención y frena todo.'
              },
            ].map((factor, i) => (
              <div key={i} className="flex items-start gap-3 bg-black/30 border border-white/5 rounded-[1.5rem] p-4">
                <span className="text-lg mt-0.5 shrink-0">{factor.icon}</span>
                <div>
                  <p className="text-xs font-black italic text-white mb-0.5">{factor.titulo}</p>
                  <p className="text-[11px] font-bold italic text-slate-500 leading-relaxed">{factor.desc}</p>
                </div>
              </div>
            ))}
          </div>
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
  </ShinyCard>  //potentialScore  //AX
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
  <div className="space-y-4">
    {(aiResult.roadmap || []).map((step, i) => {
      const isCompleted = completedSteps.includes(i);
      return (
        <div key={i} onClick={() => toggleStep(i)}
          className={`p-6 rounded-[2.5rem] transition-all cursor-pointer border ${isCompleted ? 'bg-green-500/10 border-green-500/30 opacity-50' : 'bg-black/40 border-white/5 hover:border-purple-500/30'}`}>
          
          {/* Header con impacto */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`shrink-0 transition-colors ${isCompleted ? 'text-green-400' : 'text-slate-600'}`}>
              {isCompleted ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </div>
            <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${
              step.impacto === 'ALTO' ? 'bg-red-500/20 text-red-400' :
              step.impacto === 'MEDIO' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {step.impacto}
            </span>
          </div>

          {/* Contenido */}
          <div className={`space-y-2 ${isCompleted ? 'opacity-50' : ''}`}>
            <p className="text-sm font-bold text-slate-300">
              <strong>Problema:</strong> {step.problema}
            </p>
            <p className="text-sm text-slate-400">
              <strong>Solución:</strong> {step.solucion}
            </p>
            <p className="text-sm text-slate-400">
              <strong>Resultado:</strong> {step.resultado}
            </p>
          </div>
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
