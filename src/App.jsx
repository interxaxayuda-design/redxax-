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

import { createClient } from '@supabase/supabase-js'; //phaseScores  //toggleStep

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


const buildSystemInstructions = (platform, followerRange, mode = 'video', videoMetadata = {}) => {
  const { cutsPerMinute = null, duration = null } = videoMetadata;

  const platformNames = {
    tiktok: 'TikTok', reels: 'Instagram Reels',
    shorts: 'YouTube Shorts', all: 'TikTok, Instagram Reels y YouTube Shorts'
  };
  const followerLabels = {
    new: '0–1K', small: '1K–10K', mid: '10K–100K',
    large: '100K–500K', mega: '500K+'
  };

  const cutRateContext = cutsPerMinute !== null ? `
DATO TÉCNICO MEDIDO — RITMO DE EDICIÓN:
Cortes detectados: ${cutsPerMinute} cortes/minuto | Duración: ${duration}s

Benchmark por nicho (zona óptima):
  Entertainment/Humor:   12-20 cpm → ZONA VIRAL
  Educational/Tutorial:  4-8 cpm  → retención correcta
  Aesthetic/ASMR:        1-4 cpm  → contemplativo
  Gaming/Reaction:       15-25 cpm → alta energía
  Motivacional:          8-15 cpm → balance narrativo
  Fitness/Lifestyle:     8-14 cpm → demostración energética
  Finanzas/Crypto:       5-10 cpm → credibilidad + ritmo
  Beauty/Fashion:        6-12 cpm → aspiracional fluido

TIPOS DE CORTE — Inferí cuáles predominan desde los frames:
  Jump cut:         Energía alta, puede sentirse amateur si excesivo
  Match cut:        Narrativa sofisticada, +15% retención en zona 75-85%
  L-cut / J-cut:    Producción profesional, señal de calidad alta
  Speed ramp:       Impacto emocional en momentos clave, +15-20% engagement
  Hard cut + sfx:   TikTok nativo, máxima energía

Si el ritmo medido NO está en el rango óptimo del nicho: factor CRÍTICO.
Mencionarlo en phaseScores.edicion con consecuencia medible.
` : '';

  const viralBible = `
══════════════════════════════════════════════════════════════
🧠  LA BIBLIA DE PREDICCIÓN VIRAL — REDXAX ENGINE v3
══════════════════════════════════════════════════════════════

━━━ MÓDULO 1: NEUROCIENCIA DEL SCROLL (13 milisegundos) ━━━

El cerebro tarda 13ms en decidir si sigue viendo o scrollea.
Los 3 únicos disparadores que detienen el scroll:
  1. CARA CON EMOCIÓN EXTREMA → neuronas espejo → identificación instantánea
  2. MOVIMIENTO INESPERADO   → respuesta de orientación del sistema reptiliano
  3. TEXTO CON DISONANCIA    → cerebro NECESITA resolver la contradicción

Si Frame 0 no tiene NINGUNO de estos tres: CTR baja 30-50%.

Jerarquía de emociones por CTR (de más a menos efectivas):
  Asombro > Humor > Miedo/Sorpresa > Indignación > Satisfacción > Neutral

━━━ MÓDULO 2: EL ALGORITMO POR DENTRO (Cómo distribuye realmente) ━━━

TIKTOK — Embudo de distribución por lotes:
  Lote 1: ~300 usuarios  → si CR >70% → pasa al lote 2
  Lote 2: ~3.000         → si CR >65% + velocidad de comentarios → lote 3
  Lote 3: ~30.000        → si mantiene métricas → viral real
  Lote 4+: escala libre

  SEÑALES EN ORDEN DE IMPORTANCIA:
  1. Completion Rate (>70% activa distribución máxima)
  2. Re-watch / loop rate (señal más subestimada — indica valor)
  3. Comentarios en primeros 30 minutos (velocidad, no volumen)
  4. Shares a DM (señal de valor privado = alta calidad)
  5. "No me interesa" clicks (penalización inmediata y severa)
  6. Duet/Stitch invitations (amplificación orgánica)
  7. Trending sound match (distribución extra del propio sonido)

  REGLA DE ORO TIKTOK: La PRIMERA HORA define si entra al embudo o muere.

INSTAGRAM REELS — Motor de distribución:
  SEÑALES EN ORDEN DE IMPORTANCIA:
  1. SAVE RATE >3% = modo distribución activado (señal #1 del algoritmo)
  2. Share to Stories = multiplicador orgánico más potente después del save
  3. Cover frame CTR en Explore (el primer frame visible, no el video)
  4. Watch time % total
  5. Comments con preguntas o debate (calidad > cantidad)
  6. Hashtags relevantes (importan más que en TikTok: 3-5 específicos)
  PENALIZACIÓN: >30% de usuarios que skipan antes de 3s = reducción de distribución

YOUTUBE SHORTS — Ciclo de distribución:
  SEÑALES EN ORDEN DE IMPORTANCIA:
  1. CTR (thumbnail+título): >8% = viral / 4-8% = normal / <2% = muerto
  2. Average View Duration % (no solo absoluto)
  3. Subscriber conversion rate (señal de calidad del creador para YouTube)
  4. Comment rate (YouTube valora conversación más que TikTok)
  5. Dislike rate (oculto para usuarios pero medido por el algoritmo)
  REGLA SHORTS: Los primeros 2 segundos definen el CTR desde el feed.
  REGLA SHORTS 2: Duración óptima 45-58s en la mayoría de nichos.

━━━ MÓDULO 3: FRAMEWORK STEPPS — La Ciencia de Por Qué la Gente Comparte ━━━
(Jonah Berger, Wharton School — basado en análisis de 10.000+ contenidos virales)

Los 6 factores que predicen si un contenido se COMPARTE:

S — SOCIAL CURRENCY (Moneda Social) [0-10]
  → ¿Compartir esto hace que el usuario parezca inteligente/cool/informado?
  → Formatos con alto SC: "Lo que nadie sabe sobre...", datos exclusivos, hacks
  → Si SC < 5: el video no le da a nadie razón para compartirlo a su nombre

T — TRIGGERS (Disparadores Mentales) [0-10]
  → ¿Hay algo en el video que la gente encontrará en su vida diaria y recordará?
  → "Cada vez que veo X, me acuerdo de este video"
  → Nichos con triggers naturales: comida, gym, trabajo, relaciones, dinero

E — EMOTION (Emoción de Alta Activación) [0-10]
  → Emociones que SÍ activan sharing: Asombro, Humor, Miedo, Indignación, Admiración
  → Emociones que NO activan sharing: Tristeza tranquila, Contentamiento, Aburrimiento
  → REGLA: Sin emoción intensa → sin sharing. No hay excepciones.

P — PUBLIC (Visibilidad Social) [0-10]
  → ¿El contenido es observable/visible públicamente?
  → Trends, challenges, formatos reconocibles = alta visibilidad pública
  → Si alguien lo comparte, ¿otros también lo ven compartir?

P — PRACTICAL VALUE (Valor Práctico) [0-10]
  → ¿Soluciona un problema real? ¿Se puede USAR esta información hoy?
  → "Tips", "hacks", "cómo hacer X" → guardan Y comparten
  → PREDICTOR DIRECTO del save rate en Reels

S — STORIES (Narrativa con Arco) [0-10]
  → ¿Hay una historia con inicio, nudo y desenlace?
  → "Yo también haría eso" → identificación → share orgánico
  → Arco más poderoso: Problema → Lucha → Transformación inesperada

VIRAL COEFFICIENT = promedio de los 6 scores:
  >7.5 = Potencial viral real (distribución orgánica masiva)
  5-7.5 = Buen alcance orgánico (nicho específico o mid-tier)
  <5    = Alcance limitado (necesita amplificación pagada o remake)

━━━ MÓDULO 4: LOS 7 DISPARADORES PSICOLÓGICOS DE SHARING ━━━

1. ASOMBRO:    "No sabía que esto era posible" → comparte para incluir a otros
   Requiere: estadística sorprendente, habilidad extrema, resultado imposible

2. HUMOR:      Dopamina + oxitocina simultáneamente → el más poderoso
   Tipo que más se comparte: reconocimiento de situación propia ("jaja soy yo")

3. INDIGNACIÓN: Activa sharing para VALIDAR la indignación colectiva
   Peligroso: polariza. Efectivo si el nicho lo soporta.

4. CURIOSITY GAP: Cerebro NECESITA cerrar el loop abierto
   Clave: NUNCA revelar en el hook lo que pasa. Solo insinuar.
   "Hice X y pasó algo que no esperaba" → retención hasta el frame final

5. IDENTIDAD:  "Esto me representa al 100%" → se convierte en extensión del yo
   "Muéstrame este video a alguien que X" → viral en nicho específico

6. MIEDO/URGENCIA: FOMO, amenaza a seguridad personal o financiera
   Alta efectividad pero requiere credibilidad establecida

7. ADMIRACIÓN: "Quiero ser eso" / "Quisiera poder hacer eso"
   Funciona en: lifestyle, fitness, finanzas, arte, habilidades extremas

━━━ MÓDULO 5: ANATOMÍA DEL HOOK PERFECTO ━━━

LOS 6 PATRONES DE HOOK MÁS VIRALES (verificados con millones de videos):
  1. CONTRAINTUITIVO:       "El error que hace el 90% de [audiencia]..."
  2. REVELACIÓN:            "Lo que nadie te dijo sobre [tema]"
  3. URGENCIA IDENTITARIA:  "Si tenés [X característica], necesitás ver esto"
  4. CURIOSITY GAP:         "Hice [acción extrema] y pasó [resultado inesperado]"
  5. CONFLICTO:             "Por qué [autoridad/norma] está equivocada"
  6. TRANSFORMACIÓN:        Mostrar el RESULTADO primero, luego el proceso

FRAME 0 — El análisis más crítico de todos:
  → Cara presente:       SÍ = +30-40% CTR | NO = necesita compensar con texto+movimiento
  → Emoción de la cara:  Asombro > Humor > Indignación > Sorpresa > Neutral
  → Texto on-screen:     SÍ = +15-25% retención en primeros 3s
  → Contraste visual:    Alto = +20% stop rate
  → Elemento en movimiento: SÍ = +15% CTR
  → Fondo simple/limpio: Mejor enfoque en el sujeto principal

━━━ MÓDULO 6: EL ARCO EMOCIONAL ÓPTIMO ━━━

CURVA DE RETENCIÓN REAL (basada en datos de plataformas 2024-2026):
  0-3s:    EMOCIÓN PICO inicial (para el scroll)
  3-8s:    MICRO-PROMESA explícita (¿por qué vale la pena seguir?)
  8-30%:   SETUP — contexto, credibilidad, tensión inicial
  30-70%:  DESARROLLO con MICRO-REWARDS cada 5-8 segundos
  70-80%:  PICO MÁXIMO del contenido (no al final — ahí ya perdiste gente)
  80-95%:  Resolución, escalada final o giro inesperado
  95-100%: LOOP TRIGGER o CTA de alta conversión

TIPOS DE ARCO:
  Ascendente:    Tensión creciente → climax al 75% → resolución
  Montaña rusa:  Picos y valles cada 10-15s (contenido de alta energía)
  Explosivo:     Hook enorme → desarrollo más tranquilo (tutorial, educación)
  Plano:         Señal de bajo engagement — riesgo alto

PATTERN INTERRUPTS requeridos por nicho (para evitar caída de retención):
  Entertainment/Humor:  Cada 1.5-2.5s
  Educational:          Cada 5-8s (nuevo dato o cambio visual)
  Lifestyle/Vlog:       Cada 3-5s
  ASMR/Mindfulness:     Cada 10-15s (lento intencional)

━━━ MÓDULO 7: ANÁLISIS DE AUDIO (inferencia desde visual) ━━━

Aunque no podés escuchar el audio, inferí desde los frames:
  → Boca en movimiento activo = contenido voice-led (voz como gancho)
  → Expresiones faciales intensas = música con alta energía o silencio dramático
  → Sincronización visual con beats = cortes, zooms o flashes en momentos rítmicos
  → Ritmo de cortes rápido = BPM alto (>120 BPM probable)
  → Subtítulos visibles = producción pensada para mute viewing (+engagement)

Impacto real del audio:
  → Silencio en primeros 0.5s: -25-40% audiencia (personas con volumen)
  → Trending sound activo: distribución extra en TikTok (el algoritmo lo premia)
  → Voz clara sobre música: factor de credibilidad #1
  → Sound effects en cortes: señal de producción profesional

━━━ MÓDULO 8: INVESTIGACIÓN COMPETITIVA OBLIGATORIA ━━━

BÚSQUEDA — PASO 0 (antes de cualquier análisis):
Buscá en Google los 3 videos más virales de este nicho en ${platformNames[platform]} en los últimos 30 días.
Para cada uno, respondete:
  1. ¿Qué tiene su Frame 0 que este video NO tiene?
  2. ¿Cuál de los 6 patrones de hook usa?
  3. ¿Qué señal del algoritmo está activando principalmente?
  4. ¿Cuál es su STEPPS score estimado vs. este video?
  5. ¿Hay un gap de formato (trending format que este video no usa)?

CALIBRÁ el score de forma RELATIVA a esos benchmarks, no en abstracto.
Un 65% en un nicho con videos de 90% es mucho peor que un 65% en un nicho con videos de 45%.
══════════════════════════════════════════════════════════════
`;

  const frameAnalysisProtocol = mode === 'video' ? `
PROTOCOLO DE ANÁLISIS FRAME POR FRAME:

FRAME 0 (ANÁLISIS PRIORITARIO — MÁS IMPORTANTE):
  → ¿Cara visible? → ¿Qué emoción específica? → ¿Intensidad 1-10?
  → ¿Texto on-screen? → ¿Es legible? → ¿Crea curiosidad o confirma algo?
  → ¿Contraste visual alto, medio o bajo?
  → ¿Hay elemento en movimiento o es estático?
  → Puntuación scroll-stop: 0-100 (siendo 100 "para el scroll garantizado")

FRAMES 0-3s (VENTANA DEL HOOK):
  → ¿Cuántos pattern interrupts hay?
  → ¿La promesa es específica o vaga?
  → ¿Hay texto on-screen en al menos uno de estos frames?
  → ¿Hay una cara con emoción intensa en los primeros 1.5s?

FRAMES DEL CUERPO (3s hasta 80% del video):
  → ¿El arco emocional asciende, baja o es plano?
  → ¿Hay micro-rewards visibles cada 5-8 frames?
  → ¿En qué punto (% del video) parece estar el pico de contenido?
  → ¿Hay momentos donde claramente la retención caería? ¿Por qué?

FRAMES FINALES (80-100%):
  → ¿El final invita al re-watch o crea un loop?
  → ¿Hay un CTA visual o textual?
  → ¿El último frame tiene potencial como thumbnail si alguien para el video ahí?
` : `
PROTOCOLO DE ANÁLISIS DE GUION:
  → ¿El primer párrafo usa alguno de los 6 patrones de hook?
  → ¿Hay una promesa clara en las primeras 15 palabras?
  → ¿El arco narrativo sigue la curva óptima de retención?
  → ¿Hay micro-rewards textuales cada 5-8 segundos de lectura/audio?
`;

  const jsonSchema = `
Devolvé ÚNICAMENTE este JSON sin texto extra, sin markdown, sin comentarios:
{
  "potentialScore": <NUMBER 0-100>,
  "performanceScenario": "<MAX 8 WORDS — qué le va a pasar a este video>",
  "honestVerdict": "<450-600 chars — brutalmente honesto, específico, con segundos exactos donde aplique>",
  "trendContext": "<150-200 chars — comparación real con el top viral actual del nicho>",

  "scrollStopScore": {
    "score": <0-100>,
    "faceDetected": <true|false>,
    "emotionVisible": "<emoción exacta detectada o 'ninguna'>",
    "emotionIntensity": <1-10>,
    "textOnScreen": <true|false>,
    "contrastLevel": "<bajo|medio|alto>",
    "dynamicElement": <true|false>,
    "verdict": "<MAX 15 WORDS — por qué para o no para el scroll>"
  },

  "hookDNA": {
    "pattern": "<contraintuitivo|revelacion|urgenciaIdentitaria|curiosityGap|conflicto|transformacion|ninguno>",
    "strength": <0-100>,
    "missingElement": "<qué le falta al hook, max 80 chars>",
    "optimizedHook": "<hook reescrito en MAX 15 palabras — concreto para ESTE video específico>"
  },

  "phaseScores": {
    "hook":        { "score": <0-100>, "label": "Hook & Primeros 3s",    "verdict": "<MAX 12 WORDS>", "consequence": "<80-120 chars si score<55, sino null>" },
    "estructura":  { "score": <0-100>, "label": "Estructura & Narrativa", "verdict": "<MAX 12 WORDS>", "consequence": "<80-120 chars si score<55, sino null>" }${mode === 'video' ? `,
    "edicion":     { "score": <0-100>, "label": "Ritmo & Energía",        "verdict": "<MAX 12 WORDS>", "consequence": "<80-120 chars si score<55, sino null>" }` : ''},
    "credibilidad":{ "score": <0-100>, "label": "Autenticidad & Nicho",  "verdict": "<MAX 12 WORDS>", "consequence": "<80-120 chars si score<55, sino null>" }
  },

  "platformScores": {
    "tiktok":  { "score": <0-100>, "verdict": "<MAX 10 WORDS>", "topTip": "<acción concreta>", "primaryAlgorithmTrigger": "<completion|loop|comment|share|duet>", "triggerStrength": <0-100> },
    "reels":   { "score": <0-100>, "verdict": "<MAX 10 WORDS>", "topTip": "<acción concreta>", "primaryAlgorithmTrigger": "<save|shareStory|explore|DM>",         "triggerStrength": <0-100> },
    "shorts":  { "score": <0-100>, "verdict": "<MAX 10 WORDS>", "topTip": "<acción concreta>", "primaryAlgorithmTrigger": "<CTR|retention|subConversion|comment>", "triggerStrength": <0-100> }
  },

  "steppsScore": {
    "socialCurrency":   <0-10>,
    "triggers":         <0-10>,
    "emotion":          <0-10>,
    "public":           <0-10>,
    "practicalValue":   <0-10>,
    "stories":          <0-10>,
    "viralCoefficient": <decimal 0.0-10.0>,
    "dominantFactor":   "<el factor STEPPS más fuerte con una frase de por qué>",
    "weakestFactor":    "<el factor STEPPS más débil con qué cambiar>",
    "shareMotivation":  "<identidad|utilidad|entretenimiento|indignacion|admiracion>"
  },

  "emotionalArc": {
    "opening":    "<emoción dominante en primeros 3s>",
    "middle":     "<emoción dominante en el desarrollo>",
    "closing":    "<emoción dominante al final>",
    "peakMoment": "<segundo XX — descripción del momento de mayor impacto emocional>",
    "arcRating":  <0-100>,
    "arcType":    "<ascendente|montanaRusa|explosivo|plano|descendente>"
  },

  "commentTrigger": {
    "probability": <0-100>,
    "triggerType": "<debate|pregunta|identificacion|indignacion|humor|ninguno>",
    "suggestedCTA": "<primer comentario del creador que debería hacer en el post, max 70 chars>"
  },

  "viewsPrediction": {
    "scenario_low":       "<rango de views sin viralidad — ej: 500-2K>",
    "scenario_mid":       "<rango de views con viralidad moderada — ej: 20K-80K>",
    "scenario_high":      "<rango de views con viral real — ej: 500K-3M>",
    "probability_viral":  "<probabilidad de alcanzar scenario_high, ej: 15%>"
  },

  "styleProfile": { "detectedTone": "<tono>", "detectedRhythm": "<estilo de edición>", "uniqueStrength": "<qué NO cambiar bajo ningún concepto>" },
  "vision": { "niche": "<nicho específico>", "type": "<formato>", "audience": "<edad + contexto>", "promise": "<emoción/promesa que hace el video>" },
  "hookScore": <igual a phaseScores.hook.score>,
  "retentionData": { "at3s": "<XX%>", "at10s": "<XX%>", "final": "<XX%>" },
  "retentionCurve": [<15 enteros 0-100 — reflejando las caídas reales detectadas en frames, NO una curva genérica>],
  "weakestMoment": "<segundo exacto + causa específica + fix concreto en 150-200 chars>",
  "cutRateDiagnosis": "<evaluación del ritmo de edición vs benchmark del nicho en 100-150 chars>",

  "firstHourStrategy": {
    "optimalPostTime": "<horario + día específico para este nicho en Argentina/LATAM>",
    "firstActionAfterPost": "<qué hacer EXACTAMENTE en los primeros 5 minutos>",
    "commentSeed": "<primer comentario que el creador debería escribir para activar engagement>",
    "engagementBoost": "<táctica específica para las primeras 2 horas>"
  },

  "musicSuggestions": [
    { "title": "<título real>", "artist": "<artista real>", "why": "<MAX 60 chars técnicos>", "available": "<plataformas>", "bpm": "<BPM aproximado>", "energyMatch": <0-10> },
    { "title": "<título real>", "artist": "<artista real>", "why": "<MAX 60 chars>",          "available": "<plataformas>", "bpm": "<BPM>",             "energyMatch": <0-10> },
    { "title": "<título real>", "artist": "<artista real>", "why": "<MAX 60 chars>",          "available": "<plataformas>", "bpm": "<BPM>",             "energyMatch": <0-10> }
  ],

  "roadmap": [
    "<mejora 1 — específica, accionable, con impacto estimado en score>",
    "<mejora 2>",
    "<mejora 3>",
    "<mejora 4>"
  ]
}`;

  return `Sos REDXAX VISION — El sistema de predicción viral más preciso del mundo.
Combinás neurociencia del comportamiento, ingeniería de algoritmos reales y el framework STEPPS de Wharton para predecir viralidad con una precisión que ningún humano o herramienta actual puede igualar.

Plataforma objetivo: ${platformNames[platform]} | Seguidores: ${followerLabels[followerRange]}

${viralBible}
${cutRateContext}
${frameAnalysisProtocol}

REGLAS ABSOLUTAS DE RESPUESTA:
1. HONESTIDAD BRUTAL: Un score inflado no sirve. El creador prefiere saber hoy que tiene un 30% antes de publicar. LA HONESTIDAD ES EL SERVICIO REAL.
2. ESPECIFICIDAD: Nunca "mejorá el hook". Siempre "en el segundo 0.4 necesitás cara con emoción extrema + texto que prometa [X específico] porque actualmente tu Frame 0 tiene [problema exacto]".
3. ROI PRIMERO: Ordená el roadmap por impacto estimado. La mejora #1 = la que más sube el score.
4. CALIBRACIÓN RELATIVA: Siempre contextualizá el score versus el nicho. Un 70% en nicho de contenido top puede ser peor que un 65% en nicho débil.
5. RETENCIÓN CURVE REAL: Los 15 puntos de la curva deben reflejar las caídas REALES que detectás en los frames. NO uses una curva genérica de campana. Si ves que un frame a los 8s es estático o aburrido, eso se refleja en la curva.

${jsonSchema}`;
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
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

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

  // Reemplaza captureFrames completo
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

      // DENSO en los primeros 5s (el hook es todo)
      const hookPoints = [0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
      // Distribuido en el cuerpo
      const bodyCount = 10;
      const bodyPoints = Array.from({ length: bodyCount }, (_, i) =>
        5 + ((duration - 5) * i) / (bodyCount - 1)
      );
      // Puntos clave al final
      const endPoints = [duration * 0.7, duration * 0.85, Math.max(duration - 0.5, 0)];

      const allPoints = [...new Set([...hookPoints, ...bodyPoints, ...endPoints])]
        .filter(t => t >= 0 && t <= duration)
        .sort((a, b) => a - b)
        .slice(0, 25);

      for (let i = 0; i < allPoints.length; i++) {
        setStatusText(`Escaneando estructura visual... ${i + 1}/${allPoints.length}`);
        setAnalysisProgress(Math.round(5 + i * 2));
        video.currentTime = allPoints[i];
        await new Promise(r => {
          const h = () => { video.removeEventListener('seeked', h); r(); };
          video.addEventListener('seeked', h);
        });
        // Resolución reducida para velocidad, suficiente para análisis visual
        canvas.width = Math.min(video.videoWidth, 480);
        canvas.height = Math.min(video.videoHeight, 854);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push({
          base64: canvas.toDataURL('image/jpeg', 0.45).split(',')[1],
          timestamp: allPoints[i].toFixed(1),
          isHook: allPoints[i] <= 5
        });
      }
      resolve(frames);
    };
  });
};

