require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const ffmpegPath = require('ffmpeg-static'); // npm i ffmpeg-static

// -------------------------------------------------------------
// Variables de entorno (.env.local o panel del hosting)
// -------------------------------------------------------------
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PLAY_STORE_URL = process.env.PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=tu.paquete.virax';

// -------------------------------------------------------------
// Configuración
// -------------------------------------------------------------
// Interruptor de Play Store: poné true cuando la app esté publicada.
// En false se ocultan los botones, los enlaces y las menciones a la app.
const PLAY_STORE_ACTIVO = false;

const MAX_PRUEBAS = 2;
const MAX_DIRECTO_MB = 15;     // hasta acá el video se manda tal cual al proxy (se carga en memoria)
const MAX_DESCARGA_MB = 100;   // techo de descarga; lo que pase de MAX_DIRECTO_MB se comprime
const SEGUNDOS_ANALISIS = 20;  // la IA solo analiza los primeros 20 s, así que no hace falta más

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Fila con el botón de Play Store (null si el interruptor está apagado)
function filaPlayStore(label) {
  if (!PLAY_STORE_ACTIVO) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(PLAY_STORE_URL)
  );
}

// -------------------------------------------------------------
// 1. REGISTRO DEL COMANDO /analizar
// -------------------------------------------------------------
const commands = [
  new SlashCommandBuilder()
    .setName('analizar')
    .setDescription('Evalúa la retención de tu video o guion con VIRAX AI')
    .addAttachmentOption(o =>
      o.setName('video').setDescription('Sube un clip corto (MP4 / MOV)').setRequired(false))
    .addStringOption(o =>
      o.setName('texto').setDescription('Escribe el texto de tu gancho o guion inicial').setRequired(false))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔄 Desplegando comandos Slash...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Comando /analizar activo en Discord');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
})();

// -------------------------------------------------------------
// 2. IA: todo el contenido lo redacta Gemini vía tu gemini-proxy
// -------------------------------------------------------------
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nivel: { type: 'STRING', enum: ['alto', 'medio', 'bajo'] },
    potencial: { type: 'STRING' },
    retencion: { type: 'STRING' },
    microTip: { type: 'STRING' }
  },
  required: ['nivel', 'potencial', 'retencion', 'microTip']
};

function construirPrompt({ texto, hayVideo }) {
  return `Eres VIRAX AI, una estratega experta en contenido viral de formato corto (TikTok, Reels, Shorts).
Tu trabajo es ANALIZAR de verdad lo que el creador te envía y razonar sobre ello. No des consejos genéricos:
cada observación debe apoyarse en algo concreto y específico de este contenido.

${hayVideo
  ? `Recibes el video (con audio). Evalúa el primer segundo, el gancho visual y hablado, lo que dice la persona y cómo lo dice, el texto en pantalla, el encuadre, la iluminación, los cambios de plano, la música y el ritmo.`
  : `Recibes el texto del gancho o guion inicial. Evalúa: claridad, curiosidad que genera, promesa, especificidad, longitud y si detiene el scroll en los primeros 3 segundos.`}
${texto ? `\nContenido del creador: """${texto}"""\n` : ''}
Piensa qué funciona, qué falla y cuál es el cambio de mayor impacto. Escribe SIEMPRE en español, con tono directo y cercano.

Campos de la respuesta:
- nivel: "alto", "medio" o "bajo" según el potencial de retención.
- potencial: emoji + título corto de 2 a 5 palabras que resuma tu veredicto.
- retencion: emoji + una frase (máx. 15 palabras) sobre el riesgo de abandono en los primeros 3 segundos y por qué.
- microTip: el consejo más valioso y específico para ESTE contenido, máx. 30 palabras, con un ejemplo concreto de cómo aplicarlo.`;
}

// Gemini acepta "video/mov", no "video/quicktime"
function normalizarMime(contentType) {
  const base = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (base === 'video/quicktime') return 'video/mov';
  return base || 'video/mp4';
}

async function analizarConIA({ texto, video }) {
  const body = {
    text: construirPrompt({ texto, hayVideo: !!video }),
    temperature: 0.7,
    maxOutputTokens: 2500,      // incluye los tokens de razonamiento
    expectsJson: true,          // el proxy activa el modo JSON
    responseSchema: RESPONSE_SCHEMA,
    thinkingBudget: 1024        // deja que la IA razone antes de responder
  };

  if (video) {
    Object.assign(body, {
      videoBase64: video.base64,
      videoMimeType: video.mimeType,
      videoEndOffset: `${SEGUNDOS_ANALISIS}s`,
      videoFps: 1,
      mediaResolution: 'MEDIA_RESOLUTION_LOW'
    });
  }

  const { data } = await axios.post(`${SUPABASE_URL}/functions/v1/gemini-proxy`, body, {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 140000,            // el proxy espera hasta 150 s
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });

  const raw = (data?.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
  let r;
  try {
    r = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('La IA no devolvió JSON: ' + raw.slice(0, 200));
    r = JSON.parse(match[0]);
  }
  if (!r.potencial || !r.retencion || !r.microTip) throw new Error('JSON de la IA incompleto');
  return r;
}

// -------------------------------------------------------------
// 2b. VIDEO: descarga y, si pesa más de MAX_DIRECTO_MB, compresión con ffmpeg
// -------------------------------------------------------------
// Recorta a los primeros SEGUNDOS_ANALISIS s, escala a máx. 720 px del lado largo,
// 24 fps y ~1,2 Mbps (mismos valores que el compresor de la app).
function comprimirVideo(entrada, salida) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y', '-i', entrada,
      '-t', String(SEGUNDOS_ANALISIS),
      '-vf', "scale='if(gt(iw,ih),min(720,iw),-2)':'if(gt(iw,ih),-2,min(720,ih))'",
      '-r', '24',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
      '-maxrate', '1200k', '-bufsize', '2400k',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '64k',
      '-movflags', '+faststart',
      salida
    ];

    const ff = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let log = '';
    ff.stderr.on('data', d => { log = (log + d).slice(-2000); });

    const timer = setTimeout(() => {
      ff.kill('SIGKILL');
      reject(new Error('ffmpeg tardó demasiado'));
    }, 90000);

    ff.on('error', e => { clearTimeout(timer); reject(e); });
    ff.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error('ffmpeg falló: ' + log.slice(-300)));
    });
  });
}

