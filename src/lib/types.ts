// All money is stored in the smallest unit (paise, cents) as integers so totals never drift.

export type Person = {
  id: string;
  name: string;
  color: number; // index into the person palette
  upi?: string;
};

export type Item = {
  id: string;
  name: string;
  raw?: string; // text exactly as printed on the bill
  qty: number;
  amount: number; // line total in minor units
  shares: Record<string, number>; // personId -> shares; empty means not assigned yet
};

export type ExtraKind = "tax" | "service" | "tip" | "delivery" | "discount" | "roundoff" | "other";

export type Extra = {
  id: string;
  kind: ExtraKind;
  label: string;
  amount: number; // negative for discounts
  mode: "proportional" | "equal";
};

export type Bill = {
  id: string;
  title: string;
  store?: string;
  date?: string;
  currency: string;
  createdAt: number;
  updatedAt: number;
  people: Person[];
  items: Item[];
  extras: Extra[];
  mode: "items" | "equal";
  payer: string | null; // who paid the whole bill
  paidSplit?: Record<string, number>; // set when several people paid parts of it
  printedTotal?: number; // total read from the bill, used to check the scan
  source?: "ai" | "ocr" | "manual" | "sample";
  scanNote?: "quota" | "offline" | "not_configured" | "failed";
};

export type Transfer = { from: string; to: string; amount: number };

export type PersonResult = {
  id: string;
  items: { itemId: string; amount: number; units: number }[];
  itemsTotal: number;
  extras: { extraId: string; amount: number }[];
  owes: number; // what this person's share of the bill is
  paid: number;
  net: number; // paid - owes; positive means others owe them
};

export type BillResult = {
  total: number;
  itemsTotal: number;
  extrasTotal: number;
  unassigned: { count: number; amount: number };
  people: PersonResult[];
  transfers: Transfer[];
  paidTotal: number;
};
