import { Check, Copy, LifeBuoy, X } from 'lucide-react';
import { useState } from 'react';

const SupportIdModal = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const userId = localStorage.getItem('redxax_user_id') || 'No disponible';

  const handleCopy = () => {
    navigator.clipboard.writeText(userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative bg-[#0d0d0f] border border-white/10 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">

        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white/40" />
        </button>

        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
          <LifeBuoy className="w-5 h-5 text-emerald-400" />
        </div>

        <h3 className="text-xl font-black italic uppercase tracking-tight text-white mb-2">
          Tu ID de soporte
        </h3>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Si tenés un problema con tus gemas o tu historial, compartinos este ID por nuestro canal de soporte para que podamos ayudarte.
        </p>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3 mb-4">
          <code className="text-emerald-300 text-xs font-mono break-all">{userId}</code>
        </div>

        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-full text-sm font-black italic uppercase tracking-wider transition-all active:scale-95"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" /> Copiado
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" /> Copiar ID
            </>
          )}
        </button>

      </div>
    </div>
  );
};

export default SupportIdModal;