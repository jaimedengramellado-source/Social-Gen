import { createAdminClient, getUser } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS } from "@/types";
import type { Script } from "@/types";

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // El acceso público es por share_token (no adivinable), vía admin client: la
  // policy RLS que exponía todos los guiones "saved" a cualquiera se eliminó.
  const admin = await createAdminClient();
  const { data: script } = await admin
    .from("scripts")
    .select("*")
    .eq("share_token", id)
    .single();

  if (!script) notFound();

  // Los borradores solo los ve su dueño
  if (script.status !== "saved") {
    const user = await getUser();
    if (!user || user.id !== script.user_id) notFound();
  }

  const s = script as Script;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <nav className="border-b border-[var(--color-border)] bg-white/80 backdrop-blur-sm sticky top-0">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-normal" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Social Flamingo
          </Link>
          <Link
            href="/signup"
            className="bg-[var(--color-foreground)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-all"
          >
            Crear guiones gratis →
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-2xl md:text-3xl font-semibold leading-tight">{s.title}</h1>
            <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded-full border-2 font-bold text-lg
              border-emerald-500 bg-emerald-50 text-emerald-700">
              {s.viral_score}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="purple">
              {PLATFORM_LABELS[s.platform] || s.platform}
            </Badge>
            <span className="text-sm text-[var(--color-muted-foreground)]">
              ~{s.estimated_retention}% retención estimada
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { label: "Hook", content: s.hook, border: "border-l-amber-400", bg: "bg-amber-50/40" },
            { label: "Intro", content: s.intro, border: "border-l-purple-400", bg: "bg-purple-50/30" },
          ].map(({ label, content, border, bg }) => content && (
            <div key={label} className={`rounded-xl border border-l-4 border-[var(--color-border)] p-5 ${border} ${bg}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-3">{label}</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
            </div>
          ))}

          {s.main_content?.map((section, i) => (
            <div key={i} className="rounded-xl border border-l-4 border-l-green-400 bg-green-50/30 border-[var(--color-border)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">{section.section}</span>
                <span className="text-xs text-[var(--color-muted-foreground)] font-mono">{section.timestamp}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{section.content}</p>
            </div>
          ))}

          {s.cta && (
            <div className="rounded-xl border border-l-4 border-l-red-400 bg-red-50/30 border-[var(--color-border)] p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-3">CTA</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{s.cta}</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center bg-[var(--color-primary-light)] rounded-2xl p-8 border border-[var(--color-primary)]/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-2">Crea tu propio guion viral</p>
          <h2 className="text-2xl font-semibold mb-3" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Este guion fue creado con Social Flamingo
          </h2>
          <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
            Genera ideas virales y guiones completos para YouTube, TikTok e Instagram en menos de 60 segundos.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center bg-[var(--color-primary)] text-white px-6 py-3 rounded-xl font-medium hover:bg-[var(--color-primary-hover)] hover:-translate-y-px transition-all"
          >
            Empieza gratis con 10 créditos →
          </Link>
        </div>
      </main>
    </div>
  );
}
