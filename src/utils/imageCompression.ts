import { computeScaledDimensions, shouldCompressImageMime } from '../domain/media';

export interface CompressedAttachmentResult {
  blob: Blob;
  mimeType: string;
  size: number;
  originalSize: number;
  wasCompressed: boolean;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذر قراءة أبعاد الصورة.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function compressImageFileIfBeneficial(
  file: File,
  maxDimension = 1600,
  quality = 0.82,
): Promise<CompressedAttachmentResult> {
  const fallback: CompressedAttachmentResult = {
    blob: file,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    originalSize: file.size,
    wasCompressed: false,
  };

  if (typeof document === 'undefined' || !shouldCompressImageMime(file.type)) {
    return fallback;
  }

  try {
    const img = await loadImageElement(file);
    const dims = computeScaledDimensions(img.naturalWidth, img.naturalHeight, maxDimension);
    if (dims.width <= 0 || dims.height <= 0) return fallback;

    // Skip re-encoding small files (< 120 KB) that don't exceed max dimensions
    if (!dims.scaled && file.size < 120 * 1024) {
      return fallback;
    }

    const canvas = document.createElement('canvas');
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;

    ctx.drawImage(img, 0, 0, dims.width, dims.height);

    // Prefer WebP when supported, fallback to JPEG
    let compressed = await canvasToBlob(canvas, 'image/webp', quality);
    if (!compressed || compressed.type !== 'image/webp') {
      compressed = await canvasToBlob(canvas, 'image/jpeg', quality);
    }

    if (!compressed || compressed.size <= 0 || compressed.size >= file.size) {
      return fallback;
    }

    return {
      blob: compressed,
      mimeType: compressed.type,
      size: compressed.size,
      originalSize: file.size,
      wasCompressed: true,
    };
  } catch {
    return fallback;
  }
}
