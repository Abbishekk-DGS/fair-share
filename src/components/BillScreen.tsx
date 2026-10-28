import { useMemo, useState } from "react";
import { useT } from "../lib/i18n";
import { fmt } from "../lib/money";
import { computeBill } from "../lib/split";
import type { Bill } from "../lib/types";
import { Avatar } from "./common";
import { ArrowLeft, ArrowRight, Info } from "./Icons";
import { ItemsTab } from "./ItemsTab";
import { SettleTab } from "./SettleTab";
import { SplitTab } from "./SplitTab";

export type Tab = "items" | "split" | "settle";
const TABS: Tab[] = ["items", "split", "settle"];

export function BillScreen(props: {
  bill: Bill;
  update: (fn: (b: Bill) => Bill) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  photo: string | null;
  shared: boolean;
  onBack: () => void;
  toast: (s: string) => void;
}) {
  const { bill, update, tab, setTab, photo, shared, onBack, toast } = props;
  const { t } = useT();
  const result = useMemo(() => computeBill(bill), [bill]);
  const [filter, setFilter] = useState<"all" | "left">("all");
  const c = bill.currency;

  const go = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <div className="billbar">
        <button className="icon-btn" aria-label={t("common.back")} onClick={onBack}>
          <ArrowLeft />
        </button>
        <input
          className="title-input"
          aria-label={t("items.titlePh")}
          placeholder={t("items.titlePh")}
          value={bill.title}
          onChange={(e) => update((b) => ({ ...b, title: e.target.value }))}
        />
        <div className="bill-total">
          <small>{t("common.total")}</small>
          <b className="money">{fmt(result.total, c)}</b>
        </div>
      </div>

      {shared && (
        <div className="note" style={{ marginBottom: 12 }}>
          <Info />
          <span>{t("shared.banner")}</span>
        </div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((k, i) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(k)}>
            <span className="n">{i + 1}</span>
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === "items" && <ItemsTab bill={bill} update={update} photo={photo} />}
      {tab === "split" && <SplitTab bill={bill} result={result} update={update} filter={filter} setFilter={setFilter} />}
      {tab === "settle" && (
        <SettleTab
          bill={bill}
          result={result}
          update={update}
          toast={toast}
          goAssign={() => {
            setFilter("left");
            go("split");
          }}
        />
      )}

      {tab !== "settle" && (
        <div className="dock">
          <div className="dock-inner">
            {tab === "split" && (
              <>
                <div className="dock-people" aria-live="polite">
                  {result.people.map((r) => {
                    const p = bill.people.find((x) => x.id === r.id)!;
                    return (
                      <span className="dock-person" key={r.id}>
                        <Avatar person={p} />
                        <span>{p.name}</span>
                        <b className="money">{fmt(r.owes, c)}</b>
                      </span>
                    );
                  })}
                  {bill.mode === "items" && result.unassigned.count > 0 && (
                    <span className="dock-person left">{t("split.left", { n: result.unassigned.count, amount: fmt(result.unassigned.amount, c) })}</span>
                  )}
                </div>
                {bill.mode === "items" && result.total !== 0 && (
                  <div className="progress" aria-hidden="true">
                    {result.people.map((r) => {
                      const p = bill.people.find((x) => x.id === r.id)!;
                      return <span key={r.id} style={{ width: `${Math.max(0, (r.itemsTotal / Math.max(1, result.itemsTotal)) * 100)}%`, background: `var(--p${p.color})` }} />;
                    })}
                  </div>
                )}
              </>
            )}
            <button className="btn primary block" disabled={tab === "items" && bill.items.length === 0} onClick={() => go(tab === "items" ? "split" : "settle")}>
              {tab === "items" ? t("next.split") : t("next.settle")} <ArrowRight />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
