import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { useT } from "../lib/i18n";
import { fmt } from "../lib/money";
import { shareLink } from "../lib/share";
import { summaryText } from "../lib/summary";
import type { Bill, BillResult, Person, Transfer } from "../lib/types";
import { UPI_ID, upiLink } from "../lib/upi";
import { Avatar, MoneyInput, pc } from "./common";
import { Alert, ArrowRight, Chat, Chevron, Copy, LinkIcon, Share, Wallet } from "./Icons";

export function SettleTab(props: { bill: Bill; result: BillResult; update: (fn: (b: Bill) => Bill) => void; goAssign: () => void; toast: (s: string) => void }) {
  const { bill, result, update, goAssign, toast } = props;
  const { t } = useT();
  const c = bill.currency;
  const person = (id: string) => bill.people.find((p) => p.id === id)!;
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [copyText, setCopyText] = useState<string | null>(null);

  const several = Boolean(bill.paidSplit);
  const paidGap = result.total - result.paidTotal;
  const link = useMemo(() => shareLink(bill), [bill]);
  const text = useMemo(() => summaryText(bill, result, t, link), [bill, result, t, link]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(t("share.copied"));
      setCopyText(null);
    } catch {
      setCopyText(value);
      toast(t("share.copyFail"));
    }
  };

  return (
    <div className="panel">
      {bill.mode === "items" && result.unassigned.count > 0 && (
        <div className="note warn">
          <Alert />
          <div className="body">
            <span>{t("settle.unassigned", { n: result.unassigned.count, amount: fmt(result.unassigned.amount, c) })}</span>
            <button className="link" onClick={goAssign}>
              {t("settle.assign")}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>{t("settle.paid")}</h3>
        </div>
        <div className="card-pad payer-row">
          {bill.people.map((p) => (
            <button
              key={p.id}
              className="person-chip"
              style={pc(p)}
              aria-pressed={!several && bill.payer === p.id}
              onClick={() => update((b) => ({ ...b, payer: p.id, paidSplit: undefined }))}
            >
              <Avatar person={p} />
              <span className="nm">{p.name}</span>
            </button>
          ))}
          <button
            className="person-chip"
            style={{ paddingLeft: 12 }}
            aria-pressed={several}
            onClick={() =>
              update((b) => ({
                ...b,
                paidSplit: b.paidSplit ?? Object.fromEntries(b.people.map((p) => [p.id, p.id === b.payer ? result.total : 0])),
              }))
            }
          >
            {t("settle.several")}
          </button>
        </div>
        {several && (
          <div className="pay-split">
            {bill.people.map((p) => (
              <div className="pay-split-row" key={p.id}>
                <Avatar person={p} />
                <span>{p.name}</span>
                <MoneyInput
                  className="field boxed right num"
                  label={p.name}
                  value={bill.paidSplit?.[p.id] ?? 0}
                  currency={c}
                  onChange={(v) => update((b) => ({ ...b, paidSplit: { ...(b.paidSplit ?? {}), [p.id]: v } }))}
                />
              </div>
            ))}
            {paidGap !== 0 && (
              <p className="small" style={{ margin: 0, padding: "8px 14px 12px", color: "var(--orange-text)", fontWeight: 600 }}>
                {paidGap > 0 ? t("settle.notCovered", { amount: fmt(paidGap, c) }) : t("settle.over", { amount: fmt(-paidGap, c) })}
              </p>
            )}
          </div>
        )}
      </div>

      <section className="transfers" aria-labelledby="tr-h">
        <h3 id="tr-h">{t("settle.transfers")}</h3>
        {result.transfers.length === 0 ? (
          <p className="square" style={{ margin: 0 }}>{t("settle.square")}</p>
        ) : (
          <>
            {result.transfers.map((tr) => (
              <TransferRow key={tr.from + tr.to} tr={tr} from={person(tr.from)} to={person(tr.to)} bill={bill} update={update} />
            ))}
            {c === "INR" &&
              [...new Set(result.transfers.map((tr) => tr.to))]
                .map(person)
                .filter((p) => !(p.upi && UPI_ID.test(p.upi)))
                .map((p) => <UpiAsk key={p.id} person={p} update={update} />)}
          </>
        )}
      </section>

      <div className="card">
        <div className="card-head">
          <h3>{t("settle.shares")}</h3>
          <span className="money small muted">{fmt(result.total, c)}</span>
        </div>
        {result.people.map((r) => {
          const p = person(r.id);
          const expanded = openPerson === r.id;
          return (
            <div className="person-card" key={r.id}>
              <button className="person-sum" aria-expanded={expanded} onClick={() => setOpenPerson(expanded ? null : r.id)}>
                <Avatar person={p} />
                <span className="nm">{p.name}</span>
                <span className="owes money">{fmt(r.owes, c)}</span>
                <Chevron className="chev" />
              </button>
              {expanded && (
                <div className="person-detail">
                  {r.items.map((x) => {
                    const it = bill.items.find((i) => i.id === x.itemId);
                    if (!it) return null;
                    const part = it.qty > 1 && Math.abs(x.units - it.qty) > 1e-9 ? ` (${+x.units.toFixed(2)}/${it.qty})` : it.qty > 1 ? ` ×${it.qty}` : "";
                    return (
                      <div key={x.itemId}>
                        <span>
                          {it.name}
                          <span className="sub">{part}</span>
                        </span>
                        <span className="money">{fmt(x.amount, c)}</span>
                      </div>
                    );
                  })}
                  {r.extras.map((x) => {
                    const e = bill.extras.find((i) => i.id === x.extraId);
                    return e ? (
                      <div key={x.extraId} className="sub">
                        <span>{e.label}</span>
                        <span className="money">{fmt(x.amount, c)}</span>
                      </div>
                    ) : null;
                  })}
                  <hr />
                  <div>
                    <b>{t("settle.share")}</b>
                    <b className="money">{fmt(r.owes, c)}</b>
                  </div>
                  <div className="sub">
                    <span>{t("settle.paidLabel")}</span>
                    <span className="money">{fmt(r.paid, c)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{t("share.title")}</h3>
        <div className="share-grid">
          <a className="btn wa wide" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            <Chat /> {t("share.whatsapp")}
          </a>
          <button className="btn" onClick={() => copy(text)}>
            <Copy /> {t("share.copy")}
          </button>
          <button className="btn" onClick={() => copy(link)}>
            <LinkIcon /> {t("share.link")}
          </button>
          {typeof navigator.share === "function" && (
            <button
              className="btn wide"
              onClick={() => navigator.share({ title: bill.title || "Fair Share", text, url: link }).catch(() => {})}
            >
              <Share /> {t("share.more")}
            </button>
          )}
        </div>
        <p className="small muted" style={{ margin: 0 }}>{t("share.linkHint")}</p>
        {copyText && <textarea className="copybox" readOnly value={copyText} onFocus={(e) => e.target.select()} autoFocus />}
      </div>
    </div>
  );
}

function TransferRow({ tr, from, to, bill, update }: { tr: Transfer; from: Person; to: Person; bill: Bill; update: (fn: (b: Bill) => Bill) => void }) {
  const { t } = useT();
  const c = bill.currency;
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const href =
    c === "INR" && to.upi && UPI_ID.test(to.upi)
      ? upiLink({ upi: to.upi, name: to.name, amountMinor: tr.amount, note: `Fair Share ${bill.title || ""}`.trim() })
      : null;

  useEffect(() => {
    if (!href || !showQr) return;
    QRCode.toDataURL(href, { margin: 1, width: 360, color: { dark: "#0C1A19", light: "#FFFFFF" } }).then(setQr, () => setQr(null));
  }, [href, showQr]);

  return (
    <div className="transfer">
      <div className="transfer-line">
        <span className="transfer-who">
          <Avatar person={from} /> {from.name}
          <ArrowRight className="arrow" />
          <Avatar person={to} /> {to.name}
        </span>
        <span className="transfer-amt money">{fmt(tr.amount, c)}</span>
      </div>
      {href && (
        <div className="transfer-tools">
          <a className="btn small primary" href={href}>
            <Wallet /> {t("settle.payUpi", { amount: fmt(tr.amount, c) })}
          </a>
          <button className="btn small" aria-expanded={showQr} onClick={() => setShowQr((s) => !s)}>
            {t("settle.qr")}
          </button>
          <span className="small muted">
            {to.upi} ·{" "}
            <button className="link" onClick={() => update((b) => ({ ...b, people: b.people.map((p) => (p.id === to.id ? { ...p, upi: undefined } : p)) }))}>
              {t("common.change")}
            </button>
          </span>
        </div>
      )}
      {showQr && qr && (
        <div className="qr">
          <img src={qr} alt={t("settle.payUpi", { amount: fmt(tr.amount, c) })} />
          <p>{t("settle.upiNote")}</p>
        </div>
      )}
    </div>
  );
}

/** One UPI box per person who gets paid, shown until they have a valid ID. */
function UpiAsk({ person, update }: { person: Person; update: (fn: (b: Bill) => Bill) => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState(person.upi ?? "");
  const bad = draft.trim() !== "" && !UPI_ID.test(draft.trim());
  const save = () => {
    const v = draft.trim();
    if (v && !UPI_ID.test(v)) return;
    update((b) => ({ ...b, people: b.people.map((p) => (p.id === person.id ? { ...p, upi: v || undefined } : p)) }));
  };
  return (
    <div className="upi-ask">
      <label className="small" htmlFor={`upi-${person.id}`} style={{ fontWeight: 700 }}>
        {t("settle.upiAsk", { name: person.name })}
      </label>
      <div className="upi-field">
        <input
          id={`upi-${person.id}`}
          className="field boxed"
          placeholder={t("settle.upiPh")}
          value={draft}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button className="btn small" onClick={save} disabled={!draft.trim() || bad}>
          {t("common.save")}
        </button>
      </div>
      <span className="small" style={{ color: bad ? "var(--orange-text)" : "var(--muted)" }}>
        {bad ? t("settle.upiBad") : t("settle.upiHint")}
      </span>
    </div>
  );
}
