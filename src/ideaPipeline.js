// viraxPrompt.js — prompt, contexto y validación del plan de VIRAX
// Contrato con gemini-proxy (modo stream): { stream, systemInstruction, text, thinkingLevel }

const MAX_HISTORY_TURNS = 6;
const MAX_CHARS_PER_TURN = 600;
const MAX_CHARS_LAST_PLAN = 3000;

// Evita que el texto del usuario cierre o abra etiquetas del prompt
const neutralize = (s = "") =>
  String(s).replace(
    /<\/?(idea_del_usuario|historial|contexto|plataforma|duracion_objetivo_s)>/gi,
    ""
  );

// Planes viejos del bot (JSON) → una línea. Ahorra tokens.
const compactBotText = (text = "") => {
  try {
    const p = JSON.parse(text);
    if (p && typeof p.titulo === "string") {
      return `[plan previo] ${p.titulo} — ${p.idea_principal ?? ""}`;
    }
  } catch {
    /* no era JSON */
  }
  return text;
};

// Pasale el historial SIN el mensaje actual (la idea va aparte).
// El último mensaje del bot se conserva completo para poder iterar sobre él.
const historyBlock = (history = []) => {
  const recent = history.slice(-MAX_HISTORY_TURNS);
  if (!recent.length) return "(primera interacción)";

  let lastBotIdx = -1;
  recent.forEach((m, i) => {
    if (m.role !== "user") lastBotIdx = i;
  });

  return recent
    .map((m, i) => {
      const isUser = m.role === "user";
      const raw = String(m.text ?? "");
      const isLastBot = i === lastBotIdx;
      const text = isUser || isLastBot ? raw : compactBotText(raw);
      const limit = isLastBot ? MAX_CHARS_LAST_PLAN : MAX_CHARS_PER_TURN;
      return `${isUser ? "USUARIO" : "VIRAX"}: ${neutralize(text.slice(0, limit))}`;
    })
    .join("\n");
};

// Estático → va en systemInstruction (cacheable de forma implícita)
const SYSTEM_PROMPT = `
<rol>
Sos VIRAX, estratega de video corto (TikTok, Reels, Shorts) especializado en retención de los primeros 3 segundos. No opinás: entregás un guion ejecutable para la idea del usuario. Respondé en español.
</rol>

<criterios>
1. ESPECIFICIDAD: cada afirmación lleva un dato concreto (número, objeto, situación, nicho). Si una línea serviría para cualquier negocio, reescribila.
2. GANCHO (primer elemento, 0-3s): máx. 15 palabras habladas. Primer estímulo visual y primera palabra en el instante 0, sin saludo ni presentación. Usá UN solo mecanismo: brecha de curiosidad, afirmación contraintuitiva, número específico o error personal.
3. INTERRUPCIÓN DE PATRÓN: el gancho incluye un cambio visual o sonoro concreto (corte seco, zoom, contraste, sonido).
4. RETENCIÓN: cada segmento abre una pregunta o promesa que se resuelve en el siguiente. El último cierra el loop con CTA o con un final que invite a re-ver.
5. MARCO: PAS (problema → agitación → solución) por defecto; AIDA si el objetivo es venta directa.
</criterios>

<prohibido>
- Aperturas: "Hola", "En este video", "Hoy te voy a mostrar", "¿Sabías que...?".
- Adjetivos vacíos ("increíble", "revolucionario") sin dato que los respalde.
- Consejos aplicables a cualquier negocio.
- Rangos de tiempo sin acción visual concreta.
</prohibido>

<proceso_interno>
Antes de responder, generá mentalmente 3 ganchos distintos, descartá los que podrían aplicarse a otro negocio y desarrollá el más específico. No muestres este razonamiento.
</proceso_interno>

<seguimiento>
Si el historial contiene un plan previo y el usuario pide un ajuste (más corto, otro tono, otro gancho, otro nicho), devolvé el plan COMPLETO actualizado en el mismo formato JSON, conservando lo que no pidió cambiar. Si pide una idea nueva, ignorá el plan previo.
</seguimiento>

<datos_faltantes>
No hagas preguntas. Si falta un dato crítico (nicho, público), asumí lo más probable y declaralo en la última frase de "idea_principal".
</datos_faltantes>

<formato>
Respondé SOLO con un objeto JSON válido (no un array), sin texto antes ni después y sin bloques de código:
{
  "titulo": "máx. 8 palabras, nombra el ángulo (no el rubro)",
  "idea_principal": "1-2 frases: ángulo + a quién + por qué retiene",
  "ejecucion": [
    { "momento": "0-3s", "descripcion": "VISUAL: ... | DICE: \\"...\\" | TEXTO EN PANTALLA: ..." }
  ]
}
Reglas: entre 3 y 6 elementos; el primero empieza en "0-"; rangos contiguos sin solaparse; duración total según <duracion_objetivo_s>. Todos los valores son strings. No agregues claves extra.
</formato>

<ejemplo>
Entrada: "Vendo velas de soja artesanales por Instagram"
Salida:
{"titulo":"La vela de $3.000 que dura 40 horas","idea_principal":"Contrastar en vivo una vela de supermercado que se apaga en 8 h con una de soja medida con cronómetro, para compradoras que deciden por precio. Retiene porque promete un resultado medible al final. Supuesto: público femenino 25-45.","ejecucion":[{"momento":"0-3s","descripcion":"VISUAL: dos velas encendidas, cronómetro en 00:00 entre ambas, corte seco a la barata derretida | DICE: \\"Esta vela de $1.500 murió en 8 horas. Mirá la mía.\\" | TEXTO EN PANTALLA: 8h vs 40h"},{"momento":"3-10s","descripcion":"VISUAL: timelapse de ambas velas con el cronómetro corriendo | DICE: \\"La de parafina te suelta hollín. La de soja arde limpia y más lenta.\\" | TEXTO EN PANTALLA: Hollín vs llama limpia"},{"momento":"10-20s","descripcion":"VISUAL: cronómetro en 40:00 con la vela de soja aún encendida | DICE: \\"Cuarenta horas. Menos de la mitad del costo por hora.\\" | TEXTO EN PANTALLA: $75/h vs $187/h"},{"momento":"20-25s","descripcion":"VISUAL: mano apagando la vela, plano del frasco con la etiqueta | DICE: \\"Link en bio. ¿Querés ver qué pasa a las 41 horas?\\" | TEXTO EN PANTALLA: Link en bio"}]}
El ejemplo marca el nivel de especificidad esperado; no copies su tema ni su contenido.
</ejemplo>
`.trim();

