"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, Loader2, Check, X, Film, CalendarDays, PenLine, ChevronDown, Sparkles,
  AlertTriangle, Plus, Zap, Image as ImageIcon, Crop, Scan,
} from "lucide-react";
import {
  YoutubeIcon, InstagramIcon, FacebookIcon, TiktokIcon, XIcon, LinkedinIcon, ThreadsIcon,
} from "@/components/shared/brand-icons";
import type { BrandIconProps } from "@/components/shared/brand-icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { PublishPlatform, Snippet, SocialConnection } from "@/types";
import {
  PLATFORM_LABELS, PLATFORM_TEXT_LIMITS, formatBytes, formatDateTime,
  toLocalInputValue, nextOccurrence, WEEKDAY_SHORT,
} from "./shared";
import type { BestSlot } from "./shared";
import { PostPreview } from "./post-previews";
import type { PreviewAccount } from "./post-previews";
import { PhotoCrop } from "./photo-crop";
import { IMAGE_INPUT_TYPES, MAX_IMAGE_INPUT_BYTES, prepareImageFile } from "./image-utils";
import type { CropState } from "./image-utils";

const MAX_FILE_BYTES = 400 * 1024 * 1024;
// YouTube solo acepta Shorts de momento: vertical/cuadrado y ≤3 min (el largo
// necesita miniaturas y más ajustes que aún no existen)
const MAX_SHORT_SECONDS = 181;

export const PLATFORM_ORDER: PublishPlatform[] = [
  "youtube", "instagram", "facebook", "tiktok", "x", "linkedin", "threads",
];

export const PLATFORM_ICONS: Record<PublishPlatform, React.ComponentType<BrandIconProps>> = {
  youtube: YoutubeIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TiktokIcon,
  x: XIcon,
  linkedin: LinkedinIcon,
  threads: ThreadsIcon,
};

// Umbrales de visitas para las reglas condicionales
const RULE_THRESHOLDS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Público",
  MUTUAL_FOLLOW_FRIENDS: "Amigos",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Solo yo",
};

export interface PublishFlags {
  youtube: boolean;
  instagram: boolean;
  facebook: boolean;
  tiktok: boolean;
  x: boolean;
  linkedin: boolean;
  threads: boolean;
  automations: boolean;
}

export interface YoutubeConnectionSummary {
  channelName: string | null;
  channelThumbnail: string | null;
  canUpload: boolean;
}

interface Props {
  flags: PublishFlags;
  youtubeConnection: YoutubeConnectionSummary | null;
  connections: SocialConnection[];
  bestSlots: BestSlot[] | null;
  snippets: Snippet[] | null;
  onLoadSnippets: () => void;
  refreshPosts: () => void;
  refreshRules: () => void;
}

type UploadPhase = null | "buffer" | "queue" | "youtube";

// Variante de la foto recortada para una red concreta (fase 1 del editor de
// medios; el vídeo no se recorta, solo se previsualiza el encuadre)
type MediaOverride = { file: File; url: string; crop: CropState };

