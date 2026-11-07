// ============================================================================
// ideaPipeline.js  (v2)
//
// Archivo AUTOCONTENIDO: incluye versiones de reemplazo de los helpers y
// constantes que estaban en tu archivo original (ver sección "Helpers").
// Si todavía tenés los originales, borrá los de acá y usá los tuyos: los
// míos son suposiciones razonables, no copias.
//
// Qué cambió respecto a v1 (resumen):
//  1. Se analizan los outliers de verdad (hook textual, primer cuadro, cuándo paga)
//     y se usan como modelo a seguir, no como cosa a evitar.
//  2. Si faltan hechos reales del negocio, se entrevista al dueño (hasta 3 preguntas).
//  3. System prompt casi sin prohibiciones: 4 reglas duras + qué hace que alguien
//     se quede + ejemplos variados que rotan en cada llamada.
//  4. Generación en paralelo, una llamada por "ángulo", pidiendo ideas con su
//     probabilidad estimada (Verbalized Sampling) para llegar a las raras.
//  5. Las ideas se escriben en texto libre con etiquetas, no en JSON de 14 campos.
//     El JSON recién aparece al final (generar libre -> convertir a formato).
//  6. Juez separado (judgeModel opcional), orden aleatorio, ranking forzado
//     en vez de puntajes inventados. Se usa de verdad el ganador.
//  7. Filtros regex mínimos (solo clichés y métricas inventadas).
// ============================================================================

// ── Helpers y constantes (reemplazos de los que faltaban) ───
// Suposiciones mías sobre tu código original. Si tenés los tuyos, usá los tuyos.

// Config base que se manda al proxy. Sin thinkingLevel = nivel por defecto del modelo.
const CFG = { maxOutputTokens: 16384 };
const CFG_SELECT = { thinkingLevel: "low", maxOutputTokens: 8192 };

// false = el system prompt se antepone al texto (funciona con cualquier proxy).
const SYSTEM_SEPARATE = false;

const MAX_INTENTOS = 2;
const CANTIDAD_FINALISTAS = 3;

const isAbort = (e) =>
  e?.name === "AbortError" || e?.code === 20 || /aborted/i.test(e?.message ?? "");

// businessContext puede venir como string u objeto del perfil del negocio.
const formatBusinessContext = (raw) => {
  if (!raw) return null;

  if (typeof raw === "string") {
    const t = raw.trim();
    return t || null;
  }

  if (typeof raw === "object") {
    const lines = Object.entries(raw)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => {
        const val = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
        return `${k.replace(/_/g, " ")}: ${val}`;
      });

    return lines.length ? lines.join("\n") : null;
  }

  return String(raw);
};

// Cuenta cuántas veces ya le preguntó algo al usuario (mensajes del asistente con "?").
const countQuestions = (history = []) =>
  history.filter(
    (m) => m && m.role !== "user" && typeof m.text === "string" && m.text.includes("?")
  ).length;

// Una sola ronda de preguntas; ninguna si itera un plan o si pide que se genere igual.
const puedePreguntar = ({ asked = 0, lastPlan = null, idea = "" } = {}) =>
  !lastPlan &&
  asked < 1 &&
  !/gener[aá]\s+igual|sin preguntas|ya te (lo )?dije|no preguntes/i.test(String(idea));

