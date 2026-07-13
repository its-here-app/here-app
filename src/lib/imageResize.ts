"use client";

import imageCompression from "browser-image-compression";

const FULL_MAX_EDGE = 2000;
const THUMB_MAX_EDGE = 600;
const QUALITY = 0.9;

export interface ImageDerivatives {
  /** Untouched upload, kept for archival/reprocessing — never render this in the UI. */
  original: File;
  /** Downscaled for the hero/detail context. */
  full: Blob;
  /** Downscaled for grid/carousel/list contexts. */
  thumb: Blob;
  /** File extension (without dot) matching the encoding used for full/thumb. */
  ext: "webp" | "jpg";
}

let webpSupportPromise: Promise<boolean> | null = null;

/** Canvas can *decode* webp everywhere it can display it, but a handful of
 * older engines can't *encode* it via toBlob — check once and cache. */
export function supportsWebpEncode(): Promise<boolean> {
  if (!webpSupportPromise) {
    webpSupportPromise = new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      canvas.toBlob(
        (blob) => resolve(!!blob && blob.type === "image/webp"),
        "image/webp",
      );
    });
  }
  return webpSupportPromise;
}

/**
 * Produce upload-ready derivatives of a cover photo: the original file
 * (archived, unreferenced by the UI) plus downscaled/compressed "full" and
 * "thumb" versions sized for the two ways covers actually get displayed
 * across the app (hero detail view vs. small grid/carousel cards).
 */
export async function createImageDerivatives(
  file: File,
): Promise<ImageDerivatives> {
  const useWebp = await supportsWebpEncode();
  const fileType = useWebp ? "image/webp" : "image/jpeg";
  const ext = useWebp ? "webp" : "jpg";

  const [full, thumb] = await Promise.all([
    imageCompression(file, {
      maxWidthOrHeight: FULL_MAX_EDGE,
      initialQuality: QUALITY,
      fileType,
      useWebWorker: true,
    }),
    imageCompression(file, {
      maxWidthOrHeight: THUMB_MAX_EDGE,
      initialQuality: QUALITY,
      fileType,
      useWebWorker: true,
    }),
  ]);

  return { original: file, full, thumb, ext };
}

/* ------------------------------------------------------------------ */
/*  Shared upload validation — sanitizes by rejecting anything that   */
/*  isn't a genuinely decodable image before it ever reaches canvas   */
/*  re-encoding or gets uploaded.                                     */
/* ------------------------------------------------------------------ */

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class InvalidImageError extends Error {}

/**
 * Reject files that are too large, the wrong format, or don't actually
 * decode as an image, before any compression/upload work happens. Used by
 * both avatar and playlist-cover uploads so every entry point into
 * `createImageDerivatives`/`sanitizeAndCompressAvatar` sees pre-validated
 * files.
 */
export async function validateImageFile(
  file: File,
  maxBytes: number,
): Promise<void> {
  if (file.size > maxBytes) {
    throw new InvalidImageError(
      `Image must be smaller than ${maxBytes / 1024 / 1024}MB`,
    );
  }
  // Reject by MIME type outright (covers SVG and anything else outside our
  // supported formats) before ever attempting to decode it — decoding an
  // SVG via createImageBitmap/canvas would silently rasterize any embedded
  // script rather than refusing the format entirely.
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new InvalidImageError("Image must be JPEG, PNG, or WebP");
  }
  // Real decode check — catches files that claim an accepted MIME type but
  // are actually corrupt/truncated/malformed.
  try {
    await createImageBitmap(file);
  } catch {
    throw new InvalidImageError("Couldn't process this image — try a different file");
  }
}

/* ------------------------------------------------------------------ */
/*  Avatars — compress + sanitize                                     */
/* ------------------------------------------------------------------ */

const AVATAR_MAX_EDGE = 300;
const AVATAR_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Produce an upload-ready avatar derivative: downscaled to WebP (JPEG
 * fallback) capped at 300px, the largest the app ever renders an avatar
 * plus retina headroom. The canvas decode/re-encode this goes through is
 * also what sanitizes the file — it only preserves pixel data, so EXIF
 * metadata, embedded scripts, and other non-image payloads don't survive.
 */
export async function sanitizeAndCompressAvatar(
  file: File,
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  await validateImageFile(file, AVATAR_MAX_BYTES);

  const useWebp = await supportsWebpEncode();
  const fileType = useWebp ? "image/webp" : "image/jpeg";
  const ext = useWebp ? "webp" : "jpg";
  const blob = await imageCompression(file, {
    maxWidthOrHeight: AVATAR_MAX_EDGE,
    initialQuality: QUALITY,
    fileType,
    useWebWorker: true,
  });
  return { blob, ext };
}
