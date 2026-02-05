/**
 * ImageKit Transformation Utilities
 * Documentation: https://docs.imagekit.io/features/image-transformations
 */

export interface ImageKitOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'pad';
  focus?: 'auto' | 'center' | 'top' | 'left' | 'bottom' | 'right';
  blur?: number; // 1-100
  dpr?: number; // 1-5
}

/**
 * Generates an optimized ImageKit URL with transformations
 * @param url Original ImageKit URL (or any URL if we proxy it later)
 * @param options Transformation options
 * @returns Transformed URL
 */
export function getTransformedUrl(url: string | null | undefined, options: ImageKitOptions = {}): string {
  if (!url) return '/placeholder-bike.png'; // Fallback image

  // If not an ImageKit URL, return as is (unless we want to proxy external URLs through ImageKit later)
  if (!url.includes('ik.imagekit.io')) {
    return url;
  }

  const {
    width,
    height,
    quality = 80,
    format = 'auto',
    fit,
    focus,
    blur,
    dpr
  } = options;

  // Build transformation string
  const transforms: string[] = [];

  if (width) transforms.push(`w-${width}`);
  if (height) transforms.push(`h-${height}`);
  if (quality) transforms.push(`q-${quality}`);
  if (format) transforms.push(`f-${format}`);
  if (fit) transforms.push(`cm-${fit === 'cover' ? 'pad_resize' : fit}`);
  if (blur) transforms.push(`bl-${blur}`);
  if (dpr) transforms.push(`dpr-${dpr}`);

  const transformString = transforms.join(',');

  // Check if URL already has query params
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}tr=${transformString}`;
}

/**
 * Standard presets for the application
 */
export const ImagePresets = {
  thumbnail: { width: 400, height: 300, quality: 80, fit: 'cover' } as ImageKitOptions,
  card: { width: 600, height: 450, quality: 85, fit: 'cover' } as ImageKitOptions,
  detail: { width: 1200, quality: 90 } as ImageKitOptions,
  mobile: { width: 300, height: 225, quality: 70 } as ImageKitOptions,
};

// Backward compatibility helpers
export function getThumbnailUrl(url: string | null | undefined): string {
  return getTransformedUrl(url, ImagePresets.thumbnail);
}

export function getFullSizeUrl(url: string | null | undefined): string {
  return getTransformedUrl(url, ImagePresets.detail);
}
