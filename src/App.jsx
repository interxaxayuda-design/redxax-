import {
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
import { useEffect, useRef, useState } from 'react'; //const buildPreClassifierPrompt = () => `
import logo from './assets/logo.png';

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
      const ch = s[i];
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

  // Intento 1: limpieza con lookahead
  try { return JSON.parse(aggressiveClean(rawText)); }
  catch (err1) { console.warn(`[${context}] Intento 1 falló:`, err1.message); }

  // Intento 2: nuclear — quitar control characters
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

const NICHE_CRITERIA = {
  producto_fisico: [
    "¿Ataca un problema cotidiano real?",
    "¿El producto aparece como solución obvia sin explicación?",
    "¿Qué es y para qué sirve en <5 segundos?",
    "¿Se ve funcionando de verdad, no solo de costado?",
    "¿Genera sensación de 'necesito esto'?",
    "¿Sin CTA explícito, el producto se vende solo visualmente?",
  ],
  inmobiliaria: [
    "¿Luz natural y espacios amplios visibles?",
    "¿Barrio/zona mencionado como beneficio concreto?",
    "¿Genera aspiración de vivir ahí?",
    "¿Precio o contacto aparece claramente?",
    "¿Hay persona real que genere confianza?",
    "¿Transmite seriedad profesional?",
  ],
  curso: [
    "¿Se muestra resultado/transformación del alumno en el primer frame?",
    "¿Problema que resuelve claro en <5 segundos?",
    "¿Creador transmite autoridad y credibilidad con pruebas visuales?",
    "¿Contenido concreto, no solo promesas vagas?",
    "¿Hay urgencia o razón para comprar ahora en los primeros 15s?",
    "¿Precio/acceso aparece en momento correcto?",
    "¿Hay música o ritmo que sostenga energía en los primeros 10s?",
    "¿Se plantea pregunta o reto al espectador en los primeros 5s?",
    "¿Se diferencia de otros cursos similares en algo concreto?",
  ],
  servicio: [
    "¿Se entiende exactamente qué problema resuelve?",
    "¿Muestra antes/después o resultado concreto?",
    "¿Genera confianza quien lo presenta?",
    "¿Hay movimiento real o todo son imágenes estáticas sin transición?",
    "¿Contacto/siguiente paso fácil y obvio?",
    "¿Parece accesible o genera miedo al precio?",
    "¿Se diferencia de competencia en algo concreto?",
  ],
  app_software: [
    "¿App funcionando en pantalla real?",
    "¿Problema que resuelve claro sin texto técnico?",
    "¿Interfaz parece fácil de usar?",
    "¿Demo o caso de uso real?",
    "¿Ataca el dolor en algo en específico?",
    "¿Botón de descarga/prueba gratis claro?",
    "¿Genera curiosidad de probarlo?",
  ],
  otro: [
    "¿Audio/texto ataca dolor o deseo concreto?",
    "¿Producto/servicio aparece como solución?",
    "¿Se entiende qué es sin pensar?",
    "¿Ritmo mantiene atención hasta el final?",
    "¿Queda claro qué debe hacer el espectador?",
    "¿Genera emoción fuerte: deseo, curiosidad o urgencia?",
    "¿Se entiende en <5 segundos incluso sin audio?",
    "¿El primer frame genera curiosidad o deseo?",
    "¿Se muestran pruebas o resultados verificables?",
    "¿El video invita a comentar o compartir?",
    "¿Se comunica urgencia o escasez?",
    "¿Hay micro-recompensas cada 2–3 segundos?",
    "¿Se diferencia claramente de la competencia?",
  ],
};

const buildPreClassifierPrompt = () => `
Watch this video carefully and answer ONLY with this exact JSON. No text before. No text after. No explanation.

{
  "logo_en_s0": <true if the first frame shows a brand logo or brand name prominently | false>,
  "producto_en_s0": <true if the product or service being sold is the main visual element in the first frame | false>,
  "audio_desde_s0": <true if there is music or voice with energy starting at or before second 1 | false>,
  "movimiento_real": <true if there is real movement: person talking, hands in action, product being used, camera moving — NOT automatic slideshow transitions | false>,
  "imagen_alto_impacto": <true if the first second shows an explosion, fall, conflict, extreme result, or other high-impact visual event | false>,
  "pregunta_al_espectador": <true if the video opens with a direct question to the viewer in text or audio | false>,
  "afirmacion_contradictoria": <true if the video opens with a statement that contradicts common beliefs | false>,
  "dolor_antes_s5": <true ONLY if you can transcribe a specific word, phrase or visual that names a viewer problem before second 5 | false>,
  "dolor_transcripcion": <exact words spoken or shown on screen that express the pain, or "" if none>,
  "dolor_tipo": <"activo" if the problem is something the viewer already experiences now | "latente" if the video reveals a problem they didn't know they had | "ninguno" if no pain is named>,
  "segundo_dolor": <exact second when the pain words or image first appear, or 0 if none>
}
`;

const deriveFlags = (obs) => {
  const hookType = (() => {
    if (obs.logo_en_s0) return 'muerto';
    if (obs.imagen_alto_impacto && obs.producto_en_s0) return 'bait_con_puente';
    if (obs.imagen_alto_impacto && !obs.producto_en_s0) return 'bait_desconectado';
    if (obs.pregunta_al_espectador || obs.afirmacion_contradictoria) return 'explosivo';
    if (obs.producto_en_s0 && !obs.pregunta_al_espectador) return 'apertura_informativa';
    if (obs.movimiento_real && obs.audio_desde_s0) return 'debil';
    return 'muerto';
  })();

  return {
    hook_type: hookType,
    ad_filter_triggered: !!obs.logo_en_s0,
    no_audio_from_s0: !obs.audio_desde_s0,
    is_static_slideshow: !obs.movimiento_real,
    pain_missing: !obs.dolor_antes_s5,
    pain_late: Number(obs.segundo_dolor) > 5 && Number(obs.segundo_dolor) > 0,   //<p className={`${analysisMode === 'video' ? 'text-purple-400' : 'text-indigo-400'} font-bold animate-pulse text-lg tracking-tight uppercase`}>{statusText}</p>
    movimiento_real: !!obs.movimiento_real,
    // flags subjetivos los toma Gemini Strategy Brain
  };
}; //const strategyAnalysis = stripFlags(strategyRaw);





const buildViewerBrainPrompt = (platform, nicho) => {
  const pName = { tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts' }[platform];
  const criterios = (NICHE_CRITERIA[nicho] || NICHE_CRITERIA['otro']).map((c, i) => `${i + 1}. ${c}`).join('\n');

  return `Sos un analista forense de videos para ${pName}. Tu trabajo es observar y reportar hechos sensoriales exactos. Sin adjetivos evaluativos. Sin opiniones. Solo lo que se ve y se escucha.

CONTEXTO INAMOVIBLE:
- El espectador scrollea en 2-4s si no pasa nada. No tiene paciencia.
- Sin audio desde s0 = no activa atención.
- Imágenes quietas = invisibles para el cerebro en scroll.
- El hook más efectivo genera "¿qué es eso?" — no muestra el producto directamente.
- La gente compra para escapar del dolor. Si el video no nombra el dolor antes de mostrar el producto, no conecta.
- La gente comparte lo que dice algo sobre ellos: identidad, utilidad social, sorpresa o validación.

HOOK — TIPOS (elegir uno al reportar):
- explosivo: el espectador no puede saber qué sigue en s0
- bait_con_puente: impacto visual + conexión temática con el producto
- bait_desconectado: impacto visual sin relación con el producto
- debil: interesante pero ya intuye de qué trata
- apertura_informativa: muestra el producto/resultado desde s0 sin tensión
- muerto: logo, marca, locutor, fondo blanco con producto centrado

CAPAS DE COMPRA (en orden de prioridad):
1. DOLOR: ¿el problema del espectador se nombra antes de s5?
2. CONFIANZA: ¿el producto se ve funcionando de verdad?
3. URGENCIA: ¿hay razón para comprar hoy y no mañana?
4. FRICCIÓN: ¿el siguiente paso está claro?

Si un elemento aparece después del segundo en que el espectador scrolleó, marcarlo con [TARDE - sX]. No contarlo como fortaleza.

---

INVENTARIO PREVIO (responder antes de analizar):
- ¿Hay secuencia antes/después? → s inicio: / s resultado:
- ¿Resultado exitoso visible? → describir exactamente
- ¿Timeline o duración mencionada? → transcribir literal
- ¿Persona real mostrando resultado? →
- ¿Testimonial? → transcribir literal
- ¿Proceso paso a paso? →
- ¿Texto en pantalla? → transcribir cada uno con su segundo

A. PRIMER FRAME
- ¿Qué ve exactamente el espectador en s0?
- ¿Fondo limpio o distrae?
- ¿Suciedad/deterioro visible? → [descripción][segundo]
- ¿Hay persona? ¿Expresión? ¿Mira a cámara?

B. CAPAS DE COMPRA
DOLOR: ¿aparece antes de s5? SÍ/TARDE/NO | ¿activo o latente? | segundo exacto | transcripción literal
CONFIANZA: prueba social visible | producto en acción o de costado | calidad visual suma o resta | algo destruye confianza
URGENCIA: ¿real (stock/oferta)? SÍ/NO → literal | ¿emocional? SÍ/NO → literal | segundo en que aparece
FRICCIÓN: ¿CTA claro? | segundo del CTA | ¿proceso simple o complicado?

C. RITMO
- Cortes cada 10s: número exacto
- ¿Plano de +4s sin nada nuevo? SÍ/NO + segundo
- Música: ¿plana o tiene cambios de energía?
- ¿En qué segundo el espectador sentiría que "ya vio suficiente"?

D. PRODUCTO
- ¿Aparece en primeros 3s? SÍ/NO + segundo exacto
- ¿En acción o de costado/tarde?
- ¿Resuelve un problema concreto o solo existe?

E. VIABILIDAD DEL PRODUCTO (FUERTE/ACEPTABLE/DÉBIL + 1 línea cada uno):
1. Frecuencia de uso
2. Claridad instantánea (<5s)
3. Problema cotidiano
4. Amplitud (de 100 personas, ¿cuántas lo necesitan?)
5. Fricción de compra (impulso vs investigación)
6. Factor wow visual
7. Credibilidad del resultado
→ Si 3+ son DÉBIL: PRODUCTO DE VENTA DIFÍCIL EN REDES: [razón]

F. CRITERIOS DE NICHO (SÍ/PARCIALMENTE/NO + 1 línea):
${criterios}

G. TRANSCRIPCIÓN LITERAL
→ [s0] "texto exacto"
Sin parafrasear. Si no hay texto: "SIN TEXTO EN PANTALLA".

H. AUDIO
- ¿Música desde s0? SÍ/NO
- ¿Energía o ambiente?
- ¿Cambia de ritmo?
- Volumen vs voz: compite / música debajo / sin voz
- ¿Entendible en silencio? SÍ/NO

I. MOTORES DE RETENCIÓN (PRESENTE/PARCIAL/AUSENTE + 1 oración + segundo):
- Dolor nombrado
- Loop de curiosidad (segundo apertura + cierre)
- Micro-recompensas (algo nuevo cada 2-3s o no)
- Consumibilidad (entendible sin audio)
- Parece contenido o parece aviso
- Elemento compartible

J. HOOK DETECTADO
- Tipo: (explosivo/bait_con_puente/bait_desconectado/debil/apertura_informativa/muerto)
- Si es bait: ¿puente emocional con el producto? SÍ/NO → describir
- Tono: (informal/aspiracional/educativo/humoristico/directo)
- Estilo: (habla a camara/muestra sin hablar/usa texto)
- Riesgo de desconfianza: ninguno/leve/alto → 1 oración

VEREDICTO FINAL DE FASE 1:
- ¿El espectador siguió después de s3? SÍ/NO
- ¿En qué segundo habría scrolleado?
- ¿Qué lo hizo scrollear o quedarse?
`;
};


const buildStrategyBrainPrompt = (viewerAnalysis, platform, objetivo, nicho, preFacts = {}, preHookType = null) => {
  const pName = { tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts' }[platform];

  const truthBlock = preHookType ? `
HECHOS PRE-CLASIFICADOS — INAMOVIBLES. NO MODIFICAR.
hook_type: ${preHookType}
audio_desde_s0: ${preFacts.audio_desde_s0 ?? 'no_determinado'}
dolor_antes_s5: ${preFacts.dolor_antes_s5 ?? 'no_determinado'}
dolor_transcripcion: "${preFacts.dolor_transcripcion ?? ''}"
dolor_tipo: ${preFacts.dolor_tipo ?? 'no_determinado'}
segundo_dolor: ${preFacts.segundo_dolor ?? '0'}
movimiento_real: ${preFacts.movimiento_real ?? 'no_determinado'}
logo_en_s0: ${preFacts.logo_en_s0 ?? 'no_determinado'}
producto_en_s0: ${preFacts.producto_en_s0 ?? 'no_determinado'}
dolor_antes_s5: ${preFacts.dolor_antes_s5 ?? 'no_determinado'}
segundo_dolor: ${preFacts.segundo_dolor ?? '0'}

TECHOS DERIVADOS (aplicar sin excepción):
muerto → viralScore ≤35 | debil → viralScore ≤60 | apertura_informativa → viralScore ≤40
explosivo → viralScore hasta 90 | bait_con_puente → hasta 85 | bait_desconectado → viralScore ≤55, salesScore ≤45
audio_desde_s0=false → viralScore -15 adicional sobre cualquier techo
` : '';

  return `Estratega de ventas y viralidad. Plataforma: ${pName} | Objetivo: ${objetivo} | Nicho: ${nicho}

${truthBlock}
REPORTE FORENSE:
${viewerAnalysis}

STEP 1 — GATE DE FORMATO (responder primero)
1. ¿Activa filtro de anuncio en s0? → si SÍ: dato inamovible, continuar con ese contexto
2. ¿Audio con energía desde s0? → si NO: scrolleó antes de s2
3. ¿Video real con movimiento o imágenes quietas? → imágenes: scrolleó antes de s3
4. ¿El primer segundo genera "¿qué es eso?"? → si NO: scrolleó entre s1 y s4
5. ¿Algo nuevo cada ≤3s? → si NO: scrolleó en el primer plano largo

Resultado: 5/5 = FORMATO COMPETITIVO | 3-4 = FORMATO DÉBIL | 0-2 = FORMATO MUERTO

STEP 2 — CAPAS DE COMPRA
DOLOR: ¿nombrado antes de s5? ¿activo o latente? ¿espectador se identifica antes de ver qué se vende?
→ si falta o es tarde: pain_missing = true (primera prioridad)

CONFIANZA: ¿producto en acción real o solo afirmado? ¿prueba social verificable? ¿calidad visual suma o resta?
→ si baja: trust_gap = true (segunda prioridad)

URGENCIA: ¿razón concreta para comprar hoy? ¿el espectador llega a verla?
→ si falta: no_urgency = true (tercera prioridad)

FRICCIÓN: ¿CTA claro antes del scroll masivo? ¿proceso parece simple?
→ si no: high_friction = true (cuarta prioridad)

STEP 3 — SUPERVIVENCIA SEGUNDO A SEGUNDO
Reglas de comportamiento real:
- logo/anuncio s0 → scroll s0-s1
- sin audio → scroll s1-s2
- imágenes quietas → scroll s2-s3
- video+audio sin hook → scroll s3-s5
- hook débil → scroll s5-s8
- hook explosivo → puede llegar al final si ritmo sostiene
- plano +4s sin nada → scroll en ese segundo exacto
- bait desconectado → se queda hasta que aparece el producto, luego scroll

Reportar:
→ s0-s3: ¿qué ve? ¿audio? ¿hook? ¿se queda? SÍ/NO + por qué
→ s3-s7: ¿algo nuevo? ¿dolor? ¿se queda? SÍ/NO
→ s7-s15: ¿ritmo sostenido? ¿confianza? ¿se queda? SÍ/NO
→ s15-fin: ¿llega? SÍ/NO + % que llegaría

Métricas duras:
- Segundo exacto de scroll masivo
- % que llega al final
- Cortes en primeros 3s
- Plano más largo sin nada nuevo
- Audio desde s0: SÍ/NO | Dolor antes de s5: SÍ/NO | Confianza antes del scroll: SÍ/NO | Urgencia visible: SÍ/NO

STEP 4 — TRAMPAS
TRAMPA DE VALOR: contenido valioso que el espectador nunca ve → value_trap = true
VALOR DETRÁS DEL SCROLL: mejor momento después del segundo de scroll masivo → value_behind_scroll_wall = true
TRAMPA DEL BAIT: hook retiene pero producto no tiene relación → bait_disconnect = true

STEP 5 — COMPARTIBILIDAD
¿Por qué alguien compartiría? → identidad / utilidad social / sorpresa / validación / ninguno
¿Hay elemento "no sabía eso"? → describir o indicar ausencia

STEP 6 — VEREDICTO FINAL
- Fortalezas reales (solo las visibles antes del scroll)
- Debilidades sin suavizar
- ¿Compraría o scrollearía?
- 3 mejoras concretas (si value_trap: primera mejora = hook/formato siempre; si bait_disconnect: segunda = puente emocional)

ESCALA:
viralScore: 80-90 paró+quedó+compartió | 65-79 paró+llegó al final | 50-64 dudó+mitad | 35-49 scrolleó s4-s8 | 20-34 scrolleó antes de s4 | <20 ni lo registró
salesScore: 75-90 dolor+confianza+urgencia | 55-74 parcial | 35-54 no conectó | <35 sin dolor ni confianza

---FLAGS--- (OBLIGATORIO. Todos los campos. Sin omitir.)
{
  "ad_filter_triggered": <true|false>,
  "no_audio_from_s0": <true|false>,
  "is_static_slideshow": <true|false>,
  "no_music_and_static": <true|false>,
  "slow_cuts_no_music": <true|false>,
  "hook_type": "<explosivo|bait_con_puente|debil|bait_desconectado|apertura_informativa|muerto>",
  "hook_creates_question": <true|false>,
  "hook_is_direct_info": <true|false>,
  "bait_disconnect": <true|false>,
  "dead_hook": <true|false>,
  "pain_missing": <true|false>,
  "pain_late": <true|false>,
  "trust_gap": <true|false>,
  "no_urgency": <true|false>,
  "high_friction": <true|false>,
  "product_damage": <true|false>,
  "visual_repulsion": <true|false>,
  "visual_repulsion_severity": "<ninguna|leve|moderada|fuerte>",
  "first_frame_repulsion": <true|false>,
  "product_shown_late": <true|false>,
  "product_shown_sideways": <true|false>,
  "product_presentation_interrupted": <true|false>,
  "dead_moment": <true|false>,
  "dead_moment_second": <número o 0>,
  "static_visuals": <true|false>,
  "low_visual_dynamism": <true|false>,
  "slow_pacing": <true|false>,
  "overlong_shots": <true|false>,
  "weak_editing_flow": <true|false>,
  "audio_issue": <true|false>,
  "boring_full_video": <true|false>,
  "flat_energy": <true|false>,
  "no_retention_engines": <true|false>,
  "no_share_trigger": <true|false>,
  "product_unclear": <true|false>,
  "product_difficult_to_sell": <true|false>,
  "format_incompatible": <true|false>,
  "format_weak": <true|false>,
  "value_behind_scroll_wall": <true|false>,
  "value_trap": <true|false>,
  "recompensa_tardia": <true|false>,
  "buried_result": <true|false>
}
---END---
`;
};


// ============================================================
// HELPERS
// ============================================================
export const extractFlags = (strategyText) => {
  try {
    const match = strategyText.match(/---FLAGS---\s*([\s\S]*?)\s*---END---/);
    if (!match) { console.warn('[extractFlags] Bloque FLAGS no encontrado'); return {}; }
    return JSON.parse(match[1]);
  } catch (err) { console.warn('[extractFlags] Error parseando FLAGS:', err.message); return {}; }
};

export const stripFlags = (strategyText) =>
  strategyText.replace(/---FLAGS---[\s\S]*?---END---/, '').trim();

export const buildPenalties = (flags) => {
  if (!flags || !Object.keys(flags).length)
    return 'Sin flags criticos. Evaluar con libertad. Si el espectador se habría quedado a mirar, los scores altos son correctos.';

  const rules = [];

  // ══════════════════════════════════════════════════════
  // BLOQUE 0 — FILTRO DE ANUNCIO (lo más temprano que puede ocurrir)
  // ══════════════════════════════════════════════════════
  if (flags.ad_filter_triggered)
    rules.push('⛔ FILTRO DE ANUNCIO ACTIVADO: el primer segundo se parece a publicidad corporativa. El cerebro lo ignoró antes de procesarlo. viralScore TECHO = 30 | scrollStopScore ≤20 | salesScore ≤40. El problema no es el producto sino que el video delata que es un anuncio antes de que nadie lo vea.');

  // ══════════════════════════════════════════════════════
  // BLOQUE 1 — AUDIO
  // ══════════════════════════════════════════════════════
  if (flags.no_audio_from_s0)
    rules.push('⛔ SIN AUDIO DESDE S0: el espectador no activó atención. scrollStopScore ≤22 | retencion_ritmo ≤30 | viralScore -15 adicional sobre cualquier otro techo. Sin audio el cerebro no activa modo atención en el feed. No negociable.');

  // ══════════════════════════════════════════════════════
  // BLOQUE 2 — HOOK
  // ══════════════════════════════════════════════════════
  if (flags.hook_type === 'muerto')
    rules.push('⛔ HOOK MUERTO: viralScore TECHO ABSOLUTO = 35. Nada lo supera. hook ≤25 | scrollStopScore ≤28 | honestVerdict: "Los primeros segundos no paran el dedo — no pasa nada que haga que el cerebro quiera quedarse."');

  if (flags.hook_type === 'debil')
    rules.push('⚠️ HOOK DÉBIL: viralScore TECHO = 60 | hook ≤50 | scrollStopScore ≤45');

  if (flags.hook_type === 'apertura_informativa')
    rules.push('⚠️ APERTURA INFORMATIVA: viralScore TECHO = 40 | hook ≤38. Mostrar el resultado desde s0 no es un hook — el espectador ya sabe lo que es y no tiene razón para quedarse.');

  if (flags.bait_disconnect)
    rules.push('⚠️ BAIT HOOK DESCONECTADO: viralScore TECHO = 55 pero salesScore TECHO = 45. El video retiene con el impacto visual pero cuando aparece el producto el espectador se siente engañado. La brecha entre viralScore y salesScore debe ser reportada y explicada. honestVerdict: mencionar que el hook genera retención pero destruye conversión porque no hay puente emocional con el producto.');

  if (flags.hook_is_direct_info && !flags.bait_disconnect && flags.hook_type !== 'explosivo')
    rules.push('⚠️ APERTURA DIRECTA SIN TENSIÓN: hook -10 adicional. Mostrar el producto o resultado desde s0 informa pero no genera curiosidad. El espectador ya sabe lo que es y decide si le interesa en menos de 1 segundo.');

  // ══════════════════════════════════════════════════════
  // BLOQUE 3 — FORMATO
  // ══════════════════════════════════════════════════════
  if (flags.is_static_slideshow)
    rules.push('⛔ SLIDESHOW DE IMÁGENES: el espectador no las vio. retencion_ritmo ≤25 | emocion_deseo ≤35 | produccion_estetica ≤38 | viralScore TECHO = 28. Las imágenes quietas son invisibles en el feed en 2026. No importa lo que muestren.');

  if (flags.no_music_and_static)
    rules.push('⛔ IMÁGENES SIN MÚSICA: peor combinación posible. produccion_estetica ≤28 | scrollStopScore ≤18 | viralScore TECHO = 20 | honestVerdict: este formato no compite en el feed actual — no es problema del producto sino del formato elegido.');

  if (flags.slow_cuts_no_music)
    rules.push('⛔ CORTES LENTOS SIN MÚSICA: el espectador scrolleó antes de s4. retencion_ritmo ≤28 | viralScore TECHO = 30.');

  if (flags.format_incompatible)
    rules.push('⛔ FORMATO INCOMPATIBLE (0-2 preguntas del Gate): el espectador no vio el video. claridad_producto -25 | confianza_credibilidad -25 | propuesta_valor -25. honestVerdict: separar "el contenido es valioso" de "el formato hace que nadie llegue a verlo".');

  if (flags.format_weak && !flags.format_incompatible)
    rules.push('⚠️ FORMATO DÉBIL (3-4 preguntas del Gate): el espectador llegó a la mitad o menos. claridad_producto -12 | confianza_credibilidad -12 | propuesta_valor -12 | retencion_ritmo ≤50.');

  // ══════════════════════════════════════════════════════
  // BLOQUE 4 — CAPAS DE COMPRA
  // ══════════════════════════════════════════════════════
  if (flags.pain_missing)
    rules.push('⛔ DOLOR NO NOMBRADO: salesScore ≤48 | propuesta_valor ≤42 | emocion_deseo ≤40. Sin nombrar el dolor del espectador antes de mostrar el producto, el video no conecta con nadie. Primera mejora del roadmap siempre.');

  if (flags.pain_late && !flags.pain_missing)
    rules.push('⚠️ DOLOR NOMBRADO TARDE (después de s5): salesScore -12 | propuesta_valor -10. El espectador se fue antes de sentir que el video le habla a él.');

  if (flags.trust_gap)
    rules.push('⚠️ BRECHA DE CONFIANZA: salesScore -15 | confianza_credibilidad ≤45. Hay interés pero no hay acción porque el espectador no cree que el producto funcione de verdad.');

  if (flags.no_urgency)
    rules.push('⚠️ SIN URGENCIA: salesScore -10 | call_to_action -12. Hay intención de compra pero no hay razón para actuar hoy. El espectador dice "lo veo después" y nunca vuelve.');

  if (flags.high_friction)
    rules.push('⚠️ FRICCIÓN ALTA: call_to_action ≤40 | salesScore -8. El siguiente paso no está claro o parece complicado. La decisión de compra se toma pero no se ejecuta.');

  // ══════════════════════════════════════════════════════
  // BLOQUE 5 — PRESENTACIÓN DEL PRODUCTO
  // ══════════════════════════════════════════════════════
  if (flags.product_shown_late)
    rules.push('⚠️ PRODUCTO MOSTRADO TARDE (después de s8): claridad_producto -15 | salesScore -12. El espectador ya se fue.');

  if (flags.product_shown_sideways)
    rules.push('⚠️ PRODUCTO DE COSTADO O PARCIAL: claridad_producto -12 | emocion_deseo -10.');

  if (flags.product_presentation_interrupted)
    rules.push('⚠️ PRESENTACIÓN INTERRUMPIDA: retencion_ritmo -10 | produccion_estetica -8.');

  // ══════════════════════════════════════════════════════
  // BLOQUE 6 — VALOR QUE EL ESPECTADOR NUNCA VIO
  // ══════════════════════════════════════════════════════
  if (flags.value_trap)
    rules.push('⛔ TRAMPA DE VALOR: no subir salesScore ni potentialScore por el resultado/contenido si el espectador promedio nunca llega a verlo. salesScore ≤50 | potentialScore ≤53 | honestVerdict: "El resultado es real y tiene potencial. El problema es que nadie llega a verlo con este formato."');

  if (flags.value_behind_scroll_wall)
    rules.push('⚠️ VALOR DETRÁS DEL SCROLL: el mejor momento aparece cuando el espectador ya se fue. No contarlo como fortaleza. Scores que dependen de ese elemento bajan 20 puntos.');

  if (flags.recompensa_tardia)
    rules.push('⚠️ RECOMPENSA TARDÍA: emocion_deseo -18 | salesScore -12. Primera mejora del roadmap: mover ese elemento a los primeros 5 segundos.');

  if (flags.buried_result)
    rules.push('⛔ RESULTADO ENTERRADO (después de s15, espectador scrolleó antes de s10): salesScore ≤45. No puede aparecer como fortaleza.');

  // ══════════════════════════════════════════════════════
  // BLOQUE 7 — RITMO Y ENERGÍA
  // ══════════════════════════════════════════════════════
  if (flags.boring_full_video)
    rules.push('⛔ VIDEO ABURRIDO COMPLETO: emocion_deseo ≤33 | retencion_ritmo ≤35 | retentionCurve con caída pronunciada antes de s8.');

  if (flags.flat_energy && !flags.boring_full_video)
    rules.push('⚠️ ENERGÍA PLANA: emocion_deseo -15 | retencion_ritmo -12. Sin picos ni escalada el espectador siente que "ya vio suficiente" aunque no haya visto todo.');

  if (flags.dead_moment && !flags.boring_full_video)
    rules.push(`⚠️ MOMENTO MUERTO (~s${flags.dead_moment_second || '?'}): retencion_ritmo ≤52. El espectador scrollea exactamente ahí.`);

  if (flags.no_retention_engines)
    rules.push('⛔ SIN MOTORES DE RETENCIÓN: viralScore -10 adicional | retencion_ritmo ≤38.');

  if (flags.no_share_trigger)
    rules.push('⚠️ SIN MOTOR DE COMPARTIR: viralScore -8. El video no activa ninguno de los 4 motores de compartir (identidad, utilidad social, sorpresa, validación).');

  // ══════════════════════════════════════════════════════
  // BLOQUE 8 — RECHAZO VISUAL Y DAÑO
  // ══════════════════════════════════════════════════════
  if (flags.first_frame_repulsion)
    rules.push('⛔ PRIMER FRAME REPULSIVO: hook ≤30 | scrollStopScore ≤25. El espectador scrolleó en s0.');

  if (flags.visual_repulsion) {
    const s = flags.visual_repulsion_severity || 'moderada';
    if (s === 'fuerte')  rules.push('⛔ RECHAZO VISUAL FUERTE: produccion_estetica ≤40 | confianza_credibilidad ≤38 | potentialScore ≤48.');
    else if (s === 'moderada') rules.push('⚠️ RECHAZO VISUAL MODERADO: produccion_estetica -20 | confianza_credibilidad -15.');
    else if (s === 'leve') rules.push('⚠️ RECHAZO VISUAL LEVE: produccion_estetica -10.');
  }

  if (flags.product_damage)
    rules.push('⛔ DAÑO VISIBLE EN PRODUCTO: confianza_credibilidad ≤43 | potentialScore ≤58 | salesScore ≤53.');

  if (flags.audio_issue)
    rules.push('⚠️ AUDIO PROBLEMÁTICO: produccion_estetica -15 | confianza_credibilidad -10.');

  // ══════════════════════════════════════════════════════
  // BLOQUE 9 — PRODUCTO
  // ══════════════════════════════════════════════════════
  if (flags.product_unclear)
    rules.push('⛔ PRODUCTO POCO CLARO: claridad_producto ≤45 | salesScore ≤50 | propuesta_valor ≤45.');

  if (flags.product_difficult_to_sell)
    rules.push('⚠️ PRODUCTO DIFÍCIL EN REDES: potentialScore ≤58 | salesScore ≤53 | honestVerdict: la limitación es del producto, no del video.');

  if (!rules.length) return `Sin flags criticos. Si el espectador se habría quedado a mirar — audio desde s0, movimiento real, hook con curiosidad, dolor nombrado, cortes cada 1-3s — los scores altos (70-90) son correctos y deben asignarse.`;

  return `PENALIZACIONES DERIVADAS DEL COMPORTAMIENTO REAL DEL ESPECTADOR — APLICAR EN ORDEN:
${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

REGLAS DE APLICACIÓN:
- TECHO (≤X): valor máximo absoluto. El contenido del video no lo supera.
- RESTA (-Y): restar del score base antes de comparar contra techos.
- Si hay múltiples techos sobre el mismo score: aplicar siempre el más restrictivo.
- TECHOS DE VIRALSCORE se acumulan: hook muerto (≤35) + no_audio (-15) = techo efectivo ≤20.
- BAIT DESCONECTADO: reportar viralScore y salesScore por separado y explicar la brecha.
- Si NO hay flags: un video que el espectador vería hasta el final merece scores 70-90. Asignarlos.`;
};


// ============================================================
// SCORING BRAIN
// ============================================================
const buildScoringBrainPrompt = (strategyAnalysis, platform, objetivo, nicho, flags) => {
  const pName = { tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts' }[platform];
  const penaltiesBlock = buildPenalties(flags);

  return `
Sistema de scoring VIRAX AI para ${pName}. Objetivo: ${objetivo} | Nicho: ${nicho}

ANÁLISIS ESTRATÉGICO:
${strategyAnalysis}

════════════════════════════════════════════════════════════
IDENTIDAD DEL EVALUADOR — MANTENERLA DURANTE TODO EL SCORING
════════════════════════════════════════════════════════════
No sos un analista de marketing evaluando calidad de contenido.
Sos el sistema de puntuación que refleja lo que el espectador promedio
— cerebro en modo vegetativo, pulgar listo para scrollear — realmente haría con este video.

Las preguntas reales que guían cada score:

hook: ¿el espectador paró el pulgar en el primer segundo? ¿por qué? ¿o no lo paró?
retencion_ritmo: ¿llegó al final, o en qué segundo exacto se fue?
emocion_deseo: ¿sintió algo (quiero esto, necesito esto, esto es para mí), o no sintió nada?
claridad_producto: ¿entendió qué es sin tener que pensar?
confianza_credibilidad: ¿confió en que el producto funciona de verdad, o le pareció un aviso más?
produccion_estetica: ¿el video se veía como algo que un amigo compartiría, o como publicidad corporativa?
propuesta_valor: ¿el video le habló de su dolor antes de mostrarle el producto?
call_to_action: ¿supo exactamente qué hacer después de ver el video?
viralScore: ¿lo mandaría a alguien o lo compartiría? ¿por qué?
salesScore: ¿haría clic o buscaría más info? ¿qué lo convencería o qué lo frenó?

NOTA SOBRE BAIT HOOK DESCONECTADO:
Si el video usa un hook de impacto visual sin conexión con el producto, reportar:
viralScore (retención generada por el impacto) y salesScore (conversión real) por separado.
La brecha entre ambos es la señal de que el hook retiene pero no convierte.
════════════════════════════════════════════════════════════

PENALIZACIONES — APLICAR PRIMERO, EN ORDEN, EXACTAMENTE:
${penaltiesBlock}

SEÑALES POSITIVAS (aplicar activamente cuando el análisis las confirma):
→ Hook explosivo confirmado (el espectador se quedó sin decidirlo): viralScore base ≥72 antes de ajustes
→ Dolor nombrado en los primeros 5s + producto como solución directa: salesScore base ≥68
→ Audio desde s0 + video real + cortes cada 1-2s: retencion_ritmo base ≥70
→ Algo nuevo cada ≤2s sostenido: retencion_ritmo +10 adicional
→ Producto mostrado en acción desde s0-s3, sin interrupciones: claridad_producto ≥75
→ Prueba social real + demostración funcionando: confianza_credibilidad ≥70
→ Urgencia real o emocional visible antes del scroll masivo: call_to_action ≥65
→ Satisfacción visual fuerte (transformación visible, proceso fluido): emocion_deseo ≥65
→ Parece contenido de amigo, no aviso corporativo: produccion_estetica ≥60
→ Elemento compartible detectado (dato revelador, sorpresa, identificación fuerte): viralScore +8
Las señales positivas son tan importantes como las penalizaciones.
Un video que el espectador vería hasta el final debe tener scores altos. No ser conservador.

REGLAS BASE:
- Producción simple + formato competitivo (espectador llegó al final): produccion_estetica ≥55. No penalizar.
- Producto físico que se vende visualmente: call_to_action ≥65 aunque no haya CTA verbal.
- Música de fondo sin molestia: produccion_estetica -6 (leve).
- viralScore y salesScore son independientes. Pueden diferir 15-25 puntos. Explicar la brecha cuando ocurra.

════════════════════════════════════════════════════════════
ESCALA DE REFERENCIA — CALIBRAR ANTES DE PUNTUAR:
════════════════════════════════════════════════════════════
viralScore 82-90: paró, se quedó, lo mandó. Hook real + ritmo + elemento compartible.
viralScore 68-81: paró, llegó al final, no lo mandó pero lo consideró.
viralScore 52-67: dudó, llegó a la mitad. Hook débil o ritmo con problemas.
viralScore 35-51: scrolleó en s4-s8. Algo lo detuvo brevemente pero no suficiente.
viralScore 20-34: scrolleó antes de s4. Sin audio, imágenes, o hook muerto.
viralScore <20: ni lo registró. Slideshow sin música o primer frame repulsivo.

salesScore 75-90: dolor nombrado + confianza construida + urgencia visible. Compra inmediata probable.
salesScore 55-74: dolor o confianza presentes pero no ambos. Intención sin acción inmediata.
salesScore 35-54: el espectador no sintió que el video le hablaba a él. Pasa de largo.
salesScore <35: sin dolor nombrado + sin confianza = sin compra.

EJEMPLOS CONCRETOS DE CALIBRACIÓN:
- Video de 8 imágenes sin música, resultado mostrado desde s0 → viralScore 12-18 | salesScore 20-30
- Video real, cortes cada 3s, música, producto de frente, hook informativo, sin dolor nombrado → viralScore 42-52 | salesScore 32-42
- Video real, hook "¿te pasa esto?", cortes cada 1-2s, música, dolor en s2, producto como solución en s5, urgencia en s18 → viralScore 72-82 | salesScore 68-78
- Bait hook (explosión) sin conexión con el producto → viralScore 58-68 | salesScore 28-38 (reportar brecha)
════════════════════════════════════════════════════════════

REGLA DE LENGUAJE — OBLIGATORIA:
Escribí como si le explicás a la persona que hizo el video qué tiene de bueno o malo.
Esa persona no estudió marketing. No sabe qué es un "hook" ni un "loop de curiosidad".
Hablale como a alguien que quiere saber por qué su video no funciona o por qué sí funciona.

PROHIBIDO sin explicación: UGC, CTR, hook, retención, conversión, viralización, STEPPS, engagement, funnel, orgánico.
Si lo usás: "el gancho (lo que la gente ve en el primer segundo)".

EJEMPLOS DE LENGUAJE:
✗ "El hook carece de pattern interrupt efectivo"
✓ "Los primeros segundos no paran el dedo — no pasa nada que haga querer quedarse"
✗ "Baja consumibilidad sin audio"
✓ "Sin sonido nadie entiende de qué trata el video"
✗ "El formato slideshow compromete la retención orgánica"
✓ "Son imágenes quietas — el cerebro las scrollea automáticamente sin ni verlas"
✗ "Pain point no establecido en apertura"
✓ "El video no le dice al espectador que entiende su problema antes de mostrarle el producto"

════════════════════════════════════════════════════════════
REGLA DE ANÁLISIS PRESCRIPTIVO — LA MÁS IMPORTANTE
════════════════════════════════════════════════════════════
Cada problema detectado DEBE venir con su solución concreta.
Diagnosticar sin prescribir es inútil. Es como un médico que dice "tenés fiebre" y se va.

ESTRUCTURA OBLIGATORIA para cada problema en categorias y roadmap:

FORMATO CATEGORIAS:
  explicacion: una oración que dice QUÉ está mal y POR QUÉ pasa
  solucion: una oración que dice QUÉ CAMBIAR EXACTAMENTE, en lenguaje del creador
  ejemplo: cómo quedaría aplicado a ESTE video específico (no genérico)

EJEMPLO CORRECTO de categorias con problema:
  hook: {
    puntaje: 28,
    explicacion: "El video arranca mostrando el producto directamente — el cerebro ya sabe lo que es en s0 y no tiene razón para quedarse",
    solucion: "Empezá con el problema antes de mostrar el producto — que el espectador se identifique antes de ver qué vendés",
    ejemplo: "En vez de mostrar el rodillo desde s0, empezá con un plano de un saco lleno de peluza y alguien mirándolo frustrado. Recién ahí aparece el rodillo como solución."
  }

EJEMPLO CORRECTO de categorias sin problema (puntaje alto):
  retencion_ritmo: {
    puntaje: 78,
    explicacion: "Los cortes cada 2 segundos mantienen al espectador activo — nunca hay tiempo de aburrirse",
    solucion: "Mantener este ritmo en futuros videos, especialmente en los primeros 10 segundos",
    ejemplo: "El corte en s4 cuando aparece el resultado es el mejor momento del video — ese es el ritmo que hay que sostener"
  }

FORMATO ROADMAP — 4 mejoras ordenadas por impacto real:
Cada mejora tiene este formato exacto:
  "IMPACTO ALTO | [nombre del problema] → [qué cambiar] → [cómo quedaría en este video]"

ORDEN OBLIGATORIO del roadmap:
  roadmap[0]: La mejora que más views genera (siempre el hook o el formato si están mal)
  roadmap[1]: La mejora que más convierte (dolor + confianza)
  roadmap[2]: La mejora que más retiene (ritmo + energía)
  roadmap[3]: La mejora que más comparte (elemento revelador o CTA)

EJEMPLO de roadmap bien construido:
  roadmap[0]: "IMPACTO ALTO | Los primeros segundos no paran el dedo → Empezá con el problema visible antes de mostrar el producto → Abrí con un plano del saco lleno de peluza, sin mostrar el rodillo. Que el espectador piense '¿cómo lo saca?' antes de ver la solución"
  roadmap[1]: "IMPACTO ALTO | El video no le dice al espectador que entiende su problema → Agregá una línea de texto en s2 que nombre el dolor → 'Esa peluza que no sale con nada...' antes de mostrar el producto funcionando"
  roadmap[2]: "IMPACTO MEDIO | Hay un plano de 6 segundos en s12 donde no pasa nada nuevo → Cortalo a la mitad o agregá un cambio de ángulo → Mostrá el mismo momento desde arriba en s14 para que el cerebro sienta que avanzó"
  roadmap[3]: "IMPACTO MEDIO | No hay razón para comprarlo hoy → Agregá urgencia emocional al final → Terminá con 'Cada vez que lo usás es como estrenar la ropa de nuevo' antes del CTA"

FORMATO HONESVERDICT:
Una sola cosa. La más importante. Sin rodeos. En lenguaje del creador.
NO listar tres cosas. UNA.
Y después: qué cambiaría todo si se arregla eso.

EJEMPLO de honestVerdict bien construido:
  "El producto es bueno y el video está bien grabado. El problema es que empieza mostrando lo que vende, y el cerebro lo ignora antes de procesarlo. Si los primeros 3 segundos muestran el problema en vez del producto, todo lo demás que ya está bien empieza a funcionar."

EJEMPLO de honestVerdict MAL construido (prohibido):
  "El video tiene problemas con el hook, la retención es baja, falta urgencia y el CTA no es claro."
  → Eso es una lista de diagnósticos. No es un veredicto. No lo uses.


PONDERACIÓN BASE (antes de penalizaciones):
hook 20% | retencion_ritmo 13% | claridad_producto 12% | confianza_credibilidad 11% | emocion_deseo 11% | propuesta_valor 12% | call_to_action 9% | produccion_estetica 7% | tendencias_formato 5%

RESPUESTA: ÚNICAMENTE el objeto JSON. Primera línea: { — Última línea: }
Sin nada antes ni después. Strings sin tildes, sin comillas dobles internas (usar simples), sin saltos de línea.

{
  "vision": {
    "niche": "",
    "type": "<UGC|profesional|mixto>",
    "audience": "",
    "promise": ""
  },
  "salesScore": { "score": 0, "titulo": "Potencial de Venta", "verdict": "", "razon_principal": "", "accion_clave": "" },
  "viralScore":  { "score": 0, "titulo": "Potencial Viral",   "verdict": "", "razon_principal": "", "accion_clave": "" },
  "potentialScore": 0,
  "performanceScenario": "",
  "honestVerdict": "",
  "buyerJourney": {
    "painNamed": "<si — segundo exacto|no|tarde — segundo exacto>",
    "painType": "<activo|latente|no nombrado>",
    "trustBuilt": "<si|parcial|no>",
    "urgencyPresent": "<si|parcial|no>",
    "frictionLevel": "<baja|media|alta>",
    "conversionVerdict": ""
  },
  "hookAnalysis": {
    "type": "<explosivo|bait_con_puente|debil|bait_desconectado|apertura_informativa|muerto>",
    "strength": 0,
    "implicitQuestion": "<pregunta que genera en el espectador, o 'ninguna'>",
    "baitBridge": "<descripcion del puente emocional si existe, o 'sin puente'>",
    "viralScoreCeiling": 0,
    "salesScoreImpact": "",
    "missingElement": "",
    "optimizedHook": ""
  },
  "shareMotivation": {
    "identity": "<presente|ausente>",
    "socialUtility": "<presente|ausente>",
    "surprise": "<presente|ausente>",
    "validation": "<presente|ausente>",
    "dominantMotor": "<identidad|utilidad_social|sorpresa|validacion|ninguno>",
    "shareVerdict": ""
  },
  "platformScores": {
    "tiktok": { "score": 0, "verdict": "", "topTip": "" },
    "reels":  { "score": 0, "verdict": "", "topTip": "" },
    "shorts": { "score": 0, "verdict": "", "topTip": "" }
  },
  "retentionData": {
    "at3s": "",
    "at10s": "",
    "final": "",
    "scrollMassiveSecond": 0,
    "contentVisibleBeforeScroll": "<que ve el espectador antes de irse>",
    "contentMissedByMost": "<que valor tiene el video que casi nadie alcanza, o 'ninguno'>"
  },
  "retentionCurve": [100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "phaseScores": {
    "hook":       { "label": "Hook",       "score": 0, "verdict": "", "consequence": "" },
    "desarrollo": { "label": "Desarrollo", "score": 0, "verdict": "", "consequence": "" },
    "escalada":   { "label": "Escalada",   "score": 0, "verdict": "", "consequence": "" },
    "cierre":     { "label": "Cierre",     "score": 0, "verdict": "", "consequence": "" }
  },
  "steppsScore": {
    "socialCurrency": 0, "triggers": 0, "emotion": 0, "public": 0,
    "practicalValue": 0, "stories": 0, "viralCoefficient": 0.0,
    "dominantFactor": "", "weakestFactor": "", "shareMotivation": ""
  },
  "scrollStopScore": {
    "score": 0, "faceDetected": false, "textOnScreen": false,
    "contrastLevel": "<alto|medio|bajo>", "emotionVisible": "",
    "emotionIntensity": 0, "verdict": ""
  },
  "commentTrigger": {
    "probability": 0,
    "triggerType": "<debate|pregunta|identificacion|humor|sorpresa>",
    "suggestedCTA": ""
  },
  "viewsPrediction": {
    "scenario_low": "", "scenario_mid": "", "scenario_high": "",
    "probability_viral": ""
  },
  "firstHourStrategy": {
    "optimalPostTime": "", "firstActionAfterPost": "",
    "commentSeed": "", "engagementBoost": ""
  },
  "styleProfile": {
    "detectedRhythm": "<lento|medio|dinamico|frenetico>",
    "detectedTone":   "<serio|cercano|aspiracional|humoristico|urgente>"
  },
  "productViability": {
    "usageFrequency":    "<diaria|semanal|mensual|ocasional|unica vez>",
    "instantClarity":    "<fuerte|aceptable|debil>",
    "everydayProblem":   "<fuerte|aceptable|debil>",
    "audienceWidth":     "<masivo|nicho amplio|nicho especifico>",
    "purchaseFriction":  "<baja|media|alta>",
    "wowFactor":         "<fuerte|aceptable|debil>",
    "resultCredibility": "<fuerte|aceptable|debil>",
    "weakFactors": 0, "alert": "", "verdict": ""
  },
  "retentionEngines": {
    "painLoop":           "<presente|parcial|ausente>",
    "openLoop":           "<presente|parcial|ausente>",
    "microRewards":       "<presentes|escasas|ausentes>",
    "consumability":      "<alta|media|baja>",
    "platformNaturalness":"<organico|mixto|parece publicidad>",
    "dominantEngine": "", "verdict": ""
  },
  "editingAudio": {
    "editingQuality":  "<intencional|amateur|sin editar>",
    "cutsPerThreeSeconds": 0,
    "deadMoments":     "<ninguno|leve|varios — con segundo aproximado>",
    "musicFit":        "<perfecta|generica|ausente|contraproducente>",
    "audioBalance":    "<bien balanceado|musica muy alta|muy silencioso>",
    "rhythmVsProduct": "<compatible|contradice la energia del producto>",
    "energyProfile":   "<plana|variable|escalada|caida>",
    "boringRisk":      "<bajo|medio|alto>",
    "verdict": ""
  },
  "visualRepulsion": {
    "hasRepulsion": false, "signal": "", "second": "",
    "severity": "<ninguna|leve|moderada|fuerte>", "impact": ""
  },
  "trendContext": "",
  "roadmap": [
    "<IMPACTO ALTO|MEDIO — [nombre del problema] → [que cambiar exactamente] → [como quedaria en este video especifico]>",
    "<IMPACTO ALTO|MEDIO — [nombre del problema] → [que cambiar exactamente] → [como quedaria en este video especifico]>",
    "<IMPACTO MEDIO — [nombre del problema] → [que cambiar exactamente] → [como quedaria en este video especifico]>",
    "<IMPACTO MEDIO — [nombre del problema] → [que cambiar exactamente] → [como quedaria en este video especifico]>"
  ],
  "trendResearch": {
    "hooksWorking": "", "topStructure": "",
    "sourceQuality": "<alta|media|baja>", "researchDate": ""
  },
  "gapAnalysis": {
    "biggestGap": "", "quickWin": "", "competitiveAdvantage": ""
  },
  "categorias": {
    "hook": {
      "puntaje": 0,
      "explicacion": "<que esta mal o bien y por que pasa — en lenguaje del creador>",
      "solucion": "<que cambiar exactamente — accion concreta, no consejo vago>",
      "ejemplo": "<como quedaria aplicado a este video especifico — no un ejemplo generico>"
    },
    "claridad_producto": {
      "puntaje": 0,
      "explicacion": "",
      "solucion": "",
      "ejemplo": ""
    },
    "confianza_credibilidad": {
      "puntaje": 0,
      "explicacion": "",
      "solucion": "",
      "ejemplo": ""
    },
    "emocion_deseo": {
      "puntaje": 0,
      "explicacion": "",
      "solucion": "",
      "ejemplo": ""
    },
    "propuesta_valor": {
      "puntaje": 0,
      "explicacion": "",
      "solucion": "",
      "ejemplo": ""
    },
    "retencion_ritmo": {
      "puntaje": 0,
      "explicacion": "",
      "solucion": "",
      "ejemplo": ""
    },
    "call_to_action": {
      "puntaje": 0,
      "tipo": "<explicito|implicito|ausente>",
      "explicacion": "",
      "solucion": "",
      "ejemplo": ""
    },
    "produccion_estetica": {
      "puntaje": 0,
      "explicacion": "",
      "solucion": "",
      "ejemplo": ""
    },
    "tendencias_formato": {
      "puntaje": 0,
      "explicacion": "",
      "solucion": "",
      "ejemplo": ""
    }
  },
  "updatedHook": "",
  "updatedRoadmap": ["", "", ""]
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

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
//
const transcodeToH264 = async (videoFile, onProgress) => {
  const ffmpeg = new FFmpeg();

  // Versión sin SharedArrayBuffer — funciona en Vercel sin headers especiales
  await ffmpeg.load({
    coreURL: await toBlobURL(
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      'text/javascript'
    ),
    wasmURL: await toBlobURL(
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
      'application/wasm'
    ),
  });

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 100));
  });

  const ext = videoFile.name.split('.').pop() || 'mp4';
  await ffmpeg.writeFile(`input.${ext}`, await fetchFile(videoFile));

  await ffmpeg.exec([
    '-i', `input.${ext}`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '28',          // calidad razonable, archivo más liviano
    '-c:a', 'aac',
    '-movflags', '+faststart',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  return new File([data.buffer], 'video.mp4', { type: 'video/mp4' });
};

const App = () => {
  const [step, setStep] = useState('upload');
  const [analysisMode, setAnalysisMode] = useState('video');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [selectedFollowerRange, setSelectedFollowerRange] = useState(null);
  const [selectedObjetivo, setSelectedObjetivo] = useState('ventas'); // ← agregá esto
  const [selectedNicho, setSelectedNicho] = useState('producto_fisico');  //const deriveFlags
  const [pendingVideoFile, setPendingVideoFile] = useState(null);
  const [pendingVideoUrl, setPendingVideoUrl] = useState(null);        //mimeType 
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
    actual_views: null,
    actual_viral: null
  });
};  //const scores = buildPenalties(flagsDeterministic)  //catch (err)

const runNeuralAnalysis = async (url, platform, followerRange, videoFile) => {
  if (videoFile.size > 45 * 1024 * 1024) {
    alert(`El video pesa ${(videoFile.size / 1024 / 1024).toFixed(1)}MB. El límite es 50MB.`);
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
  setStatusText("Preparando video...");
  setAnalysisProgress(5);

  // Nombre seguro
  const safeName = videoFile?.name
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '') || 'video.mp4';

  const storagePath = `temp-analysis/${Date.now()}-${safeName}`;

  // ✅ CAMBIO 1: usar el mimeType real del archivo, no forzar nada
  const mimeType = videoFile.type || 'video/mp4';

  // ✅ CAMBIO 2: subir el archivo original sin envolverlo en new File()
  const fileToUpload = videoFile;
  console.log('[VIRAX] Subiendo:', fileToUpload.name, fileToUpload.size, 'bytes', mimeType);

  try {
    setStatusText("Subiendo video...");
    setAnalysisProgress(10);

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, fileToUpload, { upsert: true });

    if (uploadError) throw new Error("Error subiendo video: " + uploadError.message);

    await new Promise(r => setTimeout(r, 1500));

    // CALL 0 — Pre-clasificador
    setAnalysisProgress(18);
    setStatusText("Pre-clasificando video...");

    let preFacts = {};
    let preHookType = 'debil';

    try {
      const { data: call0Data, error: call0Error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          text: buildPreClassifierPrompt(),
          storagePath,
          videoMimeType: mimeType,
          duration: Math.round(duration),
          maxOutputTokens: 1024,
          expectsJson: true
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
        if (preFacts.producto_en_s0) return 'apertura_informativa';
        return 'debil';
      })();

      console.log('[VIRAX] Pre-facts:', preFacts, '| Hook:', preHookType);
    } catch (e) {
      console.warn('[CALL 0] Fallback:', e.message);
    }

    // CALL 1 — Viewer Brain
    setAnalysisProgress(25);
    setStatusText("Analizando el video...");

    let call1Data, call1Error;
    try {
      const res = await supabase.functions.invoke('gemini-proxy', {
        body: {
          text: buildViewerBrainPrompt(platform, selectedNicho),
          storagePath,
          videoMimeType: mimeType,
          duration: Math.round(duration),
          maxOutputTokens: 8192,
        }
      });
      call1Data = res.data;
      call1Error = res.error;

      if (call1Error) {
        const rawBody = await call1Error.context?.text?.();
        console.error('[CALL 1] Body:', rawBody);
        throw new Error(`CALL 1 falló: ${rawBody || call1Error.message}`);
      }
    } catch (e) {
      console.error('[CALL 1] Exception:', e.message);
      throw e;
    }

    const viewerAnalysis = extractGeminiText(call1Data);

    // CALL 2 — Strategy Brain
    setAnalysisProgress(50);
    setStatusText("Evaluando ventas y viralidad...");

    const { data: call2Data, error: call2Error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildStrategyBrainPrompt(viewerAnalysis, platform, selectedObjetivo, selectedNicho, preFacts, preHookType),
        maxOutputTokens: 6144,
      }
    });
    if (call2Error) throw call2Error;

    const strategyRaw = extractGeminiText(call2Data);
    const flagsFromStrategy = extractFlags(strategyRaw);
    const strategyAnalysis = stripFlags(strategyRaw);
    const flagsDeterministic = { ...flagsFromStrategy, ...deriveFlags(preFacts) };
    console.log('[VIRAX] Flags:', flagsDeterministic);

    // CALL 3 — Scoring Brain
    setAnalysisProgress(80);
    setStatusText("Calculando scores finales...");

    const { data: call3Data, error: call3Error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildScoringBrainPrompt(strategyAnalysis, platform, selectedObjetivo, selectedNicho, flagsDeterministic),
        expectsJson: true,
        maxOutputTokens: 8192,
      }
    });
    if (call3Error) throw call3Error;

    const parsed = safeParseJSON(extractGeminiText(call3Data), 'scoring');

    setAnalysisProgress(95);
    setStatusText("Preparando tu análisis completo...");

    const finalResult = {
      ...parsed,
      objetivo: selectedObjetivo,
      _flags: flagsDeterministic,
      _strategy_text: strategyAnalysis,
      _viewer_text: viewerAnalysis
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
    const msg = err?.message || String(err);
    const isCodec = msg.includes('video_upload_failed') || msg.includes('codec') || msg.includes('HEVC');
    alert(
      isCodec
        ? '❌ Tu video usa un formato que Google no puede procesar.\n\nCambiá la configuración de la cámara:\nSamsung → Configuración de cámara → Formato → Compatible (H.264)\n\nDespués grabá un video nuevo y subilo.'
        : `❌ Error: ${msg}`
    );
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
        text: buildStrategyBrainPrompt(viewerAnalysis, platform, selectedObjetivo, selectedNicho),
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
        text: buildScoringBrainPrompt(strategyAnalysis, platform, selectedObjetivo, selectedNicho, flags),
        expectsJson: true,
        maxOutputTokens: 8192
      }
    });
    if (call3Error) throw call3Error;
    const parsed = safeParseJSON(extractGeminiText(call3Data), 'scoring-script');

    setAnalysisProgress(95);
    setStatusText("Preparando tu análisis...");

    const finalResult = {
      ...parsed,
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
    @keyframes logoPulse {
      0%   { transform: scale(1);             filter: drop-shadow(0 0 0px transparent); }
      5%   { transform: scale(1.06) rotate(-1deg); filter: drop-shadow(0 0 8px #ef4444aa); }
      11%  { transform: scale(1.11) rotate(0deg);  filter: drop-shadow(0 0 18px #ef4444dd); }
      17%  { transform: scale(0.96);          filter: drop-shadow(0 0 4px #ef444433); }
      23%  { transform: scale(1);             filter: drop-shadow(0 0 0px transparent); }
      100% { transform: scale(1);             filter: drop-shadow(0 0 0px transparent); }
    }
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
    .logo-pulse {
      animation: logoPulse 5s cubic-bezier(0.22, 1, 0.36, 1) 2s infinite;
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
      className="logo-pulse w-10 h-10 rounded-xl object-contain shadow-lg"
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
      { id: 'producto_fisico', label: 'Producto físico' },
      { id: 'curso',          label: 'Curso / Info'    },
      { id: 'servicio',       label: 'Servicio'        },
      { id: 'inmobiliaria',   label: 'Inmobiliaria'    },
      { id: 'app_software',   label: 'App / Software'  },
      { id: 'otro',           label: 'Otro'            },
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
  @keyframes shimmer-text {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
`}</style>
    </div>
  );
};

export default App;