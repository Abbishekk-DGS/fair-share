import type { T } from "./i18n";
import { fmt } from "./money";
import type { Bill, BillResult } from "./types";

/** Plain-text summary for WhatsApp or the clipboard. */
export function summaryText(bill: Bill, r: BillResult, t: T, link?: string): string {
  const c = bill.currency;
  const name = (id: string) => bill.people.find((p) => p.id === id)?.name ?? "?";
  const lines = [`*${t("sum.header", { title: bill.title || t("common.untitled"), total: fmt(r.total, c) })}*`, ""];
  for (const p of r.people) {
    lines.push(`${name(p.id)}: *${fmt(p.owes, c)}*`);
    for (const it of p.items) {
      const item = bill.items.find((i) => i.id === it.itemId);
      if (!item) continue;
      const share = Math.abs(it.units - item.qty) > 1e-9 && item.qty > 1 ? ` (${+it.units.toFixed(2)}/${item.qty})` : "";
      lines.push(`  · ${item.name}${share} ${fmt(it.amount, c)}`);
    }
    for (const e of p.extras) {
      const extra = bill.extras.find((x) => x.id === e.extraId);
      if (extra) lines.push(`  · ${extra.label} ${fmt(e.amount, c)}`);
    }
  }
  lines.push("");
  if (bill.payer && !bill.paidSplit) lines.push(t("sum.paidBy", { name: name(bill.payer) }));
  for (const tr of r.transfers) {
    const to = bill.people.find((p) => p.id === tr.to);
    lines.push(`➜ ${t("sum.pays", { from: name(tr.from), to: name(tr.to), amount: fmt(tr.amount, c) })}${to?.upi ? `  (${t("sum.upi", { upi: to.upi })})` : ""}`);
  }
  lines.push("", `${t("sum.footer")}${link ? `: ${link}` : ""}`);
  return lines.join("\n");
}