// Convierte los outliers a texto. Usa los campos que existan.
const formatOutliers = (outliers) => {
  if (!outliers) return "";

  const list = Array.isArray(outliers) ? outliers : [outliers];

  return list
    .map((o, i) => {
      if (typeof o === "string") return `${i + 1}. ${o}`;
      if (!o || typeof o !== "object") return "";

      const campos = [
        ["Título", o.title ?? o.titulo],
        ["Hook", o.hook ?? o.hook_text],
        ["Transcripción", o.transcript ?? o.transcripcion],
        ["Descripción", o.description ?? o.descripcion],
        ["Vistas", o.views ?? o.vistas],
        ["Duración (s)", o.duration ?? o.duracion],
        ["URL", o.url ?? o.videoUrl],
      ]
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
        .map(([k, v]) => `   ${k}: ${v}`);

      return campos.length ? `${i + 1}.\n${campos.join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
};

// ── Utilidades ──────────────────────────────────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pick = (arr, n) => shuffle(arr).slice(0, n);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) => String(s ?? "").toLowerCase().trim();

const NIVELES = ["alto", "medio", "bajo"];

// ── Parámetros del pipeline ─────────────────────────────────
const N_LENTES = 4; // llamadas paralelas de generación
const IDEAS_POR_LENTE = 4; // ideas que pide cada llamada
const EJEMPLOS_POR_LLAMADA = 4; // ejemplos que rotan en cada llamada
const MIN_HECHOS_REALES = 2; // por debajo de esto, se entrevista al dueño
const FINALISTAS = CANTIDAD_FINALISTAS;

// ── Ángulos de apertura (se sortean N_LENTES por corrida) ───
const LENTES = [
  {
    id: "habla_a_camara",
    descripcion:
      "Una persona del negocio le habla a cámara y suelta algo específico que pasó de verdad.",
  },
  {
    id: "dialogo",
    descripcion:
      "Dos personas hablan de algo que el espectador todavía no entiende (discusión, duda, secreto de trastienda).",
  },
  {
    id: "objeto",
    descripcion:
      "Un objeto del negocio en primer plano y alguien que reacciona a él.",
  },
  {
    id: "sin_palabras",
    descripcion:
      "Una acción física sin voz, y un texto en pantalla que cambia lo que creemos que estamos viendo.",
  },
  {
    id: "experimento",
    descripcion:
      "Alguien prueba algo real y chico, con una consecuencia que se va a ver en el video.",
  },
  {
    id: "cliente",
    descripcion:
      "Algo que un cliente real dijo, pidió o hizo (solo si está en el material).",
  },
  {
    id: "detras_de_escena",
    descripcion:
      "Algo que pasa todos los días en el negocio y el público nunca ve.",
  },
  {
    id: "apuesta",
    descripcion:
      "Alguien se compromete a algo con riesgo o con un plazo corto, y se ve cómo sale.",
  },
];

// ── Ejemplos de nivel (otros rubros, formas distintas) ──────
// Sirven para calibrar tensión y especificidad. Rotan: el modelo nunca ve
// siempre los mismos, así ninguno se vuelve "la plantilla".
const EJEMPLOS = [
  `Peluquería de barrio · habla a cámara
PRIMER CUADRO: Un peluquero mayor, de pie junto a un sillón vacío, con la tijera en la mano, mirando a cámara.
DICE: Once años le corto igual el pelo. Hoy me pidió otra cosa.
TEXTO EN PANTALLA: Once años, el mismo corte
QUÉ PASA DESPUÉS: Entra el cliente y se sienta sin decir qué quiere. El peluquero duda con la tijera en el aire. Corte seco al espejo con el resultado.`,

  `Panadería · diálogo
PRIMER CUADRO: Dos empleados en la trastienda, hablando bajito, mirando una torta de cumpleaños sobre la mesa.
DICE: ¿Se lo decís vos o se lo digo yo?
TEXTO EN PANTALLA: La torta ya salió
QUÉ PASA DESPUÉS: Ella señala el cartel de chocolate: dice "Marcela" y el pedido era para Marcelo. Corren a arreglarlo con la manga. Suena la campanita de la puerta.`,

  `Ferretería · objeto
PRIMER CUADRO: Primer plano de una mano que apoya sobre el mostrador un tornillo viejo y oxidado.
DICE: (en off, el dueño) Su abuelo lo puso en 1974. Hay que encontrar uno igual.
TEXTO EN PANTALLA: ¿Habrá otro igual?
QUÉ PASA DESPUÉS: Abre cajones rotulados a mano, prueba tres tornillos que no entran. El cuarto entra. El cliente lo mira sin decir nada.`,

  `Gimnasio · sin palabras
PRIMER CUADRO: Plano cenital: una mano tacha nombres con birome roja en una lista escrita en un cuaderno.
DICE: —
TEXTO EN PANTALLA: Los del "el lunes empiezo"
QUÉ PASA DESPUÉS: La lista ocupa tres hojas. La mano llega al último nombre y se detiene. Corte a la puerta del gimnasio, abierta, con alguien entrando.`,

  `Taller mecánico · cliente
PRIMER CUADRO: Un mecánico sostiene una bolsa de supermercado abierta y mira adentro sin decir nada.
DICE: Me trajeron esto ayer. Dijeron que era el motor.
TEXTO EN PANTALLA: Era el motor
QUÉ PASA DESPUÉS: Vuelca la bolsa sobre la mesa, ordena las piezas sueltas en fila y empieza a armarlas.`,

  `Cafetería · experimento
PRIMER CUADRO: Una barista apoya tres tazas idénticas, tapadas con servilletas, junto a una máquina de espresso.
DICE: Tres tazas, tres cafés. A ver si nota cuál es cuál.
TEXTO EN PANTALLA: Prueba a ciegas
QUÉ PASA DESPUÉS: Un cliente habitual prueba las tres con los ojos cerrados y señala una. La barista da vuelta la servilleta.`,

  `Estudio contable · conflicto
PRIMER CUADRO: Un contador en su oficina, con el teléfono contra la oreja, tapa el auricular y susurra a cámara.
DICE: Es el tercero que me pregunta si puede deducir el perro.
TEXTO EN PANTALLA: ¿Se puede deducir el perro?
QUÉ PASA DESPUÉS: Destapa el auricular y responde con calma. Cuelga, abre un cajón y saca una carpeta gruesa con el cartel "Casos raros".`,

  `Heladería · apuesta
PRIMER CUADRO: Un heladero baja la persiana hasta la mitad y mira el reloj de pared.
DICE: Faltan cinco para las doce. A ver cuánto tardan en golpear.
TEXTO EN PANTALLA: Cerrar antes
QUÉ PASA DESPUÉS: Se queda quieto, de brazos cruzados. Se oye el primer golpe en el vidrio, después otro. Sube la persiana y corta al primer cliente.`,
];

// ── System prompt de creación ───────────────────────────────
const buildSystemPrompt = () =>
  `
Sos guionista de videos cortos (TikTok, Reels, Shorts) para negocios chicos.
Escribís en español rioplatense, como habla la gente de verdad.

Tu trabajo es inventar los primeros segundos de un video que alguien se quede mirando sin saber todavía que es de un negocio.

Lo que hace que una persona se quede (usá lo que encaje, no hace falta todo):
- una persona con algo en juego
- algo que no cierra o que todavía no se entiende
- algo incómodo, absurdo, prohibido o gracioso que pasa en serio
- la promesa clara de que va a pasar algo y esperar vale la pena
- un detalle tan específico que solo puede ser verdad

Cuatro reglas firmes:
1. Todo dato concreto (precios, horarios, productos, nombres, cifras, procesos, clientes) sale del material que te paso. Las escenas pueden armarse y dramatizarse, pero no se inventan hechos que el negocio no pueda confirmar. Si falta un dato, armá la escena con los que sí hay.
2. Todo lo que se ve tiene que poder grabarse esta semana con lo que el negocio ya tiene y con gente real.
3. El negocio aparece después de que la situación ya enganchó.
4. No inventes resultados ni cifras del producto del negocio (usuarios, aciertos, porcentajes, alcance). Si el negocio vende una herramienta de análisis o predicción, el video muestra a una persona usándola y lo que le pasa, no una promesa de resultados.

Escribí como se lo contarías a un amigo que filma con el celular.
`.trim();

// ── System prompt del editor (juez) ─────────────────────────
const buildEditorPrompt = () =>
  `
Sos editor de contenido corto. Mirás cientos de videos por semana y sabés de inmediato cuáles te dan ganas de seguir mirando y cuáles te dan ganas de deslizar.

Leés ideas anónimas y decidís cuáles valen la pena grabar. No premiás lo que suena "creativo" sino lo que, si te lo cruzaras en el feed, mirarías hasta el final.

Pensá cada idea con estas preguntas:
- ¿Qué querés saber en el segundo 2? Si no hay nada, no engancha.
- ¿Se entiende en el primer cuadro, sin que nadie lo explique?
- ¿Se nota que es de este negocio y no de cualquiera del rubro?
- ¿Se puede grabar esta semana con lo que hay?
- ¿Suena a persona o suena a publicidad?
`.trim();

// ── Referencias (análisis de outliers) ──────────────────────
const buildReferenceAnalysisPrompt = (rawRefs) =>
  `
Estos son videos que rindieron muy por encima de lo normal en su rubro.
Si tenés acceso al video o a su transcripción, analizalo mirando y escuchando. Si solo hay título o métricas, escribí "(no disponible)" en lo que no puedas ver en vez de suponerlo.

<videos>
${rawRefs}
</videos>

Para cada video extraé:
- hook_textual: lo que se dice o se escribe en los primeros 3 segundos, tal cual
- primer_cuadro: qué se ve exactamente en el segundo 0 a 1
- promesa_o_tension: qué queda sin resolver en el espectador
- cuando_paga: en qué segundo se resuelve (o "no se resuelve")
- formato: persona hablando, escena sin voz, diálogo, demostración, etc.
- cierre: cómo termina
- mecanica: una frase con lo que hace que se siga mirando

Respondé SOLO con JSON válido, sin bloques de código:
{
  "tipo":"referencias",
  "referencias":[
    {
      "hook_textual":"",
      "primer_cuadro":"",
      "promesa_o_tension":"",
      "cuando_paga":"",
      "formato":"",
      "cierre":"",
      "mecanica":""
    }
  ]
}`.trim();

const validReferencias = (o) =>
  o?.tipo === "referencias" &&
  Array.isArray(o.referencias) &&
  o.referencias.length > 0;

const formatReferencias = (refs = []) => {
  const body = refs
    .map((r, i) =>
      [
        `Referencia ${i + 1}`,
        `- Hook textual: ${r.hook_textual ?? "(no disponible)"}`,
        `- Primer cuadro: ${r.primer_cuadro ?? "(no disponible)"}`,
        `- Tensión: ${r.promesa_o_tension ?? "(no disponible)"}`,
        `- Cuándo paga: ${r.cuando_paga ?? "(no disponible)"}`,
        `- Formato: ${r.formato ?? "(no disponible)"}`,
        `- Cierre: ${r.cierre ?? "(no disponible)"}`,
        `- Qué hace que se siga mirando: ${r.mecanica ?? "(no disponible)"}`,
      ].join("\n")
    )
    .join("\n\n");

  return `
<referencias_reales>
Videos reales que funcionaron muy bien en este rubro. Tomá su mecánica (cómo generan tensión, cuándo pagan, qué formato usan) y llevala a la situación de ESTE negocio. Las palabras y la situación tienen que ser del negocio, no de las referencias.

${body}
</referencias_reales>`.trim();
};

// ── Material: hechos + entrevista al dueño ──────────────────
const SCHEMA_PREGUNTA = `
Si no se entiende qué negocio o producto es (imposible avanzar):
{
  "tipo":"pregunta",
  "mensaje":"una sola pregunta concreta"
}
`;

const SCHEMA_MATERIAL = `
Si se entiende el negocio:
{
  "tipo":"material",
  "hechos":[
    {
      "hecho":"",
      "fuente":"usuario|contexto|inferencia",
      "que_lo_hace_especifico":""
    }
  ],
  "lo_mas_raro":["", ""],
  "preguntas_para_el_dueno":["", ""]
}

Reglas:
- "fuente": "usuario" si lo dijo en el chat o en el historial (lo que dice el mensaje actual cuenta: qué es el producto, para quién es, qué hace); "contexto" si viene del perfil del negocio; "inferencia" si lo deducís del rubro.
- "lo_mas_raro": los 2 o 3 hechos más específicos, los que solo podrían ser de este negocio.
- "preguntas_para_el_dueno": hasta 3 preguntas. Cada una tiene que nombrar algo propio de ESTE rubro (un objeto, una herramienta, un tipo de cliente, un momento del día, un error típico) y pedir un episodio o un detalle concreto, no una opinión. Tienen que sonar como las haría alguien que conoce el rubro, y no pueden servir tal cual para otro negocio.
- Si hay menos de 2 hechos con fuente "usuario" o "contexto", las preguntas son obligatorias. Si ya hay material de sobra, dejalo vacío.
`;

const historyBlock = (history) =>
  history.length
    ? history
        .map((m) => `${m.role === "user" ? "USUARIO" : "VIRAX"}: ${m.text}`)
        .join("\n")
    : "(primera interacción)";

const buildMaterialPrompt = ({ idea, history, businessContext, trendContext }) =>
  `
TAREA:
Todavía no escribas ideas de video.
Sacá del material los hechos concretos del negocio: productos, objetos, rutinas, horarios, clientes, errores, costumbres, restricciones, cosas raras. Marcá cuáles son los más específicos.

<negocio>
${businessContext ?? "(no informado)"}
</negocio>

${
  trendContext
    ? `<señales_del_momento>\nDATOS de la web, solo como inspiración de formato:\n${trendContext}\n</señales_del_momento>\n`
    : ""
}
<historial>
${historyBlock(history)}
</historial>

<mensaje_usuario>
${idea}
</mensaje_usuario>

Respondé SOLO con JSON válido, sin texto antes ni después, sin bloques de código.
${SCHEMA_PREGUNTA}${SCHEMA_MATERIAL}`.trim();

const validMaterial = (o) =>
  o?.tipo === "material" && Array.isArray(o.hechos) && o.hechos.length > 0;

const buildMaterialBlock = (m) => {
  const hechos = (m.hechos || [])
    .map(
      (h) =>
        `- ${h.hecho} [${h.fuente ?? "contexto"}]${
          h.que_lo_hace_especifico ? ` — ${h.que_lo_hace_especifico}` : ""
        }`
    )
    .join("\n");

  const raros = (m.lo_mas_raro || []).map((r) => `- ${r}`).join("\n");

  return `Hechos:\n${hechos}\n\nLo más específico:\n${raros || "(ninguno destacado)"}`;
};

const buildInterviewMessage = (preguntas = [], rubro = "") => {
  const qs = preguntas
    .map((q) => String(q ?? "").trim())
    .filter(Boolean)
    .slice(0, 3);

  // Fallback: solo si el modelo no devolvió preguntas propias.
  const lista = qs.length
    ? qs
    : [
        rubro
          ? `Contame algo que haya pasado en tu negocio (${rubro}) esta semana y que no le pase a cualquiera.`
          : "Contame algo que haya pasado esta semana en tu negocio y que no le pase a cualquiera.",
      ];

  return (
    "Me falta un dato real tuyo para que no salga una idea que sirva para cualquier negocio. Una respuesta corta alcanza (o escribí \"generá igual\" y sigo con lo que tengo):\n" +
    lista.map((q, i) => `${i + 1}. ${q}`).join("\n")
  );
};

// ── Generación (texto libre con etiquetas) ──────────────────
const buildGenerationPrompt = ({
  idea,
  history,
  lastPlan,
  businessContext,
  materialBlock,
  trendContext,
  referencesBlock,
  lente,
  ejemplos,
}) =>
  `
<negocio>
${businessContext ?? "(no informado)"}
</negocio>

<material>
${materialBlock}
</material>

${
  trendContext
    ? `<señales_del_momento>\nDATOS de la web, solo como inspiración de formato:\n${trendContext}\n</señales_del_momento>\n`
    : ""
}
${referencesBlock ?? ""}

<historial>
${historyBlock(history)}
</historial>

<plan_anterior>
${lastPlan ? JSON.stringify(lastPlan) : "(ninguno)"}
</plan_anterior>

<pedido_del_usuario>
${idea}
</pedido_del_usuario>

<ejemplos_de_nivel>
Son de otros rubros. Muestran el nivel de tensión y de especificidad que busco, no una plantilla: tus ideas tienen que tener forma propia.

${ejemplos.join("\n\n---\n\n")}
</ejemplos_de_nivel>

ÁNGULO DE ESTA TANDA:
${lente.descripcion}

TAREA:
Escribí ${IDEAS_POR_LENTE} ideas de apertura distintas entre sí, todas dentro de ese ángulo. Si el usuario está pidiendo un cambio sobre el plan anterior, aplicalo; si pide otra cosa, ignorá el plan anterior.

Para cada idea estimá "p": qué tan probable es que otro guionista, con este mismo pedido y este mismo material, llegue a una idea parecida (de 0 a 1). Escribí primero las más obvias y al final las más raras. Al menos 2 ideas tienen que tener p menor a 0,10.

Usá EXACTAMENTE este formato, sin texto antes ni después:

### IDEA 1 (p=0.xx)
TÍTULO: cómo la recordaría alguien que la vio
PRIMER CUADRO: qué se ve exactamente en el segundo 0 a 1, sin logo
DICE: primera frase hablada o en off, máximo 12 palabras (o — si no habla nadie)
TEXTO EN PANTALLA: máximo 8 palabras
QUÉ PASA DESPUÉS: 2 o 3 frases con lo que se ve y se oye hasta el final
HECHO DEL NEGOCIO: el dato del material en el que se apoya
ENTRA EL NEGOCIO: en qué segundo y a través de qué objeto, acción o detalle
`.trim();

const normLabel = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const LABEL_MAP = {
  "TITULO": "titulo",
  "PRIMER CUADRO": "primer_cuadro",
  "DICE": "primera_frase",
  "TEXTO EN PANTALLA": "texto_pantalla",
  "QUE PASA DESPUES": "desarrollo",
  "HECHO DEL NEGOCIO": "hecho_usado",
  "ENTRA EL NEGOCIO": "entrada_marca",
};

// "DICE (en off)", "Texto en pantalla (máx 8)", etc.
const resolveLabelKey = (label) => {
  const n = normLabel(label);
  if (LABEL_MAP[n]) return LABEL_MAP[n];

  for (const k of Object.keys(LABEL_MAP)) {
    if (n.startsWith(k + " ")) return LABEL_MAP[k];
  }

  return null;
};

const HEADER_RE = /^[ \t]*(?:#{1,6}[ \t]*)?[*_]*[ \t]*IDEA[ \t]*#?\d+[^\n]*$/gim;
const LABEL_LINE_RE =
  /^\s*(?:[-*•>]+\s*)?(?:\d+[.)]\s*)?[*_]*\s*([^:\n]{3,40}?)\s*[*_]*\s*:\s*[*_]*\s*(.*)$/;

const splitIdeaBlocks = (text) => {
  const heads = [...text.matchAll(HEADER_RE)];

  if (heads.length) {
    return heads.map((h, i) => ({
      header: h[0],
      body: text.slice(
        h.index + h[0].length,
        i + 1 < heads.length ? heads[i + 1].index : text.length
      ),
    }));
  }

  // Sin encabezados "IDEA n": cortar cada vez que aparece una línea TÍTULO:
  return text
    .split(/^(?=[ \t]*(?:[-*•>]+[ \t]*)?[*_]*[ \t]*T[ÍI]TULO[*_ \t]*:)/gim)
    .filter((part) => part.trim())
    .map((part) => ({ header: "", body: part }));
};

const parseIdeas = (rawText, lenteId, startId = 1) => {
  const text = String(rawText ?? "")
    .replace(/\r/g, "")
    .replace(/```[a-z]*|```/g, "");

  const ideas = [];

  for (const { header, body } of splitIdeaBlocks(text)) {
    const pMatch = `${header}\n${body}`.match(/\bp\s*=\s*([0-9]+[.,]?[0-9]*)/i);
    const p = pMatch ? Number(pMatch[1].replace(",", ".")) : null;

    const idea = { lente: lenteId, p: Number.isFinite(p) ? p : null };
    let current = null;

    for (const line of body.split("\n")) {
      const m = line.match(LABEL_LINE_RE);
      const key = m ? resolveLabelKey(m[1]) : null;

      if (key) {
        current = key;
        idea[key] = m[2].replace(/[*_]+$/g, "").trim();
      } else if (current && line.trim()) {
        idea[current] = `${idea[current] ?? ""} ${line.trim()}`.trim();
      }
    }

    const tienePrimerCuadro = String(idea.primer_cuadro ?? "").trim().length >= 10;
    const tieneDesarrollo =
      String(idea.desarrollo ?? "").trim().length >= 15 ||
      String(idea.primera_frase ?? "").trim().length >= 5;

    if (tienePrimerCuadro && tieneDesarrollo) ideas.push(idea);
  }

  return ideas.map((it, i) => ({ id: startId + i, ...it }));
};

// ── Filtros mínimos (solo clichés y métricas inventadas) ────
const DESCARTAR_PATTERNS = [
  /no vas a creer/i,
  /¿sabías que/i,
  /game changer/i,
  /cambi(é|a) tu vida/i,
  /lo que nadie te cuenta/i,
  /\b\d{1,3}\s?%\s?(viral|retención|probabilidad|más views)/i,
];

const ideaText = (it) =>
  [
    it.primer_cuadro,
    it.primera_frase,
    it.texto_pantalla,
    it.desarrollo,
    it.entrada_marca,
  ]
    .filter(Boolean)
    .join(" ");

const esDescartable = (it) =>
  DESCARTAR_PATTERNS.some((re) => re.test(ideaText(it)));

// ── Juez: ranking forzado, sin puntajes ─────────────────────
const buildJudgePrompt = ({ ideas, businessContext }) =>
  `
<negocio>
${businessContext ?? "(no informado)"}
</negocio>

<ideas>
${ideas
  .map(
    (it) =>
      `[${it.id}] ${it.titulo ?? ""}
PRIMER CUADRO: ${it.primer_cuadro ?? ""}
DICE: ${it.primera_frase ?? ""}
TEXTO EN PANTALLA: ${it.texto_pantalla ?? ""}
QUÉ PASA DESPUÉS: ${it.desarrollo ?? ""}
HECHO DEL NEGOCIO: ${it.hecho_usado ?? ""}
ENTRA EL NEGOCIO: ${it.entrada_marca ?? ""}`
  )
  .join("\n\n")}
</ideas>

TAREA:
Ordená TODAS las ideas de la mejor a la peor. Compará de a pares: cuando dudes entre dos, elegí la que te harías ver hasta el final y la que se grabaría mejor esta semana. No empates.
No elijas dos ideas con el mismo corazón (aunque cambien el rubro del objeto): si hay dos parecidas, la peor va más abajo.

Respondé SOLO con JSON válido, sin bloques de código:
{
  "tipo":"seleccion",
  "ranking":[3,1,2],
  "nota_top":[
    {"id":3,"por_que":"una frase"}
  ]
}

Reglas:
- "ranking" incluye todos los ids, una sola vez cada uno.
- "nota_top": una frase por cada una de las ${FINALISTAS} primeras.`.trim();

const validSeleccion = (o) =>
  o?.tipo === "seleccion" &&
  Array.isArray(o.ranking) &&
  o.ranking.length > 0;

// ── Guion (texto libre) y conversión a plan (JSON) ──────────
const buildScriptPrompt = ({
  finalista,
  history,
  lastPlan,
  businessContext,
  materialBlock,
  referencesBlock,
}) =>
  `
<negocio>
${businessContext ?? "(no informado)"}
</negocio>

<material>
${materialBlock}
</material>

${referencesBlock ?? ""}

<historial>
${historyBlock(history)}
</historial>

<plan_anterior>
${lastPlan ? JSON.stringify(lastPlan) : "(ninguno)"}
</plan_anterior>

<idea_elegida>
TÍTULO: ${finalista.titulo ?? ""}
PRIMER CUADRO: ${finalista.primer_cuadro ?? ""}
DICE: ${finalista.primera_frase ?? ""}
TEXTO EN PANTALLA: ${finalista.texto_pantalla ?? ""}
QUÉ PASA DESPUÉS: ${finalista.desarrollo ?? ""}
HECHO DEL NEGOCIO: ${finalista.hecho_usado ?? ""}
ENTRA EL NEGOCIO: ${finalista.entrada_marca ?? ""}
</idea_elegida>

TAREA:
Escribí el guion de este video para grabar con celular (entre 15 y 30 segundos).
Mantené la esencia de la idea; podés mejorar el ritmo y los detalles usando solo hechos del material.

Escribilo en texto corrido, en 3 a 5 momentos con su tiempo aproximado. En cada momento contá qué se ve, qué se oye o se dice, y el texto en pantalla si hay. El primer momento incluye el primer cuadro, la primera frase y el texto en pantalla exacto entre comillas (máximo 8 palabras). En uno de los momentos entra el negocio sin discurso de venta. El final resuelve, revela o deja una pregunta concreta.

Después del guion agregá tres líneas sueltas, cada una de una frase:
- Lo más fuerte del video:
- Lo más débil del video:
- En qué segundo empieza a parecer un anuncio:
`.trim();

const buildPlanJsonPrompt = ({ guion, finalista, lastPlan }) =>
  `
Convertí este guion a JSON sin cambiar su contenido. No agregues ideas ni datos nuevos.

<guion>
${guion}
</guion>

<mecanica_de_la_idea>
${finalista.titulo ?? ""}
</mecanica_de_la_idea>

Respondé SOLO con JSON válido, sin texto antes ni después, sin bloques de código:
{
  "tipo":"plan",
  "titulo":"",
  "tipo_hook":"",
  "idea_principal":"",
  "ejecucion":[
    {"momento":"", "descripcion":""}
  ],
  "analisis":{
    "por_que_detiene_scroll":"",
    "por_que_alguien_haria_scroll":"",
    "momento_mas_fuerte":"",
    "momento_mas_debil":""
  },
  "veredicto":{
    "nivel":"alto|medio|bajo",
    "razon":""
  },
  "pregunta_seguimiento":""
}

Reglas:
- "titulo": cómo lo recordaría alguien que lo vio.
- "tipo_hook": nombre corto del formato (por ejemplo "diálogo", "objeto", "experimento").
- "idea_principal": la razón humana por la que un desconocido se queda.
- "ejecucion": 3 a 5 momentos tomados del guion. "descripcion": una o dos frases con lo que se ve y se oye. El primer momento incluye el texto en pantalla exacto entre comillas.
- "por_que_detiene_scroll": qué queda sin resolver en el primer segundo.
- "por_que_alguien_haria_scroll": en qué instante se vuelve anuncio o se agota la tensión.
- "momento_mas_fuerte" y "momento_mas_debil": tomalos de las líneas finales del guion.
- "veredicto.nivel": "alto" si el video engancha aunque no se sepa que es de un negocio; "medio" si depende del contexto; "bajo" si es una demostración de producto. "razon": una o dos frases.
- "pregunta_seguimiento": vacía${lastPlan ? "" : ", salvo que falte un dato que cambiaría el guion"}.
- Máximo 2 frases por campo de análisis y veredicto.`.trim();

const validPlan = (o) =>
  o?.tipo === "plan" &&
  typeof o.idea_principal === "string" &&
  o.idea_principal.trim().length > 0 &&
  Array.isArray(o.ejecucion) &&
  o.ejecucion.length > 0;

// ── Parsing ─────────────────────────────────────────────────
const parseJson = (raw) => {
  if (!raw || typeof raw !== "string") return null;

  const s = raw.replace(/```json|```/g, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");

  if (a === -1 || b === -1) return null;

  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
};

// ── Streaming ───────────────────────────────────────────────
// Cambio: opción `raw` para devolver el texto sin parsear (generación libre).
const callGeminiStream = async (
  supabase,
  body,
  { onThinking, signal, raw = false } = {}
) => {
  const projectUrl = supabase.supabaseUrl;
  const session = await supabase.auth.getSession();
  const token = session?.data?.session?.access_token ?? "";

  const res = await fetch(`${projectUrl}/functions/v1/gemini-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabase.supabaseKey,
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    const err = new Error(`gemini-proxy stream ${res.status}: ${msg.slice(0, 200)}`);
    err.retryable = res.status >= 500 || res.status === 429 || res.status === 408;
    throw err;
  }

  if (!res.body) {
    const err = new Error("La conexión no devolvió datos. Probá de nuevo.");
    err.retryable = true;
    throw err;
  }

  let jsonText = "";
  let tokens = 0;
  let usedSearch = false;
  let searchQueries = [];

  const handleLine = (line) => {
    if (!line.startsWith("data:")) return;

    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    let chunk;

    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }

    if (chunk.type === "thinking" && chunk.text) {
      onThinking?.(chunk.text);
    } else if (chunk.type === "text" && chunk.text) {
      jsonText += chunk.text;
    } else if (chunk.type === "done") {
      tokens = chunk.tokens ?? 0;
      usedSearch = chunk.usedSearch === true;
      searchQueries = Array.isArray(chunk.searchQueries) ? chunk.searchQueries : [];
    } else if (chunk.type === "error") {
      throw new Error(chunk.message ?? "Error en el stream de Gemini");
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) handleLine(line.replace(/\r$/, ""));
  }

  buf += decoder.decode();

  if (buf.trim()) handleLine(buf.replace(/\r$/, ""));

  if (raw) {
    if (!jsonText.trim()) {
      const err = new Error("La IA devolvió una respuesta vacía. Probá de nuevo.");
      err.tokens = tokens;
      err.retryable = true;
      throw err;
    }

    return { json: null, text: jsonText, tokens, usedSearch, searchQueries };
  }

  const json = parseJson(jsonText);

  if (!json) {
    console.warn("Stream: JSON no parseable. Texto acumulado:", jsonText.slice(0, 500));

    const err = new Error("La IA devolvió un formato inesperado. Probá de nuevo.");
    err.tokens = tokens;
    err.retryable = true;
    throw err;
  }

  return { json, text: jsonText, tokens, usedSearch, searchQueries };
};

