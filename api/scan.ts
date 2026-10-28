import { callGemini, DEFAULT_MODELS, GeminiError } from "../src/lib/gemini.js";

// Photos are read and forgotten: nothing is stored or logged.

const MAX_BASE64 = 4_000_000; // Vercel caps request bodies at 4.5 MB
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const LIMIT = 15; // scans per visitor per hour, per server instance
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIMIT) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "not_configured" }, 503);

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return json({ error: "rate_limited" }, 429);

  let body: { image?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const image = typeof body.image === "string" ? body.image : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  if (!image || !TYPES.has(mimeType) || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200))) return json({ error: "bad_image" }, 400);
  if (image.length > MAX_BASE64) return json({ error: "too_large" }, 413);

  const models = (process.env.GEMINI_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  try {
    const result = await callGemini(key, image, mimeType, models.length ? models : DEFAULT_MODELS);
    return json(result);
  } catch (e) {
    const status = e instanceof GeminiError ? e.status : 500;
    console.error("scan failed", status); // status only; never the image or the key
    return json({ error: status === 429 ? "quota" : "scan_failed" }, status === 429 ? 429 : 502);
  }
}

export function GET(): Response {
  return json({ ok: true, configured: Boolean(process.env.GEMINI_API_KEY) });
}
