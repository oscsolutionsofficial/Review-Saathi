import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url");
  if (!source || !/^https?:\/\//i.test(source)) return new Response("Invalid logo URL", { status: 400 });

  try {
    const response = await fetch(source, { headers: { accept: "image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8" }, cache: "no-store" });
    if (!response.ok) return new Response("Logo unavailable", { status: 404 });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return new Response("Logo URL is not an image", { status: 415 });

    return new Response(response.body, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Logo unavailable", { status: 502 });
  }
}
