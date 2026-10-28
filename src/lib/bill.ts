import type { Bill, Extra, ExtraKind, Item, Person } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const PERSON_COLORS = 8;

export function newPerson(name: string, taken: Person[]): Person {
  const used = new Set(taken.map((p) => p.color));
  let color = 0;
  while (used.has(color) && color < PERSON_COLORS - 1) color++;
  if (used.has(color)) color = taken.length % PERSON_COLORS;
  return { id: uid(), name, color };
}

export function newItem(name = "", amount = 0, qty = 1, raw?: string): Item {
  return { id: uid(), name, raw, qty, amount, shares: {} };
}

export function newExtra(kind: ExtraKind, label: string, amount: number): Extra {
  return { id: uid(), kind, label, amount, mode: kind === "tip" || kind === "delivery" ? "equal" : "proportional" };
}

export function newBill(people: string[] = ["You", "Friend"]): Bill {
  const ps: Person[] = [];
  for (const n of people) ps.push(newPerson(n, ps));
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    currency: "INR",
    createdAt: now,
    updatedAt: now,
    people: ps,
    items: [],
    extras: [],
    mode: "items",
    payer: ps[0].id,
  };
}
