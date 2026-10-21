const buckets = new Map<string, { count: number; resetAt: number }>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export function allowRequest(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export async function allowRequestDistributed(key: string, limit: number, windowMs: number) {
  if (!redisUrl || !redisToken) return allowRequest(key, limit, windowMs);
  try {
    const response = await fetch(`${redisUrl}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, Math.ceil(windowMs / 1000)]]),
      cache: "no-store",
    });
    if (!response.ok) return allowRequest(key, limit, windowMs);
    const result = await response.json() as Array<{ result?: number }>;
    return Number(result?.[0]?.result ?? limit + 1) <= limit;
  } catch {
    return allowRequest(key, limit, windowMs);
  }
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
