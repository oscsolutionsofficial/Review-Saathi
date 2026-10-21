import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  if (pathname === "/login") return response;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const protectedPath = pathname.startsWith("/client") || pathname.startsWith("/admin");
  if (!supabaseUrl || !publishableKey) {
    if (protectedPath) return NextResponse.redirect(new URL("/login?error=configuration", request.url));
    return response;
  }
  const supabase = createServerClient(supabaseUrl, publishableKey, { cookies: { getAll: () => request.cookies.getAll(), setAll: (values: { name: string; value: string; options: CookieOptions }[]) => values.forEach(({ name, value, options }) => { request.cookies.set(name, value); response = NextResponse.next({ request }); response.cookies.set(name, value, options); }) } });
  const { data: { user } } = await supabase.auth.getUser();
  if (protectedPath && !user) return NextResponse.redirect(new URL("/login", request.url));
  if (user && pathname.startsWith("/admin")) {
    const { data: member } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    if (member?.role !== "superadmin") return NextResponse.redirect(new URL("/client/dashboard", request.url));
  }
  if (user && pathname.startsWith("/client")) {
    const { data: member } = await supabase.from("users").select("role,must_change_password,tenant_id,tenants(onboarding_completed,status)").eq("id", user.id).maybeSingle();
    const tenant = Array.isArray(member?.tenants) ? member.tenants[0] : member?.tenants;
    if (member?.role !== "client") return NextResponse.redirect(new URL("/admin", request.url));
    if (tenant?.status !== "active") return NextResponse.redirect(new URL("/login?error=disabled", request.url));
    if (member.must_change_password && pathname !== "/change-password") return NextResponse.redirect(new URL("/change-password", request.url));
    if (!tenant?.onboarding_completed && pathname !== "/onboarding") return NextResponse.redirect(new URL("/onboarding", request.url));
  }
  if (pathname === "/login" && user) {
    const { data: member } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    return NextResponse.redirect(new URL(member?.role === "superadmin" ? "/admin" : "/client/dashboard", request.url));
  }
  return response;
}

export const config = { matcher: ["/client/:path*", "/admin/:path*"] };
