import { useState } from "react";
import { newExtra, newItem } from "../lib/bill";
import { useT } from "../lib/i18n";
import { CURRENCIES, fmt, rescale } from "../lib/money";
import { billTotal, sum } from "../lib/split";
import type { Bill, ExtraKind } from "../lib/types";
import { MoneyInput } from "./common";
import { Alert, Check, Image, Info, Plus, X } from "./Icons";

const EXTRA_KINDS: ExtraKind[] = ["tax", "service", "tip", "discount", "delivery", "roundoff"];

export function ItemsTab({ bill, update, photo }: { bill: Bill; update: (fn: (b: Bill) => Bill) => void; photo: string | null }) {
  const { t } = useT();
  const [showPhoto, setShowPhoto] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const c = bill.currency;
  const total = billTotal(bill);
  const itemsTotal = sum(bill.items.map((i) => i.amount));
  const diff = bill.printedTotal ? bill.printedTotal - total : 0;

  const setItem = (id: string, patch: Partial<Bill["items"][number]>) =>
    update((b) => ({ ...b, items: b.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const setExtra = (id: string, patch: Partial<Bill["extras"][number]>) =>
    update((b) => ({ ...b, extras: b.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  const sourceNote =
    bill.source === "ai" ? t("note.ai") : bill.source === "ocr" ? (bill.scanNote ? t(`note.${bill.scanNote}`) + " " : "") + t("note.ocr") : null;

  return (
    <div className="panel">
      {sourceNote && (
        <div className={`note${bill.source === "ocr" ? " warn" : ""}`}>
          <Info />
          <span>{sourceNote}</span>
        </div>
      )}

      {bill.printedTotal !== undefined && bill.items.length > 0 && (
        diff === 0 ? (
          <div className="note good">
            <Check />
            <span>{t("items.match", { total: fmt(bill.printedTotal, c) })}</span>
          </div>
        ) : (
          <div className="note warn">
            <Alert />
            <div className="body">
              <span>{t("items.mismatch", { sum: fmt(total, c), total: fmt(bill.printedTotal, c) })}</span>
              <button
                className="link"
                onClick={() => update((b) => ({ ...b, extras: [...b.extras, newExtra("other", t("extras.other"), diff)] }))}
              >
                {t("items.addDiff", { diff: fmt(diff, c) })}
              </button>
            </div>
          </div>
        )
      )}

      {photo && (
        <div className="photo-peek">
          <button className="btn small" onClick={() => setShowPhoto((s) => !s)} aria-expanded={showPhoto}>
            <Image /> {showPhoto ? t("items.hidePhoto") : t("items.photo")}
          </button>
          {showPhoto && <img src={photo} alt="" style={{ marginTop: 10 }} />}
        </div>
      )}

      <div className="card">
        <div className="lines">
          <div className="line-edit line-head" aria-hidden="true">
            <span>{t("items.name")}</span>
            <span style={{ textAlign: "right" }}>{t("items.qty")}</span>
            <span style={{ textAlign: "right" }}>{t("items.amount")}</span>
            <span />
          </div>
          {bill.items.length === 0 && <p className="card-pad muted small" style={{ margin: 0 }}>{t("items.empty")}</p>}
          {bill.items.map((it) => (
            <div className="line-edit" key={it.id}>
              <input
                className="field"
                aria-label={t("items.name")}
                value={it.name}
                autoFocus={focusId === it.id}
                placeholder={t("items.name")}
                onChange={(e) => setItem(it.id, { name: e.target.value })}
              />
              <input
                className="field right num"
                inputMode="decimal"
                aria-label={t("items.qty")}
                value={it.qty}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const q = parseFloat(e.target.value);
                  setItem(it.id, { qty: Number.isFinite(q) && q > 0 ? Math.min(q, 9999) : 1 });
                }}
              />
              <MoneyInput label={t("items.amount")} value={it.amount} currency={c} onChange={(amount) => setItem(it.id, { amount })} />
              <button className="del" aria-label={t("items.remove", { name: it.name || t("items.name") })} onClick={() => update((b) => ({ ...b, items: b.items.filter((i) => i.id !== it.id) }))}>
                <X />
              </button>
              {it.raw && it.raw !== it.name && <span className="line-raw">{t("items.printed", { raw: it.raw })}</span>}
            </div>
          ))}
        </div>
        <div className="add-row">
          <button
            className="btn small"
            onClick={() => {
              const it = newItem();
              setFocusId(it.id);
              update((b) => ({ ...b, items: [...b.items, it] }));
            }}
          >
            <Plus /> {t("items.add")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{t("extras.title")}</h3>
        </div>
        {bill.extras.map((e) => (
          <div key={e.id}>
            <div className="extra-row">
              <input className="field" aria-label={t("extras.other")} value={e.label} onChange={(ev) => setExtra(e.id, { label: ev.target.value })} />
              <MoneyInput
                label={e.label}
                value={e.kind === "discount" ? Math.abs(e.amount) : e.amount}
                currency={c}
                percentOf={itemsTotal}
                onChange={(v) => setExtra(e.id, { amount: e.kind === "discount" ? -Math.abs(v) : v })}
              />
              <button className="del" aria-label={t("items.remove", { name: e.label })} onClick={() => update((b) => ({ ...b, extras: b.extras.filter((x) => x.id !== e.id) }))}>
                <X />
              </button>
            </div>
            <div className="extra-mode">
              {(["proportional", "equal"] as const).map((m) => (
                <button key={m} className="pill-toggle" aria-pressed={e.mode === m} onClick={() => setExtra(e.id, { mode: m })}>
                  {m === "proportional" ? t("extras.byShare") : t("extras.equal")}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="add-row" style={bill.extras.length ? undefined : { borderTop: 0 }}>
          <p className="muted small" style={{ margin: "0 0 4px", width: "100%" }}>{t("extras.hint")}</p>
          <div className="chips">
            {EXTRA_KINDS.map((k) => (
              <button key={k} className="chip-add" onClick={() => update((b) => ({ ...b, extras: [...b.extras, newExtra(k, t(`extras.${k}`), 0)] }))}>
                + {t(`extras.${k}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="total-row">
          <span>{t("common.total")}</span>
          <span className="money">{fmt(total, c, { always: true })}</span>
        </div>
      </div>

      <label className="small muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {t("items.currency")}
        <select className="select" value={c} onChange={(e) => {
            const to = e.target.value;
            update((b) => {
              const r = (m: number) => rescale(m, b.currency, to);
              return {
                ...b,
                currency: to,
                items: b.items.map((i) => ({ ...i, amount: r(i.amount) })),
                extras: b.extras.map((x) => ({ ...x, amount: r(x.amount) })),
                printedTotal: b.printedTotal === undefined ? undefined : r(b.printedTotal),
                paidSplit: b.paidSplit && Object.fromEntries(Object.entries(b.paidSplit).map(([k, v]) => [k, r(v)])),
              };
            });
          }}>
          {Object.keys(CURRENCIES).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
