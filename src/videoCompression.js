const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export async function compressVideoIfNeeded(file, onProgress) {
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2) + 'MB';

  if (file.size <= MAX_UPLOAD_BYTES) {
    console.log('[Compresión] ✅ El video ya pesa menos de 50MB, se usa directo.');
    return file;
  }

  console.log(`[Compresión] Archivo pesado (${mb(file.size)}). Comprimiendo vía Hardware...`);
  const t0 = performance.now();

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      // Escalamos a máximo 720p para mantener excelente calidad visual para la IA
      const maxDimension = 720;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Detectar formato compatible con aceleración por hardware
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4;codecs=avc1'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

      const stream = canvas.captureStream(24); // 24 FPS es ideal para el análisis

      // Intentar vincular la pista de audio original si está disponible
      try {
        const origStream = video.captureStream ? video.captureStream() : video.mozCaptureStream?.();
        const audioTrack = origStream?.getAudioTracks()?.[0];
        if (audioTrack) stream.addTrack(audioTrack);
      } catch (e) {
        console.warn('[Compresión] No se pudo extraer la pista de audio directa:', e);
      }

      // Bitrate de 1.2 Mbps: reduce videos de 100MB a menos de 10MB instantáneamente
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1200000,
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        URL.revokeObjectURL(video.src);
        const compressedBlob = new Blob(chunks, { type: mimeType });
        const ext = mimeType.includes('mp4') ? '.mp4' : '.webm';
        const resultFile = new File([compressedBlob], `compressed_${Date.now()}${ext}`, {
          type: mimeType,
        });

        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
        console.log(`[Compresión] ✅ Finalizado: ${mb(file.size)} → ${mb(resultFile.size)} en ${elapsed}s`);
        resolve(resultFile);
      };

      mediaRecorder.start();
      video.play();

      // Reproducción y renderizado acelerado cuadro por cuadro
      const processFrame = () => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, width, height);
          
          // Reportar progreso estimado a la interfaz
          if (video.duration) {
            const pct = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
            onProgress?.(pct);
          }
          requestAnimationFrame(processFrame);
        } else {
          mediaRecorder.stop();
        }
      };

      processFrame();
    };

    video.onerror = () => reject(new Error('No se pudo procesar la compresión del video.'));
  });
}