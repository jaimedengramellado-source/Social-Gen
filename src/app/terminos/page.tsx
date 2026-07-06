import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export const metadata = {
  title: "Términos de Servicio — Social Flamingo",
};

export default function TerminosPage() {
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
          Términos de Servicio
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mb-12">
          Última actualización: 29 de junio de 2026
        </p>

        <div className="prose prose-zinc max-w-none space-y-10 text-[var(--color-foreground)]">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Aceptación de los términos</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Al crear una cuenta o utilizar Social Flamingo (en adelante, "el Servicio"), aceptas quedar vinculado por estos Términos de Servicio. Si no estás de acuerdo con alguno de ellos, no debes usar el Servicio. El Servicio es operado por Social Flamingo y está dirigido a creadores de contenido en plataformas como TikTok, Instagram y YouTube.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Descripción del Servicio</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Social Flamingo es una plataforma de asistencia para creadores de contenido que utiliza inteligencia artificial para generar ideas, guiones, hooks y estrategia de contenido. Las funcionalidades disponibles dependen del plan de suscripción activo en tu cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Cuentas de usuario</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-3">
              Debes tener al menos 16 años para usar el Servicio. Eres responsable de mantener la confidencialidad de tus credenciales y de toda la actividad que ocurra en tu cuenta. Notifícanos inmediatamente si sospechas de acceso no autorizado.
            </p>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Nos reservamos el derecho de suspender o eliminar cuentas que incumplan estos términos, usen el Servicio de forma fraudulenta o intenten eludir los sistemas de créditos y limitaciones.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Planes, créditos y pagos</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-3">
              El Servicio ofrece un plan gratuito con créditos limitados y planes de pago (Starter, Pro, Agency) con distintos niveles de créditos semanales. Los pagos se procesan de forma segura a través de Stripe. Las suscripciones se renuevan automáticamente hasta que las canceles.
            </p>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-3">
              Los créditos no utilizados no se acumulan entre períodos y no son reembolsables una vez consumidos. Los packs de créditos adicionales (one-time) no caducan mientras tu cuenta esté activa.
            </p>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Puedes cancelar tu suscripción en cualquier momento desde Ajustes. La cancelación surte efecto al final del período de facturación en curso, sin reembolsos prorrateados salvo que la ley aplicable lo exija.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Uso aceptable</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-3">Queda prohibido usar el Servicio para:</p>
            <ul className="list-disc list-inside space-y-1 text-[var(--color-muted-foreground)]">
              <li>Generar contenido que incite al odio, la violencia o la discriminación.</li>
              <li>Infringir derechos de propiedad intelectual de terceros.</li>
              <li>Intentar acceder a cuentas de otros usuarios o a los sistemas del Servicio.</li>
              <li>Automatizar el uso del Servicio mediante bots o scripts no autorizados.</li>
              <li>Revender o sublicenciar el acceso al Servicio sin autorización expresa.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Contenido generado</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              El contenido generado por la IA del Servicio es de tu propiedad para los fines de uso personal y comercial en tus canales. Social Flamingo no reclama derechos sobre el contenido que generes. Eres el único responsable de revisar y verificar que el contenido generado es adecuado, veraz y cumple con las normas de las plataformas en las que lo publiques.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Limitación de responsabilidad</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              El Servicio se proporciona "tal cual", sin garantías de ningún tipo. En ningún caso Social Flamingo será responsable de daños indirectos, incidentales o consecuentes derivados del uso o la imposibilidad de uso del Servicio. Nuestra responsabilidad máxima acumulada no superará el importe pagado por el usuario en los 12 meses anteriores al evento que origine la reclamación.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Modificaciones</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Podemos actualizar estos términos en cualquier momento. Te notificaremos por email con al menos 15 días de antelación ante cambios materiales. El uso continuado del Servicio tras dicho período implica la aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Ley aplicable</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Estos términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales competentes de España.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contacto</h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Para cualquier consulta sobre estos términos, escríbenos a{" "}
              <a href="mailto:hello@socialflamingo.app" className="text-[var(--color-primary)] hover:underline">
                hello@socialflamingo.app
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
