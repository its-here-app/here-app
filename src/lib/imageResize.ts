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
function supportsWebpEncode(): Promise<boolean> {
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
