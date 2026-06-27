"use client";

import { useState } from "react";
import { Download, Pencil, Trash2, ImageIcon, Upload, X, LayoutGrid, ChevronDown, ChevronUp } from "lucide-react";
import type { Profile, GeneratedImage } from "@/types";

type Mode = "generar" | "editar";
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
  const [galleryOpen, setGalleryOpen] = useState(false);

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

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left panel */}
        <div className="space-y-4">
          {/* Mode tabs — solo Generar / Editar */}
          <div
            className="flex rounded-xl p-1 gap-1"
            style={{ backgroundColor: "var(--color-muted)" }}
          >
            {(["generar", "editar"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all"
                style={{
                  backgroundColor: mode === m ? "white" : "transparent",
                  color: mode === m ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                  boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.08)" : undefined,
                }}
              >
                {m === "generar" ? "Generar" : "Editar"}
              </button>
            ))}
          </div>

          {/* Editar: imagen fuente (galería o subir) */}
          {mode === "editar" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                Imagen base
              </label>
              {sourceImage ? (
                <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedImage ? uploadedImage.previewUrl : (selectedGalleryImage as GeneratedImage).image_url}
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
                    className="w-full flex items-center gap-2 px-4 py-4 text-sm font-medium cursor-pointer"
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
                  {gallery.length > 0 && (
                    <p className="px-4 pb-3 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                      O selecciona una de tu galería abajo
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
              {mode === "editar"
                ? "Describe cómo quieres editar la imagen"
                : "Describe la imagen que quieres crear"}
            </label>
            <div
              className="rounded-xl border transition-all focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.08)]"
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
            <label className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
              Proporción
            </label>
            <div className="flex gap-2">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar}
                  onClick={() => setAspectRatio(ar)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all"
                  style={{
                    borderColor: aspectRatio === ar ? "var(--color-primary)" : "var(--color-border)",
                    backgroundColor: aspectRatio === ar ? "var(--color-primary-light)" : "transparent",
                    color: aspectRatio === ar ? "var(--color-primary)" : "var(--color-muted-foreground)",
                  }}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

          {/* Variaciones — solo en modo generar, debajo del aspect ratio */}
          {mode === "generar" && (
            <div
              className="rounded-xl border px-4 py-3 space-y-3"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                  Variaciones
                </span>
                <button
                  onClick={() => setVariacionesEnabled((v) => !v)}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: variacionesEnabled ? "var(--color-primary)" : "var(--color-border)",
                  }}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow"
                    style={{ transform: variacionesEnabled ? "translateX(18px)" : "translateX(3px)" }}
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
                        borderColor: variacionesCount === n ? "var(--color-primary)" : "var(--color-border)",
                        backgroundColor: variacionesCount === n ? "var(--color-primary-light)" : "transparent",
                        color: variacionesCount === n ? "var(--color-primary)" : "var(--color-muted-foreground)",
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
            style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
          >
            Gemini 2.5 Flash · 2 créditos por imagen
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                backgroundColor: noCredits ? "var(--color-primary-light)" : "#FEF2F2",
                color: noCredits ? "var(--color-primary)" : "var(--color-destructive)",
              }}
            >
              {error}
              {noCredits && (
                <a href="/ajustes" className="block mt-1 font-semibold underline underline-offset-2">
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
              boxShadow: canGenerate ? "0 2px 12px rgba(124,58,237,0.35)" : undefined,
            }}
          >
            {btnLabel}
          </button>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Gallery button */}
          {gallery.length > 0 && (
            <div>
              <button
                onClick={() => setGalleryOpen((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium w-full transition-all"
                style={{
                  borderColor: galleryOpen ? "var(--color-primary)" : "var(--color-border)",
                  backgroundColor: galleryOpen ? "var(--color-primary-light)" : "transparent",
                  color: galleryOpen ? "var(--color-primary)" : "var(--color-foreground)",
                }}
              >
                <LayoutGrid size={15} />
                <span>Mi galería</span>
                <span
                  className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: galleryOpen ? "var(--color-primary)" : "var(--color-muted)",
                    color: galleryOpen ? "white" : "var(--color-muted-foreground)",
                  }}
                >
                  {gallery.length}
                </span>
                <span className="ml-auto">
                  {galleryOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </span>
              </button>

              {galleryOpen && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {gallery.map((img) => (
                      <div
                        key={img.id}
                        className="relative group aspect-square rounded-xl overflow-hidden border cursor-pointer"
                        style={{ borderColor: "var(--color-border)" }}
                        onClick={() => setCurrentImage(img)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.image_url} alt={img.prompt} className="w-full h-full object-cover" />

                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                          style={{ background: "rgba(0,0,0,0.55)" }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGalleryImage(img);
                              setUploadedImage(null);
                              setMode("editar");
                            }}
                            className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                            className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors"
                            title="Borrar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {selectedGalleryImage?.id === img.id && mode === "editar" && (
                          <div
                            className="absolute inset-0 rounded-xl border-2"
                            style={{ borderColor: "var(--color-primary)" }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {mode === "editar" && !sourceImage && (
                    <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                      Pulsa una imagen para seleccionarla como base
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Image preview */}
          <div className="max-w-[600px] mx-auto w-full">
            <div
              className="relative w-full rounded-2xl overflow-hidden border"
              style={{ borderColor: "var(--color-border)", paddingBottom: ASPECT_PADDING[aspectRatio] }}
            >
              <div className="absolute inset-0">
                {loading ? (
                  <div
                    className="w-full h-full animate-pulse rounded-2xl"
                    style={{ backgroundColor: "var(--color-muted)" }}
                  />
                ) : currentImage ? (
                  <div className="relative w-full h-full group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentImage.image_url}
                      alt={currentImage.prompt}
                      className="w-full h-full object-contain"
                      style={{ backgroundColor: "#000" }}
                    />
                    <a
                      href={currentImage.image_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                      title="Descargar"
                    >
                      <Download size={16} className="text-white" />
                    </a>
                  </div>
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
                  >
                    <ImageIcon size={36} strokeWidth={1.2} />
                    <div className="text-center">
                      <p className="text-sm font-medium">Tu imagen aparecerá aquí</p>
                      <p className="text-xs mt-1">Escribe un prompt y pulsa Generar imagen</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(code: string): string {
  switch (code) {
    case "NO_CREDITS": return "Se han agotado tus créditos.";
    case "RATE_LIMIT": return "Demasiadas solicitudes. Espera un momento.";
    case "IMAGE_NOT_FOUND": return "Imagen no encontrada o sin permisos.";
    case "NO_IMAGE_IN_RESPONSE": return "El modelo no devolvió una imagen. Intenta con otro prompt.";
    default: return "Error al generar la imagen. Inténtalo de nuevo.";
  }
}
