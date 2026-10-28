// UPI deep link (works with GPay, PhonePe, Paytm, BHIM and bank apps).
export const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

export function upiLink(opts: { upi: string; name: string; amountMinor: number; note: string }): string {
  const params = new URLSearchParams({
    pa: opts.upi.trim(),
    pn: opts.name,
    am: (opts.amountMinor / 100).toFixed(2),
    cu: "INR",
    tn: opts.note.slice(0, 50),
  });
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}
