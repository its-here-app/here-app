const INSTAGRAM_HANDLE_REGEX = /^[\w](?!.*\.{2})[\w.]{0,28}[\w]$/;

export function isValidInstagramHandle(handle: string): boolean {
  return INSTAGRAM_HANDLE_REGEX.test(handle);
}

/** Strips characters an Instagram handle can never contain and collapses
 * repeated periods, for use directly in an input's onChange. */
export function sanitizeInstagramHandleInput(value: string): string {
  return value
    .replace(/[^\w.]/g, "")
    .replace(/\.{2,}/g, ".")
    .slice(0, 30);
}
