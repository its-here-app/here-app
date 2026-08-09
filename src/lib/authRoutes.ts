// Routes that render full-bleed on a dark surface (sign-in/onboarding),
// unlike the rest of the app which is light. Shared between middleware
// (to tag the request so <body>'s theme is correct on first paint, with
// no client-side flash) and AppShell (to skip the normal nav chrome).
export const AUTH_PATHS = ["/signin", "/create-account", "/users/registration"];

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname.startsWith(p));
}
