import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged out, "/" belongs to the marketing zone. Decided here rather than
  // with a cookie condition in next.config.ts: Supabase splits the session
  // across chunked cookies (`-auth-token.0`, `.1`, ...) when the JWT is large,
  // so no single cookie name reliably means "signed in".
  const marketingOrigin = process.env.MARKETING_ORIGIN;
  if (!user && marketingOrigin && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/", marketingOrigin), {
      request,
      headers: supabaseResponse.headers,
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
