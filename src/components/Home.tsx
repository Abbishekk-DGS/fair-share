import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";
import { fmt } from "../lib/money";
import { billTotal } from "../lib/split";
import type { Bill } from "../lib/types";
import { Camera, Pencil, Receipt, Shield, Trash } from "./Icons";

export function Home(props: {
  bills: Bill[];
  onFile: (f: File) => void;
  onManual: () => void;
  onSample: () => void;
  onOpen: (b: Bill) => void;
  onDelete: (id: string) => void;
}) {
  const { t, lang } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);

  // Pasting a screenshot anywhere on the home screen scans it.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) props.onFile(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [props]);

  const date = (ms: number) => new Date(ms).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short" });

  return (
    <>
      <section className="hero">
        <h1>
          {lang === "ta" ? (
            t("app.tagline")
          ) : (
            <>
              Split the bill by <mark>what each person had</mark>.
            </>
          )}
        </h1>
        <p>{t("home.sub")}</p>

        <div className="scan-card">
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr"
            id="bill-photo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) props.onFile(f);
              e.target.value = "";
            }}
          />
          <button
            className={`scan-drop${drag ? " drag" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/") || /\.hei[cf]$/i.test(x.name));
              if (f) props.onFile(f);
            }}
          >
            <span className="cam">
              <Camera />
            </span>
            <span>
              <strong>{t("home.scan")}</strong>
              <span>{t("home.scanHint")}</span>
            </span>
          </button>
          <div className="scan-alt">
            <button className="btn" onClick={props.onManual}>
              <Pencil /> {t("home.manual")}
            </button>
            <button className="btn" onClick={props.onSample}>
              <Receipt /> {t("home.sample")}
            </button>
          </div>
          <div className="privacy">
            <Shield /> <span>{t("home.privacy")}</span>
          </div>
        </div>
      </section>

      {props.bills.length > 0 && (
        <section className="section" aria-labelledby="recent-h">
          <h2 id="recent-h">{t("home.recent")}</h2>
          <div className="recent">
            {props.bills.map((b) => (
              <div className="recent-row" key={b.id}>
                <button className="recent-open" onClick={() => props.onOpen(b)}>
                  <b>{b.title || b.store || t("common.untitled")}</b>
                  <span>
                    {date(b.updatedAt)} · {t("common.items", { n: b.items.length })} · {b.people.map((p) => p.name).join(", ")}
                  </span>
                </button>
                {asking === b.id ? (
                  <span className="confirm" style={{ gridColumn: "2 / -1" }}>
                    {t("common.deleteAsk")}
                    <button className="btn small" onClick={() => (props.onDelete(b.id), setAsking(null))}>
                      {t("common.delete")}
                    </button>
                    <button className="btn small ghost" onClick={() => setAsking(null)}>
                      {t("common.keep")}
                    </button>
                  </span>
                ) : (
                  <>
                    <span className="money">{fmt(billTotal(b), b.currency)}</span>
                    <button className="del" aria-label={t("common.delete")} onClick={() => setAsking(b.id)}>
                      <Trash />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="how-h">
        <h2 id="how-h">{t("home.how")}</h2>
        <div className="steps">
          {(["1", "2", "3"] as const).map((n) => (
            <div className="step" key={n}>
              <b>{t(`home.step${n}.t`)}</b>
              <span>{t(`home.step${n}.d`)}</span>
            </div>
          ))}
        </div>
        <div className="step" style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <span className="muted" style={{ fontSize: 14 }}>
            <b style={{ color: "var(--ink)", display: "inline" }}>{t("home.equal.t")}.</b> {t("home.equal.d")}
          </span>
        </div>
      </section>
    </>
  );
}
