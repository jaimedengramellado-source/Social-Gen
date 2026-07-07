import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export const metadata = {
  title: "Política de Privacidad — Social Flamingo",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <nav className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <Link href="/signup" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            Crear cuenta
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1
          className="text-4xl font-normal mb-2"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          Política de Privacidad
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mb-12">
          Última actualización: 7 de julio de 2026
        </p>

        <div className="prose prose-zinc max-w-none space-y-10 text-[var(--color-foreground)]">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Responsable del tratamiento</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              El responsable del tratamiento de tus datos personales es Social Flamingo, con domicilio en España. Puedes contactarnos en{" "}
              <a href="mailto:service@socialflamingo.app" className="text-[var(--color-primary)] hover:underline">
                service@socialflamingo.app
              </a>{" "}
              para cualquier cuestión relacionada con la privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Datos que recogemos</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-3">
              Recogemos únicamente los datos necesarios para prestar el Servicio:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--color-muted-foreground)]">
              <li><strong>Datos de cuenta:</strong> nombre, dirección de email y contraseña (almacenada como hash).</li>
              <li><strong>Datos de perfil del canal:</strong> nombre del canal, plataforma, nicho, descripción y objetivos que introduces durante el onboarding y en Ajustes.</li>
              <li><strong>Contenido generado:</strong> las conversaciones con la IA, ideas, guiones y documentos guardados en tu biblioteca.</li>
              <li><strong>Datos de pago:</strong> gestionados íntegramente por Stripe. No almacenamos números de tarjeta ni datos bancarios. Solo guardamos el identificador de cliente y suscripción de Stripe.</li>
              <li><strong>Datos de uso:</strong> número de créditos consumidos y plan activo.</li>
              <li><strong>Datos técnicos:</strong> dirección IP (usada exclusivamente para rate limiting de seguridad, no para perfilado).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Finalidad y base legal</h2>
            <div className="space-y-3 text-[var(--color-muted-foreground)]">
              <p><strong className="text-[var(--color-foreground)]">Ejecución del contrato:</strong> prestación del Servicio, gestión de tu cuenta, procesamiento de pagos y entrega de los créditos correspondientes a tu plan.</p>
              <p><strong className="text-[var(--color-foreground)]">Interés legítimo:</strong> seguridad del servicio (detección de abuso, rate limiting), mejora del producto con datos agregados y anónimos.</p>
              <p><strong className="text-[var(--color-foreground)]">Obligación legal:</strong> cumplimiento de obligaciones fiscales y contables derivadas de los pagos.</p>
              <p><strong className="text-[var(--color-foreground)]">Consentimiento:</strong> envío de comunicaciones sobre novedades o recordatorios del Servicio, que puedes revocar en cualquier momento desde Ajustes.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Proveedores de servicios (encargados del tratamiento)</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-3">
              Compartimos tus datos exclusivamente con los siguientes proveedores, que tratan los datos en nuestro nombre bajo contratos de encargo del tratamiento conformes al RGPD:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--color-muted-foreground)]">
              <li><strong>Supabase</strong> — base de datos y autenticación. Los datos se almacenan en servidores de la UE.</li>
              <li><strong>Anthropic</strong> — procesamiento de las solicitudes de generación de contenido mediante IA. Las solicitudes se envían a sus servidores; consulta su política en <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">anthropic.com/privacy</a>.</li>
              <li><strong>Stripe</strong> — procesamiento de pagos. Consulta su política en <a href="https://stripe.com/es/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">stripe.com/es/privacy</a>.</li>
              <li><strong>Google</strong> — inicio de sesión con Google OAuth y, opcionalmente, conexión con YouTube Analytics.</li>
              <li><strong>Vercel</strong> — infraestructura de alojamiento de la aplicación.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Servicios API de Google y datos de YouTube</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-3">
              Social Flamingo utiliza los Servicios API de YouTube (YouTube Data API y YouTube Analytics API) cuando decides, de forma voluntaria, conectar tu canal de YouTube desde la sección Estadísticas. Al usar esta función aceptas los{" "}
              <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                Términos de Servicio de YouTube
              </a>{" "}
              y la{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                Política de Privacidad de Google
              </a>.
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--color-muted-foreground)]">
              <li><strong>Qué datos accedemos:</strong> información básica de tu canal (nombre, identificador, miniatura, número de suscriptores) y métricas de analíticas (visualizaciones, CTR, retención, fuentes de tráfico y similares). El acceso es de <strong>solo lectura</strong>: nunca publicamos, modificamos ni eliminamos nada en tu canal.</li>
              <li><strong>Qué datos almacenamos:</strong> únicamente la información básica del canal y los tokens de acceso OAuth necesarios para consultar las métricas en tu nombre. Las métricas de analíticas se consultan a YouTube en tiempo real cada vez que visitas Estadísticas y no se almacenan en nuestros servidores.</li>
              <li><strong>Cómo los usamos:</strong> exclusivamente para mostrarte tus propias estadísticas dentro de la aplicación. No compartimos estos datos con terceros, no los usamos con fines publicitarios y no los transferimos a los proveedores de IA.</li>
              <li><strong>Cómo revocar el acceso:</strong> puedes desconectar tu canal en cualquier momento desde Estadísticas (eliminamos los tokens y revocamos el permiso ante Google) o directamente desde la{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                  configuración de seguridad de tu cuenta de Google
                </a>.
              </li>
            </ul>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mt-3">
              El uso que Social Flamingo hace de la información recibida de las APIs de Google se ajusta a la{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                Política de Datos de Usuario de los Servicios API de Google
              </a>, incluidos los requisitos de Uso Limitado (Limited Use).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Conservación de los datos</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, borraremos tus datos personales en un plazo máximo de 30 días, excepto los que debamos conservar por obligación legal (datos de facturación, hasta 5 años).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Tus derechos (RGPD)</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-3">
              Como usuario en la UE, tienes derecho a:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[var(--color-muted-foreground)]">
              <li><strong>Acceso</strong> — obtener confirmación de qué datos tratamos sobre ti.</li>
              <li><strong>Rectificación</strong> — corregir datos inexactos desde Ajustes o contactándonos.</li>
              <li><strong>Supresión</strong> — solicitar el borrado de tu cuenta y tus datos.</li>
              <li><strong>Portabilidad</strong> — recibir tus datos en un formato estructurado y legible.</li>
              <li><strong>Oposición y limitación</strong> — oponerte a ciertos tratamientos basados en interés legítimo.</li>
              <li><strong>Retirar el consentimiento</strong> — en cualquier momento, sin efecto retroactivo.</li>
            </ul>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mt-3">
              Para ejercer cualquier derecho, escríbenos a{" "}
              <a href="mailto:service@socialflamingo.app" className="text-[var(--color-primary)] hover:underline">
                service@socialflamingo.app
              </a>. Responderemos en un plazo máximo de 30 días. Si consideras que el tratamiento vulnera tus derechos, puedes presentar una reclamación ante la{" "}
              <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                Agencia Española de Protección de Datos (AEPD)
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Usamos exclusivamente cookies técnicas necesarias para el funcionamiento del Servicio: la cookie de sesión de autenticación y una cookie temporal para el demo de la landing (control de uso). No usamos cookies de publicidad ni de seguimiento de terceros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Transferencias internacionales</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Algunos de nuestros proveedores (Anthropic, Stripe, Vercel) operan desde Estados Unidos. Las transferencias se realizan bajo las garantías adecuadas previstas en el RGPD (cláusulas contractuales tipo aprobadas por la Comisión Europea o el marco EU-US Data Privacy Framework según corresponda).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Cambios en esta política</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Podemos actualizar esta política cuando sea necesario. Te notificaremos por email ante cambios materiales. La fecha de última actualización siempre aparece al inicio del documento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contacto</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Para cualquier consulta sobre privacidad, escríbenos a{" "}
              <a href="mailto:service@socialflamingo.app" className="text-[var(--color-primary)] hover:underline">
                service@socialflamingo.app
              </a>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-[var(--color-border)] py-8 px-6 mt-16">
        <div className="mx-auto max-w-3xl flex items-center justify-between text-sm text-[var(--color-muted-foreground)]">
          <span>© 2026 Social Flamingo</span>
          <div className="flex gap-6">
            <Link href="/terminos" className="hover:text-[var(--color-foreground)]">Términos</Link>
            <Link href="/privacidad" className="hover:text-[var(--color-foreground)]">Privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
