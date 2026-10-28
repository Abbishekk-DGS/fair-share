import { newBill, newExtra, newItem, newPerson } from "./bill";
import type { Bill } from "./types";

// A made-up restaurant bill so people can try the app without a photo.
export function sampleBill(names: string[]): Bill {
  const bill = newBill([names[0]]);
  for (const n of names.slice(1)) bill.people.push(newPerson(n, bill.people));
  const [a, b, c, d] = bill.people.map((p) => p.id);
  const line = (name: string, qty: number, rupees: number, shares: Record<string, number>) => {
    const it = newItem(name, rupees * 100, qty);
    it.shares = shares;
    return it;
  };
  bill.title = "Dinner at Anjappar";
  bill.store = "Sample restaurant";
  bill.source = "sample";
  bill.items = [
    line("Chicken Biryani", 2, 560, { [a]: 1, [b]: 1 }),
    line("Paneer Butter Masala", 1, 280, { [c]: 1, [d]: 1 }),
    line("Butter Naan", 4, 200, { [c]: 2, [d]: 2 }),
    line("Veg Fried Rice", 1, 220, { [d]: 1 }),
    line("Fresh Lime Soda", 3, 270, { [a]: 1, [b]: 1, [c]: 1 }),
    line("Gulab Jamun", 2, 160, {}),
    line("Mineral Water 1L", 2, 80, {}),
  ];
  bill.extras = [newExtra("tax", "CGST 2.5%", 4425), newExtra("tax", "SGST 2.5%", 4425), newExtra("roundoff", "Round off", 50)];
  bill.printedTotal = 185900;
  return bill;
}
