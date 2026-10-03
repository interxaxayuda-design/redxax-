// supabase/functions/discord-bot/index.ts
// Bot de Discord (VIRAX AI) como Edge Function: Discord llama a esta URL
// cada vez que alguien usa /analizar. No hay nada corriendo el resto del tiempo.
import { createClient } from "npm:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// ─────────────────────────────────────────────────────────────
// Configuración
//   Secrets a crear:  DISCORD_PUBLIC_KEY, DISCORD_APP_ID, PLAY_STORE_URL
//   Ya vienen solos:  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────
const PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";
const APP_ID = Deno.env.get("DISCORD_APP_ID") ?? "";
const PLAY_STORE_URL = Deno.env.get("PLAY_STORE_URL") ??
  "https://play.google.com/store/apps/details?id=tu.paquete.virax";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_PRUEBAS = 2;
const MAX_VIDEO_MB = 15;
const EPHEMERAL = 64; // flag de Discord: mensaje visible solo para el usuario

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─────────────────────────────────────────────────────────────
// Utilidades de respuesta
// ─────────────────────────────────────────────────────────────
const json = (obj: unknown) =>
  new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });

const efimero = (content: string, components?: unknown[]) =>
  json({ type: 4, data: { content, flags: EPHEMERAL, ...(components && { components }) } });

const botonLink = (label: string) => ({
  type: 1,
  components: [{ type: 2, style: 5, label, url: PLAY_STORE_URL }],
});

// ─────────────────────────────────────────────────────────────
// Verificación de firma de Discord (obligatoria)
// ─────────────────────────────────────────────────────────────
const hexABytes = (hex: string) =>
  Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

function firmaValida(req: Request, body: string): boolean {
  const sig = req.headers.get("x-signature-ed25519");
  const ts = req.headers.get("x-signature-timestamp");
  if (!sig || !ts || !PUBLIC_KEY) return false;
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(ts + body),
      hexABytes(sig),
      hexABytes(PUBLIC_KEY),
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// IA: todo lo redacta Gemini a través de tu gemini-proxy
// ─────────────────────────────────────────────────────────────
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    nivel: { type: "STRING", enum: ["alto", "medio", "bajo"] },
    potencial: { type: "STRING" },
    retencion: { type: "STRING" },
    microTip: { type: "STRING" },
  },
  required: ["nivel", "potencial", "retencion", "microTip"],
};

function construirPrompt(texto: string, hayVideo: boolean): string {
  return `Eres VIRAX AI, una estratega experta en contenido viral de formato corto (TikTok, Reels, Shorts).
Tu trabajo es ANALIZAR de verdad lo que el creador te envía y razonar sobre ello. No des consejos genéricos:
cada observación debe apoyarse en algo concreto y específico de este contenido.

${
    hayVideo
      ? `Recibes el video (con audio). Evalúa el primer segundo, el gancho visual y hablado, lo que dice la persona y cómo lo dice, el texto en pantalla, el encuadre, la iluminación, los cambios de plano, la música y el ritmo.`
      : `Recibes el texto del gancho o guion inicial. Evalúa: claridad, curiosidad que genera, promesa, especificidad, longitud y si detiene el scroll en los primeros 3 segundos.`
  }
${texto ? `\nContenido del creador: """${texto}"""\n` : ""}
Piensa qué funciona, qué falla y cuál es el cambio de mayor impacto. Escribe SIEMPRE en español, con tono directo y cercano.

Campos de la respuesta:
- nivel: "alto", "medio" o "bajo" según el potencial de retención.
- potencial: emoji + título corto de 2 a 5 palabras que resuma tu veredicto.
- retencion: emoji + una frase (máx. 15 palabras) sobre el riesgo de abandono en los primeros 3 segundos y por qué.
- microTip: el consejo más valioso y específico para ESTE contenido, máx. 30 palabras, con un ejemplo concreto de cómo aplicarlo.`;
}

// Gemini acepta "video/mov", no "video/quicktime"
function normalizarMime(ct?: string): string {
  const base = String(ct ?? "").split(";")[0].trim().toLowerCase();
  if (base === "video/quicktime") return "video/mov";
  return base || "video/mp4";
}