async function prepararVideo(attachment) {
  const pesaMucho = attachment.size > MAX_DIRECTO_MB * 1024 * 1024;

  if (!pesaMucho) {
    const res = await axios.get(attachment.url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: MAX_DIRECTO_MB * 1024 * 1024 * 1.1
    });
    return {
      base64: Buffer.from(res.data).toString('base64'),
      mimeType: normalizarMime(attachment.contentType)
    };
  }

  // Video pesado: se baja a disco (no a memoria), se comprime y se borra todo al terminar
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'virax-'));
  const entrada = path.join(tmp, 'entrada');
  const salida = path.join(tmp, 'salida.mp4');
  try {
    const res = await axios.get(attachment.url, {
      responseType: 'stream',
      timeout: 120000,
      maxContentLength: MAX_DESCARGA_MB * 1024 * 1024 * 1.1
    });
    await pipeline(res.data, fs.createWriteStream(entrada));
    await comprimirVideo(entrada, salida);
    const buf = await fs.promises.readFile(salida);
    return { base64: buf.toString('base64'), mimeType: 'video/mp4' };
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true });
  }
}

// -------------------------------------------------------------
// 3. CONTROL DE PRUEBAS (en memoria; se reinicia al apagar el bot)
// -------------------------------------------------------------
const userUsageMap = new Map();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'analizar') return;

  const userId = interaction.user.id;
  const usageCount = userUsageMap.get(userId) || 0;

  if (usageCount >= MAX_PRUEBAS) {
    const rowConversion = filaPlayStore('Descargar VIRAX App Gratis');
    const contenido = PLAY_STORE_ACTIVO
      ? `**¡Te has quedado sin pruebas gratuitas!**\n\nHas alcanzado el límite de ${MAX_PRUEBAS} análisis en Discord.\nInstala **VIRAX** en Play Store para seguir analizando tus videos y obtener un análisis completo.`
      : `**¡Te has quedado sin pruebas gratuitas!**\n\nHas alcanzado el límite de ${MAX_PRUEBAS} análisis en Discord.`;
    return interaction.reply({
      content: contenido,
      components: rowConversion ? [rowConversion] : [],
      flags: MessageFlags.Ephemeral
    });
  }

  const archivoVideo = interaction.options.getAttachment('video');
  const textoGancho = interaction.options.getString('texto');

  if (!archivoVideo && !textoGancho) {
    return interaction.reply({
      content: 'Debes adjuntar un video o escribir un texto para analizar.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (archivoVideo) {
    if (!archivoVideo.contentType?.includes('video')) {
      return interaction.reply({
        content: 'Por favor sube un archivo de video válido (MP4, MOV, WebM).',
        flags: MessageFlags.Ephemeral
      });
    }
    if (archivoVideo.size > MAX_DESCARGA_MB * 1024 * 1024) {
      return interaction.reply({
        content: `El video pesa demasiado. Sube un clip de máximo ${MAX_DESCARGA_MB} MB.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }

  // Discord solo da 3 s para responder: avisamos y editamos después
  await interaction.deferReply();

  try {
    const video = archivoVideo ? await prepararVideo(archivoVideo) : null;
    const r = await analizarConIA({ texto: textoGancho, video });

    const nivel = String(r.nivel || '').toLowerCase();
    const colorEmbed = nivel === 'alto' ? '#00FF7F' : nivel === 'bajo' ? '#FF4D4D' : '#FFD700';
    const recorte = (s, n) => String(s).slice(0, n);

    const embed = new EmbedBuilder()
      .setColor(colorEmbed)
      .setTitle('VIRAX AI | Diagnóstico')
      .setDescription(archivoVideo ? `📹 **Video:** [Ver clip](${archivoVideo.url})` : recorte(`> *"${textoGancho}"*`, 1000))
      .addFields(
        { name: 'Diagnóstico', value: `**${recorte(r.potencial, 200)}**`, inline: true },
        { name: 'Retención', value: `**${recorte(r.retencion, 300)}**`, inline: true },
        { name: 'Micro-Tip', value: recorte(r.microTip, 1000) }
      )
      .setFooter({ text: `Prueba ${usageCount + 1}/${MAX_PRUEBAS} utilizada • VIRAX AI` });

    const row = filaPlayStore('📲 Ver mapa de calor completo en la App');

    await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });

    // Solo se descuenta la prueba si el análisis se entregó
    userUsageMap.set(userId, usageCount + 1);
  } catch (error) {
    const detalle = error.response?.data;
    console.error('Error procesando análisis:', detalle || error.message);

    let msg;
    if (detalle?.error === 'video_upload_failed') {
      msg = '❌ No pude procesar ese video. Prueba con un MP4 (H.264) más corto.';
    } else if (String(error.message).startsWith('ffmpeg')) {
      msg = '❌ No pude comprimir ese video. Prueba con otro formato (MP4) o un clip más corto.';
    } else {
      msg = '❌ Hubo un error al procesar la solicitud. No se descontó tu prueba, inténtalo de nuevo.';
    }
    await interaction.editReply(msg);
  }
});

client.once('clientReady', () => {
  console.log(`🚀 Bot activo como ${client.user.tag}`);
});