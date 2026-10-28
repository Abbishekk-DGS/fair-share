export const CURRENCIES: Record<string, { symbol: string; locale: string; decimals: number }> = {
  INR: { symbol: "₹", locale: "en-IN", decimals: 2 },
  USD: { symbol: "$", locale: "en-US", decimals: 2 },
  EUR: { symbol: "€", locale: "de-DE", decimals: 2 },
  GBP: { symbol: "£", locale: "en-GB", decimals: 2 },
  AED: { symbol: "AED ", locale: "en-AE", decimals: 2 },
  SGD: { symbol: "S$", locale: "en-SG", decimals: 2 },
  MYR: { symbol: "RM ", locale: "en-MY", decimals: 2 },
  LKR: { symbol: "Rs ", locale: "en-LK", decimals: 2 },
  JPY: { symbol: "¥", locale: "ja-JP", decimals: 0 },
};

const cur = (code: string) => CURRENCIES[code] ?? CURRENCIES.INR;
const factor = (code: string) => 10 ** cur(code).decimals;

/** Minor units -> "₹1,234.50" (drops ".00" for whole amounts). */
export function fmt(minor: number, code = "INR", opts: { always?: boolean } = {}): string {
  const c = cur(code);
  const value = minor / factor(code);
  const whole = Number.isInteger(value);
  const text = Math.abs(value).toLocaleString(c.locale, {
    minimumFractionDigits: whole && !opts.always ? 0 : c.decimals,
    maximumFractionDigits: c.decimals,
  });
  return (value < 0 ? "−" : "") + c.symbol + text;
}

/** User or AI number (major units, may be a string with commas) -> minor units. */
export function toMinor(value: number | string, code = "INR"): number {
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * factor(code)) : 0;
}

/** Minor units -> plain major-unit string for an input box ("1234.5"). */
export function toMajorInput(minor: number, code = "INR"): string {
  const v = minor / factor(code);
  return Number.isInteger(v) ? String(v) : v.toFixed(cur(code).decimals).replace(/0+$/, "");
}

/** Keep the same face value when switching between currencies with different decimals (₹ ↔ ¥). */
export function rescale(minor: number, from: string, to: string): number {
  return Math.round((minor * factor(to)) / factor(from));
}
