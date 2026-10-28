import { useState } from "react";
import { newPerson } from "../lib/bill";
import { useT } from "../lib/i18n";
import { fmt } from "../lib/money";
import type { Bill, BillResult, Item } from "../lib/types";
import { Avatar, pc } from "./common";
import { Plus, X } from "./Icons";

const assigned = (it: Item) => Object.values(it.shares).some((v) => v > 0);

export function SplitTab(props: {
  bill: Bill;
  result: BillResult;
  update: (fn: (b: Bill) => Bill) => void;
  filter: "all" | "left";
  setFilter: (f: "all" | "left") => void;
}) {
  const { bill, result, update, filter, setFilter } = props;
  const { t } = useT();
  const c = bill.currency;
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [brush, setBrush] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const people = bill.people;
  const brushPerson = people.find((p) => p.id === brush);
  const left = bill.items.filter((i) => !assigned(i));
  const shown = filter === "left" ? left : bill.items;

  const setShares = (id: string, fn: (s: Record<string, number>, it: Item) => Record<string, number>) =>
    update((b) => ({ ...b, items: b.items.map((i) => (i.id === id ? { ...i, shares: clean(fn({ ...i.shares }, i)) } : i)) }));

  const toggle = (itemId: string, pid: string) =>
    setShares(itemId, (s) => {
      if (s[pid] > 0) delete s[pid];
      else s[pid] = 1;
      return s;
    });

  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    update((b) => ({ ...b, people: [...b.people, newPerson(name, b.people)] }));
    setNewName("");
  };

  const removePerson = (pid: string) =>
    update((b) => {
      const peopleLeft = b.people.filter((p) => p.id !== pid);
      return {
        ...b,
        people: peopleLeft,
        items: b.items.map((i) => {
          const s = { ...i.shares };
          delete s[pid];
          return { ...i, shares: s };
        }),
        payer: b.payer === pid ? peopleLeft[0]?.id ?? null : b.payer,
        paidSplit: b.paidSplit && Object.fromEntries(Object.entries(b.paidSplit).filter(([k]) => k !== pid)),
      };
    });

  return (
    <div className="panel">
      <div className="card">
        <div className="card-head">
          <h3>{t("people.title")}</h3>
          <button className="btn small ghost" onClick={() => setEditing((e) => !e)}>
            {editing ? t("people.doneEdit") : t("people.edit")}
          </button>
        </div>
        {editing ? (
          <div>
            {people.map((p) => (
              <div className="person-edit" key={p.id}>
                <Avatar person={p} />
                <input
                  className="field boxed"
                  aria-label={t("people.title")}
                  value={p.name}
                  onChange={(e) => update((b) => ({ ...b, people: b.people.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)) }))}
                />
                <button className="del" disabled={people.length <= 1} aria-label={t("people.remove", { name: p.name })} onClick={() => removePerson(p.id)}>
                  <X />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-pad brush">
            <div className="people">
              {people.map((p) =>
                bill.mode === "items" ? (
                  <button key={p.id} className="person-chip" style={pc(p)} aria-pressed={brush === p.id} onClick={() => setBrush(brush === p.id ? null : p.id)}>
                    <Avatar person={p} />
                    <span className="nm">{p.name}</span>
                  </button>
                ) : (
                  <span className="person-chip" key={p.id} style={pc(p)}>
                    <Avatar person={p} />
                    <span className="nm">{p.name}</span>
                  </span>
                ),
              )}
              {brush && (
                <button className="btn small ghost" onClick={() => setBrush(null)}>
                  {t("split.brushOff")}
                </button>
              )}
            </div>
            {bill.mode === "items" &&
              (brushPerson ? (
                <span className="small" style={{ color: "var(--orange-text)", fontWeight: 600 }}>{t("split.brushHint", { name: brushPerson.name })}</span>
              ) : (
                <span className="small muted">{t("split.brush")}</span>
              ))}
          </div>
        )}
        <form
          className="add-person"
          style={editing ? { borderTop: "1px dashed var(--line)" } : { paddingTop: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            addPerson();
          }}
        >
          <input className="field boxed" id="new-person" placeholder={t("people.ph")} aria-label={t("people.ph")} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={30} />
          <button className="btn small" type="submit" disabled={!newName.trim()}>
            <Plus /> {t("people.add")}
          </button>
        </form>
      </div>

      <div className="seg" role="group" style={{ alignSelf: "flex-start" }}>
        {(["items", "equal"] as const).map((m) => (
          <button key={m} aria-pressed={bill.mode === m} onClick={() => update((b) => ({ ...b, mode: m }))}>
            {m === "items" ? t("split.byItem") : t("split.equal")}
          </button>
        ))}
      </div>

      {bill.mode === "equal" ? (
        <div className="card">
          <p className="card-pad muted small" style={{ margin: 0, borderBottom: "1px dashed var(--line)" }}>
            {t("split.equalNote", { total: fmt(result.total, c), n: people.length })}
          </p>
          {result.people.map((r) => {
            const p = people.find((x) => x.id === r.id)!;
            return (
              <div className="person-sum" key={r.id} style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                <Avatar person={p} />
                <span className="nm">{p.name}</span>
                <span className="owes money">{fmt(r.owes, c)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="filterbar">
            <div className="seg" role="group">
              <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                {t("split.filterAll")} <span className="num small">{bill.items.length}</span>
              </button>
              <button aria-pressed={filter === "left"} onClick={() => setFilter("left")}>
                {t("split.filterLeft")} <span className="num small">{left.length}</span>
              </button>
            </div>
          </div>

          <div className="card assign">
            {shown.length === 0 && <p className="card-pad muted small" style={{ margin: 0 }}>{t("split.nothingLeft")}</p>}
            {shown.map((it) => {
              const isOn = (pid: string) => (it.shares[pid] ?? 0) > 0;
              const inItem = people.filter((p) => isOn(p.id));
              const allOn = inItem.length === people.length;
              const split = result.people.flatMap((r) => r.items.filter((x) => x.itemId === it.id).map((x) => ({ pid: r.id, ...x })));
              return (
                <div
                  key={it.id}
                  className={`arow${assigned(it) ? "" : " unassigned"}${brush ? " painting" : ""}`}
                  onClick={(e) => {
                    if (!brush || (e.target as HTMLElement).closest("button, input")) return;
                    toggle(it.id, brush);
                  }}
                >
                  <div className="arow-top">
                    <span className="arow-name">
                      {it.name || "—"}
                      {it.qty !== 1 && <small>×{it.qty}</small>}
                    </span>
                    <span className="arow-amt money">{fmt(it.amount, c)}</span>
                  </div>
                  <div className="arow-chips">
                    <button
                      className="mini all"
                      aria-pressed={allOn}
                      onClick={() => setShares(it.id, () => (allOn ? {} : Object.fromEntries(people.map((p) => [p.id, 1]))))}
                    >
                      {t("split.everyone")}
                    </button>
                    {people.map((p) => (
                      <button key={p.id} className="mini" style={pc(p)} aria-pressed={isOn(p.id)} onClick={() => toggle(it.id, p.id)}>
                        <Avatar person={p} />
                        {p.name}
                      </button>
                    ))}
                    {(inItem.length > 1 || (inItem.length && it.qty > 1)) && (
                      <button
                        className="link small"
                        aria-expanded={open === it.id}
                        onClick={() => {
                          if (open !== it.id && it.qty > 1) {
                            // Show shares as units of this item ("2 of the 3") when adjusting.
                            const total = Object.values(it.shares).reduce((a, b) => a + b, 0);
                            if (total && Math.abs(total - it.qty) > 1e-9)
                              setShares(it.id, (sh) => Object.fromEntries(Object.entries(sh).map(([k, v]) => [k, Math.round((it.qty * v * 2) / total) / 2 || 0.5])));
                          }
                          setOpen(open === it.id ? null : it.id);
                        }}
                      >
                        {open === it.id ? t("split.done") : t("split.adjust")}
                      </button>
                    )}
                  </div>
                  {split.length > 1 && open !== it.id && (
                    <div className="arow-split">
                      {split.map((s) => (
                        <span key={s.pid}>
                          {people.find((p) => p.id === s.pid)?.name} <b className="money">{fmt(s.amount, c)}</b>
                        </span>
                      ))}
                    </div>
                  )}
                  {open === it.id && (
                    <div className="adjust">
                      <span className="small muted">{it.qty > 1 ? t("split.unitsHelp", { qty: it.qty }) : t("split.sharesHelp")}</span>
                      {people.map((p) => {
                        const v = it.shares[p.id] ?? 0;
                        const amt = split.find((s) => s.pid === p.id)?.amount ?? 0;
                        const unit = it.qty > 1 ? 0.5 : 1;
                        const step = (d: number) => setShares(it.id, (s) => ({ ...s, [p.id]: Math.max(0, Math.min(999, +(v + d * unit).toFixed(2))) }));
                        return (
                          <div className="adjust-row" key={p.id}>
                            <Avatar person={p} />
                            <span className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                            <span className="stepper">
                              <button aria-label="−" onClick={() => step(-1)} disabled={v <= 0}>
                                −
                              </button>
                              <span>{v}</span>
                              <button aria-label="+" onClick={() => step(1)}>
                                +
                              </button>
                            </span>
                            <span className="money small" style={{ minWidth: 72, textAlign: "right" }}>{fmt(amt, c)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {left.length > 0 && (
            <button
              className="btn"
              onClick={() =>
                update((b) => ({
                  ...b,
                  items: b.items.map((i) => (assigned(i) ? i : { ...i, shares: Object.fromEntries(b.people.map((p) => [p.id, 1])) })),
                }))
              }
            >
              {t("split.rest", { n: left.length })}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function clean(s: Record<string, number>) {
  for (const k of Object.keys(s)) if (!(s[k] > 0)) delete s[k];
  return s;
}
