"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatInterface } from "./chat-interface";
import { ChatSidebar } from "./chat-sidebar";
import type { ChatSession, ChatProject } from "./chat-sidebar";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Profile } from "@/types";
import { useToast } from "@/components/ui/toast";
import { buildScriptSeedPrompt, CREAR_SEED_STORAGE_KEY, ONBOARDING_JUST_COMPLETED_KEY } from "@/lib/utils";
import { FirstChatFeedbackModal } from "@/components/shared/first-chat-feedback-modal";

interface CrearClientProps {
  profile: Profile;
}

export function CrearClient({ profile }: CrearClientProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [chatProjects, setChatProjects] = useState<ChatProject[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [pendingEditProjectId, setPendingEditProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(ONBOARDING_JUST_COMPLETED_KEY)) {
        sessionStorage.removeItem(ONBOARDING_JUST_COMPLETED_KEY);
        setShowFeedbackPopup(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/chat/sessions")
      .then(r => r.json())
      .then(d => { if (d.sessions) setChatSessions(d.sessions); })
      .catch(() => {});
    fetch("/api/chat/projects")
      .then(r => r.json())
      .then(d => { if (d.projects) setChatProjects(d.projects); })
      .catch(() => {});
  }, []);

  // Arranque del chat con contenido: (a) semilla directa en sessionStorage (dashboard —
  // sin fetch intermedio, no puede fallar), o (b) deep link /crear?idea=<id> o
  // ?script=<id> desde biblioteca/documentos. Limpiamos URL y storage enseguida para
  // que un refresh no reenvíe. Si el deep link no carga, se avisa en vez de dejar el
  // chat vacío en silencio.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ideaId = params.get("idea");
    const scriptId = params.get("script");

    if (!ideaId && !scriptId) {
      try {
        const seed = sessionStorage.getItem(CREAR_SEED_STORAGE_KEY);
        if (seed) {
          sessionStorage.removeItem(CREAR_SEED_STORAGE_KEY);
          setInitialPrompt(seed);
        }
      } catch {}
      return;
    }
    router.replace("/crear", { scroll: false });

    const notifyLoadError = () =>
      toast({
        title: "No se ha podido cargar el contenido",
        description: "Vuelve a abrir la idea o el guion desde su lista e inténtalo de nuevo.",
      });

    if (ideaId) {
      fetch(`/api/ideas/${ideaId}`)
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          const idea = data?.idea;
          if (!idea) {
            notifyLoadError();
            return;
          }
          setInitialPrompt(buildScriptSeedPrompt(idea.title, idea.description));
        })
        .catch(notifyLoadError);
    } else if (scriptId) {
      fetch(`/api/scripts/${scriptId}`)
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          const script = data?.script;
          if (!script) {
            notifyLoadError();
            return;
          }
          const hookLine = script.hook ? `\n\nHook actual: "${script.hook}"` : "";
          setInitialPrompt(
            `Quiero seguir trabajando en este guion: **${script.title || "Sin título"}**${hookLine}\n\nAyúdame a mejorarlo, ampliarlo o proponer alternativas.`
          );
        })
        .catch(notifyLoadError);
    }
  }, [router, toast]);

  async function handleSelectSession(id: string) {
    setMobileHistoryOpen(false);
    if (id === activeSessionId) return;
    setActiveProjectId(null);
    try {
      const res = await fetch(`/api/chat/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        setActiveSessionId(id);
        setActiveMessages(data.session.messages ?? []);
      }
    } catch {}
  }

  function handleNewChat() {
    setMobileHistoryOpen(false);
    setActiveSessionId(null);
    setActiveMessages([]);
    setActiveProjectId(null);
  }

  function handleNewChatInProject(projectId: string) {
    setMobileHistoryOpen(false);
    setActiveSessionId(null);
    setActiveMessages([]);
    setActiveProjectId(projectId);
  }

  async function handleDeleteSession(id: string) {
    await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    setChatSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) handleNewChat();
  }

  async function handleRenameSession(id: string, title: string) {
    setChatSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
    try {
      await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {}
  }

  function handleSessionCreated(id: string, title: string, messages: { role: "user" | "assistant"; content: string }[], projectId: string | null) {
    const now = new Date().toISOString();
    setChatSessions(prev => [{ id, title, project_id: projectId, created_at: now, updated_at: now }, ...prev]);
    setActiveSessionId(id);
    setActiveMessages(messages);
  }

  function handleSessionUpdated(id: string) {
    const now = new Date().toISOString();
    setChatSessions(prev => prev.map(s => s.id === id ? { ...s, updated_at: now } : s));
  }

  async function handleCreateProject() {
    const res = await fetch("/api/chat/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.project) {
      const now = new Date().toISOString();
      const project: ChatProject = { ...data.project, created_at: data.project.created_at ?? now, updated_at: data.project.updated_at ?? now };
      setChatProjects(prev => [project, ...prev]);
      setPendingEditProjectId(project.id);
    }
  }

  async function handleDeleteProject(id: string) {
    const res = await fetch(`/api/chat/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Error al eliminar el proyecto", description: "Inténtalo de nuevo." });
      return;
    }
    setChatProjects(prev => prev.filter(p => p.id !== id));
    setChatSessions(prev => prev.map(s => s.project_id === id ? { ...s, project_id: null } : s));
    if (activeProjectId === id) setActiveProjectId(null);
  }

  async function handleRenameProject(id: string, title: string) {
    setChatProjects(prev => prev.map(p => p.id === id ? { ...p, title } : p));
    try {
      await fetch(`/api/chat/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {}
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 53px)" }}>
      <FirstChatFeedbackModal open={showFeedbackPopup} onClose={() => setShowFeedbackPopup(false)} />
      <div className="flex flex-1 min-h-0">
        <div className="hidden md:flex p-2 pr-0 relative">
          {!sidebarCollapsed && (
            <ChatSidebar
              sessions={chatSessions}
              projects={chatProjects}
              activeId={activeSessionId}
              pendingEditProjectId={pendingEditProjectId}
              profile={profile}
              onSelect={handleSelectSession}
              onNew={handleNewChat}
              onNewInProject={handleNewChatInProject}
              onDelete={handleDeleteSession}
              onRename={handleRenameSession}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onRenameProject={handleRenameProject}
              onPendingEditHandled={() => setPendingEditProjectId(null)}
            />
          )}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? "Expandir panel" : "Contraer panel"}
            className="absolute top-4 -right-3 z-10 flex items-center justify-center w-6 h-6 rounded-full border shadow-sm transition-colors hover:bg-[var(--color-muted)]"
            style={{ background: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
          </button>
        </div>
        {/* Mobile: drawer con historial de chats */}
        {mobileHistoryOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/30" onClick={() => setMobileHistoryOpen(false)} />
        )}
        <div className={`md:hidden fixed inset-y-0 left-0 z-[60] flex p-2 transition-transform duration-200 ease-out ${mobileHistoryOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"}`}>
          <ChatSidebar
            sessions={chatSessions}
            projects={chatProjects}
            activeId={activeSessionId}
            pendingEditProjectId={pendingEditProjectId}
            profile={profile}
            onSelect={handleSelectSession}
            onNew={handleNewChat}
            onNewInProject={handleNewChatInProject}
            onDelete={handleDeleteSession}
            onRename={handleRenameSession}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
            onPendingEditHandled={() => setPendingEditProjectId(null)}
          />
        </div>
        <div className="flex-1 min-h-0 px-4 md:px-6 pb-4">
          <ChatInterface
            profile={profile}
            sessionId={activeSessionId}
            initialMessages={activeMessages}
            initialPrompt={initialPrompt}
            projectId={activeProjectId}
            projectName={activeProjectId ? (chatProjects.find(p => p.id === activeProjectId)?.title ?? null) : null}
            onSessionCreated={handleSessionCreated}
            onSessionUpdated={handleSessionUpdated}
            onOpenHistory={() => setMobileHistoryOpen(true)}
          />
        </div>
      </div>
    </div>
  );
}
