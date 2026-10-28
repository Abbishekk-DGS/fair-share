// Turns raw OCR text from a bill into items. Used when the AI scan is not available,
// so it aims to get most lines right and leaves the rest for the person to fix.

export type ParsedBill = {
  items: { name: string; raw: string; qty: number; amount: number }[];
  total: number;
};

const SKIP = /\b(sub\s*total|total|net\s*amt|net\s*amount|grand|cgst|sgst|igst|gst|vat|tax|cash|change|card|upi|paid|balance|tender|round|savings|saved|discount|items?\s*:|qty\s*:|bill\s*no|invoice|phone|date|gstin|cashier|hsn|thank)(?![a-z])/i;
const TOTAL = /\bitems?\s*:\s*\d+.*\bqty\b|\b(grand\s*total|net\s*(amt|amount|payable)|total\s*(amount|due|payable)?|amount\s*(due|payable))\b/i;
// Once these appear, the item list is over (tax breakup tables, payment details).
const END = /\b(breakup|taxable\s*amount|gst\s*summary|payment\s*details|tender)\b/i;
const NUMBER = /^-?(\d{1,3}(,\d{3})+|\d+)([.,]\d{1,2})?$/;

const toNumber = (s: string) => parseFloat(s.replace(/,(?=\d{3}\b)/g, "").replace(",", "."));

export function parseReceiptText(text: string): ParsedBill {
  const items: ParsedBill["items"] = [];
  const totals: number[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[_~=*]+/g, " ").replace(/₹|rs\.?\s/gi, " ").replace(/\s+/g, " ").trim();
    if (END.test(line)) break;
    if (/^\d\)\s|@\s*\d+(\.\d+)?\s*%/.test(line)) continue; // tax-slab headings like "2) CGST @ 2.50%"
    const tokens = line.split(" ");
    // Numbers at the end of the line: [qty] [rate] amount
    const tail: string[] = [];
    while (tokens.length && tail.length < 3 && NUMBER.test(tokens[tokens.length - 1])) tail.unshift(tokens.pop()!);
    if (!tail.length) continue;
    // OCR often reads a quantity of 1 as "i", "l" or "|".
    if (tail.length < 3 && /^[iIl|!]$/.test(tokens[tokens.length - 1] ?? "")) {
      tokens.pop();
      tail.unshift("1");
    }
    const amount = toNumber(tail[tail.length - 1]);
    if (!Number.isFinite(amount) || amount === 0) continue;

    const label = tokens.join(" ");
    if (TOTAL.test(label) && !/sub\s*total/i.test(label)) {
      totals.push(Math.abs(amount));
      continue;
    }
    if (SKIP.test(label)) continue;

    // A whole number with no decimals right before the rate/amount is the quantity.
    let qty = 1;
    let extra = "";
    if (tail.length >= 2 && /^\d{1,2}$/.test(tail[0])) {
      const q = Number(tail[0]);
      const rate = tail.length === 3 ? toNumber(tail[1]) : amount / q;
      if (q > 0 && Math.abs(q * rate - amount) < 0.6) qty = q;
      else if (tail.length === 3) extra = " " + tail[0]; // it was part of the name ("DOORMAT 4")
    }

    const name = (label + extra)
      .replace(/^\d{4,10}\s+/, "") // HSN / SKU code
      .replace(/(\s+[^\p{L}\p{N}\s]+|\s+[a-z])+$/u, "") // stray OCR marks at the end
      .replace(/[^\p{L}\p{N}&()./%'\- ]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (name.replace(/[^\p{L}]/gu, "").length < 2) continue;
    items.push({ name, raw: name, qty, amount: Math.abs(amount) });
  }

  return { items, total: totals.length ? Math.max(...totals) : 0 };
}
