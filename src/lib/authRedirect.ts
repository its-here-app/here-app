// Carries the post-signup destination across OAuth / email confirmation, whose
// redirect URLs must exactly match Supabase's allowlist (so no query params).
export const AUTH_NEXT_COOKIE = "auth_next";

// Same-origin paths only, to avoid an open redirect.
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  if (value === "/signin" || value.startsWith("/signin?") || value.startsWith("/auth/")) {
    return null;
  }
  return value;
}

export function signinHref(next: string): string {
  return `/signin?next=${encodeURIComponent(next)}`;
}
