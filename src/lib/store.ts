import type { Bill } from "./types";

// Everything stays in this browser. Storage can be missing (private mode), so every call is guarded.

const BILLS = "fairshare.bills.v1";
const SETTINGS = "fairshare.settings.v1";

export type Settings = {
  lang: "en" | "ta";
  theme: "system" | "light" | "dark";
  ownKey?: string;
  lastPeople?: string[];
  myUpi?: string;
};

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the app still works for this visit */
  }
}

export const loadBills = (): Bill[] => read<Bill[]>(BILLS, []).filter((b) => b && Array.isArray(b.items));

export function saveBill(bill: Bill) {
  const all = loadBills().filter((b) => b.id !== bill.id);
  all.unshift({ ...bill, updatedAt: Date.now() });
  write(BILLS, all.slice(0, 50));
}

export function deleteBill(id: string) {
  write(BILLS, loadBills().filter((b) => b.id !== id));
}

export const loadSettings = (): Settings => ({ lang: "en", theme: "system", ...read<Partial<Settings>>(SETTINGS, {}) });
export const saveSettings = (s: Settings) => write(SETTINGS, s);