// Mantiene el nombre que ya usa ChatScreen
const buildSystemPrompt = () => SYSTEM_PROMPT;

// Variable → va en el mensaje de usuario
const buildUserMessage = ({
  idea,
  history = [],
  plataforma = "TikTok/Reels",
  duracionS = 30,
}) =>
  `<contexto>
<plataforma>${neutralize(plataforma)}</plataforma>
<duracion_objetivo_s>${Number(duracionS) || 30}</duracion_objetivo_s>
<historial>
${historyBlock(history)}
</historial>
</contexto>
<idea_del_usuario>
${neutralize(idea)}
</idea_del_usuario>`;

// Body listo para enviar a gemini-proxy (sin temperature: 3.8 Flash y Argon la ignoran)
const buildChatRequest = ({
  idea,
  history = [],
  plataforma,
  duracionS,
  thinkingLevel = "medium",
}) => ({
  stream: true,
  systemInstruction: buildSystemPrompt(),
  text: buildUserMessage({ idea, history, plataforma, duracionS }),
  thinkingLevel,
});

// Extrae y valida el plan. Lanza Error si no cumple → reintentá 1 vez.
const extractJson = (raw) => {
  const clean = String(raw ?? "")
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La respuesta no contiene JSON");
    return JSON.parse(match[0]);
  }
};

const parsePlan = (raw) => {
  const plan = extractJson(raw);
  const ok =
    plan &&
    typeof plan.titulo === "string" &&
    typeof plan.idea_principal === "string" &&
    Array.isArray(plan.ejecucion) &&
    plan.ejecucion.length >= 3 &&
    plan.ejecucion.length <= 6 &&
    plan.ejecucion.every(
      (e) => typeof e?.momento === "string" && typeof e?.descripcion === "string"
    ) &&
    /^0\s*-/.test(plan.ejecucion[0].momento);
  if (!ok) throw new Error("Plan inválido");
  return plan;
};

export {
  buildChatRequest, buildSystemPrompt,
  buildUserMessage, historyBlock, parsePlan, SYSTEM_PROMPT
};

