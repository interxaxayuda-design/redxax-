const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-[#020203] text-white font-sans px-6 py-16">
      <div className="max-w-3xl mx-auto">

        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-1">
          Política de Privacidad de VIRAX
        </h1>
        <p className="text-slate-500 text-sm mb-10">Última actualización: 14 de agosto de 2026</p>

        <p className="text-slate-300 leading-relaxed mb-6">
          Esta Política de Privacidad describe cómo VIRAX ("la aplicación", "nosotros") recopila,
          usa, almacena y protege la información de los usuarios. Al usar VIRAX, aceptás las
          prácticas descritas en este documento.
        </p>

        <h2 className="text-xl font-black uppercase tracking-tight mt-10 mb-3 border-b border-white/10 pb-2">
          1. Información que recopilamos
        </h2>
        <p className="text-slate-300 mb-2">Para brindar el servicio de análisis de viralidad de video, recopilamos:</p>
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li><strong className="text-white">Videos subidos por el usuario:</strong> el contenido audiovisual que subís a la aplicación para ser analizado.</li>
          <li><strong className="text-white">Identificador de usuario anónimo:</strong> VIRAX no requiere registro con correo electrónico ni contraseña. Al usar la app por primera vez, se genera automáticamente un identificador anónimo que se guarda localmente en tu dispositivo (localStorage) y se usa para asociar tu saldo de gemas, historial de análisis y conversaciones de chat entre sesiones.</li>
          <li><strong className="text-white">Dirección IP:</strong> se recopila con fines de conteo de uso y estadísticas agregadas de la aplicación, y puede ser utilizada por nuestros proveedores de pago como parte de sus procesos de verificación y prevención de fraude.</li>
          <li><strong className="text-white">Historial de análisis y conversación:</strong> los resultados de cada análisis de video y los mensajes que intercambiás con el asistente de chat integrado se guardan asociados a tu identificador de usuario, para que puedas consultarlos más adelante.</li>
          <li><strong className="text-white">Datos de pago:</strong> cuando comprás "gemas" dentro de la aplicación, el pago es procesado directamente por PayPal o Mercado Pago, según el método que elijas. VIRAX no recibe ni almacena números de tarjeta ni datos financieros completos; solo recibe la confirmación de que el pago fue exitoso.</li>
        </ul>

        <h2 className="text-xl font-black uppercase tracking-tight mt-10 mb-3 border-b border-white/10 pb-2">
          2. Cómo usamos tu información
        </h2>
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Los videos que subís se almacenan temporalmente en nuestra infraestructura (Supabase) y se envían a Google Gemini para ser analizados y generar métricas de viralidad, retención y calidad del contenido.</li>
          <li>Los resultados del análisis, el historial y las conversaciones de chat se almacenan asociados a tu identificador anónimo, para que puedas acceder a tu historial en sesiones futuras desde el mismo dispositivo.</li>
          <li>El identificador anónimo se usa para gestionar tu saldo de gemas y validar tus compras.</li>
          <li>La dirección IP se usa para estadísticas internas de uso y, en el caso de las plataformas de pago, para sus propios controles de seguridad.</li>
          <li>No vendemos tu información personal ni tus videos a terceros con fines publicitarios.</li>
        </ul>

        <h2 className="text-xl font-black uppercase tracking-tight mt-10 mb-3 border-b border-white/10 pb-2">
          3. Con quién compartimos información
        </h2>
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li><strong className="text-white">Google (Gemini API):</strong> recibe el contenido de video para su procesamiento y análisis mediante inteligencia artificial.</li>
          <li><strong className="text-white">Supabase:</strong> proveedor de infraestructura utilizado para almacenamiento de videos, historial de análisis, conversaciones de chat y funciones del backend.</li>
          <li><strong className="text-white">PayPal y Mercado Pago:</strong> procesan las transacciones de compra de gemas dentro de la aplicación. Cada uno tiene su propia política de privacidad para el manejo de los datos de pago.</li>
        </ul>
        <p className="text-slate-300 mt-2">No compartimos tu información con terceros para fines de publicidad ni la vendemos.</p>

        <h2 className="text-xl font-black uppercase tracking-tight mt-10 mb-3 border-b border-white/10 pb-2">
          4. Almacenamiento y retención de datos
        </h2>
        <p className="text-slate-300">
          Los videos y resultados de análisis se almacenan en nuestros servidores mientras tu
          identificador de usuario permanezca activo, con el fin de que puedas consultar tu
          historial. Podés solicitar la eliminación de tus datos en cualquier momento.
        </p>

        <h2 className="text-xl font-black uppercase tracking-tight mt-10 mb-3 border-b border-white/10 pb-2">
          5. Seguridad
        </h2>
        <p className="text-slate-300">
          Implementamos medidas técnicas razonables para proteger tu información, incluyendo
          transmisión de datos cifrada (HTTPS/TLS) entre la aplicación y nuestros servidores.
        </p>

        <h2 className="text-xl font-black uppercase tracking-tight mt-10 mb-3 border-b border-white/10 pb-2">
          6. Tus derechos
        </h2>
        <p className="text-slate-300 mb-2">Podés solicitar en cualquier momento:</p>
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Acceso a los datos que tenemos asociados a tu identificador de usuario.</li>
          <li>Eliminación de tu historial de análisis, conversaciones y videos almacenados.</li>
          <li>Corrección de datos inexactos.</li>
        </ul>
        <p className="text-slate-300 mt-2">
          Como VIRAX no usa cuentas con email, para procesar tu solicitud vamos a pedirte tu
          identificador de usuario anónimo (podés encontrarlo en el almacenamiento local de la
          app en tu dispositivo) para localizar y eliminar los datos correspondientes. Para
          ejercer estos derechos, contactanos usando la información de la sección 8.
        </p>

        <h2 className="text-xl font-black uppercase tracking-tight mt-10 mb-3 border-b border-white/10 pb-2">
          7. Menores de edad
        </h2>
        <p className="text-slate-300">
          VIRAX no está dirigida a menores de 13 años. No recopilamos intencionalmente
          información de menores de esa edad.
        </p>

        <h2 className="text-xl font-black uppercase tracking-tight mt-10 mb-3 border-b border-white/10 pb-2">
          8. Contacto
        </h2>
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <p className="text-slate-300 mb-2">
            Si tenés preguntas sobre esta Política de Privacidad o querés ejercer tus derechos
            sobre tus datos, contactanos en:
          </p>
          <p className="text-white font-bold">Correo electrónico: [tu-email-de-contacto]</p>
        </div>

        <h2 className="text-xl font-black uppercase tracking-tight mt-10 mb-3 border-b border-white/10 pb-2">
          9. Cambios a esta política
        </h2>
        <p className="text-slate-300 mb-16">
          Podemos actualizar esta Política de Privacidad ocasionalmente. Publicaremos cualquier
          cambio en esta misma página con la fecha de actualización correspondiente.
        </p>

      </div>
    </div>
  );
};

export default PrivacyPolicy;