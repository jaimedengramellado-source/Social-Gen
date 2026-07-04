"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Download,
  Pencil,
  Trash2,
  ImageIcon,
  Upload,
  X,
  ChevronRight,
  Maximize2,
  PenLine,
  Eraser,
  Send,
  Loader2,
} from "lucide-react";
import type { Profile, GeneratedImage } from "@/types";
import { useLasso } from "@/hooks/use-lasso";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { downloadImageFromUrl } from "@/lib/utils";

type Mode = "generar" | "editar" | "galeria";
type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3";

const ASPECT_RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3"];

const ASPECT_PADDING: Record<AspectRatio, string> = {
  "1:1": "100%",
  "16:9": "56.25%",
  "9:16": "177.78%",
  "4:3": "75%",
};

interface UploadedImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

interface Props {
  profile: Profile;
  initialImages: GeneratedImage[];
}

function getVersionChain(current: GeneratedImage, gallery: GeneratedImage[]): GeneratedImage[] {
  const byId = new Map(gallery.map((img) => [img.id, img]));

  // Walk up to collect all ancestors
  const ancestors: GeneratedImage[] = [];
  let cur = current;
  while (cur.parent_image_id) {
    const parent = byId.get(cur.parent_image_id);
    if (!parent) break;
    ancestors.unshift(parent);
    cur = parent;
  }

  // Walk down from current following oldest child at each step
  const descendants: GeneratedImage[] = [];
  let node = current;
  while (true) {
    const next = gallery
      .filter((img) => img.parent_image_id === node.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    if (!next) break;
    descendants.push(next);
    node = next;
  }

  return [...ancestors, current, ...descendants];
}

export function ImagenesClient({ profile, initialImages }: Props) {
  const [mode, setMode] = useState<Mode>("generar");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GeneratedImage | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [gallery, setGallery] = useState<GeneratedImage[]>(initialImages);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(profile.credits_remaining);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [variacionesEnabled, setVariacionesEnabled] = useState(false);
  const [variacionesCount, setVariacionesCount] = useState<1 | 2>(1);
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);

  const [iteratePrompt, setIteratePrompt] = useState("");
  const [iterateLoading, setIterateLoading] = useState(false);
  const [iterateError, setIterateError] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewLasso = useLasso(previewCanvasRef);
  const [previewEditPrompt, setPreviewEditPrompt] = useState("");
  const [previewEditLoading, setPreviewEditLoading] = useState(false);
  const [previewEditError, setPreviewEditError] = useState<string | null>(null);

  const versionChain = useMemo(() => {
    if (!currentImage) return [];
    return getVersionChain(currentImage, gallery);
  }, [currentImage, gallery]);

  // Sync canvas dimensions with the preview container
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const sync = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(parent);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear lasso when image changes
  useEffect(() => {
    previewLasso.clearLasso();
    setPreviewEditPrompt("");
    setPreviewEditError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImage?.id]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [meta, base64] = dataUrl.split(",");
      const mimeType = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
      setUploadedImage({ base64, mimeType, previewUrl: dataUrl });
      setSelectedGalleryImage(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function clearSourceImage() {
    setUploadedImage(null);
    setSelectedGalleryImage(null);
  }

  async function handleGenerate() {
    if (loading) return;
    if (mode === "generar" && !prompt.trim()) return;
    if (mode === "editar" && !uploadedImage && !selectedGalleryImage) return;

    setLoading(true);
    setError(null);
    setNoCredits(false);

    try {
      if (mode === "editar") {
        const res = await fetch("/api/ai/edit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editPrompt: prompt,
            sourceImageId: selectedGalleryImage?.id ?? null,
            sourceImageBase64: uploadedImage?.base64 ?? null,
            sourceMimeType: uploadedImage?.mimeType ?? null,
            aspectRatio,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setNoCredits(data.error === "NO_CREDITS");
          setError(getErrorMessage(data.error));
          return;
        }
        const result: GeneratedImage = data.image;
        setCurrentImage(result);
        setGallery((prev) => [result, ...prev]);
        if (data.creditsRemaining != null) setCreditsRemaining(data.creditsRemaining);
      } else {
        const count = variacionesEnabled ? variacionesCount : 1;
        const results: GeneratedImage[] = [];

        for (let i = 0; i < count; i++) {
          const res = await fetch("/api/ai/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, aspectRatio, mode: "generate" }),
          });
          const data = await res.json();
          if (!res.ok) {
            setNoCredits(data.error === "NO_CREDITS");
            setError(getErrorMessage(data.error));
            return;
          }
          results.push(data.images[0]);
          if (data.creditsRemaining != null) setCreditsRemaining(data.creditsRemaining);
        }

        setCurrentImage(results[results.length - 1]);
        setGallery((prev) => [...results.reverse(), ...prev]);
      }
    } catch {
      setError("Error inesperado. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(imageId: string) {
    const res = await fetch("/api/images", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
    if (res.ok) {
      setGallery((prev) => prev.filter((img) => img.id !== imageId));
      if (currentImage?.id === imageId) setCurrentImage(null);
      if (selectedGalleryImage?.id === imageId) setSelectedGalleryImage(null);
    }
  }

  async function handlePreviewZoneEdit() {
    if (!currentImage || !previewLasso.hasSelection || !previewEditPrompt.trim()) return;
    const maskBase64 = previewLasso.getMask();
    if (!maskBase64) return;

    setPreviewEditLoading(true);
    setPreviewEditError(null);

    try {
      const res = await fetch("/api/ai/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editPrompt: previewEditPrompt,
          sourceImageId: currentImage.id,
          maskBase64,
          aspectRatio: currentImage.aspect_ratio ?? aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPreviewEditError(
          data.error === "NO_CREDITS" ? "Sin créditos." : "Error al editar.",
        );
        return;
      }
      const newImg: GeneratedImage = data.image;
      setCurrentImage(newImg);
      setGallery((prev) => [newImg, ...prev]);
      if (data.creditsRemaining != null) setCreditsRemaining(data.creditsRemaining);
      previewLasso.clearLasso();
      setPreviewEditPrompt("");
    } catch {
      setPreviewEditError("Error inesperado. Inténtalo de nuevo.");
    } finally {
      setPreviewEditLoading(false);
    }
  }

  async function handleIterate() {
    if (!currentImage || !iteratePrompt.trim() || iterateLoading) return;
    setIterateLoading(true);
    setIterateError(null);
    try {
      const res = await fetch("/api/ai/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editPrompt: iteratePrompt,
          sourceImageId: currentImage.id,
          aspectRatio: (currentImage.aspect_ratio as AspectRatio) ?? aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIterateError(data.error === "NO_CREDITS" ? "Sin créditos." : "Error al refinar la imagen.");
        return;
      }
      const newImg: GeneratedImage = data.image;
      setCurrentImage(newImg);
      setGallery((prev) => [newImg, ...prev]);
      if (data.creditsRemaining != null) setCreditsRemaining(data.creditsRemaining);
      setIteratePrompt("");
    } catch {
      setIterateError("Error inesperado. Inténtalo de nuevo.");
    } finally {
      setIterateLoading(false);
    }
  }

  function handleClear() {
    setCurrentImage(null);
    setIteratePrompt("");
    setIterateError(null);
    previewLasso.clearLasso();
  }

  function handleUseAsBase(img: GeneratedImage) {
    setSelectedGalleryImage(img);
    setUploadedImage(null);
    setMode("editar");
    setLightboxImage(null);
  }

  function selectVersion(img: GeneratedImage) {
    setCurrentImage(img);
    const ar = img.aspect_ratio as AspectRatio;
    if (ASPECT_RATIOS.includes(ar)) setAspectRatio(ar);
  }

  const sourceImage = uploadedImage ?? selectedGalleryImage;
  const canGenerate =
    !loading &&
    (mode === "generar" ? prompt.trim().length > 0 : !!sourceImage);

  const btnLabel = loading
    ? "Generando..."
    : mode === "editar"
    ? "Editar imagen"
    : variacionesEnabled
    ? `Generar ${variacionesCount} variación${variacionesCount > 1 ? "es" : ""}`
    : "Generar imagen";

  const displayAspectRatio = (currentImage?.aspect_ratio as AspectRatio | undefined) ?? aspectRatio;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1
          className="text-2xl font-normal"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          Estudio de Imágenes
        </h1>
        {creditsRemaining != null && (
          <span
            className="text-xs font-medium px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: "var(--color-primary-light)",
              color: "var(--color-primary)",
            }}
          >
            {creditsRemaining} créditos restantes
          </span>
        )}
      </div>

      {/* Top-level mode tabs */}
      <div
        className="flex rounded-xl p-1 gap-1 mb-6 w-fit"
        style={{ backgroundColor: "var(--color-muted)" }}
      >
        {(["generar", "editar", "galeria"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="py-2 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: mode === m ? "white" : "transparent",
              color:
                mode === m
                  ? "var(--color-foreground)"
                  : "var(--color-muted-foreground)",
              boxShadow:
                mode === m ? "0 1px 3px rgba(0,0,0,0.08)" : undefined,
            }}
          >
            {m === "generar"
              ? "Generar"
              : m === "editar"
              ? "Editar"
              : gallery.length > 0
              ? `Galería (${gallery.length})`
              : "Galería"}
          </button>
        ))}
      </div>

      {/* ── Gallery mode ─────────────────────────────── */}
      {mode === "galeria" ? (
        gallery.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-4 py-24 rounded-2xl border-2 border-dashed"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-muted-foreground)",
            }}
          >
            <ImageIcon size={48} strokeWidth={1.2} />
            <div className="text-center">
              <p className="font-medium" style={{ color: "var(--color-foreground)" }}>
                Todavía no tienes imágenes
              </p>
              <p className="text-sm mt-1">Genera tu primera imagen en la pestaña Generar</p>
            </div>
            <button
              onClick={() => setMode("generar")}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Generar imagen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {gallery.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-xl overflow-hidden border cursor-pointer"
                style={{ borderColor: "var(--color-border)" }}
                onClick={() => setLightboxImage(img)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.image_url}
                  alt={img.prompt}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  <p className="text-white text-xs line-clamp-3 leading-snug">
                    {img.prompt}
                  </p>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseAsBase(img);
                      }}
                      className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors"
                      title="Usar como base"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(img.id);
                      }}
                      className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors"
                      title="Borrar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Generar / Editar mode ───────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left panel */}
          <div className="space-y-4">
            {/* Editar: imagen fuente */}
            {mode === "editar" && (
              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Imagen base
                </label>
                {sourceImage ? (
                  <div
                    className="relative rounded-xl overflow-hidden border"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        uploadedImage
                          ? uploadedImage.previewUrl
                          : (selectedGalleryImage as GeneratedImage).image_url
                      }
                      alt="imagen base"
                      className="w-full h-36 object-cover"
                    />
                    <button
                      onClick={clearSourceImage}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <X size={14} />
                    </button>
                    <div
                      className="absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs text-white"
                      style={{ background: "rgba(0,0,0,0.45)" }}
                    >
                      {uploadedImage ? "Imagen subida" : "Imagen de galería"}
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-xl border-2 border-dashed"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <label
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium cursor-pointer"
                      style={{ color: "var(--color-primary)" }}
                    >
                      <Upload size={16} style={{ flexShrink: 0 }} />
                      Adjuntar imagen desde tu dispositivo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        tabIndex={-1}
                        style={{
                          opacity: 0,
                          position: "absolute",
                          pointerEvents: "none",
                          width: "1px",
                          height: "1px",
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* Mini gallery picker (only when no source selected) */}
                {!sourceImage && gallery.length > 0 && (
                  <div className="space-y-1.5">
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-muted-foreground)" }}
                    >
                      O elige de tu galería:
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {gallery.slice(0, 12).map((img) => (
                        <button
                          key={img.id}
                          onClick={() => {
                            setSelectedGalleryImage(img);
                            setUploadedImage(null);
                          }}
                          className="aspect-square rounded-lg overflow-hidden border-2 transition-all"
                          style={{
                            borderColor:
                              selectedGalleryImage?.id === img.id
                                ? "var(--color-primary)"
                                : "transparent",
                          }}
                          title={img.prompt}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.image_url}
                            alt={img.prompt}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                    {gallery.length > 12 && (
                      <button
                        onClick={() => setMode("galeria")}
                        className="text-xs font-medium"
                        style={{ color: "var(--color-primary)" }}
                      >
                        Ver todas ({gallery.length}) →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--color-foreground)" }}
              >
                {mode === "editar"
                  ? "Describe cómo quieres editar la imagen"
                  : "Describe la imagen que quieres crear"}
              </label>
              <div
                className="rounded-xl border transition-all focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_rgba(140,34,48,0.08)]"
                style={{ borderColor: "var(--color-border)" }}
              >
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    mode === "editar"
                      ? "Cambia el fondo a una ciudad futurista de noche con luces de neón..."
                      : "Una fotografía hiperrealista de un paisaje montañoso al atardecer con niebla..."
                  }
                  rows={4}
                  className="w-full px-4 py-3 text-sm rounded-xl resize-none outline-none bg-transparent"
                  style={{ color: "var(--color-foreground)" }}
                />
              </div>
            </div>

            {/* Aspect ratio */}
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--color-foreground)" }}
              >
                Proporción
              </label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      borderColor:
                        aspectRatio === ar
                          ? "var(--color-primary)"
                          : "var(--color-border)",
                      backgroundColor:
                        aspectRatio === ar
                          ? "var(--color-primary-light)"
                          : "transparent",
                      color:
                        aspectRatio === ar
                          ? "var(--color-primary)"
                          : "var(--color-muted-foreground)",
                    }}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            {/* Variaciones */}
            {mode === "generar" && (
              <div
                className="rounded-xl border px-4 py-3 space-y-3"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Variaciones
                  </span>
                  <button
                    onClick={() => setVariacionesEnabled((v) => !v)}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                    style={{
                      backgroundColor: variacionesEnabled
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                    }}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow"
                      style={{
                        transform: variacionesEnabled
                          ? "translateX(18px)"
                          : "translateX(3px)",
                      }}
                    />
                  </button>
                </div>
                {variacionesEnabled && (
                  <div className="flex gap-2">
                    {([1, 2] as const).map((n) => (
                      <button
                        key={n}
                        onClick={() => setVariacionesCount(n)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all"
                        style={{
                          borderColor:
                            variacionesCount === n
                              ? "var(--color-primary)"
                              : "var(--color-border)",
                          backgroundColor:
                            variacionesCount === n
                              ? "var(--color-primary-light)"
                              : "transparent",
                          color:
                            variacionesCount === n
                              ? "var(--color-primary)"
                              : "var(--color-muted-foreground)",
                        }}
                      >
                        {n} {n === 1 ? "variación" : "variaciones"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Model chip */}
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{
                backgroundColor: "var(--color-muted)",
                color: "var(--color-muted-foreground)",
              }}
            >
              Gemini 2.5 Flash · 2 créditos por imagen
            </div>

            {/* Error */}
            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: noCredits
                    ? "var(--color-primary-light)"
                    : "#FEF2F2",
                  color: noCredits
                    ? "var(--color-primary)"
                    : "var(--color-destructive)",
                }}
              >
                {error}
                {noCredits && (
                  <a
                    href="/ajustes"
                    className="block mt-1 font-semibold underline underline-offset-2"
                  >
                    Consigue más créditos →
                  </a>
                )}
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--color-primary)",
                boxShadow: canGenerate
                  ? "0 2px 12px rgba(140,34,48,0.35)"
                  : undefined,
              }}
            >
              {btnLabel}
            </button>

            {currentImage && (
              <button
                onClick={handleClear}
                className="w-full py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-muted-foreground)",
                }}
              >
                × Empezar desde cero
              </button>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Image preview */}
            <div className="max-w-[600px] mx-auto w-full space-y-3">
              <div
                className="relative w-full rounded-2xl overflow-hidden border"
                style={{
                  borderColor: "var(--color-border)",
                  paddingBottom: ASPECT_PADDING[displayAspectRatio],
                }}
              >
                <div className="absolute inset-0">
                  {loading ? (
                    <div
                      className="w-full h-full animate-pulse rounded-2xl"
                      style={{ backgroundColor: "var(--color-muted)" }}
                    />
                  ) : currentImage ? (
                    <div
                      className="relative w-full h-full group"
                      style={{
                        cursor: previewLasso.lassoActive
                          ? "crosshair"
                          : "pointer",
                      }}
                      onClick={() => {
                        if (!previewLasso.lassoActive && !iterateLoading)
                          setLightboxImage(currentImage);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentImage.image_url}
                        alt={currentImage.prompt}
                        className="w-full h-full object-contain"
                        style={{ backgroundColor: "#000" }}
                      />

                      {/* Iterate loading overlay */}
                      {iterateLoading && (
                        <div
                          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
                          style={{ backgroundColor: "rgba(13,13,13,0.6)", backdropFilter: "blur(3px)" }}
                        >
                          <Loader2 size={28} className="animate-spin text-white" />
                          <p className="text-sm font-medium text-white">Generando nueva versión...</p>
                        </div>
                      )}

                      {/* Lasso canvas */}
                      <canvas
                        ref={previewCanvasRef}
                        className="absolute inset-0 w-full h-full"
                        style={{
                          pointerEvents: previewLasso.lassoActive
                            ? "auto"
                            : "none",
                        }}
                        onClick={(e) => {
                          if (previewLasso.lassoActive) e.stopPropagation();
                        }}
                        {...previewLasso.handlers}
                      />

                      {/* Expand hint */}
                      {!previewLasso.lassoActive && (
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-3 pointer-events-none">
                          <div
                            className="p-1.5 rounded-lg"
                            style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                          >
                            <Maximize2 size={15} className="text-white" />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImageFromUrl(currentImage.image_url);
                        }}
                        className="absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                        title="Descargar"
                      >
                        <Download size={16} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
                      style={{
                        borderColor: "var(--color-border)",
                        color: "var(--color-muted-foreground)",
                      }}
                    >
                      <ImageIcon size={36} strokeWidth={1.2} />
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          Tu imagen aparecerá aquí
                        </p>
                        <p className="text-xs mt-1">
                          Escribe un prompt y pulsa Generar imagen
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Iterate prompt bar */}
              {currentImage && !loading && (
                <div className="space-y-1.5">
                  <div
                    className="flex items-center gap-1 rounded-xl border transition-all focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_rgba(140,34,48,0.08)]"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <input
                      type="text"
                      value={iteratePrompt}
                      onChange={(e) => setIteratePrompt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleIterate(); }}
                      placeholder="Refina esta imagen: cambia el fondo, el estilo, los colores..."
                      disabled={iterateLoading}
                      className="flex-1 px-4 py-3 text-sm rounded-xl outline-none bg-transparent disabled:opacity-50"
                      style={{ color: "var(--color-foreground)" }}
                    />
                    <button
                      onClick={handleIterate}
                      disabled={!iteratePrompt.trim() || iterateLoading}
                      className="mr-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    >
                      {iterateLoading
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Send size={14} />}
                    </button>
                  </div>
                  {iterateError && (
                    <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
                      {iterateError}
                    </p>
                  )}
                </div>
              )}

              {/* Version history carousel */}
              {currentImage && !loading && versionChain.length > 1 && (
                <div className="space-y-1.5">
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    Historial de versiones
                  </p>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {versionChain.map((img, idx) => (
                      <div key={img.id} className="flex items-center gap-1.5 flex-shrink-0">
                        {idx > 0 && (
                          <ChevronRight
                            size={13}
                            style={{ color: "var(--color-border)", flexShrink: 0 }}
                          />
                        )}
                        <button
                          onClick={() => selectVersion(img)}
                          title={img.prompt}
                          className="flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all hover:opacity-90"
                          style={{
                            width: 52,
                            height: 52,
                            borderColor:
                              currentImage.id === img.id
                                ? "var(--color-primary)"
                                : "var(--color-border)",
                            boxShadow:
                              currentImage.id === img.id
                                ? "0 0 0 2px var(--color-primary-light)"
                                : undefined,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.image_url}
                            alt={img.prompt}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lasso toolbar */}
              {currentImage && !loading && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (previewLasso.lassoActive)
                          previewLasso.clearLasso();
                        previewLasso.setLassoActive((v) => !v);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        borderColor: previewLasso.lassoActive
                          ? "var(--color-primary)"
                          : "var(--color-border)",
                        backgroundColor: previewLasso.lassoActive
                          ? "var(--color-primary-light)"
                          : "transparent",
                        color: previewLasso.lassoActive
                          ? "var(--color-primary)"
                          : "var(--color-muted-foreground)",
                      }}
                    >
                      <PenLine size={13} />
                      {previewLasso.lassoActive
                        ? "Dibujando..."
                        : "Seleccionar zona"}
                    </button>

                    {previewLasso.hasSelection && (
                      <button
                        onClick={previewLasso.clearLasso}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
                        style={{
                          borderColor: "var(--color-border)",
                          color: "var(--color-muted-foreground)",
                        }}
                      >
                        <Eraser size={13} />
                        Limpiar
                      </button>
                    )}

                    {previewLasso.lassoActive && !previewLasso.hasSelection && (
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-muted-foreground)" }}
                      >
                        Clic y arrastra para seleccionar
                      </span>
                    )}
                  </div>

                  {previewLasso.hasSelection && (
                    <div className="space-y-1.5">
                      <div
                        className="rounded-xl border transition-all focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_rgba(140,34,48,0.08)]"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <input
                          type="text"
                          value={previewEditPrompt}
                          onChange={(e) => setPreviewEditPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handlePreviewZoneEdit();
                          }}
                          placeholder="Describe qué cambiar en la zona seleccionada..."
                          className="w-full px-4 py-2.5 text-sm rounded-xl outline-none bg-transparent"
                          style={{ color: "var(--color-foreground)" }}
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePreviewZoneEdit}
                          disabled={
                            !previewEditPrompt.trim() || previewEditLoading
                          }
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                          style={{ backgroundColor: "var(--color-primary)" }}
                        >
                          {previewEditLoading ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Send size={13} />
                          )}
                          Editar zona
                        </button>
                        {previewEditError && (
                          <p
                            className="text-xs"
                            style={{ color: "var(--color-destructive)" }}
                          >
                            {previewEditError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          image={{
            url: lightboxImage.image_url,
            id: lightboxImage.id,
            prompt: lightboxImage.prompt,
            aspectRatio: lightboxImage.aspect_ratio,
          }}
          onClose={() => setLightboxImage(null)}
          onUseAsBase={() => handleUseAsBase(lightboxImage)}
          onEditDone={(newImg) => {
            setGallery((prev) => [newImg, ...prev]);
            setCurrentImage(newImg);
            setLightboxImage(null);
          }}
        />
      )}
    </div>
  );
}

function getErrorMessage(code: string): string {
  switch (code) {
    case "NO_CREDITS":
      return "Se han agotado tus créditos.";
    case "RATE_LIMIT":
      return "Demasiadas solicitudes. Espera un momento.";
    case "IMAGE_NOT_FOUND":
      return "Imagen no encontrada o sin permisos.";
    case "NO_IMAGE_IN_RESPONSE":
      return "El modelo no devolvió una imagen. Intenta con otro prompt.";
    default:
      return "Error al generar la imagen. Inténtalo de nuevo.";
  }
}