// ── Señales culturales (sin cambios de fondo) ───────────────
const TREND_TTL_MS = 6 * 60 * 60 * 1000;
const trendCache = new Map();

const rubroDe = (businessContext) =>
  String(businessContext ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

const fetchTrendSignals = async ({
  supabase,
  model,
  platform,
  businessContext,
  signal,
}) => {
  const rubro = rubroDe(businessContext);
  const key = `${platform}|${rubro}`;
  const hit = trendCache.get(key);

  if (hit && Date.now() - hit.at < TREND_TTL_MS) {
    return { ...hit, tokens: 0, cached: true };
  }

  const text = `
Tarea: detectar señales culturales ORGÁNICAS que están funcionando ahora en ${platform}.

Buscá:
- formatos narrativos
- estructuras de video
- tipos de sonido
- humor
- conflictos cotidianos
- patrones visuales
- tensiones cotidianas

Rubro de referencia:
${rubro || "(rubro no informado)"}

Reglas:
- Buscá tendencias de creadores y comunidades, no publicidad ni casos de marcas.
- Ignorá artículos de marketing, growth hacking y consejos para hacer crecer un negocio.
- Cada señal debe describir un patrón de video en una frase.
- No nombres marcas ni productos concretos.
- Priorizá señales que puedan adaptarse a situaciones locales y cotidianas.

Respondé SOLO con JSON válido, sin bloques de código:
{"senales":["...","..."]}

Devolvé entre 5 y 8 señales.`.trim();

  const r = await callGeminiStream(
    supabase,
    {
      ...CFG,
      thinkingLevel: "low",
      maxOutputTokens: 4096,
      useSearch: true,
      model,
      text,
    },
    { signal }
  );

  if (!r.usedSearch) {
    return { text: null, tokens: r.tokens, queries: [], cached: false };
  }

  const senales = Array.isArray(r.json?.senales)
    ? r.json.senales.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
    : [];

  const entry = {
    text: senales.length ? senales.map((s) => `- ${s}`).join("\n") : null,
    tokens: r.tokens,
    queries: r.searchQueries,
    at: Date.now(),
  };

  if (entry.text) trendCache.set(key, entry);

  return { ...entry, cached: false };
};

// ── Pipeline ────────────────────────────────────────────────
export const runIdeaPipeline = async ({
  supabase,
  model,
  judgeModel = null, // idealmente OTRO modelo distinto al que genera
  idea,
  history = [],
  platform = "tiktok",
  lastPlan = null,
  businessContext: businessContextRaw = null,
  trendContext = null,
  outliers = null,
  questionsAsked = null,
  onThinking = null,
  signal = null,
  useSearch = true,
}) => {
  const trace = [];
  const total = () => trace.reduce((s, t) => s + t.tokens, 0);

  const businessContext = formatBusinessContext(businessContextRaw);
  const asked = questionsAsked ?? countQuestions(history);
  const canAsk = puedePreguntar({ asked, lastPlan, idea, businessContext });

  const systemPrompt = buildSystemPrompt();
  const editorPrompt = buildEditorPrompt();

  const askError = () =>
    new Error("La IA devolvió un formato inesperado. Probá de nuevo.");

  const retryNote =
    "\n\nIMPORTANTE: tu respuesta anterior se cortó o fue inválida. " +
    "Respondé completa, en el formato pedido y más concisa.";

  // ── Llamada base a un modelo ──────────────────────────────
  const ask = async ({
    stage,
    text,
    system = systemPrompt,
    cfg = {},
    raw = false,
    modelOverride = null,
    extraBody = {},
    thinking = true,
  }) => {
    try {
      const r = await callGeminiStream(
        supabase,
        {
          ...CFG,
          ...cfg,
          useSearch: false,
          model: modelOverride ?? model,
          ...extraBody,
          ...(SYSTEM_SEPARATE ? { systemInstruction: system } : {}),
          text: (SYSTEM_SEPARATE ? "" : `${system}\n\n`) + text,
        },
        { onThinking: thinking ? onThinking : undefined, signal, raw }
      );

      trace.push({ stage, tokens: r.tokens, usedSearch: r.usedSearch });

      return raw ? r.text : r.json;
    } catch (e) {
      trace.push({ stage: `${stage}_fail`, tokens: e.tokens ?? 0 });
      e.tokens = 0;
      throw e;
    }
  };

  // ── Una etapa con reintentos ──────────────────────────────
  const runStage = async ({
    stage,
    buildText,
    validate,
    system,
    cfg = {},
    raw = false,
    modelOverride = null,
    extraBody = {},
    thinking = true,
  }) => {
    let lastErr = null;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      try {
        const out = await ask({
          stage: intento === 0 ? stage : `${stage}_retry`,
          text: buildText() + (intento === 0 ? "" : retryNote),
          system,
          cfg: intento === 0 ? cfg : { ...cfg, thinkingLevel: "low" },
          raw,
          modelOverride,
          extraBody,
          thinking,
        });

        if (validate(out)) return out;

        lastErr = askError();
      } catch (e) {
        lastErr = e;
        console.warn(`[${stage}] intento ${intento + 1} falló:`, e?.message);
        if (isAbort(e) || !e.retryable) break;
        await sleep(700 * (intento + 1));
      }
    }

    throw lastErr ?? askError();
  };

  try {
    // ── Etapa 0: señales culturales (opcional) ──────────────
    let signals = trendContext;

    if (!signals && useSearch) {
      try {
        const t = await fetchTrendSignals({
          supabase,
          model,
          platform,
          businessContext,
          signal,
        });

        signals = t.text;

        trace.push({
          stage: "trends",
          tokens: t.tokens,
          cached: t.cached,
          queries: t.queries,
        });
      } catch (e) {
        if (isAbort(e)) throw e;

        trace.push({ stage: "trends_fail", tokens: 0 });
        console.warn("[trends] falló, sigo sin señales:", e.message);
      }
    }

    // ── Etapa 1: análisis de referencias reales ─────────────
    // Si cada outlier trae `videoUrl` (por ejemplo YouTube Shorts), se manda
    // a Gemini como video. Tu gemini-proxy tiene que reenviar `videoUris` como
    // fileData.fileUri; si no lo hace, se ignora y se analiza solo el texto.
    let referencesBlock = "";
    const rawRefs = outliers ? String(formatOutliers(outliers) ?? "").trim() : "";

    if (rawRefs) {
      const videoUris = Array.isArray(outliers)
        ? outliers.map((o) => o?.videoUrl).filter(Boolean).slice(0, 5)
        : [];

      try {
        const refsOut = await runStage({
          stage: "referencias",
          buildText: () => buildReferenceAnalysisPrompt(rawRefs),
          validate: validReferencias,
          cfg: { thinkingLevel: "low" },
          extraBody: videoUris.length ? { videoUris } : {},
          thinking: false,
        });

        referencesBlock = formatReferencias(refsOut.referencias.slice(0, 6));
      } catch (e) {
        if (isAbort(e)) throw e;

        console.warn("[referencias] falló, uso los outliers sin analizar:", e.message);

        referencesBlock = `<referencias_reales>\nVideos reales que funcionaron muy bien. Tomá su mecánica y llevala a la situación de este negocio; las palabras y la situación tienen que ser del negocio.\n\n${rawRefs}\n</referencias_reales>`;
      }
    }

    // ── Etapa 2: material + entrevista al dueño ─────────────
    const materialOut = await runStage({
      stage: "material",
      buildText: () =>
        buildMaterialPrompt({
          idea,
          history,
          businessContext,
          trendContext: signals,
        }),
      validate: (o) =>
        (o?.tipo === "pregunta" && String(o.mensaje ?? "").trim()) ||
        validMaterial(o),
    });

    if (materialOut.tipo === "pregunta") {
      if (canAsk) {
        return {
          plan: { tipo: "pregunta", mensaje: String(materialOut.mensaje).trim() },
          tokens: total(),
          trace,
        };
      }

      throw new Error(
        "No se entiende qué negocio o producto es. Contame un poco más y lo intento de nuevo."
      );
    }

    const hechosReales = materialOut.hechos.filter(
      (h) => norm(h?.fuente) !== "inferencia"
    ).length;

    if (hechosReales < MIN_HECHOS_REALES && canAsk) {
      return {
        plan: {
          tipo: "pregunta",
          mensaje: buildInterviewMessage(
            materialOut.preguntas_para_el_dueno,
            rubroDe(businessContext)
          ),
        },
        tokens: total(),
        trace,
      };
    }

    const materialBlock = buildMaterialBlock(materialOut);

    // ── Etapa 3: generación en paralelo, un ángulo por llamada ─
    const lentes = pick(LENTES, N_LENTES);

    const settled = await Promise.allSettled(
      lentes.map((lente, i) =>
        runStage({
          stage: `ideas_${lente.id}`,
          buildText: () =>
            buildGenerationPrompt({
              idea,
              history,
              lastPlan,
              businessContext,
              materialBlock,
              trendContext: signals,
              referencesBlock,
              lente,
              ejemplos: pick(EJEMPLOS, EJEMPLOS_POR_LLAMADA),
            }),
          validate: (t) => parseIdeas(t, lente.id).length > 0,
          cfg: i === 0 ? {} : { thinkingLevel: "low" },
          raw: true,
          thinking: i === 0,
        })
      )
    );

    const aborted = settled.find(
      (r) => r.status === "rejected" && isAbort(r.reason)
    );
    if (aborted) throw aborted.reason;

    settled.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[ideas_${lentes[i].id}] sin resultado:`, r.reason?.message ?? r.reason);
      }
    });

    let nextId = 1;
    const ideas = [];

    settled.forEach((r, i) => {
      if (r.status !== "fulfilled") return;

      const parsed = parseIdeas(r.value, lentes[i].id, nextId);
      nextId += parsed.length;
      ideas.push(...parsed);
    });

    if (!ideas.length) {
      if (canAsk) {
        return {
          plan: {
            tipo: "pregunta",
            mensaje: buildInterviewMessage([], rubroDe(businessContext)),
          },
          tokens: total(),
          trace,
        };
      }

      throw new Error("La IA no pudo generar ideas. Probá de nuevo.");
    }

    // Filtro mínimo: si deja muy pocas, se ignora y se usan todas.
    let pool = ideas.filter((it) => !esDescartable(it));
    if (pool.length < 4) pool = ideas;

    // ── Etapa 4: juez separado, ranking forzado ─────────────
    let finalistas = null;

    try {
      const judged = await runStage({
        stage: "seleccion",
        buildText: () =>
          buildJudgePrompt({ ideas: shuffle(pool), businessContext }),
        validate: validSeleccion,
        system: editorPrompt,
        cfg: { ...CFG_SELECT },
        modelOverride: judgeModel,
        thinking: false,
      });

      const byId = new Map(pool.map((it) => [String(it.id), it]));
      const notas = new Map(
        (judged.nota_top || []).map((n) => [String(n?.id), n?.por_que])
      );
      const seen = new Set();
      const ordered = [];

      for (const rid of judged.ranking) {
        const key = String(rid);
        if (byId.has(key) && !seen.has(key)) {
          seen.add(key);
          ordered.push({ ...byId.get(key), por_que_gano: notas.get(key) ?? "" });
        }
      }

      for (const it of pool) {
        if (!seen.has(String(it.id))) ordered.push(it);
      }

      finalistas = ordered.slice(0, FINALISTAS);
    } catch (e) {
      if (isAbort(e)) throw e;

      console.warn("[seleccion] falló, tomo una idea por ángulo:", e.message);

      const porLente = new Map();
      for (const it of pool) {
        if (!porLente.has(it.lente)) porLente.set(it.lente, it);
      }
      finalistas = [...porLente.values()].slice(0, FINALISTAS);
    }

    const finalista = finalistas[0];

    // ── Etapa 5: guion en texto libre ───────────────────────
    const guion = await runStage({
      stage: "guion",
      buildText: () =>
        buildScriptPrompt({
          finalista,
          history,
          lastPlan,
          businessContext,
          materialBlock,
          referencesBlock,
        }),
      validate: (t) => typeof t === "string" && t.trim().length > 80,
      raw: true,
    });

    // ── Etapa 6: convertir el guion a JSON ──────────────────
    const planOut = await runStage({
      stage: "plan",
      buildText: () => buildPlanJsonPrompt({ guion, finalista, lastPlan }),
      validate: validPlan,
      cfg: { thinkingLevel: "low" },
      thinking: false,
    });

    const nivel = NIVELES.includes(norm(planOut.veredicto?.nivel))
      ? norm(planOut.veredicto.nivel)
      : "medio";

    const ejecucion = (planOut.ejecucion || [])
      .map((e) => (typeof e === "string" ? { momento: "", descripcion: e } : e))
      .filter((e) => e && String(e.descripcion ?? "").trim())
      .slice(0, 8);

    if (!ejecucion.length) throw askError();

    return {
      plan: {
        tipo: "plan",
        titulo: planOut.titulo,
        tipo_hook:
          String(planOut.tipo_hook ?? planOut.tipoHook ?? finalista.lente ?? "").trim() ||
          undefined,
        idea_principal: planOut.idea_principal,
        ejecucion,
        analisis: planOut.analisis ?? null,
        veredicto: {
          nivel,
          razon: planOut.veredicto?.razon ?? planOut.veredicto?.["razón"] ?? "",
        },
        pregunta_seguimiento: planOut.pregunta_seguimiento,
        hook_seleccionado: finalista,
        alternativas: finalistas.slice(1),
        guion_texto: guion,
      },
      tokens: total(),
      trace,
    };
  } catch (e) {
    e.tokens = (e.tokens ?? 0) + total();
    throw e;
  }
};