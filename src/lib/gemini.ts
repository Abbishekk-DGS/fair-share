// Shared by the server function (api/scan.ts) and the browser (when someone uses their own key).

export const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

export const PROMPT = `You read photos of shop, restaurant and supermarket bills (receipts, tax invoices) so people can split them.

Return every purchased line item, top to bottom, exactly once.
- amount: the line total actually charged for that line (the "Value", "Amount" or "Total" column), as a number with no currency symbol. On some printers the rate column is shifted by a row; trust the line-total column.
- qty: the quantity or weight on that line (1 if none is printed).
- raw: the item text exactly as printed (without HSN/SKU codes).
- name: a short, clear name a person would recognise, expanding abbreviations only when you are sure (e.g. "MAGGI MASALA N-560g" -> "Maggi Masala Noodles 560g"). If unsure, keep the printed text.

extras: only charges or reductions that are NOT already inside the item amounts: tax added on top of the items, service charge, tip, delivery or packing fee, discounts and coupons (negative numbers), round-off (positive or negative). If the bill prints a GST/VAT breakup but the item amounts already add up to the total, the tax is already included: do not add it as an extra.

total: the final amount payable printed on the bill (Net Amount, Grand Total, Amount Due). 0 if it is not visible.
currency: ISO code such as INR, USD, EUR. Use INR for Indian bills.
date: YYYY-MM-DD if printed, else "".
store: the shop or restaurant name if printed, else "".
If the image is not a bill, return an empty items list.`;

export const SCHEMA = {
  type: "OBJECT",
  properties: {
    store: { type: "STRING" },
    date: { type: "STRING" },
    currency: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          raw: { type: "STRING" },
          qty: { type: "NUMBER" },
          amount: { type: "NUMBER" },
        },
        required: ["name", "qty", "amount"],
      },
    },
    extras: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING", enum: ["tax", "service", "tip", "delivery", "discount", "roundoff", "other"] },
          label: { type: "STRING" },
          amount: { type: "NUMBER" },
        },
        required: ["kind", "label", "amount"],
      },
    },
    total: { type: "NUMBER" },
  },
  required: ["items", "extras", "total", "currency"],
};

export type ScanResult = {
  store: string;
  date: string;
  currency: string;
  items: { name: string; raw?: string; qty: number; amount: number }[];
  extras: { kind: string; label: string; amount: number }[];
  total: number;
};

export function geminiBody(base64: string, mimeType: string) {
  return {
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: PROMPT }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
  };
}

export class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Call Gemini with each model in turn; moves on when one is over quota or unavailable. */
export async function callGemini(key: string, base64: string, mimeType: string, models = DEFAULT_MODELS): Promise<ScanResult> {
  let last: GeminiError = new GeminiError("No model tried", 500);
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(geminiBody(base64, mimeType)),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      last = new GeminiError(`${model}: ${res.status} ${detail.slice(0, 300)}`, res.status);
      if ([400, 401, 403].includes(res.status) && !/not found|not supported/i.test(detail)) throw last; // bad key or bad image
      continue; // 404 model gone, 429 quota, 5xx: try the next model
    }
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    try {
      return normalize(JSON.parse(text));
    } catch {
      last = new GeminiError(`${model}: unreadable response`, 502);
    }
  }
  throw last;
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function normalize(input: unknown): ScanResult {
  const o = (input ?? {}) as Record<string, unknown>;
  const items = Array.isArray(o.items) ? o.items : [];
  const extras = Array.isArray(o.extras) ? o.extras : [];
  return {
    store: String(o.store ?? "").slice(0, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(o.date ?? "")) ? String(o.date) : "",
    currency: /^[A-Z]{3}$/.test(String(o.currency ?? "")) ? String(o.currency) : "INR",
    items: items
      .map((it) => {
        const r = (it ?? {}) as Record<string, unknown>;
        return {
          name: String(r.name ?? r.raw ?? "Item").slice(0, 80).trim() || "Item",
          raw: r.raw ? String(r.raw).slice(0, 80) : undefined,
          qty: num(r.qty) > 0 ? num(r.qty) : 1,
          amount: num(r.amount),
        };
      })
      .filter((it) => it.amount !== 0)
      .slice(0, 300),
    extras: extras
      .map((e) => {
        const r = (e ?? {}) as Record<string, unknown>;
        return { kind: String(r.kind ?? "other"), label: String(r.label ?? "").slice(0, 60), amount: num(r.amount) };
      })
      .filter((e) => e.amount !== 0)
      .slice(0, 20),
    total: num(o.total),
  };
}
