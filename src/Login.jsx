import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import { supabase } from './supabaseClient';

// AGREGA "export default" AQUÍ
export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const isNative = Capacitor.isNativePlatform();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: isNative ? 'redxax://login-callback' : window.location.origin,
          skipBrowserRedirect: isNative, // en nativo, abrimos el navegador nosotros
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6 text-center">
        <h2 className="text-2xl font-black italic uppercase">Iniciar Sesión</h2>
        
        {error && (
          <p className="text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">
            {error}
          </p>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black italic uppercase py-4 rounded-full transition-all"
        >
          {loading ? 'Cargando...' : 'Continuar con Google'}
        </button>
      </div>
    </div>
  );
}