import { callGemini, type ScanResult } from "./gemini";
import { parseReceiptText } from "./ocrParse";

export type ScanOutcome = ScanResult & { source: "ai" | "ocr"; note?: "quota" | "offline" | "not_configured" | "failed" };
export type Progress = (stage: "prepare" | "ai" | "ocr", pct?: number) => void;

const AI_SIDE = 2000; // keeps the upload well under the 4.5 MB limit
const OCR_SIDE = 2600; // on-device text reading does better with more pixels

function draw(src: CanvasImageSource, w: number, h: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Load any photo the browser can decode: a JPEG (max 2000px) for the AI and a larger canvas for OCR. */
async function toJpeg(file: File): Promise<{ base64: string; mimeType: string; canvas: HTMLCanvasElement } | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null; // e.g. HEIC on browsers that can't decode it
  }
  const canvas = draw(bitmap, bitmap.width, bitmap.height, OCR_SIDE);
  bitmap.close();
  const small = canvas.width > AI_SIDE || canvas.height > AI_SIDE ? draw(canvas, canvas.width, canvas.height, AI_SIDE) : canvas;
  const dataUrl = small.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg", canvas };
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export class ScanError extends Error {
  constructor(public code: "unreadable_format" | "nothing_found" | "failed") {
    super(code);
  }
}

export async function scanBill(file: File, opts: { ownKey?: string; onProgress?: Progress } = {}): Promise<ScanOutcome> {
  const progress = opts.onProgress ?? (() => {});
  progress("prepare");
  const jpeg = await toJpeg(file);
  const isHeic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  let base64 = jpeg?.base64;
  let mimeType = jpeg?.mimeType;
  if (!jpeg && isHeic && file.size < 2_900_000) {
    // The AI can read HEIC directly even when this browser can't show it.
    base64 = await fileToBase64(file);
    mimeType = "image/heic";
  }
  if (!base64 || !mimeType) throw new ScanError("unreadable_format");

  let note: ScanOutcome["note"];
  progress("ai");
  try {
    if (opts.ownKey) {
      const r = await callGemini(opts.ownKey, base64, mimeType);
      if (r.items.length) return { ...r, source: "ai" };
      note = "failed";
    } else {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      });
      if (res.ok) {
        const r = (await res.json()) as ScanResult;
        if (r.items?.length) return { ...r, source: "ai" };
        note = "failed";
      } else {
        const err = await res.json().catch(() => ({}));
        note = err.error === "not_configured" ? "not_configured" : err.error === "quota" || err.error === "rate_limited" ? "quota" : "failed";
      }
    }
  } catch {
    note = navigator.onLine ? "failed" : "offline";
  }

  // Fallback: read the text on this device.
  if (!jpeg) throw new ScanError("unreadable_format");
  progress("ocr", 0);
  const text = await ocr(jpeg.canvas, (p) => progress("ocr", p));
  const parsed = parseReceiptText(text);
  if (!parsed.items.length) throw new ScanError("nothing_found");
  return { store: "", date: "", currency: "INR", items: parsed.items, extras: [], total: parsed.total, source: "ocr", note };
}

async function ocr(canvas: HTMLCanvasElement, onPct: (p: number) => void): Promise<string> {
  // Tesseract does its own thresholding; extra contrast made thermal-paper photos worse in testing.
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onPct(Math.round(m.progress * 100));
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