async function analizarConIA(texto: string, storagePath: string | null, mime: string) {
  const body: Record<string, unknown> = {
    text: construirPrompt(texto, !!storagePath),
    temperature: 0.7,
    maxOutputTokens: 2500, // incluye los tokens de razonamiento
    expectsJson: true,
    responseSchema: RESPONSE_SCHEMA,
    thinkingBudget: 1024, // la IA razona antes de responder
  };

  if (storagePath) {
    Object.assign(body, {
      storagePath,
      videoMimeType: mime,
      videoEndOffset: "20s", // solo los primeros 20 s (más barato)
      videoFps: 1,
      mediaResolution: "MEDIA_RESOLUTION_LOW",
    });
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(140_000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`gemini-proxy ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const raw = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");

  let r: Record<string, string>;
  try {
    r = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("La IA no devolvió JSON: " + raw.slice(0, 200));
    r = JSON.parse(m[0]);
  }
  if (!r.potencial || !r.retencion || !r.microTip) throw new Error("JSON de la IA incompleto");
  return r;
}

// ─────────────────────────────────────────────────────────────
// Editar el mensaje "pensando..." una vez listo el análisis
// ─────────────────────────────────────────────────────────────
async function editarRespuesta(token: string, payload: unknown) {
  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${APP_ID}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new Error(`Discord PATCH ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Trabajo en segundo plano (Discord ya recibió el "pensando...")
// ─────────────────────────────────────────────────────────────
async function procesar(
  i: any,
  ctx: { userId: string; texto: string; adj: any | null; usos: number },
) {
  const { userId, texto, adj, usos } = ctx;
  let storagePath: string | null = null;
  let entregado = false;

  try {
    let mime = "video/mp4";

    if (adj) {
      const res = await fetch(adj.url);
      if (!res.ok) throw new Error(`No se pudo descargar el video de Discord (${res.status})`);
      const buf = await res.arrayBuffer();
      mime = normalizarMime(adj.content_type);
      storagePath = `discord/${i.id}`;

      const { error } = await supabase.storage
        .from("videos")
        .upload(storagePath, buf, { contentType: mime, upsert: true });
      if (error) {
        storagePath = null;
        throw new Error("Storage: " + error.message);
      }
    }

    const r = await analizarConIA(texto, storagePath, mime);

    const nivel = String(r.nivel ?? "").toLowerCase();
    const color = nivel === "alto" ? 0x00ff7f : nivel === "bajo" ? 0xff4d4d : 0xffd700;
    const cortar = (s: unknown, n: number) => String(s).slice(0, n);

    await editarRespuesta(i.token, {
      embeds: [{
        color,
        title: "VIRAX AI | Diagnóstico",
        description: adj
          ? `📹 **Video:** [Ver clip](${adj.url})`
          : cortar(`> *"${texto}"*`, 1000),
        fields: [
          { name: "Diagnóstico", value: `**${cortar(r.potencial, 200)}**`, inline: true },
          { name: "Retención", value: `**${cortar(r.retencion, 300)}**`, inline: true },
          { name: "Micro-Tip", value: cortar(r.microTip, 1000) },
        ],
        footer: { text: `Prueba ${usos}/${MAX_PRUEBAS} utilizada • VIRAX App` },
      }],
      components: [botonLink("📲 Ver mapa de calor completo en la App")],
    });
    entregado = true;
  } catch (e) {
    console.error("Error procesando análisis:", String(e));

    if (!entregado) {
      // No se entregó el análisis: devolvemos la prueba al usuario
      await supabase.rpc("discord_refund_trial", { p_user: userId });
      const msg = String(e).includes("video_upload_failed")
        ? "❌ No pude procesar ese video. Prueba con un MP4 (H.264) más corto."
        : "❌ Hubo un error al procesar la solicitud. No se descontó tu prueba, inténtalo de nuevo.";
      try {
        await editarRespuesta(i.token, { content: msg });
      } catch (e2) {
        console.error("No se pudo avisar del error a Discord:", String(e2));
      }
    }
  } finally {
    // El video de Discord no se guarda en tu Storage
    if (storagePath) {
      await supabase.storage.from("videos").remove([storagePath]).catch(() => {});
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Manejo del comando /analizar (debe responder en < 3 s)
// ─────────────────────────────────────────────────────────────
async function manejarAnalizar(i: any) {
  const userId: string = i.member?.user?.id ?? i.user?.id;
  const opts: Record<string, any> = Object.fromEntries(
    (i.data.options ?? []).map((o: any) => [o.name, o.value]),
  );

  const texto = typeof opts.texto === "string" ? opts.texto.trim().slice(0, 1500) : "";
  const adj = opts.video ? i.data.resolved?.attachments?.[opts.video] ?? null : null;

  if (!texto && !adj) {
    return efimero("Debes adjuntar un video o escribir un texto para analizar.");
  }

  if (adj) {
    if (!String(adj.content_type ?? "").includes("video")) {
      return efimero("Por favor sube un archivo de video válido (MP4, MOV, WebM).");
    }
    if ((adj.size ?? 0) > MAX_VIDEO_MB * 1024 * 1024) {
      return efimero(`El video pesa demasiado. Sube un clip de máximo ${MAX_VIDEO_MB} MB.`);
    }
  }

  // Reserva atómica de la prueba (evita que se salten el límite con comandos simultáneos)
  const { data: usos, error } = await supabase.rpc("discord_reserve_trial", {
    p_user: userId,
    p_max: MAX_PRUEBAS,
  });
  if (error) {
    console.error("Error reservando prueba:", error.message);
    return efimero("⚠️ Error temporal. Inténtalo de nuevo en unos segundos.");
  }

  if (usos === -1) {
    return efimero(
      `**¡Te has quedado sin pruebas gratuitas!**\n\nHas alcanzado el límite de ${MAX_PRUEBAS} análisis en Discord.\nInstala **VIRAX** en Play Store para seguir analizando tus videos y obtener un análisis completo.`,
      [botonLink("Descargar VIRAX App Gratis")],
    );
  }

  // Seguimos trabajando en segundo plano y respondemos "pensando..." ya
  EdgeRuntime.waitUntil(procesar(i, { userId, texto, adj, usos }));
  return json({ type: 5 });
}

// ─────────────────────────────────────────────────────────────
// Punto de entrada
// ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("VIRAX AI bot online ✅");

  const body = await req.text();
  if (!firmaValida(req, body)) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body);

  // Discord verifica el endpoint con un PING
  if (interaction.type === 1) return json({ type: 1 });

  if (interaction.type === 2 && interaction.data?.name === "analizar") {
    return await manejarAnalizar(interaction);
  }

  return efimero("Comando no soportado.");
});