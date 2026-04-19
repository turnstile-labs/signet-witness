"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Action = "access" | "opt_out" | "erasure";

interface Challenge {
  challenge: string;
  host: string;
  value: string;
  expiresAt: string;
}

export default function RightsForm() {
  const t = useTranslations("rightsPage");

  const [action, setAction] = useState<Action>("access");
  const [domain, setDomain] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState<"challenge" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setChallenge(null);
    setError(null);
    setResult(null);
  }

  async function requestChallenge(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setLoading("challenge");
    try {
      const res = await fetch("/api/rights/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "error");
      } else {
        setChallenge(json as Challenge);
      }
    } catch {
      setError("network_error");
    } finally {
      setLoading(null);
    }
  }

  async function runAction() {
    reset();
    setLoading("verify");
    try {
      const path =
        action === "opt_out"
          ? "opt-out"
          : action === "erasure"
          ? "erasure"
          : "access";
      const res = await fetch(`/api/rights/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "verification_failed");
      } else {
        setResult(json);
      }
    } catch {
      setError("network_error");
    } finally {
      setLoading(null);
    }
  }

  function downloadExport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `witnessed-${domain}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyTxt() {
    if (!challenge) return;
    navigator.clipboard.writeText(challenge.value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-8">
      {/* Action picker */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-2 mb-3">
          {t("step1Label")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(["access", "opt_out", "erasure"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAction(a);
                reset();
              }}
              className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                action === a
                  ? "border-accent bg-accent/5"
                  : "border-border bg-surface hover:border-muted-2"
              }`}
            >
              <p className="text-sm font-semibold text-txt mb-0.5">
                {t(`actions.${a}.title`)}
              </p>
              <p className="text-[0.7rem] text-muted leading-snug">
                {t(`actions.${a}.sub`)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Domain input */}
      <form onSubmit={requestChallenge} className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-2">
          {t("step2Label")}
        </p>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              reset();
            }}
            placeholder={t("domainPlaceholder")}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="url"
            aria-label={t("domainAria")}
            className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-3.5 h-11 text-sm font-mono text-txt placeholder:text-muted-2 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15 transition-all"
          />
          <button
            type="submit"
            disabled={!domain.trim() || loading === "challenge"}
            className="shrink-0 px-4 sm:px-5 h-11 rounded-lg bg-accent text-white text-sm font-semibold tracking-wide transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading === "challenge" ? t("loading") : t("continue")}
          </button>
        </div>
      </form>

      {/* Challenge display */}
      {challenge && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-2 mb-2">
              {t("step3Label")}
            </p>
            <p className="text-sm text-muted leading-relaxed">
              {t("step3Body")}
            </p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div>
              <span className="text-muted-2 uppercase tracking-widest mr-2">
                {t("type")}
              </span>
              <span className="text-txt">TXT</span>
            </div>
            <div className="break-all">
              <span className="text-muted-2 uppercase tracking-widest mr-2">
                {t("host")}
              </span>
              <span className="text-txt">{challenge.host}</span>
            </div>
            <div>
              <span className="text-muted-2 uppercase tracking-widest mr-2">
                {t("value")}
              </span>
              <div className="mt-1.5 flex items-stretch gap-2">
                <code className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-3 py-2 text-[0.7rem] text-txt break-all">
                  {challenge.value}
                </code>
                <button
                  type="button"
                  onClick={copyTxt}
                  className="shrink-0 px-3 rounded-lg border border-border bg-bg text-txt text-[0.7rem] font-semibold hover:border-muted-2 transition-colors"
                >
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            </div>
          </div>

          <p className="text-[0.7rem] text-muted-2 leading-relaxed">
            {t("step3Note")}
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={runAction}
              disabled={loading === "verify"}
              className="w-full sm:w-auto px-5 h-11 rounded-lg bg-accent text-white text-sm font-semibold tracking-wide transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading === "verify"
                ? t("verifying")
                : t(`runButton.${action}`)}
            </button>
          </div>
        </div>
      )}

      {/* Errors */}
      {error && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-400/5 px-4 py-3 text-sm">
          <p className="font-semibold text-rose-500 mb-1">{t("errorTitle")}</p>
          <p className="text-muted leading-relaxed">
            {t.has(`errors.${error}`) ? t(`errors.${error}`) : error}
          </p>
        </div>
      )}

      {/* Success */}
      {result !== null && !error && (
        <div className="rounded-lg border border-verified/30 bg-verified/5 px-4 py-4 text-sm space-y-3">
          <p className="font-semibold text-verified">
            {t(`success.${action}`)}
          </p>

          {action === "access" && (
            <>
              <p className="text-muted leading-relaxed">
                {t("success.accessBody")}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={downloadExport}
                  className="px-4 h-9 rounded-lg bg-accent text-white text-xs font-semibold tracking-wide hover:opacity-90 transition-opacity"
                >
                  {t("download")}
                </button>
              </div>
              <details className="pt-2">
                <summary className="text-xs font-mono text-muted-2 cursor-pointer hover:text-muted">
                  {t("viewJson")}
                </summary>
                <pre className="mt-2 text-[0.65rem] font-mono text-txt bg-bg border border-border rounded-lg p-3 overflow-x-auto thin-scrollbar max-h-80">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </>
          )}

          {action === "erasure" &&
            typeof result === "object" &&
            result !== null && (
              <p className="text-muted leading-relaxed">
                {t("success.erasureBody", {
                  sender:
                    (result as { eventsAsSender?: number }).eventsAsSender ?? 0,
                  receiver:
                    (result as { eventsAsReceiver?: number })
                      .eventsAsReceiver ?? 0,
                })}
              </p>
            )}

          {action === "opt_out" && (
            <p className="text-muted leading-relaxed">
              {t("success.optOutBody")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
