import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB, tu límite actual

let ffmpegPromise = null;

// Carga el core una sola vez y lo reutiliza (evita re-descargar ~25MB cada vez)
function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

/**
 * Comprime el video solo si excede el límite. Devuelve el mismo File si ya entra.
 * onProgress recibe un número 0-100.
 */
export async function compressVideoIfNeeded(file, onProgress) {
  if (file.size <= MAX_UPLOAD_BYTES) return file;

  const ffmpeg = await getFFmpeg();

  const handleProgress = ({ progress }) => {
    onProgress?.(Math.min(100, Math.round(progress * 100)));
  };
  ffmpeg.on('progress', handleProgress);

  const ext = file.name.match(/\.\w+$/)?.[0] || '.mp4';
  const inputName = `input${ext}`;
  const outputName = 'output.mp4';

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // CRF más alto = más compresión. Empezamos moderado (720p, CRF 28).
  await ffmpeg.exec([
    '-i', inputName,
    '-vf', "scale='min(1280,iw)':-2",
    '-vcodec', 'libx264',
    '-preset', 'veryfast',
    '-crf', '28',
    '-acodec', 'aac',
    '-b:a', '96k',
    outputName,
  ]);

  let data = await ffmpeg.readFile(outputName);

  // Si con la primera pasada no alcanzó, repetimos más agresivo (480p, CRF 32)
  if (data.byteLength > MAX_UPLOAD_BYTES) {
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', "scale='min(854,iw)':-2",
      '-vcodec', 'libx264',
      '-preset', 'veryfast',
      '-crf', '32',
      '-acodec', 'aac',
      '-b:a', '64k',
      outputName,
    ]);
    data = await ffmpeg.readFile(outputName);
  }

  ffmpeg.off('progress', handleProgress);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  if (data.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('No se pudo comprimir el video por debajo de 50MB. Probá con un clip más corto.');
  }

  const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
  const newName = file.name.replace(/\.\w+$/, '') + '_compressed.mp4';
  return new File([compressedBlob], newName, { type: 'video/mp4' });
}