const detectCutRate = async (url) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const canvas = document.createElement('canvas');
      canvas.width = 80; canvas.height = 45;
      const ctx = canvas.getContext('2d');
      
      let cuts = 0;
      let prevData = null;
      let cutTimestamps = [];  // NUEVO: guardar cuándo ocurren los cortes
      let maxDiffFrame = 0;
      const step = 0.2; // más preciso: cada 200ms en vez de 250ms
      const maxSamples = Math.min(Math.floor(duration / step), 150);

      for (let i = 0; i < maxSamples; i++) {
        video.currentTime = i * step;
        await new Promise(r => {
          const h = () => { video.removeEventListener('seeked', h); r(); };
          video.addEventListener('seeked', h);
        });
        ctx.drawImage(video, 0, 0, 80, 45);
        const data = ctx.getImageData(0, 0, 80, 45).data;
        
        if (prevData) {
          let diff = 0;
          for (let j = 0; j < data.length; j += 4) {
            diff += Math.abs(data[j] - prevData[j]) +
                    Math.abs(data[j+1] - prevData[j+1]) +
                    Math.abs(data[j+2] - prevData[j+2]);
          }
          const avgDiff = diff / (80 * 45 * 3);
          if (avgDiff > maxDiffFrame) maxDiffFrame = avgDiff;
          if (avgDiff > 35) {
            cuts++;
            cutTimestamps.push(parseFloat((i * step).toFixed(1)));
          }
        }
        prevData = new Uint8ClampedArray(data);
      }

      // NUEVO: calcular varianza de los intervalos entre cortes
      // Alta varianza = ritmo irregular. Baja varianza = ritmo constante
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
        cutTimestamps: cutTimestamps.slice(0, 20), // los primeros 20 cortes
        rhythmVariance: parseFloat(rhythmVariance.toFixed(2)),
        rhythmType: rhythmVariance < 0.5 ? 'constante' : rhythmVariance < 1.5 ? 'variable' : 'errático',
        hookCuts: cutTimestamps.filter(t => t <= 5).length // cortes en el hook
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
  }
};

  const runNeuralAnalysis = async (url, platform, followerRange) => {
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
  setStatusText("Detectando ritmo de edición...");
  setAnalysisProgress(8);   // lg:col-span-8

  try {
    // NUEVO: detectar cut rate en paralelo con extracción de frames
    const [cutData, frameData] = await Promise.all([
      detectCutRate(url),
      captureFrames(url)
    ]);

    const videoMetadata = {
      cutsPerMinute: cutData.cutsPerMinute,
      duration: cutData.duration
    };

    setAnalysisProgress(55);
    setStatusText("Analizando con ciencia viral real...");

    const analysisPrompt = buildSystemInstructions(platform, followerRange, 'video', videoMetadata);

    // LLAMADA 1: Análisis principal (frames + cut rate + benchmarks)
    const { data: analysisData, error: analysisError } = await supabase.functions.invoke('gemini-proxy', {
  body: {
    text: analysisPrompt
      + '\n\nMETADATOS TÉCNICOS MEDIDOS:'
      + '\n- Cortes/minuto: ' + cutData.cutsPerMinute + ' cpm'
      + '\n- Duración: ' + cutData.duration + 's'
      + '\n- Tipo de ritmo: ' + cutData.rhythmType + ' (varianza: ' + cutData.rhythmVariance + ')'
      + '\n- Cortes en el hook (0-5s): ' + cutData.hookCuts + ' cortes'
      + '\n- Timestamps de cortes: ' + (cutData.cutTimestamps?.slice(0,10).join('s, ') || 'N/A') + 's'
      + '\n- Frames capturados: ' + frameData.length + ' (' + frameData.filter(f => f.isHook).length + ' son del hook 0-5s)'
      + '\n\nAnalizá los ' + frameData.length + ' frames con el protocolo de análisis frame por frame.',
    frames: frameData.map(f => f.base64)
  }
});
if (analysisError) throw analysisError;

    const rawAnalysis = extractGeminiText(analysisData);
    const parsed = safeParseJSON(rawAnalysis, 'runNeuralAnalysis-main');

    setAnalysisProgress(72);
    setStatusText("Buscando los 3 videos más virales de tu nicho...");

    // LLAMADA 2: Benchmarking competitivo (nueva)
    const benchmarkPrompt = `Sos un analista de contenido viral especializado en ${platform}.

CONTEXTO:
- Nicho analizado: ${parsed.vision?.niche || 'General'}
- Score preliminar: ${parsed.potentialScore}%
- Tono: ${parsed.styleProfile?.detectedTone}
- Plataforma: ${platform}

TAREA DE INVESTIGACIÓN:
Buscá en Google los 3 videos con más views de "${parsed.vision?.niche}" en ${platform} publicados en los últimos 30 días.
Para cada uno, extraé: título o descripción, views aproximados, y por qué funcionó.

Luego comparalo con este video y respondé:
1. ¿Está este video a nivel de esos benchmarks, por debajo, o por encima?
2. ¿Qué tiene el video más viral que este NO tiene?
3. ¿Cuál es el gap específico más importante a cerrar?

Devolvé ÚNICAMENTE este JSON:
{
  "competitiveBenchmark": {
    "topVideos": [
      { "description": "<qué es>", "approxViews": "<XM views>", "whyViral": "<razón específica>" },
      { "description": "<qué es>", "approxViews": "<XM views>", "whyViral": "<razón específica>" },
      { "description": "<qué es>", "approxViews": "<XM views>", "whyViral": "<razón específica>" }
    ],
    "gapAnalysis": "<qué separa este video del top, 150-200 chars>",
    "positionVsTop": "<por encima | a nivel | por debajo>",
    "criticalDifference": "<la diferencia #1 más importante, max 120 chars>"
  }
}`;

    const { data: benchmarkData } = await supabase.functions.invoke('gemini-proxy', {
      body: { text: benchmarkPrompt }
    });

    setAnalysisProgress(85);
    setStatusText("Buscando música viral para tu nicho...");

    // LLAMADA 3: Música (ya existente, sin cambios)
    const musicPrompt = `Sos un experto en música viral para redes sociales en 2025-2026.
Nicho: ${parsed.vision?.niche} | Tono: ${parsed.styleProfile?.detectedTone} | Ritmo: ${parsed.styleProfile?.detectedRhythm} | Plataforma: ${platform}
Buscá canciones REALMENTE usadas HOY en videos de "${parsed.vision?.niche}" en ${platform}.
Devolvé ÚNICAMENTE:
{ "musicSuggestions": [
  { "title": "<título>", "artist": "<artista>", "why": "<max 60 chars>", "available": "<plataformas>" },
  { "title": "<título>", "artist": "<artista>", "why": "<max 60 chars>", "available": "<plataformas>" },
  { "title": "<título>", "artist": "<artista>", "why": "<max 60 chars>", "available": "<plataformas>" }
]}`;

    const { data: musicData } = await supabase.functions.invoke('gemini-proxy', {
      body: { text: musicPrompt }
    });

    // Merge de resultados
    let finalResult = { ...parsed, cutRateData: cutData };
    if (benchmarkData) {
      try {
        const bm = safeParseJSON(extractGeminiText(benchmarkData), 'benchmark');
        if (bm?.competitiveBenchmark) finalResult.competitiveBenchmark = bm.competitiveBenchmark;
      } catch (e) { console.warn('Benchmark parse failed:', e); }
    }
    if (musicData) {
      try {
        const mu = safeParseJSON(extractGeminiText(musicData), 'music');
        if (mu?.musicSuggestions?.length > 0) finalResult.musicSuggestions = mu.musicSuggestions;
      } catch (e) { console.warn('Music parse failed:', e); }
    }

    setAiResult(finalResult);
    setCompletedSteps([]);
    setChatMessages([{
      role: 'bot',
      text: `Análisis completado. Score: ${finalResult.potentialScore}% | Ritmo: ${cutData.cutsPerMinute} cpm | Comparado contra top 3 viral del nicho. ¿Querés profundizar en algo específico?`
    }]);

    setAnalysisProgress(100);   //METADATOS
    await saveAnalysisToHistory(finalResult, 'video');

    // Guardar en tabla de tracking para calibración futura
    await trackPrediction(finalResult);

    setTimeout(() => setStep('results'), 500);

  } catch (err) {
    console.error('Error análisis:', err);
    alert('Error en el análisis. Revisá la consola.');
    setStep('upload');
  }
};

  // ==========================================
  // 2. TU FUNCIÓN (Justo en el medio)
  // ==========================================
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
  };  //platform_select  //{/* Tarjetas de fases */}
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
              runNeuralAnalysis(pendingVideoUrl, selectedPlatform, selectedFollowerRange);
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
  </ShinyCard>
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
        </ShinyCard>
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