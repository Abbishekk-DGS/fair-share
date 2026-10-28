import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BillScreen, type Tab } from "./components/BillScreen";
import { Home } from "./components/Home";
import { Gear, Mark } from "./components/Icons";
import { ScanOverlay, type ScanState } from "./components/ScanOverlay";
import { REPO_URL, SettingsSheet } from "./components/Settings";
import { newBill, newExtra, newItem, uid } from "./lib/bill";
import { I18n, makeT } from "./lib/i18n";
import { CURRENCIES, toMinor } from "./lib/money";
import { sampleBill } from "./lib/sample";
import { scanBill, ScanError } from "./lib/scan";
import { readSharedBill } from "./lib/share";
import { deleteBill, loadBills, loadSettings, saveBill, saveSettings, type Settings } from "./lib/store";
import type { Bill, ExtraKind } from "./lib/types";

const KINDS = new Set<ExtraKind>(["tax", "service", "tip", "delivery", "discount", "roundoff", "other"]);

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const t = useMemo(() => makeT(settings.lang), [settings.lang]);
  const [bills, setBills] = useState<Bill[]>(loadBills);
  const [bill, setBill] = useState<Bill | null>(null);
  const [tab, setTab] = useState<Tab>("items");
  const [shared, setShared] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.lang;
    saveSettings(settings);
  }, [settings]);

  // A bill shared by link opens straight on its result.
  useEffect(() => {
    const open = () => {
      const b = readSharedBill(location.hash);
      if (!b) return;
      history.replaceState(null, "", location.pathname);
      dirty.current = false;
      setBill({ ...b, id: uid(), updatedAt: Date.now() });
      setShared(true);
      setTab("settle");
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  // Save edits (debounced). Shared and example bills are saved only once someone changes them.
  useEffect(() => {
    if (!bill || !dirty.current || !bill.items.length) return;
    const id = setTimeout(() => {
      saveBill(bill);
      if (bill.source === "sample") return;
      setSettings((s) => {
        const names = bill.people.map((p) => p.name).filter(Boolean);
        return JSON.stringify(s.lastPeople) === JSON.stringify(names) ? s : { ...s, lastPeople: names };
      });
    }, 400);
    return () => clearTimeout(id);
  }, [bill]);

  const update = useCallback((fn: (b: Bill) => Bill) => {
    dirty.current = true;
    setBill((b) => (b ? { ...fn(b), updatedAt: Date.now() } : b));
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 1800);
  }, []);

  const people = () => settings.lastPeople?.length ? settings.lastPeople : [t("people.me"), t("people.friend")];

  const openBill = (b: Bill, startTab: Tab, isDirty: boolean) => {
    dirty.current = isDirty;
    setShared(false);
    setBill(b);
    setTab(startTab);
    window.scrollTo({ top: 0 });
  };

  const goHome = () => {
    if (bill && dirty.current && bill.items.length) saveBill(bill);
    setBill(null);
    setShared(false);
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(null);
    setBills(loadBills());
    window.scrollTo({ top: 0 });
  };

  const handleFile = async (file: File) => {
    if (photo) URL.revokeObjectURL(photo);
    const url = URL.createObjectURL(file);
    setPhoto(url);
    setScan({ url, stage: "prepare" });
    try {
      const r = await scanBill(file, {
        ownKey: settings.ownKey,
        onProgress: (stage, pct) => setScan((s) => (s ? { ...s, stage, pct } : s)),
      });
      const b = newBill(people());
      const cur = CURRENCIES[r.currency] ? r.currency : "INR";
      b.currency = cur;
      b.items = r.items.map((i) => newItem(i.name, toMinor(i.amount, cur), i.qty, i.raw && i.raw.toLowerCase() !== i.name.toLowerCase() ? i.raw : undefined));
      b.extras = r.extras.map((e) => {
        const kind = (KINDS.has(e.kind as ExtraKind) ? e.kind : "other") as ExtraKind;
        return newExtra(kind, e.label || t(`extras.${kind}`), toMinor(e.amount, cur));
      });
      b.printedTotal = r.total ? toMinor(r.total, cur) : undefined;
      b.store = r.store || undefined;
      b.date = r.date || undefined;
      b.title = r.store || "";
      b.source = r.source;
      b.scanNote = r.note;
      setScan(null);
      openBill(b, "items", true);
    } catch (e) {
      setScan((s) => (s ? { ...s, error: e instanceof ScanError && e.code !== "failed" ? e.code : "failed" } : s));
    }
  };

  return (
    <I18n.Provider value={{ t, lang: settings.lang }}>
      <div className="app">
        <header className="topbar">
          <button className="brand" onClick={goHome} aria-label="Fair Share">
            <Mark className="brand-mark" />
            <span className="brand-name">
              Fair Share<i />
            </span>
          </button>
          <div className="top-actions">
            <button
              className="icon-btn lang-btn"
              onClick={() => setSettings((s) => ({ ...s, lang: s.lang === "en" ? "ta" : "en" }))}
              aria-label={settings.lang === "en" ? "தமிழ்" : "English"}
              lang={settings.lang === "en" ? "ta" : "en"}
            >
              {settings.lang === "en" ? "தமிழ்" : "EN"}
            </button>
            <button className="icon-btn" aria-label={t("settings.title")} onClick={() => setShowSettings(true)}>
              <Gear />
            </button>
          </div>
        </header>

        <main>
          {bill ? (
            <BillScreen bill={bill} update={update} tab={tab} setTab={setTab} photo={photo} shared={shared} onBack={goHome} toast={toast} />
          ) : (
            <Home
              bills={bills}
              onFile={handleFile}
              onManual={() => {
                const b = newBill(people());
                b.source = "manual";
                b.items = [newItem()];
                openBill(b, "items", false);
              }}
              onSample={() => openBill(sampleBill([...people().slice(0, 2), "Priya", "Arjun"].slice(0, 4)), "split", false)}
              onOpen={(b) => openBill(b, "settle", false)}
              onDelete={(id) => {
                deleteBill(id);
                setBills(loadBills());
              }}
            />
          )}
        </main>

        {!bill && (
          <footer className="footer">
            <span>
              {t("footer.by")}{" "}
              <a href="https://abbishekkdgs.tech" target="_blank" rel="noopener noreferrer">
                Abbishekk DGS
              </a>
            </span>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              {t("footer.source")}
            </a>
          </footer>
        )}
      </div>

      {scan && (
        <ScanOverlay
          scan={scan}
          onClose={() => setScan(null)}
          onRetry={() => {
            setScan(null);
            document.getElementById("bill-photo")?.click();
          }}
          onManual={() => {
            setScan(null);
            const b = newBill(people());
            b.source = "manual";
            b.items = [newItem()];
            openBill(b, "items", false);
          }}
        />
      )}
      {showSettings && <SettingsSheet settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </I18n.Provider>
  );
}
