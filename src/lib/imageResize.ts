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
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

export class InvalidImageError extends Error {}

/** iOS delivers a proper `image/heic` MIME type, but some Android/desktop
 * pickers hand over an empty `file.type` for HEIC/HEIF — fall back to the
 * extension in that case. */
function isHeic(file: File): boolean {
  if (HEIC_TYPES.has(file.type)) return true;
  return file.type === "" && /\.hei[cf]$/i.test(file.name);
}

interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(
    imageData: { data: Uint8ClampedArray; width: number; height: number },
    callback: (result: ImageData | null) => void,
  ): void;
}
interface HeifDecoder {
  decode(buffer: Uint8Array): HeifImage[];
}

/** Chrome/Firefox/Android can't decode HEIC via canvas (only Safari/macOS/iOS
 * can), so it has to be converted to JPEG before it ever reaches
 * createImageBitmap or the compression step. Real iPhone HEIC files (grid
 * tiling, newer HEVC profiles) aren't decodable by heic2any's bundled — and
 * long-unmaintained — libheif build, so this decodes via libheif-js directly
 * and re-encodes through canvas instead. */
async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: libheif } = await import("libheif-js/wasm-bundle");
  const decoder = new (libheif as unknown as { HeifDecoder: new () => HeifDecoder }).HeifDecoder();
  const buffer = new Uint8Array(await file.arrayBuffer());
  const images = decoder.decode(buffer);
  if (!images.length) {
    throw new Error("No images found in HEIC file");
  }

  const image = images[0];
  const width = image.get_width();
  const height = image.get_height();
  // Pass a real ImageData in (not a plain {data,width,height} object) since
  // libheif-js fills the buffer in place and hands the same reference back —
  // canvas's putImageData rejects anything that isn't an actual ImageData.
  const imageData = await new Promise<ImageData>((resolve, reject) => {
    image.display(new ImageData(width, height), (result) =>
      result ? resolve(result) : reject(new Error("HEIF decode failed")),
    );
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("HEIC to JPEG re-encode failed"))),
      "image/jpeg",
      QUALITY,
    );
  });

  const name = file.name.replace(/\.hei[cf]$/i, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

/**
 * Reject files that are too large, the wrong format, or don't actually
 * decode as an image, before any compression/upload work happens. HEIC/HEIF
 * files are transparently converted to JPEG first. Used by both avatar and
 * playlist-cover uploads so every entry point into
 * `createImageDerivatives`/`sanitizeAndCompressAvatar` sees pre-validated
 * files. Returns the file to use going forward (the original, or its JPEG
 * conversion if the input was HEIC/HEIF).
 */
export async function validateImageFile(
  file: File,
  maxBytes: number,
): Promise<File> {
  if (file.size > maxBytes) {
    throw new InvalidImageError(
      `Image must be smaller than ${maxBytes / 1024 / 1024}MB`,
    );
  }

  let workingFile = file;
  if (isHeic(workingFile)) {
    try {
      workingFile = await convertHeicToJpeg(workingFile);
    } catch (err) {
      console.error("HEIC conversion failed", err);
      throw new InvalidImageError(
        "Couldn't process this HEIC image — try a different file",
      );
    }
  }

  // Reject by MIME type outright (covers SVG and anything else outside our
  // supported formats) before ever attempting to decode it — decoding an
  // SVG via createImageBitmap/canvas would silently rasterize any embedded
  // script rather than refusing the format entirely.
  if (!ACCEPTED_TYPES.has(workingFile.type)) {
    throw new InvalidImageError("Image must be JPEG, PNG, WebP, or HEIC");
  }
  // Real decode check — catches files that claim an accepted MIME type but
  // are actually corrupt/truncated/malformed.
  try {
    await createImageBitmap(workingFile);
  } catch {
    throw new InvalidImageError("Couldn't process this image — try a different file");
  }

  return workingFile;
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
  const validatedFile = await validateImageFile(file, AVATAR_MAX_BYTES);

  const useWebp = await supportsWebpEncode();
  const fileType = useWebp ? "image/webp" : "image/jpeg";
  const ext = useWebp ? "webp" : "jpg";
  const blob = await imageCompression(validatedFile, {
    maxWidthOrHeight: AVATAR_MAX_EDGE,
    initialQuality: QUALITY,
    fileType,
    useWebWorker: true,
  });
  return { blob, ext };
}
