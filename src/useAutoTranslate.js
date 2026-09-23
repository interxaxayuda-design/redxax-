import { useEffect, useState } from 'react';

export function useAutoTranslate() {
  const [lang, setLang] = useState('es');

  useEffect(() => {
    // Detectar si ya existe una preferencia de idioma guardada en la cookie
    const match = document.cookie.match(/googtrans=\/es\/([^;]+)/);
    if (match && match[1]) {
      setLang(match[1]);
    }
  }, []);

  const changeLanguage = (targetLang) => {
    // Setea la cookie que necesita Google Translate para traducir el DOM
    document.cookie = `googtrans=/es/${targetLang}; path=/;`;
    document.cookie = `googtrans=/es/${targetLang}; path=/; domain=${window.location.hostname}`;
    setLang(targetLang);
    window.location.reload(); // Recarga la vista para aplicar la traducción
  };

  return { lang, changeLanguage };
}