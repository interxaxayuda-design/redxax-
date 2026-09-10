import React, { useState } from 'react';
import './Login.css';

// Reemplaza esto con tu instancia de Supabase o tu backend de autenticación
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'TU_SUPABASE_URL';
const supabaseAnonKey = 'TU_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin, // En Capacitor redirecciona al WebView
        },
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black flex flex-col items-center justify-between p-6 overflow-hidden select-none">
      
      {/* Efectos de Aurora Verde en el Fondo */}
      <div className="aurora-bg top-[-50px] left-[-50px]"></div>
      <div className="aurora-bg-secondary bottom-[10%] right-[-50px]"></div>

      {/* Espaciador superior */}
      <div className="w-full h-12"></div>

      {/* Contenedor del Logo con Animación */}
      <div className="z-10 flex flex-col items-center justify-center animate-logo">
        <div className="relative mb-4 flex items-center justify-center">
          {/* Resplandor verde detrás del logo */}
          <div className="absolute w-28 h-28 bg-emerald-500/20 rounded-full blur-xl"></div>
          
          {/* Reemplaza la ruta con tu archivo de logo */}
          <img 
            src="/assets/logo.png" 
            alt="Logo" 
            className="w-24 h-24 object-contain z-10 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          />
        </div>
        
        <h1 className="text-2xl font-bold text-white tracking-wide">REDxax</h1>
        <p className="text-sm text-zinc-400 mt-1 font-medium">Bienvenido de nuevo</p>
      </div>

      {/* Botón de Google Adaptado a Celular */}
      <div className="z-10 w-full max-w-xs mb-8 flex flex-col items-center gap-4">
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-13 px-4 py-3 bg-zinc-900/80 hover:bg-zinc-800 active:scale-[0.98] transition-all duration-200 border border-zinc-700/60 rounded-2xl flex items-center justify-center gap-3 shadow-lg backdrop-blur-md"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              {/* SVG Oficial de Google */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.3-.7-.5-1.5-.5-2.3z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 22.3 12 22.3z"
                />
              </svg>
              <span className="text-white text-sm font-semibold tracking-wide">
                Continuar con Google
              </span>
            </>
          )}
        </button>

        <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
          Al continuar, aceptas nuestros Términos y Política de Privacidad.
        </p>
      </div>

    </div>
  );
};