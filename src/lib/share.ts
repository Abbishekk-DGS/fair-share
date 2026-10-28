import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Bill } from "./types";

// A shared bill travels inside the link itself (after #), so no server ever sees it.

export function shareLink(bill: Bill): string {
  const slim = { ...bill, people: bill.people.map(({ upi, ...p }) => (upi ? { ...p, upi } : p)) };
  return `${location.origin}/#bill=${compressToEncodedURIComponent(JSON.stringify(slim))}`;
}

export function readSharedBill(hash: string): Bill | null {
  const m = hash.match(/^#bill=(.+)$/);
  if (!m) return null;
  try {
    const bill = JSON.parse(decompressFromEncodedURIComponent(m[1]) ?? "null") as Bill;
    if (!bill || !Array.isArray(bill.items) || !Array.isArray(bill.people)) return null;
    return bill;
  } catch {
    return null;
  }
}
