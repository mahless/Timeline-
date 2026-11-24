export interface ScaledDimensions {
  width: number;
  height: number;
  scaled: boolean;
}

const COMPRESSIBLE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export function shouldCompressImageMime(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return COMPRESSIBLE_IMAGE_MIMES.has(normalized);
}

export function computeScaledDimensions(
  width: number,
  height: number,
  maxDimension = 1600,
): ScaledDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0, scaled: false };
  }
  const largest = Math.max(width, height);
  if (largest <= maxDimension) {
    return { width: Math.round(width), height: Math.round(height), scaled: false };
  }
  const ratio = maxDimension / largest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}
