import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Globe, Play, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import logo from './logo.png';
import { supabase } from './supabaseClient';
import { useAutoTranslate } from './useAutoTranslate';

/*
  CLIPS: la tira de arriba.
  - Sin `src`, se muestra una tarjeta de ejemplo (funciona desde ya).
  - Para usar videos reales: poné archivos cortos (3-5 s, sin audio, 540x960, menos de 1 MB cada uno)
    en /public/clips/ y completá `src`, por ejemplo: src: '/clips/1.mp4'
*/
const CLIPS = [
  { src: null, score: 92, note: 'Gancho fuerte', from: '#0f766e', to: '#052e2b' },
  { src: null, score: 61, note: 'Se cae a mitad', from: '#6d28d9', to: '#1e1038' },
  { src: null, score: 84, note: 'Buen ritmo', from: '#0e7490', to: '#07242e' },
  { src: null, score: 38, note: 'Arranque lento', from: '#9f1239', to: '#2a0a14' },
  { src: null, score: 77, note: 'Final flojo', from: '#4d7c0f', to: '#14240a' },
];

const scoreColor = (s) => (s >= 75 ? '#34d399' : s >= 50 ? '#fbbf24' : '#fb7185');

function ClipCard({ clip, index }) {
  const color = scoreColor(clip.score);
  return (
    <div
      className="relative shrink-0 w-[118px] h-[210px] rounded-2xl overflow-hidden border border-white/10"
      style={{
        marginTop: index % 2 === 0 ? 0 : 28,
        background: `linear-gradient(160deg, ${clip.from}, ${clip.to})`,
      }}
    >
      {clip.src ? (
        <video
          src={clip.src}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
            <Play className="w-4 h-4 text-white/80 fill-white/80" />
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-2.5 pt-8 bg-gradient-to-t from-black/85 to-transparent">
        <div className="flex items-end justify-between gap-2">
          <span className="text-[11px] leading-tight text-slate-200 font-medium notranslate">
            {clip.note}
          </span>
          <span
            className="text-lg font-black leading-none tabular-nums notranslate"
            style={{ color }}
          >
            {clip.score}
          </span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${clip.score}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { lang, changeLanguage } = useAutoTranslate();

  const toggleLanguage = () => {
    changeLanguage(lang === 'es' ? 'en' : 'es');
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const isNative = Capacitor.isNativePlatform();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: isNative ? 'redxax://login-callback' : window.location.origin,
          skipBrowserRedirect: isNative,
        },
      });

      if (error) throw error;

      if (isNative && data?.url) {
        await Browser.open({ url: data.url });
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      setError('No pudimos abrir el inicio de sesión con Google. Intentá de nuevo.');
      setLoading(false);
    }
  };

  // Se duplica la lista para que el movimiento sea continuo, sin saltos.
  const loop = [...CLIPS, ...CLIPS];

  return (
    <div
      className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <style>{`
        @keyframes virax-slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .virax-track { animation: virax-slide 34s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .virax-track { animation: none; } }
      `}</style>

      {/* Luz de fondo */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-purple-500/[0.07] rounded-full blur-[100px] pointer-events-none" />

      {/* Barra superior: logo e idioma */}
      <header className="relative z-20 flex items-center justify-between px-5 pt-5">
        <img
          src={logo}
          alt="VIRAX"
          className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]"
        />
        <button
          onClick={toggleLanguage}
          aria-label="Cambiar idioma"
          className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300 active:scale-95 transition-transform notranslate"
        >
          <Globe className="w-4 h-4 text-emerald-400" />
          <span>{lang === 'es' ? 'ES' : 'EN'}</span>
        </button>
      </header>

      {/* Tira de videos con su puntaje */}
      <section
        aria-hidden="true"
        className="relative z-10 mt-6"
        style={{
          WebkitMaskImage:
            'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
          maskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
        }}
      >
        <div className="virax-track flex gap-3 w-max px-3">
          {loop.map((clip, i) => (
            <ClipCard key={i} clip={clip} index={i} />
          ))}
        </div>
      </section>

      {/* Mensaje principal y acceso */}
      <main className="relative z-10 flex-1 flex flex-col justify-end px-6 pt-8 pb-6">
        <div className="max-w-sm w-full mx-auto text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-[28px] leading-[1.15] font-black tracking-tight">
              Analiza el potencial viral de cualquier video con VIRAX
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Subí tu video y recibí un puntaje y los cambios exactos para que la gente lo mire hasta el final.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold"
            >
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white hover:bg-slate-100 text-black font-bold py-4 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(16,185,129,0.18)] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="text-[15px]">Continuar con Google</span>
              </>
            )}
          </button>

          <div className="space-y-2">
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Nunca vemos ni guardamos tu contraseña de Google.
            </p>
            <p className="text-[11px] text-slate-500">
              Al continuar, aceptás nuestra{' '}
              <a
                href="https://redxax.vercel.app/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline"
              >
                Política de Privacidad
              </a>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}