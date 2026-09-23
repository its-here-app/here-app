// Top-level path segments claimed by either here-app or the marketing site
// (itshere.app routes requests between them via rewrites keyed on these same
// paths — see next.config.ts). A profile at any of these would be unreachable.
export const RESERVED_USERNAMES = new Set([
  "privacy",
  "terms",
  "studio",
  "playlist",
  "signin",
  "create-account",
  "delete-account",
  "users",
  "search",
  "saves",
  "admin",
  "api",
  "auth",
  "utility",
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}
