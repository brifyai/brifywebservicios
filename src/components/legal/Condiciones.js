import React from 'react'
import { useNavigate } from 'react-router-dom'

const Condiciones = () => {
  const navigate = useNavigate()
  const goBack = () => {
    // Volver a la página anterior o al dashboard si el historial está vacío
    if (window.history.length > 1) navigate(-1)
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={goBack}
            className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            ← Volver
          </button>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold tracking-wide uppercase mb-2">
          CONDICIONES DE SERVICIO DE BRIFY AI
        </h1>
        <p className="text-sm text-gray-600 mb-6">Última actualización: 8 de noviembre de 2025</p>

        <p className="text-gray-700 mb-4">
          Bienvenido a Brify AI ("nosotros", "nuestro" o "la Compañía"). Estos Términos de Servicio ("Términos")
          rigen su acceso y uso de nuestro sitio web <a href="https://www.brifyai.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://www.brifyai.com/</a> y nuestros servicios
          (colectivamente, el "Servicio").
        </p>
        <p className="text-gray-700 mb-6">
          Al acceder o utilizar el Servicio, usted acepta estar sujeto a estos Términos. Si no está de acuerdo con alguna
          parte de los términos, no podrá acceder al Servicio.
        </p>

        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">1. Cuentas</h2>
            <p className="text-gray-700 mt-2">
              Usted es responsable de mantener la confidencialidad de su cuenta y contraseña. Acepta notificarnos
              inmediatamente sobre cualquier uso no autorizado de su cuenta.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">2. Licencia de Uso</h2>
            <p className="text-gray-700 mt-2">
              Le otorgamos una licencia limitada, no exclusiva e intransferible para usar el Servicio para la generación
              de contenido asistido por IA para sus fines comerciales y personales, sujeto a estos Términos.
            </p>
            <p className="text-gray-700 mt-2">Usted acepta no utilizar el Servicio para:</p>
            <ul className="list-disc pl-6 text-gray-700 mt-1 space-y-1">
              <li>Actividades ilegales o que infrinjan los derechos de terceros.</li>
              <li>Generar material que promueva el odio, la discriminación o la violencia.</li>
              <li>Intentar realizar ingeniería inversa, descompilar o descubrir el código fuente de nuestro Servicio.</li>
              <li>Revender o sublicenciar el Servicio sin nuestro permiso explícito.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold">3. Pagos y Suscripciones</h2>
            <ul className="list-disc pl-6 text-gray-700 mt-2 space-y-1">
              <li><span className="font-medium">Facturación:</span> Los planes pagados se facturan de forma mensual o anual por adelantado.</li>
              <li><span className="font-medium">Renovación Automática:</span> Su suscripción se renovará automáticamente al final de cada ciclo de facturación, a menos que usted la cancele.</li>
              <li><span className="font-medium">Cancelación:</span> Puede cancelar su suscripción en cualquier momento. La cancelación será efectiva al final del período de facturación actual.</li>
              <li><span className="font-medium">Reembolsos:</span> Salvo que la ley aplicable exija lo contrario, todos los pagos son finales y no reembolsables.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold">4. Propiedad del Contenido</h2>
            <p className="text-gray-700 mt-2">
              <span className="font-medium">Contenido del Usuario:</span> Usted retiene la propiedad de todos los datos e información que carga en el Servicio ("Contenido del Usuario").
            </p>
            <p className="text-gray-700 mt-2">
              <span className="font-medium">Contenido Generado:</span> Usted retiene todos los derechos y la propiedad del contenido que genera utilizando el Servicio ("Contenido Generado"). Usted es libre de usar el Contenido Generado para cualquier propósito, incluido el comercial.
            </p>
            <p className="text-gray-700 mt-2">
              <span className="font-medium">Responsabilidad:</span> La IA puede cometer errores. Usted es el único responsable de revisar, validar y asegurar que el Contenido Generado sea preciso y apropiado para su uso. No garantizamos la precisión del Contenido Generado.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">5. Propiedad Intelectual</h2>
            <p className="text-gray-700 mt-2">
              El Servicio y todo su contenido original, características y funcionalidades (excluyendo el Contenido del Usuario y el Contenido Generado) son y seguirán siendo propiedad exclusiva de AIntelligence SPA rut:78.179.864-9 y sus licenciantes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">6. Política de Privacidad</h2>
            <p className="text-gray-700 mt-2">
              El uso que hacemos de su información personal se rige por nuestra Política de Privacidad, disponible en
              <a href="https://www.brifyai.com/privacidad.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline"> https://www.brifyai.com/politica-de-privacidad.</a> Al usar el Servicio, usted acepta los términos de nuestra Política de Privacidad.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">7. Terminación</h2>
            <p className="text-gray-700 mt-2">
              Podemos suspender o terminar su acceso al Servicio de inmediato, sin previo aviso, si usted incumple estos Términos.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">8. Exclusión de Garantías</h2>
            <p className="text-gray-700 mt-2">
              El Servicio se proporciona "TAL CUAL" y "SEGÚN DISPONIBILIDAD". No garantizamos que el Servicio será ininterrumpido, seguro o libre de errores.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">9. Limitación de Responsabilidad</h2>
            <p className="text-gray-700 mt-2">
              En la máxima medida permitida por la ley, AIntelligence SPA rut:78.179.864-9 no será responsable de ningún daño indirecto, incidental o consecuente que resulte del uso del Servicio.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">10. Modificaciones a los Términos</h2>
            <p className="text-gray-700 mt-2">
              Nos reservamos el derecho de modificar estos Términos en cualquier momento. Le notificaremos publicando los nuevos términos en esta página.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">11. Ley Aplicable</h2>
            <p className="text-gray-700 mt-2">
              Estos Términos se regirán e interpretarán de acuerdo con las leyes de Chile, sin tener en cuenta sus disposiciones sobre conflicto de leyes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">12. Contacto</h2>
            <p className="text-gray-700 mt-2">
              Si tiene alguna pregunta sobre estos Términos, contáctenos en <a href="mailto:soporte@brifyai.com" className="text-blue-600 hover:underline">soporte@brifyai.com</a>.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Condiciones