export function Composer({
  flags, youtubeConnection, connections, bestSlots, snippets, onLoadSnippets, refreshPosts, refreshRules,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<PublishPlatform[]>([]);
  const [generalText, setGeneralText] = useState("");
  const [overrides, setOverrides] = useState<Partial<Record<PublishPlatform, string>>>({});
  const [ytTitle, setYtTitle] = useState("");
  const [ytPrivacy, setYtPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [tiktokPrivacy, setTiktokPrivacy] = useState("PUBLIC_TO_EVERYONE");
  const [activeTab, setActiveTab] = useState<"general" | PublishPlatform>("general");
  const [mode, setMode] = useState<"now" | "schedule">("schedule");
  const [scheduledAt, setScheduledAt] = useState("");
  // Mínimo del datetime-local fijado al montar (el servidor re-valida ≥5 min)
  const [minSchedule] = useState(() => toLocalInputValue(new Date(Date.now() + 15 * 60_000)));

  // Regla condicional: "si supera N visitas en cualquiera de las redes origen
  // → publicar en todas las redes destino"
  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [ruleSources, setRuleSources] = useState<PublishPlatform[]>([]);
  const [ruleTargets, setRuleTargets] = useState<PublishPlatform[]>([]);
  const [thresholdChoice, setThresholdChoice] = useState("100000"); // preset o "custom"
  const [customThreshold, setCustomThreshold] = useState("");
  const [ruleText, setRuleText] = useState("");

  // Dimensiones y duración del vídeo elegido (para limitar YouTube a Shorts)
  const [videoMeta, setVideoMeta] = useState<{ duration: number; width: number; height: number } | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);

  const [mediaOverrides, setMediaOverrides] = useState<Partial<Record<PublishPlatform, MediaOverride>>>({});
  const mediaOverridesRef = useRef(mediaOverrides);
  const [cropOpen, setCropOpen] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);

  const [phase, setPhase] = useState<UploadPhase>(null);
  const [ytProgress, setYtProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const snippetsMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const connectionByPlatform = useMemo(() => {
    const map = new Map<string, SocialConnection>();
    for (const c of connections) map.set(c.platform, c);
    return map;
  }, [connections]);

  // Las object URLs (vídeo base y variantes por red) se crean/revocan al elegir
  // archivo o aplicar recortes (no en efectos); aquí solo queda liberar las
  // últimas al desmontar.
  useEffect(() => { mediaOverridesRef.current = mediaOverrides; }, [mediaOverrides]);
  useEffect(() => () => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    for (const o of Object.values(mediaOverridesRef.current)) if (o) URL.revokeObjectURL(o.url);
  }, []);

  function clearMediaOverrides() {
    for (const o of Object.values(mediaOverridesRef.current)) if (o) URL.revokeObjectURL(o.url);
    setMediaOverrides({});
  }

  function applyMediaOverride(platform: PublishPlatform, f: File, crop: CropState) {
    const old = mediaOverridesRef.current[platform];
    if (old) URL.revokeObjectURL(old.url);
    setMediaOverrides((prev) => ({ ...prev, [platform]: { file: f, url: URL.createObjectURL(f), crop } }));
  }

  function removeMediaOverride(platform: PublishPlatform) {
    const old = mediaOverridesRef.current[platform];
    if (old) URL.revokeObjectURL(old.url);
    setMediaOverrides((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
  }

  function setVideoFile(f: File | null) {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    videoUrlRef.current = f ? URL.createObjectURL(f) : null;
    setVideoUrl(videoUrlRef.current);
    setFile(f);
    setVideoMeta(null);
    clearMediaOverrides();
    if (videoUrlRef.current && f?.type.startsWith("video/")) {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        setVideoMeta({ duration: probe.duration, width: probe.videoWidth, height: probe.videoHeight });
        // YouTube solo publica Shorts: si el vídeo no cualifica, soltarlo de la selección
        if (probe.duration > MAX_SHORT_SECONDS || probe.videoWidth > probe.videoHeight) {
          setSelected((prev) => prev.filter((p) => p !== "youtube"));
        }
      };
      probe.src = videoUrlRef.current;
    }
  }

  const mediaType: "video" | "image" = file?.type.startsWith("image/") ? "image" : "video";

  // Solo Shorts en YouTube: vertical/cuadrado y hasta 3 minutos. Las fotos no
  // se publican en YouTube en absoluto.
  const ytShortsBlocked = Boolean(
    videoMeta && (videoMeta.duration > MAX_SHORT_SECONDS || videoMeta.width > videoMeta.height)
  );
  const ytBlocked = ytShortsBlocked || (Boolean(file) && mediaType === "image");

  useEffect(() => {
    if (!phase) return;
    const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [phase]);

  useEffect(() => {
    if (!showSnippets) return;
    function onDocClick(e: MouseEvent) {
      if (snippetsMenuRef.current && !snippetsMenuRef.current.contains(e.target as Node)) {
        setShowSnippets(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showSnippets]);

  const tiktokPrivacyOptions = useMemo(() => {
    const creatorInfo = connectionByPlatform.get("tiktok")?.metadata?.creatorInfo as
      | { privacyOptions?: string[] }
      | undefined;
    return creatorInfo?.privacyOptions ?? ["PUBLIC_TO_EVERYONE", "SELF_ONLY"];
  }, [connectionByPlatform]);

  // Derivados (sin efectos): la privacidad elegida debe existir entre las opciones
  // reales del creador, y la pestaña activa debe seguir seleccionada
  const effectiveTiktokPrivacy = tiktokPrivacyOptions.includes(tiktokPrivacy)
    ? tiktokPrivacy
    : tiktokPrivacyOptions[0] ?? "SELF_ONLY";
  const tab: "general" | PublishPlatform =
    activeTab === "general" || selected.includes(activeTab) ? activeTab : "general";

  const effectiveText = useCallback(
    (platform: PublishPlatform): string => {
      const override = overrides[platform];
      return override && override.trim() ? override : generalText;
    },
    [overrides, generalText]
  );

  const previewAccount = useCallback(
    (platform: PublishPlatform): PreviewAccount | null => {
      if (platform === "youtube") {
        return youtubeConnection
          ? { name: youtubeConnection.channelName, avatar: youtubeConnection.channelThumbnail }
          : null;
      }
      const conn = connectionByPlatform.get(platform);
      return conn ? { name: conn.account_name, avatar: conn.account_avatar } : null;
    },
    [youtubeConnection, connectionByPlatform]
  );

  function isConnected(platform: PublishPlatform): boolean {
    if (platform === "youtube") return Boolean(youtubeConnection?.canUpload);
    return connectionByPlatform.has(platform);
  }

  function connectHref(platform: PublishPlatform): string {
    return platform === "youtube"
      ? "/api/auth/youtube/connect?from=publicar"
      : `/api/auth/${platform}/connect`;
  }

  function toggle(platform: PublishPlatform) {
    setSelected((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : PLATFORM_ORDER.filter((p) => p === platform || prev.includes(p))
    );
  }

  async function pickFile(f: File | undefined | null) {
    setFormError(null);
    setFileError(null);
    if (!f) return;

    if (f.type.startsWith("image/")) {
      if (!IMAGE_INPUT_TYPES.includes(f.type)) {
        setFileError("Formato de imagen no compatible: usa JPG, PNG o WebP.");
        return;
      }
      if (f.size > MAX_IMAGE_INPUT_BYTES) {
        setFileError(`Esta foto pesa ${formatBytes(f.size)} y el máximo es 30 MB. Redúcela e inténtalo de nuevo.`);
        return;
      }
      try {
        const prepared = await prepareImageFile(f);
        setVideoFile(prepared);
        // YouTube no publica fotos, y las reglas condicionales son solo para vídeo
        setSelected((prev) => prev.filter((p) => p !== "youtube"));
        setRuleEnabled(false);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "No se pudo procesar la imagen.");
      }
      return;
    }

    if (!f.type.startsWith("video/")) {
      setFileError("El archivo debe ser un vídeo o una foto (JPG, PNG o WebP).");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError(
        `Este vídeo pesa ${formatBytes(f.size)} y el máximo es 400 MB. Comprímelo o recórtalo e inténtalo de nuevo.`
      );
      return;
    }
    setVideoFile(f);
    if (!ytTitle) setYtTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 100));
  }

  function setActiveText(value: string) {
    if (tab === "general") setGeneralText(value);
    else setOverrides((prev) => ({ ...prev, [tab]: value }));
  }

  function activeText(): string {
    return tab === "general" ? generalText : overrides[tab] ?? "";
  }

  function insertSnippet(content: string) {
    setShowSnippets(false);
    const current = activeText();
    setActiveText(current ? (current.endsWith("\n") ? current + content : `${current}\n${content}`) : content);
    textareaRef.current?.focus();
  }

  // Derivados de la regla condicional. LinkedIn no expone visitas (no puede
  // ser origen); YouTube no publica por cron (no puede ser destino); los
  // destinos no pueden estar ya entre las redes seleccionadas.
  const ruleSourceOptions: PublishPlatform[] = selected.filter((p) => p !== "linkedin");
  const effRuleSources = ruleSources.filter((p) => ruleSourceOptions.includes(p));
  const ruleTargetOptions = PLATFORM_ORDER.filter(
    (p) => p !== "youtube" && !selected.includes(p) && flags[p] && connectionByPlatform.has(p)
  );
  const effRuleTargets = ruleTargets.filter((p) => ruleTargetOptions.includes(p));
  const ruleThreshold =
    thresholdChoice === "custom" ? parseInt(customThreshold.replace(/[.\s]/g, ""), 10) : Number(thresholdChoice);
  const ruleFinalText = (ruleText.trim() || generalText).trim();

  function openRulePanel() {
    setRuleEnabled(true);
    // Preselección natural: todas las redes medibles ya elegidas son origen
    setRuleSources(selected.filter((p) => p !== "linkedin"));
    setRuleTargets([]);
  }

  function toggleRuleSource(p: PublishPlatform) {
    setRuleSources((prev) => (prev.includes(p) ? prev.filter((s) => s !== p) : [...prev, p]));
  }

  function toggleRuleTarget(p: PublishPlatform) {
    setRuleTargets((prev) => (prev.includes(p) ? prev.filter((t) => t !== p) : [...prev, p]));
  }

  const ruleIssues: string[] = [];
  if (ruleEnabled && selected.length > 0) {
    if (effRuleSources.length === 0) {
      ruleIssues.push("Elige al menos una red de origen para la regla (LinkedIn no expone visitas).");
    }
    if (effRuleTargets.length === 0) {
      ruleIssues.push(
        ruleTargetOptions.length === 0
          ? "Sin redes de destino disponibles: conecta otra red que no esté ya seleccionada."
          : "Elige al menos una red de destino para la regla."
      );
    }
    if (!Number.isInteger(ruleThreshold) || ruleThreshold < 100) {
      ruleIssues.push("El umbral de visitas debe ser un número de al menos 100.");
    }
    for (const target of effRuleTargets) {
      const limit = PLATFORM_TEXT_LIMITS[target];
      if (!ruleFinalText) {
        ruleIssues.push("Falta el texto de la regla (o escribe antes el texto general).");
        break;
      }
      if (ruleFinalText.length > limit) {
        ruleIssues.push(
          `El texto de la regla supera los ${limit.toLocaleString("es-ES")} caracteres de ${PLATFORM_LABELS[target]}.`
        );
      }
    }
  }

  const textIssues = useMemo(() => {
    const issues: string[] = [];
    for (const p of selected) {
      const text = effectiveText(p);
      const limit = PLATFORM_TEXT_LIMITS[p];
      if (p === "youtube") {
        if (!ytTitle.trim()) issues.push("YouTube necesita un título.");
        else if (ytTitle.trim().length > 100) issues.push("El título de YouTube supera los 100 caracteres.");
        if (text.length > limit) issues.push("La descripción de YouTube supera los 5000 caracteres.");
      } else {
        if (!text.trim()) issues.push(`Falta el texto para ${PLATFORM_LABELS[p]}.`);
        else if (text.length > limit) {
          issues.push(`El texto de ${PLATFORM_LABELS[p]} supera los ${limit.toLocaleString("es-ES")} caracteres.`);
        }
      }
    }
    return issues;
  }, [selected, effectiveText, ytTitle]);

  const canSubmit =
    Boolean(file) &&
    selected.length > 0 &&
    textIssues.length === 0 &&
    ruleIssues.length === 0 &&
    !phase &&
    (mode === "now" || Boolean(scheduledAt));

  function resetForm() {
    setVideoFile(null);
    setFileError(null);
    setGeneralText("");
    setOverrides({});
    setYtTitle("");
    setScheduledAt("");
    setActiveTab("general");
    setRuleEnabled(false);
    setRuleSources([]);
    setRuleTargets([]);
    setRuleText("");
    setCustomThreshold("");
    setThresholdChoice("100000");
  }

  async function submit() {
    if (!file || !canSubmit) return;
    setFormError(null);
    setSuccessNote(null);
    setYtProgress(0);

    const scheduledIso = mode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null;
    const cronPlatforms = selected.filter((p) => p !== "youtube");
    const wantsYoutube = selected.includes("youtube");
    const queuedLabels = cronPlatforms.map((p) => PLATFORM_LABELS[p]).join(", ");
    let queuedOk = false;

    // Capturar la regla al inicio: setSelected() de más abajo cambia los derivados
    const rule = ruleEnabled && mediaType === "video" && effRuleSources.length > 0 && effRuleTargets.length > 0
      ? { sources: effRuleSources, targets: effRuleTargets, threshold: ruleThreshold, text: ruleFinalText }
      : null;
    // Variantes recortadas por red (solo fotos): cada una es un archivo propio
    // en el bucket. El archivo base solo hace falta si alguna red seleccionada
    // no tiene variante o si hay regla condicional (siempre usa el original).
    const activeOverrides: Array<{ platform: PublishPlatform; override: MediaOverride }> = [];
    if (mediaType === "image") {
      for (const p of cronPlatforms) {
        const o = mediaOverrides[p];
        if (o) activeOverrides.push({ platform: p, override: o });
      }
    }
    // Con regla, el vídeo también tiene que quedar en el bucket aunque solo haya
    // YouTube (la subida directa navegador→YouTube no deja copia para el crosspost)
    const needBase =
      rule !== null ||
      cronPlatforms.some((p) => mediaType !== "image" || !mediaOverrides[p]);
    let storagePath: string | null = null;
    const platformPaths: Partial<Record<PublishPlatform, { path: string; size: number }>> = {};
    const uploadedPaths: string[] = [];
    let createdPosts: Array<{ id: string; platform: string }> = [];
    let ytPostId: string | null = null;

    try {
      if (needBase || activeOverrides.length > 0) {
        // 1. Archivo(s) al bucket: el base compartido y las variantes por red
        setPhase("buffer");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sesión caducada. Recarga la página.");

        const uploadToBucket = async (f: File): Promise<string> => {
          const ext = f.name.split(".").pop()?.toLowerCase() ?? (mediaType === "image" ? "jpg" : "mp4");
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("publish-videos")
            .upload(path, f, {
              contentType: f.type || (mediaType === "image" ? "image/jpeg" : "video/mp4"),
            });
          if (uploadError) {
            throw new Error(`No se pudo subir ${mediaType === "image" ? "la foto" : "el vídeo"}: ${uploadError.message}`);
          }
          uploadedPaths.push(path);
          return path;
        };

        if (needBase) storagePath = await uploadToBucket(file);
        for (const { platform, override } of activeOverrides) {
          platformPaths[platform] = { path: await uploadToBucket(override.file), size: override.file.size };
        }
      }

      if (cronPlatforms.length > 0) {
        // 2. Encolar el grupo
        setPhase("queue");
        const res = await fetch("/api/publicaciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath,
            fileName: file.name,
            fileSize: file.size,
            mediaType,
            scheduledAt: scheduledIso,
            platforms: cronPlatforms.map((p) => ({
              platform: p,
              text: effectiveText(p).trim(),
              ...(platformPaths[p] ? { storagePath: platformPaths[p].path, fileSize: platformPaths[p].size } : {}),
              ...(p === "tiktok" ? { privacyLevel: effectiveTiktokPrivacy } : {}),
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "No se pudo crear la publicación.");
        createdPosts = Array.isArray(json) ? json : [];
        queuedOk = true;
        // Evita duplicados si la subida a YouTube falla y el usuario reintenta
        setSelected((prev) => prev.filter((p) => p === "youtube"));
        refreshPosts();
      }

      if (wantsYoutube) {
        // 3. Subida directa navegador → YouTube (los bytes no pasan por nuestros servidores)
        setPhase("youtube");
        const sessionRes = await fetch("/api/youtube/upload-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: ytTitle.trim(),
            description: effectiveText("youtube").trim(),
            privacy: ytPrivacy,
            scheduledAt: scheduledIso,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        });
        const session = await sessionRes.json();
        if (!sessionRes.ok) {
          if (session.error === "RECONNECT_REQUIRED") {
            throw new Error("Reconecta tu canal de YouTube para conceder el permiso de subida.");
          }
          throw new Error(session.error ?? "No se pudo iniciar la subida a YouTube.");
        }

        const { postId, uploadUrl } = session as { postId: string; uploadUrl: string };
        ytPostId = postId;
        refreshPosts();

        try {
          const videoId = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhrRef.current = xhr;
            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", file.type || "video/*");
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) setYtProgress(Math.round((e.loaded / e.total) * 100));
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const json = JSON.parse(xhr.responseText);
                  if (json.id) return resolve(json.id);
                } catch { /* cae al reject */ }
              }
              reject(new Error(`YouTube respondió ${xhr.status}`));
            };
            xhr.onerror = () => reject(new Error("Error de red durante la subida"));
            xhr.onabort = () => reject(new Error("Subida cancelada"));
            xhr.send(file);
          });

          const completeRes = await fetch("/api/youtube/upload-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, videoId }),
          });
          const completed = await completeRes.json();
          if (!completeRes.ok) throw new Error(completed.error ?? "No se pudo confirmar la subida.");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          await fetch("/api/youtube/upload-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, error: msg }),
          }).catch(() => {});
          throw err;
        } finally {
          xhrRef.current = null;
        }
      }

      // 4. Regla condicional (solo si todo lo anterior salió bien)
      let ruleWarning: string | null = null;
      let ruleCreated = false;
      if (rule) {
        const sourcePostIds = rule.sources
          .map((s) => (s === "youtube" ? ytPostId : createdPosts.find((p) => p.platform === s)?.id ?? null))
          .filter((id): id is string => Boolean(id));
        if (sourcePostIds.length === rule.sources.length) {
          const ruleRes = await fetch("/api/publicaciones/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourcePostIds,
              targetPlatforms: rule.targets,
              threshold: rule.threshold,
              text: rule.text,
              ...(rule.targets.includes("tiktok") ? { privacyLevel: effectiveTiktokPrivacy } : {}),
              ...(storagePath ? { storagePath, fileName: file.name, fileSize: file.size } : {}),
            }),
          }).catch(() => null);
          if (ruleRes?.ok) {
            ruleCreated = true;
            refreshRules();
          } else {
            const json = await ruleRes?.json().catch(() => null);
            ruleWarning = json?.error ?? "No se pudo crear la regla condicional.";
          }
        } else {
          ruleWarning = "No se pudo vincular la regla a las publicaciones de origen.";
        }
      }

      refreshPosts();
      const allLabels = [
        ...(wantsYoutube ? ["YouTube"] : []),
        ...(queuedLabels ? [queuedLabels] : []),
      ].join(", ");
      const ruleNote =
        rule && ruleCreated
          ? ` Y si supera las ${rule.threshold.toLocaleString("es-ES")} visitas en ${rule.sources.map((s) => PLATFORM_LABELS[s]).join(" o ")}, saltará también a ${rule.targets.map((t) => PLATFORM_LABELS[t]).join(" y ")} 🎯`
          : "";
      setSuccessNote(
        (scheduledIso
          ? `Programado en ${allLabels} para el ${formatDateTime(scheduledIso)}. Lo publicaremos automáticamente y lo tienes en tu calendario 🚀`
          : `¡En marcha! Se publicará en ${allLabels} en los próximos minutos.`) + ruleNote
      );
      if (ruleWarning) {
        setFormError(`La publicación salió bien, pero la regla condicional no se pudo crear: ${ruleWarning}`);
      }
      resetForm();
    } catch (err) {
      // Sin publicaciones encoladas nadie referencia los archivos subidos: limpiarlos
      if (!queuedOk && uploadedPaths.length > 0) {
        await createClient().storage.from("publish-videos").remove(uploadedPaths).catch(() => {});
      }
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setFormError(
        queuedOk
          ? `${queuedLabels} quedaron encoladas correctamente, pero YouTube falló: ${msg}. Puedes reintentar solo YouTube.`
          : msg
      );
      refreshPosts();
    } finally {
      setPhase(null);
      setYtProgress(0);
    }
  }

  const previewPlatform: PublishPlatform | null =
    tab !== "general" ? tab : selected[0] ?? null;
  const previewOverride =
    previewPlatform && mediaType === "image" ? mediaOverrides[previewPlatform] : undefined;
  // Zonas seguras: solo redes de vídeo fullscreen, donde la UI tapa contenido
  const safeZonesAvailable =
    mediaType === "video" &&
    Boolean(file) &&
    (previewPlatform === "tiktok" || previewPlatform === "instagram" || previewPlatform === "youtube");
  const horizontalVideoWarning =
    mediaType === "video" &&
    videoMeta !== null &&
    videoMeta.width > videoMeta.height &&
    (previewPlatform === "tiktok" || previewPlatform === "instagram");

  const activeLimit = tab === "general" ? null : PLATFORM_TEXT_LIMITS[tab];
  const activeCount = tab === "general" ? generalText.length : effectiveText(tab).length;

  return (
    <section className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--color-border)" }}>
      {/* 1. Redes de destino */}
      <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--color-muted-foreground)" }}>
        Publicar en
      </p>
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {PLATFORM_ORDER.map((p) => {
          const Icon = PLATFORM_ICONS[p];
          const enabled = flags[p];
          const connected = isConnected(p);
          const active = selected.includes(p);
          const blocked = p === "youtube" && ytBlocked;

          if (!enabled) {
            return (
              <span
                key={p}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium opacity-70"
                style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
              >
                <Icon size={14} />
                {PLATFORM_LABELS[p]}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}
                >
                  Pronto
                </span>
              </span>
            );
          }

          if (!connected) {
            return (
              <a
                key={p}
                href={connectHref(p)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed text-sm font-medium transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
                title={
                  p === "youtube" && youtubeConnection
                    ? "Reconecta tu canal para autorizar la subida de vídeos"
                    : `Conectar ${PLATFORM_LABELS[p]}`
                }
              >
                <Plus size={12} />
                <Icon size={14} />
                {PLATFORM_LABELS[p]}
              </a>
            );
          }

          const account = previewAccount(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              disabled={blocked}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                backgroundColor: active ? "var(--color-primary-light)" : "var(--color-card)",
                color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
              }}
              title={
                blocked
                  ? mediaType === "image"
                    ? "YouTube no admite fotos"
                    : "En YouTube solo se publican Shorts: vídeo vertical de hasta 3 minutos"
                  : undefined
              }
            >
              {account?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.avatar} alt="" className="w-[18px] h-[18px] rounded-full object-cover" />
              ) : (
                <Icon size={14} colored={active} />
              )}
              {PLATFORM_LABELS[p]}
              {active && <Check size={12} />}
            </button>
          );
        })}
      </div>
      {ytBlocked && (
        <p className="flex items-center gap-1.5 text-[11px] -mt-4 mb-5" style={{ color: "var(--color-warning)" }}>
          <AlertTriangle size={11} />
          {mediaType === "image"
            ? "Las fotos no se publican en YouTube: queda fuera de esta publicación."
            : "Este vídeo no cualifica como Short (vertical y hasta 3 min): YouTube queda fuera."}
        </p>
      )}

      {/* 2. Vídeo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
      />
      {!file ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
          className="w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors"
          style={{
            borderColor: dragOver ? "var(--color-primary)" : "var(--color-border)",
            backgroundColor: dragOver ? "var(--color-primary-light)" : "transparent",
          }}
        >
          <Upload size={22} className="mx-auto mb-3" style={{ color: "var(--color-muted-foreground)" }} />
          <p className="text-sm font-medium">Arrastra tu vídeo o foto aquí, o haz clic para elegirlo</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
            Un solo archivo para todas las redes · vídeo hasta 400 MB · foto JPG/PNG/WebP (se optimiza sola) · en YouTube solo Shorts
          </p>
        </button>
      ) : (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)" }}
        >
          {mediaType === "image" ? (
            <ImageIcon size={18} className="flex-shrink-0" style={{ color: "var(--color-primary)" }} />
          ) : (
            <Film size={18} className="flex-shrink-0" style={{ color: "var(--color-primary)" }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{formatBytes(file.size)}</p>
          </div>
          {!phase && (
            <button
              onClick={() => setVideoFile(null)}
              className="p-1.5 rounded-lg hover:bg-white transition-colors flex-shrink-0"
              aria-label="Quitar archivo"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
      {fileError && (
        <p className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "var(--color-destructive)" }}>
          <AlertTriangle size={12} className="flex-shrink-0" /> {fileError}
        </p>
      )}

      {/* 3. Texto por red + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_264px] gap-6 mt-6">
        <div className="min-w-0 space-y-4">
          {/* Pestañas: general + una por red seleccionada */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                backgroundColor: tab === "general" ? "var(--color-primary)" : "var(--color-muted)",
                color: tab === "general" ? "white" : "var(--color-muted-foreground)",
              }}
            >
              Texto general
            </button>
            {selected.map((p) => {
              const Icon = PLATFORM_ICONS[p];
              const count = effectiveText(p).length;
              const over = count > PLATFORM_TEXT_LIMITS[p];
              const customized = Boolean(overrides[p]?.trim());
              const cropped = Boolean(mediaOverrides[p]);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActiveTab(p)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: tab === p ? "var(--color-primary)" : "var(--color-muted)",
                    color: over
                      ? tab === p ? "white" : "var(--color-destructive)"
                      : tab === p ? "white" : "var(--color-muted-foreground)",
                  }}
                >
                  <Icon size={11} colored={tab !== p && !over} />
                  {PLATFORM_LABELS[p]}
                  {customized && <PenLine size={9} />}
                  {cropped && <Crop size={9} />}
                  {over && <AlertTriangle size={10} />}
                </button>
              );
            })}
          </div>

          {/* Título de YouTube */}
          {tab === "youtube" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium">Título del Short</label>
                <span
                  className="text-[11px] tabular-nums"
                  style={{ color: ytTitle.length > 100 ? "var(--color-destructive)" : "var(--color-muted-foreground)" }}
                >
                  {ytTitle.length}/100
                </span>
              </div>
              <input
                type="text"
                value={ytTitle}
                onChange={(e) => setYtTitle(e.target.value)}
                maxLength={110}
                placeholder="El título que verá tu audiencia en YouTube"
                className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium">
                {tab === "general"
                  ? "Texto del post (se usa en todas las redes sin texto propio)"
                  : tab === "youtube"
                    ? "Descripción en YouTube"
                    : `Texto para ${PLATFORM_LABELS[tab]}`}
              </label>
              <div className="flex items-center gap-3">
                <div ref={snippetsMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowSnippets((v) => !v); onLoadSnippets(); }}
                    className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-70"
                    style={{ color: "var(--color-primary)" }}
                  >
                    <PenLine size={10} /> Insertar firma <ChevronDown size={9} />
                  </button>
                  {showSnippets && (
                    <div className="absolute top-full right-0 mt-1.5 bg-white rounded-xl border border-[var(--color-border)] shadow-lg py-1 min-w-[200px] z-20">
                      {snippets === null ? (
                        <p className="px-3 py-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>Cargando...</p>
                      ) : snippets.length === 0 ? (
                        <a
                          href="/ajustes?tab=ia"
                          className="block px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors"
                          style={{ color: "var(--color-muted-foreground)" }}
                        >
                          Crea firmas en Ajustes → IA
                        </a>
                      ) : (
                        snippets.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => insertSnippet(s.content)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors truncate"
                            title={s.content}
                          >
                            {s.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {activeLimit !== null && (
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: activeCount > activeLimit ? "var(--color-destructive)" : "var(--color-muted-foreground)" }}
                  >
                    {activeCount.toLocaleString("es-ES")}/{activeLimit.toLocaleString("es-ES")}
                  </span>
                )}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={activeText()}
              onChange={(e) => setActiveText(e.target.value)}
              rows={5}
              placeholder={
                tab === "general"
                  ? "Texto, hashtags, enlaces... puedes personalizarlo por red en sus pestañas"
                  : `Si lo dejas vacío se usa el texto general${generalText ? `: "${generalText.slice(0, 60)}${generalText.length > 60 ? "…" : ""}"` : ""}`
              }
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
            />
            {/* Contadores por red en la pestaña general */}
            {tab === "general" && selected.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                {selected.map((p) => {
                  const count = effectiveText(p).length;
                  const limit = PLATFORM_TEXT_LIMITS[p];
                  return (
                    <span
                      key={p}
                      className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-md"
                      style={{
                        color: count > limit ? "var(--color-destructive)" : "var(--color-muted-foreground)",
                        backgroundColor: count > limit ? "var(--destructive-muted)" : "var(--color-muted)",
                      }}
                    >
                      {PLATFORM_LABELS[p]} {count.toLocaleString("es-ES")}/{limit.toLocaleString("es-ES")}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recorte de la foto para esta red (las variantes de vídeo llegarán más adelante) */}
          {tab !== "general" && tab !== "youtube" && file && mediaType === "image" && (
            <div className="flex items-center gap-2.5 flex-wrap">
              {mediaOverrides[tab] ? (
                <>
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-success)" }}>
                    <Crop size={12} /> Foto ajustada para {PLATFORM_LABELS[tab]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCropOpen(true)}
                    className="text-[11px] font-medium hover:underline"
                    style={{ color: "var(--color-primary)" }}
                  >
                    Editar recorte
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMediaOverride(tab)}
                    className="text-[11px] font-medium hover:underline"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    Usar la original
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setCropOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
                >
                  <Crop size={12} /> Ajustar la foto para {PLATFORM_LABELS[tab]}
                </button>
              )}
            </div>
          )}

          {/* Visibilidad TikTok */}
          {tab === "tiktok" && (
            <div>
              <label className="text-xs font-medium block mb-1.5">Visibilidad en TikTok</label>
              <Select value={effectiveTiktokPrivacy} onValueChange={setTiktokPrivacy}>
                <SelectTrigger className="w-full sm:w-64 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiktokPrivacyOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>{TIKTOK_PRIVACY_LABELS[opt] ?? opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!tiktokPrivacyOptions.includes("PUBLIC_TO_EVERYONE") && (
                <p className="text-[11px] mt-1.5" style={{ color: "var(--color-warning)" }}>
                  Tu cuenta solo permite publicar en &quot;Solo yo&quot; hasta que TikTok apruebe la app.
                </p>
              )}
            </div>
          )}

          {/* Visibilidad YouTube (solo publicación inmediata; programado siempre sale público) */}
          {tab === "youtube" && mode === "now" && (
            <div>
              <label className="text-xs font-medium block mb-1.5">Visibilidad en YouTube</label>
              <Select value={ytPrivacy} onValueChange={(v) => setYtPrivacy(v as typeof ytPrivacy)}>
                <SelectTrigger className="w-full sm:w-64 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Público</SelectItem>
                  <SelectItem value="unlisted">Oculto (con enlace)</SelectItem>
                  <SelectItem value="private">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Preview de la red activa */}
        <div className="flex flex-col items-center gap-2">
          {previewPlatform ? (
            <>
              <PostPreview
                platform={previewPlatform}
                videoUrl={previewOverride?.url ?? videoUrl}
                mediaType={mediaType}
                text={effectiveText(previewPlatform)}
                title={ytTitle}
                account={previewAccount(previewPlatform)}
                safeZones={showSafeZones && safeZonesAvailable}
              />
              <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                Así se verá en {PLATFORM_LABELS[previewPlatform]}
                {previewOverride ? " (foto ajustada)" : ""}
              </p>
              {safeZonesAvailable && (
                <button
                  type="button"
                  onClick={() => setShowSafeZones((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-70"
                  style={{ color: showSafeZones ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
                >
                  <Scan size={10} /> {showSafeZones ? "Ocultar zonas seguras" : "Ver zonas seguras"}
                </button>
              )}
              {horizontalVideoWarning && (
                <p className="flex items-start gap-1.5 text-[11px] text-center" style={{ color: "var(--color-warning)" }}>
                  <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                  Vídeo horizontal: en {PLATFORM_LABELS[previewPlatform]} se verá con bandas o recortado.
                </p>
              )}
            </>
          ) : (
            <div
              className="w-full rounded-2xl border border-dashed flex flex-col items-center justify-center text-center px-4"
              style={{ borderColor: "var(--color-border)", minHeight: 300 }}
            >
              <Sparkles size={18} className="mb-2" style={{ color: "var(--color-muted-foreground)" }} />
              <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                Selecciona una red para ver cómo quedará tu publicación
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Cuándo publicar */}
      <div className="mt-6">
        <label className="text-xs font-medium block mb-1.5">Publicación</label>
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs font-medium w-fit mb-3">
          <button
            type="button"
            onClick={() => setMode("schedule")}
            className="px-3.5 py-1.5 transition-colors"
            style={{
              backgroundColor: mode === "schedule" ? "var(--color-primary)" : "transparent",
              color: mode === "schedule" ? "white" : "var(--color-muted-foreground)",
            }}
          >
            Programar
          </button>
          <button
            type="button"
            onClick={() => setMode("now")}
            className="px-3.5 py-1.5 transition-colors"
            style={{
              backgroundColor: mode === "now" ? "var(--color-primary)" : "transparent",
              color: mode === "now" ? "white" : "var(--color-muted-foreground)",
              borderLeft: "1px solid var(--color-border)",
            }}
          >
            Publicar ahora
          </button>
        </div>

        {mode === "schedule" ? (
          <div className="space-y-2.5">
            <input
              type="datetime-local"
              value={scheduledAt}
              min={minSchedule}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full sm:w-64 text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
            />
            {bestSlots && bestSlots.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                  <Sparkles size={10} /> Mejores horas:
                </span>
                {bestSlots.map((s, i) => {
                  const d = nextOccurrence(s.weekday, s.hour);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setScheduledAt(toLocalInputValue(d))}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors hover:border-[var(--color-primary)]"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                    >
                      {WEEKDAY_SHORT[s.weekday]} {String(s.hour).padStart(2, "0")}:00
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
              Todas las redes seleccionadas publicarán automáticamente a esa hora.
            </p>
          </div>
        ) : (
          <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
            Se publicará en todas las redes seleccionadas en los próximos minutos.
          </p>
        )}
      </div>

      {/* 5. Regla condicional (opcional, solo vídeo: las visitas de fotos no
          se pueden medir en todas las redes) */}
      {selected.length > 0 && mediaType === "video" && (
        <div className="mt-6">
          {!ruleEnabled ? (
            <button
              type="button"
              onClick={openRulePanel}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold shadow-sm transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:shadow-md"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
            >
              <span
                className="flex items-center justify-center w-6 h-6 rounded-lg"
                style={{ backgroundColor: "var(--color-primary-light)" }}
              >
                <Zap size={13} style={{ color: "var(--color-primary)" }} />
              </span>
              Regla condicional
              <span className="text-[11px] font-normal" style={{ color: "var(--color-muted-foreground)" }}>
                si triunfa en una red, publícalo en otras
              </span>
              <ChevronDown size={14} style={{ color: "var(--color-muted-foreground)" }} />
            </button>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
              <div
                className="flex items-center justify-between px-5 py-3 border-b"
                style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)" }}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Zap size={14} style={{ color: "var(--color-primary)" }} /> Regla condicional
                </p>
                <button
                  type="button"
                  onClick={() => setRuleEnabled(false)}
                  className="p-1.5 rounded-lg hover:bg-white transition-colors"
                  aria-label="Quitar regla"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Umbral + redes origen */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap text-sm mb-2">
                    <span>Si el vídeo supera</span>
                    <Select value={thresholdChoice} onValueChange={setThresholdChoice}>
                      <SelectTrigger className="w-36 h-8 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_THRESHOLDS.map((t) => (
                          <SelectItem key={t} value={String(t)}>{t.toLocaleString("es-ES")}</SelectItem>
                        ))}
                        <SelectItem value="custom">Personalizado…</SelectItem>
                      </SelectContent>
                    </Select>
                    {thresholdChoice === "custom" && (
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={customThreshold}
                        onChange={(e) => setCustomThreshold(e.target.value)}
                        placeholder="p. ej. 75000"
                        className="w-32 h-8 text-sm border border-[var(--color-border)] rounded-lg px-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
                      />
                    )}
                    <span>visitas en cualquiera de estas redes:</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ruleSourceOptions.map((p) => {
                      const Icon = PLATFORM_ICONS[p];
                      const active = effRuleSources.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => toggleRuleSource(p)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors"
                          style={{
                            borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                            backgroundColor: active ? "var(--color-primary-light)" : "var(--color-card)",
                            color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
                          }}
                        >
                          <Icon size={12} colored={active} />
                          {PLATFORM_LABELS[p]}
                          {active && <Check size={11} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Redes destino */}
                <div>
                  <p className="text-sm mb-2">publícalo también en:</p>
                  {ruleTargetOptions.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                      Todas tus redes conectadas ya están seleccionadas para publicar.
                      Conecta otra red para usarla como destino.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {ruleTargetOptions.map((p) => {
                        const Icon = PLATFORM_ICONS[p];
                        const active = effRuleTargets.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => toggleRuleTarget(p)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors"
                            style={{
                              borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                              backgroundColor: active ? "var(--color-primary-light)" : "var(--color-card)",
                              color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
                            }}
                          >
                            <Icon size={12} colored={active} />
                            {PLATFORM_LABELS[p]}
                            {active && <Check size={11} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Texto del post destino */}
                {effRuleTargets.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium">
                        Texto para {effRuleTargets.map((t) => PLATFORM_LABELS[t]).join(" y ")}
                      </label>
                      <span
                        className="text-[11px] tabular-nums"
                        style={{
                          color: effRuleTargets.some((t) => ruleFinalText.length > PLATFORM_TEXT_LIMITS[t])
                            ? "var(--color-destructive)"
                            : "var(--color-muted-foreground)",
                        }}
                      >
                        {ruleFinalText.length.toLocaleString("es-ES")}/
                        {Math.min(...effRuleTargets.map((t) => PLATFORM_TEXT_LIMITS[t])).toLocaleString("es-ES")}
                      </span>
                    </div>
                    <textarea
                      value={ruleText}
                      onChange={(e) => setRuleText(e.target.value)}
                      rows={2}
                      placeholder={
                        generalText
                          ? `Si lo dejas vacío se usa el texto general: "${generalText.slice(0, 60)}${generalText.length > 60 ? "…" : ""}"`
                          : "Texto del post si la regla se cumple"
                      }
                      className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
                    />
                  </div>
                )}

                <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                  Guardamos el vídeo 30 días y comprobamos las visitas cada hora: en cuanto una
                  red origen cruce el umbral, se publica solo en los destinos y te avisamos por email.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Errores, avisos y submit */}
      <div className="space-y-3 mt-5">
        {file && selected.length > 0 && (textIssues.length > 0 || ruleIssues.length > 0) && (
          <ul className="text-xs rounded-xl px-3 py-2 space-y-0.5" style={{ color: "var(--color-muted-foreground)", backgroundColor: "var(--color-muted)" }}>
            {[...textIssues, ...ruleIssues].map((issue) => <li key={issue}>• {issue}</li>)}
          </ul>
        )}

        {formError && (
          <div className="text-xs rounded-xl px-3 py-2 border" style={{ color: "var(--color-destructive)", backgroundColor: "var(--destructive-muted)", borderColor: "var(--destructive-muted-border)" }}>
            {formError}
          </div>
        )}

        {successNote && (
          <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2 border" style={{ color: "var(--color-success)", backgroundColor: "var(--bg-success)", borderColor: "transparent" }}>
            <Check size={13} className="flex-shrink-0" /> {successNote}
          </div>
        )}

        {phase === "youtube" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Loader2 size={12} className="animate-spin" /> Subiendo a YouTube... no cierres esta pestaña
              </span>
              <span className="tabular-nums font-semibold">{ytProgress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-muted)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${ytProgress}%`, backgroundColor: "var(--color-primary)" }}
              />
            </div>
            <button
              onClick={() => xhrRef.current?.abort()}
              className="text-xs font-medium hover:underline"
              style={{ color: "var(--color-destructive)" }}
            >
              Cancelar subida
            </button>
          </div>
        ) : (
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-40"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {phase === "buffer" || phase === "queue" ? (
              <><Loader2 size={15} className="animate-spin" /> Subiendo vídeo...</>
            ) : mode === "schedule" ? (
              <><CalendarDays size={15} /> Programar en {selected.length || "..."} {selected.length === 1 ? "red" : "redes"}</>
            ) : (
              <><Upload size={15} /> Publicar en {selected.length || "..."} {selected.length === 1 ? "red" : "redes"}</>
            )}
          </button>
        )}
      </div>

      {cropOpen && tab !== "general" && tab !== "youtube" && file && videoUrl && mediaType === "image" && (
        <PhotoCrop
          platform={tab}
          imageUrl={videoUrl}
          fileName={file.name}
          initial={mediaOverrides[tab]?.crop ?? null}
          onApply={(f, crop) => { applyMediaOverride(tab, f, crop); setCropOpen(false); }}
          onClose={() => setCropOpen(false)}
        />
      )}
    </section>
  );
}
