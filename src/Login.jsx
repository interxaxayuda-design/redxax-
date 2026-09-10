import { useState } from 'react';
import './Login.css';
import logo from './logo.png';
import { supabase } from './supabaseClient';

export const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      setError('No pudimos abrir el inicio de sesión con Google. Intentá de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full bg-black flex flex-col items-center justify-between overflow-hidden select-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
        paddingLeft: '24px',
        paddingRight: '24px',
      }}
    >
      {/* Aurora de fondo */}
      <div className="aurora-bg top-[-50px] left-[-50px]"></div>
      <div className="aurora-bg-secondary bottom-[10%] right-[-50px]"></div>

      {/* Viñeta sutil para dar profundidad */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 40%, transparent 0%, rgba(0,0,0,0.55) 85%)',
        }}
      />

      <div className="w-full h-8"></div>

      {/* Logo + marca */}
      <div className="z-10 flex flex-col items-center justify-center animate-logo">
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute w-32 h-32 bg-emerald-500/25 rounded-full blur-2xl"></div>
          <div className="absolute w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '3s' }}></div>
          <img
            src={logo}
            alt="VIRAX"
            className="relative w-24 h-24 object-contain z-10 drop-shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          />
        </div>

        <h1 className="text-[28px] font-black italic uppercase tracking-tighter text-white">
          VIRAX
        </h1>
        <p className="text-[11px] text-emerald-400/80 mt-2 font-bold uppercase tracking-[0.25em]">
          Bienvenido de nuevo
        </p>
      </div>

      {/* Botón de login */}
      <div className="z-10 w-full max-w-xs mb-4 flex flex-col items-center gap-4">
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="group relative w-full h-14 px-4 bg-white hover:bg-zinc-100 active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100 transition-all duration-200 rounded-2xl flex items-center justify-center gap-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {loading ? (
            <div className="w-5 h-5 border-2 border-zinc-400 border-t-emerald-500 rounded-full animate-spin"></div>
          ) : (
            <>
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.3-.7-.5-1.5-.5-2.3z" />
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 22.3 12 22.3z" />
              </svg>
              <span className="text-zinc-800 text-sm font-bold tracking-wide">
                Continuar con Google
              </span>
            </>
          )}
        </button>

        {error && (
          <p className="text-[11px] text-red-400 text-center font-medium leading-relaxed">
            {error}
          </p>
        )}

        <p className="text-[11px] text-zinc-600 text-center leading-relaxed px-2">
          Al continuar, aceptás nuestros{' '}
          <a href="https://redxax.vercel.app/privacy" target="_blank" rel="noopener noreferrer" className="text-zinc-500 underline hover:text-emerald-400 transition-colors">
            Términos y Política de Privacidad
          </a>
          .
        </p>
      </div>
    </div>
  );
};