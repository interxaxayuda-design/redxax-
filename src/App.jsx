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
import { useEffect, useRef, useState } from 'react';
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


// ============================================================
// VIEWER BRAIN
// ============================================================
const buildViewerBrainPrompt = (platform, nicho) => {
  const pName = { tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts' }[platform];
  const criterios = (NICHE_CRITERIA[nicho] || NICHE_CRITERIA['otro']).map((c, i) => `${i + 1}. ${c}`).join('\n');

  return `
════════════════════════════════════════
MODELO MENTAL — LEER ANTES DE ANALIZAR CUALQUIER COSA
════════════════════════════════════════
Sos un cerebro biológico en modo scroll. Llevás 20 minutos en ${pName}.
Ya viste 60 videos. Estás medio dormido. Tu cerebro no evalúa, reacciona.
Tiene 0.3 segundos para decidir si para o sigue.

LOS DOS ÚNICOS GATEKEEPERS QUE IMPORTAN, EN ORDEN:

GATEKEEPER 1 — FORMATO:
¿Es un video real con movimiento y cortes, o son imágenes quietas?
→ Video real con cortes cada 1-3s + movimiento real = formato competitivo. No hay problema aquí.
→ Imágenes estáticas una tras otra, aunque tengan transición = slideshow. Formato incompatible.
→ Video real PERO el producto/servicio es interrumpido, mostrado de costado o aparece tarde = problema de presentación.

GATEKEEPER 2 — HOOK:
¿El primer segundo dispara algo en el cerebro que obligue a quedarse?
→ El hook no es "mostrar el producto rápido". Es crear una pregunta en el cerebro del espectador
   que solo se puede responder quedándose a mirar.
→ 8 imágenes de un resultado odontológico, aunque sean buenas imágenes, no son un hook.
   Son información. El cerebro en scroll no busca información, busca estímulos.
→ Un video que abre con algo que genera "¿qué es eso?", "¿cómo lo hizo?", "¿eso es real?"
   tiene hook. Uno que abre con el producto ya explicado, no.

JERARQUÍA IRROMPIBLE:
1° ¿El formato es un video real con cortes y movimiento? → si NO: slideshow, penalizar.
2° ¿El hook crea curiosidad o deseo en los primeros 3 segundos? → si NO: la gente se va, todo lo demás es irrelevante.
3° ¿El producto/servicio se presenta de forma rápida, directa, sin interrupciones? → si NO: problema de presentación.
4° Recién entonces: ¿el contenido (resultado, credibilidad, transformación) es bueno?

REGLA: Un resultado médico real, impresionante y verificable presentado en 8 imágenes quietas
sin hook = un buen resultado que casi nadie ve. El score debe reflejar eso.
════════════════════════════════════════

FASE 1 — REACCIÓN CRUDA + DIAGNÓSTICO DE HOOK (primeros 3s)

PARTE A — REACCIÓN INSTINTIVA:
Sos usuario en ${pName}, sueño, atención cero.
- ¿El pulgar se frenó o siguió? ¿Por qué exactamente?
- ¿Qué sentiste en el primer segundo: curiosidad / indiferencia / deseo / confusión / sorpresa / nada?
- ¿El primer frame genera una pregunta en tu cabeza que solo se responde mirando? SÍ/NO + cuál pregunta
Máx 3 oraciones. Solo reacción instintiva, sin analizar.

PARTE B — DIAGNÓSTICO DE HOOK (primeros 3s):
Respondé con datos concretos, sin adjetivos:
- ¿Cuántos cortes hubo en los primeros 3 segundos? → número exacto
- ¿Hay movimiento real de persona, producto o cámara? → describir qué se mueve exactamente
- ¿El primer frame tiene algo que cambia o impacta en <1s? → SÍ/NO + qué es
- ¿Hay sonido/música con energía desde el segundo 0? → SÍ/NO
- ¿El hook crea una pregunta implícita en el cerebro, o solo muestra información? → PREGUNTA / INFORMACIÓN

DISTINCIÓN CRÍTICA — HOOK vs APERTURA INFORMATIVA:
Hook real: el primer segundo genera una pregunta que obliga a quedarse para responderla.
  Ejemplos: cara de sorpresa sin contexto / resultado impactante antes de mostrar qué lo causó /
  texto "nadie te cuenta esto" / sonido extraño / acción a medio completar / dato que desafía creencia.
Apertura informativa: el primer segundo muestra el producto o servicio directamente.
  Ejemplos: logo del negocio / foto del resultado ya terminado / "somos la clínica X" / producto en caja.
  Esto no es un hook. Es un aviso. El cerebro en scroll no para para ver avisos.

CLASIFICACIÓN DEL HOOK:
→ EXPLOSIVO: genera pregunta implícita clara + movimiento real + audio desde s0 + 2+ cortes en 3s
→ DÉBIL: muestra algo interesante pero no crea pregunta / tiene movimiento pero sin tensión narrativa
→ MUERTO: abre con información directa sin tensión / imagen quieta / logo / resultado ya terminado sin contexto

→ Clasificar: EXPLOSIVO / DÉBIL / MUERTO + justificación en 1 línea concreta

════════════════════════════════════════
GATE DE FORMATO
(Completar ANTES del inventario)
════════════════════════════════════════
Responder SÍ/NO con criterio estricto:
1. ¿Es un video real? (persona, producto o pantalla en movimiento continuo, NO imágenes estáticas aunque tengan transición) →
2. ¿Hay audio con energía (música o voz clara) desde s0? →
3. ¿Hay al menos 1 corte real en los primeros 3s? →
4. ¿Hay algo visualmente nuevo cada ≤3s de forma sostenida? →
5. ¿El momento más impactante del video (el resultado, la transformación, el wow) aparece antes de s8? →

NOTA CRÍTICA sobre pregunta 1:
- SÍ real: persona hablando, producto funcionando, manos en acción, cámara en movimiento, pantalla grabada.
- NO cuenta: galería de fotos con transición automática, imágenes fijas aunque cambien cada 2s,
  capturas de pantalla sin movimiento, zoom lento en foto quieta.

CLASIFICACIÓN:
→ 5 SÍ: FORMATO COMPETITIVO — el video puede competir en el feed. No aplicar penalizaciones de formato.
→ 3-4 SÍ: FORMATO DÉBIL — tiene problemas pero no es slideshow. Penalización moderada.
→ 0-2 SÍ: FORMATO INCOMPATIBLE — slideshow o video sin estímulo. Penalización fuerte independientemente del contenido.
════════════════════════════════════════

FASE 2 — OBSERVACIÓN FORENSE
Rol: inspector forense. Solo hechos sensoriales. CERO adjetivos evaluativos.
✓ "música constante sin cambios de energía" | ✗ "edición simple pero efectiva"

INVENTARIO PREVIO OBLIGATORIO:
Respondé SÍ/NO + descripción literal de lo que SE VE.
Si el elemento existe pero aparece DESPUÉS del segundo estimado de abandono masivo, agregar: [TARDE - s_X].
- ¿Hay secuencia antes/después? → segundo inicio: / segundo resultado:
- ¿Se muestra resultado exitoso del paciente/cliente? → describir exactamente qué se ve
- ¿Se menciona duración del tratamiento o timeline? → transcribir literal
- ¿Hay persona real mostrando resultado? →
- ¿Testimonial verbal o escrito? → transcribir literal si existe
- ¿Se muestra el proceso paso a paso? →
- ¿Hay texto en pantalla con datos o promesas? → transcribir cada uno

REGLA: Elemento presente SIN etiqueta [TARDE] → no sugerir como mejora en fases posteriores.
Elemento presente CON etiqueta [TARDE] → sí reportar como problema de posicionamiento temporal.

A. AMBIENTE Y PRIMER FRAME
- ¿Qué objeto/persona aparece y dónde en el encuadre?
- Fondo: objetos, colores, texturas visibles.
- ¿Suciedad, manchas, deterioro, golpes? → SEÑAL DE RECHAZO VISUAL: [descripción][segundo exacto]
- ¿Persona presente? ¿Expresión? ¿Mira a cámara?
DINAMISMO: ¿Cambio visual relevante cada 2-3s? ¿Hay planos quietos sin progresión?

B. PRESENTACIÓN DEL PRODUCTO/SERVICIO
(Separado de viabilidad — esto evalúa CÓMO se muestra, no qué es el producto)
- ¿El producto/servicio aparece en los primeros 3s? SÍ/NO + en qué segundo exacto
- ¿Se presenta de forma directa y continua, o es interrumpido por otra cosa? DIRECTA / INTERRUMPIDA
- ¿Se muestra funcionando/en acción, o solo de costado/estático? EN ACCIÓN / ESTÁTICO
- ¿El video sigue mostrando el producto de principio a fin, o hay saltos a otra cosa? CONTINUO / CON SALTOS
Señal positiva: producto en acción + cortes rápidos + sin interrupciones = presentación efectiva.
Señal negativa: producto aparece tarde, mostrado de costado, o interrumpido por logos/textos largos.

C. VIABILIDAD DEL PRODUCTO
(Qué es el producto, independientemente del video)
FUERTE/ACEPTABLE/DÉBIL + 1 línea:
1. FRECUENCIA DE USO — diaria/semanal/mensual/ocasional
2. CLARIDAD INSTANTÁNEA — ¿extraño entiende qué es en 5s?
3. PROBLEMA COTIDIANO — ¿el espectador promedio lo experimenta?
4. AMPLITUD — ¿cuántos de 100 al azar lo necesitarían?
5. FRICCIÓN DE COMPRA — ¿impulso o requiere investigación?
6. FACTOR WOW — ¿algo visual que el cerebro procesa como recompensa?
7. CREDIBILIDAD DEL RESULTADO — ¿lo mostrado parece posible y verificable?
→ Si 3+ son DÉBIL: PRODUCTO DE VENTA DIFÍCIL EN REDES: [razón]

D. CRITERIOS DE NICHO
SÍ / PARCIALMENTE / NO + 1 línea con qué se ve que lo justifica:
${criterios}

E. TRANSCRIPCIÓN LITERAL OBLIGATORIA:
→ [s0] "texto exacto tal como aparece"
NO parafrasear. NO resumir. Copiar letra por letra.
Si no hay texto: "SIN TEXTO EN PANTALLA".

AUDIO:
- ¿Hay música? ¿Cambia de energía o es plana de inicio a fin?
- Volumen música vs voz: compite / debajo / no hay voz
- ¿Voz en off? ¿Claro o con ruido?

F. MOTORES DE RETENCIÓN (PRESENTE/PARCIAL/AUSENTE + 1 oración)
SATISFACCIÓN VISUAL — limpiar/transformar/antes-después/fluido/textura/proceso → acción/momento exacto
CURIOSIDAD ABIERTA — ¿pregunta implícita sin respuesta al inicio? → segundo apertura + cierre
MICRO-RECOMPENSAS — ¿algo nuevo cada 2-3s, o hay período >4s sin nada?
CONSUMIBILIDAD — ¿se entiende con audio apagado en <5s? SÍ/NO + justificación
NATURALIDAD ${pName} — ¿parece orgánico o publicidad tradicional?

G. PERSONALIDAD DEL CREADOR
- Tono: (informal/aspiracional/educativo/humorístico/directo)
- Estilo: (habla a cámara/muestra sin hablar/usa texto)
- Elementos únicos que no deben perderse
- Riesgo de personalidad: ninguno/leve/alto — 1 oración
`;
};



const buildStrategyBrainPrompt = (viewerAnalysis, platform, objetivo, nicho) => {
  const pName = { tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', all: 'TikTok/Reels/Shorts' }[platform];

  return `
Estratega experto en ventas, viralidad y psicología del consumidor.
Plataforma: ${pName} | Objetivo: ${objetivo} | Nicho: ${nicho}

REPORTE FORENSE:
${viewerAnalysis}


FILOSOFÍA BASE — LEER PRIMERO

HAY DOS PROBLEMAS DISTINTOS QUE NUNCA SE MEZCLAN:
A) El formato del video (slideshow vs video real, ritmo, cortes)
B) El hook (¿el primer segundo crea una pregunta que obliga a quedarse?)

Un video puede tener formato perfecto (cortes rápidos, movimiento real, música)
y aun así no ser viral porque el hook no crea curiosidad.
Un video puede tener resultado impresionante y buena producción
y aun así fracasar porque abre mostrando el resultado directamente, sin tensión.

EL HOOK ES EL FACTOR #1. No es "una de las categorías".
Es el gatekeeper de todo lo demás. Sin hook real → sin viralidad, punto.
"Mostrar el producto rápido con cortes" no es un hook.
Un hook es algo que genera en el cerebro del espectador una pregunta
que solo puede responder si se queda mirando.

FORMATO COMPETITIVO (esto NO es un problema, reconocerlo):
→ Video real con cortes cada 1-3s + movimiento real + producto mostrado directamente = BIEN
→ No penalizar producción simple si el formato tiene estímulo real
→ Penalizar solo si: imágenes quietas / producto mostrado de costado o tarde / interrupciones largas

REGLAS OPERATIVAS:
1. Formato competitivo + hook explosivo = puede viralizar aunque la producción sea simple.
2. Formato competitivo + hook muerto = no viraliza aunque el producto sea excelente.
3. Slideshow (imágenes quietas) = formato incompatible, siempre, sin excepción.
4. Producción cara + hook muerto = no viraliza. La producción no reemplaza al hook.
5. Resultado real impresionante + sin hook = información, no entretenimiento. El cerebro scrollea.


 STEP 1 — GATE DE FORMATO (ejecutar primero)

Basado en el reporte forense:
1. ¿Es video real con movimiento continuo (NO slideshow de imágenes)? SÍ/NO
2. ¿Audio con energía desde s0? SÍ/NO
3. ¿Corte real en primeros 3s? SÍ/NO
4. ¿Algo nuevo cada ≤3s sostenido? SÍ/NO
5. ¿El momento más fuerte aparece antes de s8? SÍ/NO

→ 5 SÍ: FORMATO COMPETITIVO. No aplicar penalizaciones de formato. Continuar con el hook.
→ 3-4 SÍ: FORMATO DÉBIL. Penalización moderada. El hook aún puede salvar el video.
→ 0-2 SÍ o pregunta 1 = NO: FORMATO INCOMPATIBLE. Penalización fuerte independientemente del contenido.

 STEP 2 — GATE DEL HOOK (el más importante)

El hook determina el techo real del viralScore. No hay excepción.

¿El primer segundo crea una pregunta en el cerebro del espectador
que solo puede responderse quedándose a mirar?

Evaluación:
- ¿Qué pregunta concreta genera el primer frame en el cerebro? → escribirla o escribir "ninguna"
- ¿Es información directa (producto mostrado, resultado ya visible) o tensión narrativa? INFORMACIÓN / TENSIÓN
- ¿El espectador sabe desde s0 de qué trata el video, o tiene que quedarse para entender? SABE / DEBE QUEDARSE

TECHO DE VIRALSCORE SEGÚN HOOK (no negociable, nada lo supera):
→ Hook EXPLOSIVO (tensión real + pregunta implícita fuerte): viralScore puede llegar hasta 90
→ Hook DÉBIL (algo interesante pero sin tensión narrativa clara): viralScore techo = 62
→ Hook MUERTO (información directa, sin pregunta, sin tensión): viralScore techo = 38

Este techo aplica aunque el formato sea perfecto, el producto sea excelente
y la producción sea profesional. El hook es el techo, no el piso.

⛔ STEP 3 — PRESENTACIÓN DEL PRODUCTO

¿El producto/servicio se muestra de forma directa, rápida y sin interrupciones?
→ Directo + rápido + sin interrupciones: SIN problema aquí
→ Mostrado de costado, a lo lejos, parcialmente: problema de presentación
→ Producto aparece tarde (después de s10 en video corto): problema
→ Video interrumpe el producto con logos, textos largos, intro del negocio: problema


ANÁLISIS DE SUPERVIVENCIA

¿En qué segundo exacto la persona promedio se va?

Estimá con este criterio:
- Hook muerto + sin audio → scroll antes de s2
- Hook muerto + con audio → scroll antes de s4
- Hook débil + formato competitivo → scroll entre s4 y s8
- Hook explosivo + formato competitivo → puede llegar al final
- Momento muerto >4s en cualquier punto → scroll en ese momento

DIAGNÓSTICO SEGUNDO A SEGUNDO:
→ s0-s3: ¿qué pasa? ¿hay hook? → ¿sobrevive? SÍ/NO + por qué
→ s3-s7: ¿qué pasa? ¿algo nuevo? → ¿sobrevive? SÍ/NO + por qué
→ s7-s15: ¿ritmo sostenido? → ¿sobrevive? SÍ/NO + por qué
→ s15-fin: ¿llega alguien? → ¿sobrevive? SÍ/NO + por qué

VEREDICTO DE SUPERVIVENCIA:
- Segundo de scroll masivo: (número)
- % que llega al final: (0-100)
- Causa principal de abandono: (1 frase simple)
- ¿El mejor momento del video aparece antes de ese segundo? SÍ/NO

MÉTRICAS DURAS:
- Cortes en primeros 3s: (número)
- Plano más largo sin nada nuevo: (duración + segundo)
- Música desde s0: SÍ/NO
- Algo nuevo cada 2-3s: SÍ/PARCIAL/NO
- Consumible sin audio en <5s: SÍ/NO

════════════════════════════════════════
CALIBRACIÓN DE SCORE (referencia para no sobre/sub-puntuar)
════════════════════════════════════════
viralScore 80-90: hook explosivo + formato competitivo + producto claro + ritmo sostenido
viralScore 65-79: hook explosivo o muy bueno + algún problema menor de ritmo o presentación
viralScore 50-64: hook débil pero formato competitivo + producto bueno + algo que retiene
viralScore 35-49: hook muerto O formato débil (no ambos) + algo rescatable
viralScore 20-34: hook muerto + formato incompatible O slideshow sin música
viralScore <20: slideshow sin música + hook muerto + sin motores de retención

salesScore sigue lógica similar pero pondera más credibilidad, resultado y CTA.
Un video puede tener viralScore 30 y salesScore 55 (llega a poca gente pero convierte bien a quien llega).
Un video puede tener viralScore 75 y salesScore 40 (viral pero no vende — falta CTA o propuesta).

AUTENTICIDAD:
- ¿Parece orgánico o publicidad reciclada?
- ¿Algo activa escepticismo?

DETECCIÓN DE TRAMPA DE VALOR:
¿El video tiene contenido valioso (resultado real, transformación, credibilidad)
PERO el hook no crea curiosidad y/o el formato es incompatible?
→ Si SÍ: flag value_trap = true.
  En veredicto: separar "el [producto/resultado] es real y valioso"
  de "el video no genera curiosidad suficiente para que la gente llegue a verlo".

¿El mejor momento del video aparece después del segundo de scroll masivo?
→ Si SÍ: flag value_behind_scroll_wall = true + recompensa_tardia = true.
  No contarlo como fortaleza. Reportarlo como debilidad de estructura.

VEREDICTO FINAL:
- Fortalezas reales (solo las que aparecen antes del scroll masivo)
- Debilidades reales
- ¿Compraría o seguiría scrolleando?
- 3 mejoras concretas (si hay value_trap: la primera mejora siempre es el hook, no el contenido)

---FLAGS--- (OBLIGATORIO. Completar exactamente. No omitir ningún campo.)
{
  "product_damage": <true si manchas/golpes/deterioro visible | false>,
  "visual_repulsion": <true si algo genera rechazo físico o desconfianza inmediata | false>,
  "visual_repulsion_severity": "<ninguna|leve|moderada|fuerte>",
  "first_frame_repulsion": <true si PRIMER FRAME dispara rechazo o indiferencia total | false>,
  "dead_moment": <true si hay período >4s sin nada nuevo | false>,
  "dead_moment_second": <segundo del momento muerto, o 0>,
  "is_static_slideshow": <true si el video es mayormente imágenes fijas — aunque tengan transición automática — sin movimiento real de persona, producto o cámara | false>,
  "no_music_and_static": <true si es slideshow estático Y no hay música o el audio es solo ambiente plano | false>,
  "hook_type": "<explosivo|débil|muerto>",
  "hook_creates_question": <true si el primer segundo genera una pregunta implícita que obliga a quedarse | false>,
  "hook_is_direct_info": <true si el video abre mostrando directamente el producto/resultado sin tensión narrativa | false>,
  "dead_hook": <true si hook_type es muerto o débil | false>,
  "product_shown_late": <true si el producto/servicio principal aparece después de s8 | false>,
  "product_shown_sideways": <true si el producto se muestra de costado, parcial o sin acción real | false>,
  "product_presentation_interrupted": <true si logos, intros o textos largos interrumpen la presentación del producto | false>,
  "static_visuals": <true si depende demasiado de imágenes quietas | false>,
  "low_visual_dynamism": <true si faltan cambios relevantes cada 2-3s | false>,
  "slow_pacing": <true si el ritmo se siente lento para Shorts/Reels/TikTok | false>,
  "overlong_shots": <true si hay planos largos sin progresión | false>,
  "weak_editing_flow": <true si la edición no sostiene avance o energía | false>,
  "insufficient_pattern_interrupts": <true si faltan cambios frecuentes visuales/narrativos/sonoros | false>,
  "audio_issue": <true si el audio molesta o compite con la voz dañando atención | false>,
  "boring_full_video": <true si el video es aburrido de principio a fin | false>,
  "flat_energy": <true si la energía del video es constante sin picos ni escalada emocional | false>,
  "no_retention_engines": <true si satisfacción visual + curiosidad abierta + consumibilidad ausentes | false>,
  "product_unclear": <true si un extraño no entendería qué es en 5s | false>,
  "product_difficult_to_sell": <true si análisis de viabilidad detectó 3+ factores DÉBIL | false>,
  "format_incompatible": <true si 0-2 SÍ en gate de formato O pregunta 1 del gate es NO (slideshow) | false>,
  "format_weak": <true si 3-4 SÍ en gate de formato | false>,
  "value_behind_scroll_wall": <true si el mejor momento del video aparece después del segundo de scroll masivo | false>,
  "value_trap": <true si hay contenido valioso pero el hook no crea curiosidad y/o el formato no retiene — la gente no llega a verlo | false>,
  "recompensa_tardia": <true si la transformación o resultado fuerte aparece en segunda mitad Y scroll masivo ocurre antes | false>,
  "buried_result": <true si el resultado más fuerte está después de s15 y scroll masivo ocurre antes de s10 | false>
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
    return 'Sin flags críticos. Evaluar con libertad según el análisis.';

  const rules = [];

  // ══════════════════════════════════════════════════════
  // BLOQUE 1 — HOOK (gatekeeper primario del viralScore)
  // El hook determina el techo real. Va primero, siempre.
  // ══════════════════════════════════════════════════════
  if (flags.hook_type === 'muerto')
    rules.push('⛔ HOOK MUERTO: viralScore TECHO ABSOLUTO = 38 (nada lo supera, ni formato perfecto ni producto excelente) | hook ≤25 | scrollStopScore ≤28 | honestVerdict: decir en lenguaje simple "los primeros segundos no paran el dedo — no pasa nada que haga que el cerebro quiera quedarse"');

  if (flags.hook_type === 'débil')
    rules.push('⚠️ HOOK DÉBIL: viralScore TECHO = 62 | hook ≤52 | scrollStopScore ≤48');

  if (flags.hook_is_direct_info && flags.hook_type !== 'explosivo')
    rules.push('⚠️ APERTURA INFORMATIVA (muestra resultado/producto directamente sin tensión): hook -10 adicional | no puede considerarse hook explosivo aunque haya cortes rápidos');

  // ══════════════════════════════════════════════════════
  // BLOQUE 2 — FORMATO (slideshow vs video real)
  // ══════════════════════════════════════════════════════
  if (flags.format_incompatible)
    rules.push('⛔ FORMATO INCOMPATIBLE (slideshow o sin movimiento real): retencion_ritmo ≤28 | produccion_estetica ≤40 | scrollStopScore -15 adicional | claridad_producto -20 | confianza_credibilidad -20 | propuesta_valor -20 (el 80% no llega a verlos) | honestVerdict: separar "el contenido/resultado es real" de "el formato no funciona en esta plataforma"');

  if (flags.format_weak && !flags.format_incompatible)
    rules.push('⚠️ FORMATO DÉBIL (pasa el gate con dificultad): retencion_ritmo ≤50 | claridad_producto -10 | confianza_credibilidad -10 | propuesta_valor -10');

  if (flags.is_static_slideshow)
    rules.push('⛔ SLIDESHOW ESTÁTICO: retencion_ritmo ≤30 | emocion_deseo ≤38 | viralScore máximo 38 (se combina con techo de hook si aplica, siempre el más restrictivo)');

  if (flags.no_music_and_static)
    rules.push('⛔ SLIDESHOW SIN MÚSICA: produccion_estetica ≤32 | scrollStopScore ≤25 | honestVerdict: mencionar que este formato no funciona en Reels/TikTok/Shorts — no es problema del producto sino del formato');

  // ══════════════════════════════════════════════════════
  // BLOQUE 3 — PRESENTACIÓN DEL PRODUCTO
  // ══════════════════════════════════════════════════════
  if (flags.product_shown_late)
    rules.push('⚠️ PRODUCTO MOSTRADO TARDE (después de s8): claridad_producto -15 | salesScore -10 | el tiempo antes de que aparezca es tiempo perdido');

  if (flags.product_shown_sideways)
    rules.push('⚠️ PRODUCTO MOSTRADO DE COSTADO O PARCIAL: claridad_producto -12 | emocion_deseo -10 | wowFactor reducido');

  if (flags.product_presentation_interrupted)
    rules.push('⚠️ PRESENTACIÓN INTERRUMPIDA (logos/intros/textos largos cortan el producto): retencion_ritmo -10 | produccion_estetica -8 | el espectador pierde el hilo antes de ver lo importante');

  // ══════════════════════════════════════════════════════
  // BLOQUE 4 — VALOR DETRÁS DEL MURO DE SCROLL
  // ══════════════════════════════════════════════════════
  if (flags.value_trap)
    rules.push('⛔ TRAMPA DE VALOR (contenido bueno que nadie ve): salesScore ≤52 | potentialScore ≤55 | honestVerdict: primera oración separar "el resultado/producto es real y tiene potencial" de "el video no genera curiosidad suficiente para que la gente llegue a verlo" — nunca mezclarlos');

  if (flags.value_behind_scroll_wall)
    rules.push('⚠️ VALOR DETRÁS DEL MURO DE SCROLL: el mejor momento aparece después del abandono masivo. No contarlo como fortaleza. Los scores que dependan de ese elemento bajan 20 puntos. En honestVerdict: decir en qué segundo aparece y que casi nadie llega');

  if (flags.recompensa_tardia)
    rules.push('⚠️ RECOMPENSA TARDÍA: emocion_deseo -18 | salesScore -12 | primer ítem del roadmap: mover ese elemento a los primeros 5 segundos');

  if (flags.buried_result)
    rules.push('⛔ RESULTADO ENTERRADO (después de s15 con scroll masivo antes de s10): salesScore ≤45 | ese resultado no puede aparecer en retentionData.final como fortaleza activa');

  // ══════════════════════════════════════════════════════
  // BLOQUE 5 — RITMO Y ENERGÍA
  // ══════════════════════════════════════════════════════
  if (flags.boring_full_video)
    rules.push('⛔ VIDEO ABURRIDO COMPLETO: emocion_deseo ≤35 | retencion_ritmo ≤38 | retentionCurve con caída pronunciada antes de s10 | honestVerdict: decir en lenguaje simple que no pasa nada que haga querer seguir mirando');

  if (flags.flat_energy && !flags.boring_full_video)
    rules.push('⚠️ ENERGÍA PLANA (sin picos ni escalada): emocion_deseo -15 | retencion_ritmo -12');

  if (flags.dead_moment && !flags.boring_full_video)
    rules.push(`⚠️ MOMENTO MUERTO (~s${flags.dead_moment_second || '?'}): retencion_ritmo ≤55 | caída en retentionCurve en ese segundo`);

  if (flags.no_retention_engines)
    rules.push('⛔ SIN MOTORES DE RETENCIÓN: viralScore -10 adicional (se suma al techo de hook) | retencion_ritmo ≤40');

  // ══════════════════════════════════════════════════════
  // BLOQUE 6 — RECHAZO VISUAL Y DAÑO
  // ══════════════════════════════════════════════════════
  if (flags.first_frame_repulsion)
    rules.push('⛔ PRIMER FRAME REPULSIVO: hook ≤32 | scrollStopScore ≤28');

  if (flags.visual_repulsion) {
    const s = flags.visual_repulsion_severity || 'moderada';
    if (s === 'fuerte')  rules.push('⛔ RECHAZO VISUAL FUERTE: produccion_estetica ≤42 | confianza_credibilidad ≤38 | potentialScore ≤50 | mencionar en honestVerdict');
    else if (s === 'moderada') rules.push('⚠️ RECHAZO VISUAL MODERADO: produccion_estetica -20 | confianza_credibilidad -15 | potentialScore ≤65');
    else if (s === 'leve') rules.push('⚠️ RECHAZO VISUAL LEVE: produccion_estetica -10');
  }

  if (flags.product_damage)
    rules.push('⛔ DAÑO VISIBLE EN PRODUCTO: confianza_credibilidad ≤45 | potentialScore ≤60 | salesScore ≤55');

  if (flags.audio_issue)
    rules.push('⚠️ AUDIO PROBLEMÁTICO: produccion_estetica -15 | confianza_credibilidad -10');

  // ══════════════════════════════════════════════════════
  // BLOQUE 7 — PRODUCTO
  // ══════════════════════════════════════════════════════
  if (flags.product_unclear)
    rules.push('⛔ PRODUCTO POCO CLARO: claridad_producto ≤45 | salesScore ≤50 | propuesta_valor ≤45');

  if (flags.product_difficult_to_sell)
    rules.push('⚠️ PRODUCTO DIFÍCIL EN REDES: potentialScore ≤60 | salesScore ≤55 | honestVerdict: indicar que la limitación es del producto, no del video');

  if (!rules.length) return 'Sin flags criticos. Evaluar con libertad. Si el formato es competitivo y el hook es explosivo, los scores altos son correctos.';

  return `PENALIZACIONES — APLICAR EN ORDEN, SIN IGNORAR, SIN SUAVIZAR:
${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

REGLAS DE APLICACIÓN:
- "TECHO" (≤X o = X): valor máximo absoluto. Ningún argumento de contenido, producción o producto lo supera.
- "Resta" (-Y): restar del score base. Aplicar antes de comparar contra techos.
- Si hay múltiples techos sobre el mismo score: aplicar siempre el más restrictivo.
- Si NO hay flags de hook, formato o valor: los scores altos (70-90) son correctos si el análisis los justifica.
  Un video competitivo bien ejecutado DEBE recibir scores altos. El objetivo es precisión, no conservadurismo.`;
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

════════════════════════════════════════
MODELO MENTAL — LEER ANTES DE ASIGNAR CUALQUIER NÚMERO
════════════════════════════════════════
Sos el cerebro de alguien que lleva 20 minutos en ${pName}.
Cansado. Ya vio 80 videos. No busca información. Solo busca estímulos.

HAY DOS PREGUNTAS, EN ORDEN:
1. ¿El hook genera una pregunta en mi cerebro que solo se responde quedándome?
   → Si NO: me voy. No importa qué tan bueno sea el producto.
   → Si SÍ: tengo 3 segundos más para decidir si el formato justifica quedarme.

2. ¿El video tiene cortes, movimiento real y ritmo que sostenga esa curiosidad?
   → Si SÍ: puedo llegar hasta el final y ver el resultado/oferta.
   → Si NO: me voy aunque el hook haya sido bueno.

REGLA DE CALIBRACIÓN:
No dar 40% a todo. No dar 80% a todo.
Los scores deben reflejar con precisión lo que el análisis estratégico encontró.

LO QUE MERECE SCORE ALTO (70-90):
→ Hook real que crea pregunta implícita fuerte
→ Video real con cortes cada 1-3s y movimiento sostenido
→ Producto/servicio mostrado de forma directa, rápida, sin interrupciones
→ El mejor momento del video aparece antes de que la gente se vaya
→ Hay algo nuevo cada 2-3s que sostiene la atención

LO QUE MERECE SCORE BAJO (20-45):
→ Apertura con información directa sin tensión (foto del resultado, logo, "somos la empresa X")
→ Imágenes quietas aunque tengan transición automática (slideshow)
→ El producto se muestra tarde, de costado, o interrumpido por otra cosa
→ El mejor momento del video aparece cuando el 80% ya se fue
→ Energía plana de inicio a fin sin picos

LO QUE ESTÁ EN EL MEDIO (45-65):
→ Hook débil pero algo retiene (buen producto visible, música con energía)
→ Formato competitivo pero hook no genera suficiente curiosidad
→ Buen contenido pero ritmo algo lento o con momento muerto aislado
════════════════════════════════════════

PENALIZACIONES — APLICAR EXACTAMENTE, EN ORDEN:
${penaltiesBlock}

SEÑALES POSITIVAS (aplicar activamente cuando el análisis las confirma):
→ Hook explosivo confirmado: viralScore base ≥70 antes de ajustes de contenido
→ Formato competitivo (5 SÍ en gate): no aplicar penalizaciones de formato. Scores de contenido al 100%.
→ Producto mostrado directo + rápido + en acción: claridad_producto ≥75 | call_to_action ≥65
→ Cortes cada 1-2s + movimiento real + música desde s0: retencion_ritmo ≥70
→ Satisfacción visual fuerte (antes/después, transformación visible, proceso fluido): emocion_deseo ≥65
→ Persona real hablando a cámara con energía + resultado visible: confianza_credibilidad ≥70
Estas señales son tan importantes como las penalizaciones. Un buen video debe reflejar scores buenos.

REGLAS BASE ADICIONALES:
- Producción simple + formato competitivo + hook real: produccion_estetica ≥55. No penalizar.
- Producto físico que se vende visualmente sin CTA verbal: call_to_action ≥65.
- Música genérica que no molesta: produccion_estetica -8 (leve, no grave).
- viralScore y salesScore pueden diferir mucho: un video puede llegar a poca gente pero vender bien, o viralizarse sin vender.

════════════════════════════════════════
ESCALA DE REFERENCIA — USAR PARA CALIBRAR:
viralScore 80-90: hook explosivo + formato competitivo + ritmo sostenido + producto claro
viralScore 65-79: hook bueno + algún problema menor. Puede viralizarse con boost inicial.
viralScore 50-64: hook débil pero algo que retiene. Alcance limitado, no viral orgánico.
viralScore 35-49: hook muerto o formato débil (no ambos). Alcance muy bajo.
viralScore 20-34: hook muerto + formato incompatible o slideshow. Sin posibilidad viral real.
salesScore puede ser 15-20 puntos más alto que viralScore en videos que llegan a poca gente pero convierten bien.
════════════════════════════════════════

REGLA DE LENGUAJE — OBLIGATORIA EN TODOS LOS CAMPOS DE TEXTO:
Escribí como si le explicás a alguien que nunca estudió marketing.
PROHIBIDO usar sin explicación: UGC, CTR, hook, retención, conversión, viralización, STEPPS, engagement, funnel, orgánico.
Si lo necesitás: "hook (lo que ve la gente en el primer segundo)".

EJEMPLOS:
✗ "El hook carece de pattern interrupt efectivo"
✓ "Los primeros segundos no paran el dedo — no pasa nada que haga querer quedarse"
✗ "Alta consumibilidad visual con bajo CTA explícito"
✓ "Se entiende de qué trata sin audio, pero no queda claro qué hacer después"
✗ "Ausencia de open loop compromete la retención post-hook"
✓ "El video no deja ninguna pregunta sin responder que haga querer llegar al final"

PONDERACIÓN BASE (antes de penalizaciones):
hook 20% | claridad_producto 13% | confianza_credibilidad 12% | emocion_deseo 12% | propuesta_valor 10% | retencion_ritmo 12% | call_to_action 9% | produccion_estetica 7% | tendencias_formato 5%
(El hook subió a 20% porque es el gatekeeper real del viralScore)

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
  "formatSurvival": {
    "gateResult": "<competitivo|débil|incompatible>",
    "gateScore": 0,
    "hookGateResult": "<explosivo|débil|muerto>",
    "viralScoreCeiling": 0,
    "valueBehindWall": "<qué valor llega tarde, o 'ninguno'>",
    "formatVerdict": ""
  },
  "hookDNA": {
    "strength": 0,
    "pattern": "<pregunta|shock|promesa|humor|dolor|curiosidad|ninguno>",
    "implicitQuestion": "<pregunta que genera el hook en el cerebro, o 'ninguna'>",
    "missingElement": "",
    "optimizedHook": ""
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
    "contentVisibleBeforeScroll": "<qué ve la mayoría antes de irse>",
    "contentMissedByMost": "<qué valor tiene el video que casi nadie alcanza, o 'ninguno'>"
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
    "triggerType": "<debate|pregunta|identificación|humor|sorpresa>",
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
    "detectedRhythm": "<lento|medio|dinámico|frenético>",
    "detectedTone":   "<serio|cercano|aspiracional|humorístico|urgente>"
  },
  "productViability": {
    "usageFrequency":    "<diaria|semanal|mensual|ocasional|única vez>",
    "instantClarity":    "<fuerte|aceptable|débil>",
    "everydayProblem":   "<fuerte|aceptable|débil>",
    "audienceWidth":     "<masivo|nicho amplio|nicho específico>",
    "purchaseFriction":  "<baja|media|alta>",
    "wowFactor":         "<fuerte|aceptable|débil>",
    "resultCredibility": "<fuerte|aceptable|débil>",
    "weakFactors": 0, "alert": "", "verdict": ""
  },
  "retentionEngines": {
    "visualSatisfaction": "<presente|parcial|ausente>",
    "openLoop":           "<presente|parcial|ausente>",
    "microRewards":       "<presentes|escasas|ausentes>",
    "consumability":      "<alta|media|baja>",
    "platformNaturalness":"<orgánico|mixto|parece publicidad>",
    "dominantEngine": "", "verdict": ""
  },
  "editingAudio": {
    "editingQuality":  "<intencional|amateur|sin editar>",
    "cutsPerThreeSeconds": 0,
    "deadMoments":     "<ninguno|leve|varios — con segundo aproximado>",
    "musicFit":        "<perfecta|genérica|ausente|contraproducente>",
    "audioBalance":    "<bien balanceado|música muy alta|muy silencioso>",
    "rhythmVsProduct": "<compatible|contradice la energía del producto>",
    "energyProfile":   "<plana|variable|escalada|caída>",
    "boringRisk":      "<bajo|medio|alto>",
    "verdict": ""
  },
  "visualRepulsion": {
    "hasRepulsion": false, "signal": "", "second": "",
    "severity": "<ninguna|leve|moderada|fuerte>", "impact": ""
  },
  "trendContext": "",
  "roadmap": ["", "", "", ""],
  "trendResearch": {
    "hooksWorking": "", "topStructure": "",
    "sourceQuality": "<alta|media|baja>", "researchDate": ""
  },
  "gapAnalysis": {
    "biggestGap": "", "quickWin": "", "competitiveAdvantage": ""
  },
  "categorias": {
    "hook":                   { "puntaje": 0, "explicacion": "" },
    "claridad_producto":      { "puntaje": 0, "explicacion": "" },
    "confianza_credibilidad": { "puntaje": 0, "explicacion": "" },
    "emocion_deseo":          { "puntaje": 0, "explicacion": "" },
    "propuesta_valor":        { "puntaje": 0, "explicacion": "" },
    "retencion_ritmo":        { "puntaje": 0, "explicacion": "" },
    "call_to_action":         { "puntaje": 0, "tipo": "<explicito|implicito|ausente>", "explicacion": "" },
    "produccion_estetica":    { "puntaje": 0, "explicacion": "" },
    "tendencias_formato":     { "puntaje": 0, "explicacion": "" }
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

const App = () => {
  const [step, setStep] = useState('upload');
  const [analysisMode, setAnalysisMode] = useState('video');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [selectedFollowerRange, setSelectedFollowerRange] = useState(null);
  const [selectedObjetivo, setSelectedObjetivo] = useState('ventas'); // ← agregá esto
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
    video.src = url; //viralScore
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
  setStatusText("Subiendo video...");
  setAnalysisProgress(10);

  const storagePath = `temp-analysis/${Date.now()}-${videoFile.name}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, videoFile, { upsert: true });

    if (uploadError) throw new Error("Error subiendo video: " + uploadError.message);

    // ── CALL 1 — Viewer Brain ──
    setAnalysisProgress(25);
    setStatusText("Analizando el video...");

    const { data: call1Data, error: call1Error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildViewerBrainPrompt(platform, selectedNicho),
        storagePath,
        videoMimeType: videoFile.type || 'video/mp4',
        duration: Math.round(duration),
        maxOutputTokens: 2048
      }
    });

    if (call1Error) throw call1Error;
    const viewerAnalysis = extractGeminiText(call1Data);

    // ── CALL 2 — Strategy Brain (ahora genera FLAGS al final) ──
    setAnalysisProgress(50);
    setStatusText("Evaluando ventas y viralidad...");

    const { data: call2Data, error: call2Error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildStrategyBrainPrompt(viewerAnalysis, platform, selectedObjetivo, selectedNicho),
        maxOutputTokens: 3584  // más margen para el bloque FLAGS //const CHAT_WORD_LIMIT = 1000;
      }
    });

    if (call2Error) throw call2Error;
    const strategyRaw = extractGeminiText(call2Data);

    // ── EXTRAER FLAGS y limpiar el texto ──
    const flags = extractFlags(strategyRaw);
    const strategyAnalysis = stripFlags(strategyRaw);

    // log para debugging — útil mientras calibrás
    console.log('[VIRAX] Flags detectados:', flags);

    // alerta si el bloque FLAGS no se generó
    if (Object.keys(flags).length === 0) {
      console.warn('[VIRAX] Strategy Brain no generó FLAGS. Scoring Brain corre sin penalizaciones.');
    }

    // ── CALL 3 — Scoring Brain (recibe flags ya computados) ──
    setAnalysisProgress(80);
    setStatusText("Calculando scores finales...");

    const { data: call3Data, error: call3Error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        text: buildScoringBrainPrompt(strategyAnalysis, platform, selectedObjetivo, selectedNicho, flags),
        expectsJson: true,
        maxOutputTokens: 8192
      }
    });

    if (call3Error) throw call3Error;
    const parsed = safeParseJSON(extractGeminiText(call3Data), 'scoring');

    // ── MERGE ──
    setAnalysisProgress(95);
    setStatusText("Preparando tu análisis completo...");

    const finalResult = {
      ...parsed,
      objetivo: selectedObjetivo,
      _flags: flags,  // guardamos los flags para debugging y calibración futura
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
      `}</style>
    </div>
  );
};

export default App;