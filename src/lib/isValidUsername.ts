const USERNAME_REGEX = /^[a-z0-9_](?!.*\.\.)[a-z0-9_.]{1,28}[a-z0-9_]$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

export function hasEdgePeriod(username: string): boolean {
  return username.startsWith(".") || username.endsWith(".");
}

export function hasConsecutivePeriods(username: string): boolean {
  return /\.\./.test(username);
}

/** Strips characters a username can never contain and collapses repeated
 * periods, for use directly in an input's onChange. */
export function sanitizeUsernameInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .replace(/\.{2,}/g, ".")
    .slice(0, 30);
}
