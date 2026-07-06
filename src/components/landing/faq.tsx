"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "¿Cuánto tiempo tarda en generar un guion completo?",
    a: "Entre 15 y 30 segundos. Primero generas 10 ideas con su viral score, eliges la que más te gusta, y el guion completo (hook, intro, contenido, picos de retención y CTA) se genera en unos 20 segundos más.",
  },
  {
    q: "¿Los guiones son para YouTube largo y para formatos cortos?",
    a: "Sí. Social Flamingo adapta la estructura del guion según la plataforma. Para YouTube largo incluye secciones de retención cada 60-90 segundos. Para Shorts, TikTok y Reels, la estructura es hook de 2 segundos, desarrollo conciso y remate que genera comentarios.",
  },
  {
    q: "¿Qué es el Viral Score?",
    a: "Es una puntuación de 0 a 100 que la IA asigna a cada idea basándose en patrones de contenido viral: tipo de hook, psicología de la atención, tendencias de la plataforma y potencial de engagement. Cuanto más alto, más posibilidades de alcance orgánico.",
  },
  {
    q: "¿Puedo regenerar solo una sección del guion sin tirar todo el trabajo?",
    a: "Exactamente. Cada sección (hook, intro, contenido, CTA) tiene su propio botón de regenerar. Puedes refinar sección a sección hasta que el guion sea perfecto, con un coste de solo 1 crédito por regeneración.",
  },
  {
    q: "¿Los créditos caducan?",
    a: "Los créditos mensuales del plan se resetean cada mes. Los créditos de los packs extra nunca caducan y se mantienen hasta que los uses.",
  },
];

export function LandingFaq() {
  return (
    <section className="py-24 px-6 border-t border-[var(--color-border)]" id="faq">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-6 text-center">
          FAQ
        </p>
        <h2
          className="text-4xl font-normal mb-12 text-center"
          style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.02em" }}
        >
          Preguntas frecuentes
        </h2>
        <Accordion type="single" collapsible className="space-y-0">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-base font-medium py-5">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-[var(--color-muted-foreground)] leading-relaxed pb-5">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
