import { describe, expect, it } from "vitest";
import { newBill, newExtra, newItem, newPerson } from "../src/lib/bill";
import { normalize } from "../src/lib/gemini";
import { fmt, rescale, toMinor } from "../src/lib/money";
import { parseReceiptText } from "../src/lib/ocrParse";
import { sampleBill } from "../src/lib/sample";
import { allocate, computeBill, settle, sum } from "../src/lib/split";

describe("allocate", () => {
  it("always adds back to the exact amount", () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(sum(allocate(10001, [3, 5, 7]))).toBe(10001);
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
    expect(allocate(500, [0, 1])).toEqual([0, 500]);
    expect(allocate(500, [0, 0])).toEqual([0, 0]);
  });
});

describe("computeBill", () => {
  it("splits items by who had them and tax by what each had", () => {
    const b = newBill(["A", "B"]);
    const [a, bb] = b.people.map((p) => p.id);
    const tea = newItem("Tea", 2000);
    tea.shares = { [a]: 1 };
    const pizza = newItem("Pizza", 6000);
    pizza.shares = { [a]: 1, [bb]: 1 };
    b.items = [tea, pizza];
    b.extras = [newExtra("tax", "GST", 400)];
    const r = computeBill(b);
    expect(r.total).toBe(8400);
    const [ra, rb] = r.people;
    expect(ra.itemsTotal).toBe(5000);
    expect(rb.itemsTotal).toBe(3000);
    expect(ra.owes).toBe(5250); // 5000 + 5/8 of 400
    expect(rb.owes).toBe(3150);
    expect(ra.owes + rb.owes).toBe(r.total);
    // A paid everything, so B pays A
    expect(r.transfers).toEqual([{ from: bb, to: a, amount: 3150 }]);
  });

  it("splits by units for multi-quantity items", () => {
    const b = newBill(["A", "B"]);
    const [a, bb] = b.people.map((p) => p.id);
    const mats = newItem("Doormat", 47700, 3);
    mats.shares = { [a]: 2, [bb]: 1 };
    b.items = [mats];
    const r = computeBill(b);
    expect(r.people[0].owes).toBe(31800);
    expect(r.people[1].owes).toBe(15900);
    expect(r.people[0].items[0].units).toBe(2);
  });

  it("keeps unassigned items out and reports them", () => {
    const b = newBill(["A", "B"]);
    b.items = [newItem("Milk", 4230), newItem("Bread", 4000)];
    b.items[0].shares = { [b.people[0].id]: 1 };
    const r = computeBill(b);
    expect(r.unassigned).toEqual({ count: 1, amount: 4000 });
    expect(r.people[0].owes).toBe(4230);
  });

  it("splits everything equally in equal mode", () => {
    const b = newBill(["A", "B", "C"]);
    b.mode = "equal";
    b.items = [newItem("Dinner", 100000)];
    b.extras = [newExtra("tip", "Tip", 100)];
    const r = computeBill(b);
    expect(r.people.map((p) => p.owes)).toEqual([33367, 33367, 33366]);
    expect(sum(r.people.map((p) => p.owes))).toBe(100100);
  });

  it("handles several payers", () => {
    const b = newBill(["A", "B", "C"]);
    b.mode = "equal";
    b.items = [newItem("Trip", 90000)];
    const [a, bb, c] = b.people.map((p) => p.id);
    b.paidSplit = { [a]: 60000, [bb]: 30000, [c]: 0 };
    const r = computeBill(b);
    expect(r.transfers).toEqual([{ from: c, to: a, amount: 30000 }]);
  });

  it("works for the example bill", () => {
    const r = computeBill(sampleBill(["You", "Friend", "Priya", "Arjun"]));
    expect(r.total).toBe(185900);
    expect(r.unassigned.count).toBe(2);
  });
});

describe("settle", () => {
  it("uses few transfers and balances everyone", () => {
    const tr = settle([
      { id: "a", net: 500 },
      { id: "b", net: -300 },
      { id: "c", net: -200 },
      { id: "d", net: 0 },
    ]);
    expect(tr).toEqual([
      { from: "b", to: "a", amount: 300 },
      { from: "c", to: "a", amount: 200 },
    ]);
  });
});

describe("money", () => {
  it("formats rupees the Indian way", () => {
    expect(fmt(525390)).toBe("₹5,253.90");
    expect(fmt(10000000)).toBe("₹1,00,000");
    expect(fmt(-5000)).toBe("−₹50");
    expect(toMinor("1,234.5")).toBe(123450);
    expect(rescale(12345, "INR", "JPY")).toBe(123);
  });
});

describe("parseReceiptText", () => {
  it("reads a supermarket bill", () => {
    const text = `TAX INVOICE
Bill No : 600710005-003210
Vou. No : S352005 0084 600710005
HSN Particulars Qty/Kg N/Rate Value
1) CGST @ 0.00%, SGST @ 0.00%
190590 MODERN MILK PL-350g 1 42.30 42.30
040630 MILKY MIST CHE-200g 1 108.00 108.00
570339 DOORMAT GEOMETRIC 4 3 159.00 477.00
391721 HD NON WOVEN DOOR G 2 35.00 70.00
CARDAMOM PACK 1 60.00 60.00
Items: 34 Qty: 43 5253.90
Net Amount 5253.90`;
    const r = parseReceiptText(text);
    expect(r.items.map((i) => [i.name, i.qty, i.amount])).toEqual([
      ["MODERN MILK PL-350g", 1, 42.3],
      ["MILKY MIST CHE-200g", 1, 108],
      ["DOORMAT GEOMETRIC 4", 3, 477],
      ["HD NON WOVEN DOOR G", 2, 70],
      ["CARDAMOM PACK", 1, 60],
    ]);
    expect(r.total).toBe(5253.9);
  });

  it("reads a restaurant bill with amounts only", () => {
    const r = parseReceiptText(`Paneer Tikka 240.00\nButter Naan x2 90.00\nSub Total 330.00\nCGST 2.5% 8.25\nGrand Total 346.50`);
    expect(r.items.map((i) => i.name)).toEqual(["Paneer Tikka", "Butter Naan x2"]);
    expect(r.total).toBe(346.5);
  });
});

describe("normalize (AI output)", () => {
  it("cleans up bad values", () => {
    const r = normalize({ items: [{ name: "Tea", qty: "2", amount: "₹40.00" }, { name: "Zero", amount: 0 }], extras: [{ kind: "tax", label: "GST", amount: 2 }], total: "42", currency: "inr" });
    expect(r.items).toEqual([{ name: "Tea", raw: undefined, qty: 2, amount: 40 }]);
    expect(r.currency).toBe("INR");
    expect(r.total).toBe(42);
  });
});

it("gives new people different colours", () => {
  const ps = [newPerson("A", [])];
  ps.push(newPerson("B", ps));
  expect(ps[0].color).not.toBe(ps[1].color);
});

it("keeps the CSP hash in vercel.json in step with the inline script in index.html", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const html = readFileSync("index.html", "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  const hash = createHash("sha256").update(script).digest("base64");
  expect(readFileSync("vercel.json", "utf8")).toContain(`sha256-${hash}`);
});
