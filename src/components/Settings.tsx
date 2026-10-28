import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";
import type { Settings } from "../lib/store";
import { X } from "./Icons";

export const REPO_URL = "https://github.com/Abbishekk-DGS/fair-share";

export function SettingsSheet({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const { t } = useT();
  const [key, setKey] = useState(settings.ownKey ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-h">
        <div className="sheet-head">
          <h2 id="settings-h">{t("settings.title")}</h2>
          <button className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="setting">
          <span className="label">{t("settings.lang")}</span>
          <div className="seg" role="group" style={{ alignSelf: "flex-start" }}>
            <button aria-pressed={settings.lang === "en"} onClick={() => onChange({ ...settings, lang: "en" })}>
              English
            </button>
            <button aria-pressed={settings.lang === "ta"} onClick={() => onChange({ ...settings, lang: "ta" })} lang="ta">
              தமிழ்
            </button>
          </div>
        </div>

        <div className="setting">
          <span className="label">{t("settings.theme")}</span>
          <div className="seg" role="group" style={{ alignSelf: "flex-start" }}>
            {(["system", "light", "dark"] as const).map((th) => (
              <button key={th} aria-pressed={settings.theme === th} onClick={() => onChange({ ...settings, theme: th })}>
                {t(`theme.${th}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <label htmlFor="own-key">{t("settings.key")}</label>
          <p>{t("settings.keyHint")}</p>
          <div className="key-row">
            <input
              id="own-key"
              className="field boxed"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setSaved(false);
              }}
            />
            <button
              className="btn small primary"
              disabled={!key.trim()}
              onClick={() => {
                onChange({ ...settings, ownKey: key.trim() });
                setSaved(true);
              }}
            >
              {saved ? t("settings.saved") : t("settings.save")}
            </button>
          </div>
          {settings.ownKey && (
            <button
              className="link small"
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                onChange({ ...settings, ownKey: undefined });
                setKey("");
              }}
            >
              {t("settings.clear")}
            </button>
          )}
        </div>

        <div className="setting">
          <span className="label">{t("settings.about")}</span>
          <p>
            {t("settings.aboutText")}{" "}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              {t("footer.source")}
            </a>
            {" · "}
            {t("footer.by")}{" "}
            <a href="https://abbishekkdgs.tech" target="_blank" rel="noopener noreferrer">
              Abbishekk DGS
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
