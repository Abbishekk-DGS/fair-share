import type { Bill, BillResult, PersonResult, Transfer } from "./types";

/**
 * Split `amount` into integer parts in proportion to `weights`, so the parts always add
 * back to exactly `amount` (largest remainder method). Works for negative amounts too.
 */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (!weights.length) return [];
  if (total <= 0) return weights.map(() => 0);
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  const exact = weights.map((w) => (abs * Math.max(0, w)) / total);
  const parts = exact.map(Math.floor);
  let left = abs - parts.reduce((s, p) => s + p, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .filter((o) => weights[o.i] > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && order.length; k++, left--) parts[order[k % order.length].i]++;
  return parts.map((p) => p * sign);
}

export const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function billTotal(bill: Bill): number {
  return sum(bill.items.map((i) => i.amount)) + sum(bill.extras.map((e) => e.amount));
}

const isAssigned = (shares: Record<string, number>) => Object.values(shares).some((v) => v > 0);

export function computeBill(bill: Bill): BillResult {
  const ids = bill.people.map((p) => p.id);
  const itemsTotal = sum(bill.items.map((i) => i.amount));
  const extrasTotal = sum(bill.extras.map((e) => e.amount));
  const total = itemsTotal + extrasTotal;
  const paid = (id: string) => (bill.paidSplit ? bill.paidSplit[id] ?? 0 : id === bill.payer ? total : 0);
  const res: Record<string, PersonResult> = Object.fromEntries(
    ids.map((id) => [id, { id, items: [], itemsTotal: 0, extras: [], owes: 0, paid: paid(id), net: 0 }]),
  );
  const unassigned = { count: 0, amount: 0 };

  if (bill.mode === "equal") {
    // Everything, extras included, is shared equally.
    allocate(total, ids.map(() => 1)).forEach((a, k) => (res[ids[k]].owes = a));
    allocate(itemsTotal, ids.map(() => 1)).forEach((a, k) => (res[ids[k]].itemsTotal = a));
  } else {
    for (const item of bill.items) {
      if (!isAssigned(item.shares)) {
        unassigned.count++;
        unassigned.amount += item.amount;
        continue;
      }
      const w = ids.map((id) => item.shares[id] ?? 0);
      const totalShares = sum(w);
      allocate(item.amount, w).forEach((a, k) => {
        if (w[k] <= 0) return;
        const r = res[ids[k]];
        r.items.push({ itemId: item.id, amount: a, units: (item.qty * w[k]) / totalShares });
        r.itemsTotal += a;
      });
    }
    // Extras follow what each person had (tax, service, discount) unless set to split equally.
    const base = ids.map((id) => res[id].itemsTotal);
    for (const extra of bill.extras) {
      const weights = extra.mode === "equal" || sum(base) === 0 ? ids.map(() => 1) : base;
      allocate(extra.amount, weights).forEach((a, k) => {
        if (a === 0) return;
        res[ids[k]].extras.push({ extraId: extra.id, amount: a });
      });
    }
    for (const id of ids) res[id].owes = res[id].itemsTotal + sum(res[id].extras.map((e) => e.amount));
  }

  for (const id of ids) res[id].net = res[id].paid - res[id].owes;
  const people = ids.map((id) => res[id]);
  const paidTotal = sum(people.map((p) => p.paid));
  return { total, itemsTotal, extrasTotal, unassigned, people, transfers: settle(people), paidTotal };
}

/**
 * Turn balances into the fewest simple payments: the person who owes most pays the person
 * who is owed most, repeated until everyone is square.
 */
export function settle(people: { id: string; net: number }[]): Transfer[] {
  const debtors = people.filter((p) => p.net < 0).map((p) => ({ id: p.id, v: -p.net }));
  const creditors = people.filter((p) => p.net > 0).map((p) => ({ id: p.id, v: p.net }));
  const out: Transfer[] = [];
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    if (amt > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: amt });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }
  return out;
}
