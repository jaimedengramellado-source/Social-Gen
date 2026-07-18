// Procesado de fotos en el navegador vía canvas. Instagram solo acepta JPEG
// por URL y X limita las imágenes a 5 MB (el tope más estricto), así que todo
// acaba como JPEG ≤5 MB y ≤2048 px.

export const IMAGE_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_INPUT_BYTES = 30 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 2048;

// Encuadre por red: aspecto elegido + zoom + desplazamiento normalizado
// (-1..1 respecto al recorrido máximo de paneo). Independiente de resolución.
// En modo "libre" manda `rect`: marco dibujado a mano, normalizado (0..1)
// sobre las dimensiones naturales de la imagen.
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropState {
  aspect: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  rect?: CropRect;
}

export const ASPECT_RATIOS: Record<string, number | null> = {
  original: null,
  "1:1": 1,
  "4:5": 4 / 5,
  "3:4": 3 / 4,
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "1.91:1": 1.91,
};

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen. ¿Está dañado el archivo?"));
    img.src = url;
  });
}

export async function canvasToJpegFile(canvas: HTMLCanvasElement, baseName: string): Promise<File> {
  for (const quality of [0.92, 0.85, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= MAX_IMAGE_BYTES) {
      return new File([blob], `${baseName.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
    }
  }
  throw new Error("La foto es demasiado grande incluso tras comprimirla. Prueba con una resolución menor.");
}

export async function prepareImageFile(f: File): Promise<File> {
  if (f.type === "image/jpeg" && f.size <= MAX_IMAGE_BYTES) return f;
  const url = URL.createObjectURL(f);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen en este navegador.");
    // La transparencia de PNG/WebP se aplana sobre blanco al pasar a JPEG
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await canvasToJpegFile(canvas, f.name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Rect visible en píxeles de imagen para un encuadre cover + zoom + paneo.
// El marco se trata en unidades (ancho = aspecto, alto = 1): solo importan
// las proporciones, así el mismo estado sirve para editor y export.
export function cropViewRect(
  iw: number,
  ih: number,
  crop: CropState
): { sx: number; sy: number; viewW: number; viewH: number } {
  const frameAspect = ASPECT_RATIOS[crop.aspect] ?? iw / ih;
  const coverScale = Math.max(frameAspect / iw, 1 / ih);
  const scale = coverScale * crop.zoom;
  const viewW = frameAspect / scale;
  const viewH = 1 / scale;
  const maxPanX = Math.max(0, (iw - viewW) / 2);
  const maxPanY = Math.max(0, (ih - viewH) / 2);
  return {
    sx: iw / 2 + crop.offsetX * maxPanX - viewW / 2,
    sy: ih / 2 + crop.offsetY * maxPanY - viewH / 2,
    viewW,
    viewH,
  };
}

export async function renderCroppedImage(
  sourceUrl: string,
  baseName: string,
  crop: CropState
): Promise<File> {
  const img = await loadImage(sourceUrl);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const { sx, sy, viewW, viewH } =
    crop.aspect === "libre" && crop.rect
      ? {
          sx: crop.rect.x * iw,
          sy: crop.rect.y * ih,
          viewW: Math.max(1, crop.rect.w * iw),
          viewH: Math.max(1, crop.rect.h * ih),
        }
      : cropViewRect(iw, ih, crop);
  const k = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(viewW, viewH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewW * k));
  canvas.height = Math.max(1, Math.round(viewH * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen en este navegador.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, viewW, viewH, 0, 0, canvas.width, canvas.height);
  return canvasToJpegFile(canvas, baseName);
}
