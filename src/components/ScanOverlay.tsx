import { useT } from "../lib/i18n";
import { Alert } from "./Icons";

export type ScanState = {
  url: string;
  stage: "prepare" | "ai" | "ocr";
  pct?: number;
  error?: "unreadable_format" | "nothing_found" | "failed";
};

export function ScanOverlay({ scan, onRetry, onManual, onClose }: { scan: ScanState; onRetry: () => void; onManual: () => void; onClose: () => void }) {
  const { t } = useT();
  const status =
    scan.stage === "prepare" ? t("scan.prepare") : scan.stage === "ai" ? t("scan.ai") : t("scan.ocr", { pct: scan.pct ?? 0 });
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("home.scan")}>
      <div className="scan-box">
        {!scan.error && (
          <div className="scan-photo">
            <img src={scan.url} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
          </div>
        )}
        {scan.error ? (
          <>
            <div className="note warn">
              <Alert />
              <span className="scan-error">{t(`scan.err.${scan.error}`)}</span>
            </div>
            <div className="scan-actions">
              <button className="btn primary" onClick={onRetry}>
                {t("scan.retry")}
              </button>
              <button className="btn" onClick={onManual}>
                {t("scan.tryManual")}
              </button>
              <button className="btn ghost" onClick={onClose}>
                {t("common.close")}
              </button>
            </div>
          </>
        ) : (
          <p className="scan-status" aria-live="polite">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
