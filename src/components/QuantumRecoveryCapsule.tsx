import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileKey2,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createQrcFile, qrcFilename, QRC_PARAMETERS, type QrcPayload } from "../lib/qrc";
import "./quantum-recovery-capsule.css";

export interface QuantumRecoveryCapsuleProps {
  payload: QrcPayload | null;
  authorizationAvailable: boolean;
  onContinue: () => void;
  onCanDismissChange?: (canDismiss: boolean) => void;
  tokenPageLinks?: Array<{ href: string; label: string }>;
}

export function QuantumRecoveryCapsule({
  payload,
  authorizationAvailable,
  onContinue,
  onCanDismissChange,
  tokenPageLinks = [],
}: QuantumRecoveryCapsuleProps) {
  const [downloadInitiated, setDownloadInitiated] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [capsuleReady, setCapsuleReady] = useState(false);
  const [preparationAttempt, setPreparationAttempt] = useState(0);
  const [error, setError] = useState("");
  const [continueError, setContinueError] = useState("");
  const confirmationRef = useRef<HTMLInputElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const filenameRef = useRef("");
  const operationRef = useRef(0);
  const objectUrlsRef = useRef(new Set<string>());
  useEffect(() => {
    setDownloadInitiated(false);
    setSavedConfirmed(false);
    setConfirmed(false);
    setContinueError("");
  }, [payload]);

  useEffect(() => {
    operationRef.current += 1;
    bytesRef.current?.fill(0);
    bytesRef.current = null;
    filenameRef.current = "";
    setCapsuleReady(false);
    setDownloadInitiated(false);
    setConfirmed(false);
    if (confirmationRef.current) confirmationRef.current.checked = false;
    setBusy(Boolean(payload && authorizationAvailable));
    setError("");
    setContinueError("");
    if (!payload || !authorizationAvailable) return;

    const operation = operationRef.current;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      cancelled = true;
      setBusy(false);
      setError("Preparing the recovery file took too long. Please try again.");
    }, 15000);

    // Prepare before the click so the actual download retains browser user activation.
    void (async () => {
      let bytes: Uint8Array | null = null;
      try {
        bytes = await createQrcFile(payload);
        const filename = await qrcFilename(payload);
        if (cancelled || operation !== operationRef.current) {
          bytes.fill(0);
          return;
        }
        bytesRef.current = bytes;
        filenameRef.current = filename;
        setCapsuleReady(true);
      } catch (cause) {
        bytes?.fill(0);
        if (!cancelled && operation === operationRef.current) {
          setError(cause instanceof Error ? cause.message : "The recovery file could not be prepared. Please try again.");
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled && operation === operationRef.current) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [payload, authorizationAvailable, preparationAttempt]);

  useEffect(
    () => () => {
      operationRef.current += 1;
      bytesRef.current?.fill(0);
      bytesRef.current = null;
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    onCanDismissChange?.(downloadInitiated && confirmed && savedConfirmed);
  }, [confirmed, downloadInitiated, savedConfirmed, onCanDismissChange]);

  const unavailable = !authorizationAvailable || payload === null;

  function handleDownload() {
    if (unavailable || busy || !capsuleReady) return;
    if (!confirmed && confirmationRef.current?.checked !== true) {
      setContinueError("Confirm that you understand the recovery file gives its holder access to the creator wallet.");
      confirmationRef.current?.focus();
      return;
    }
    setConfirmed(true);
    setContinueError("");
    setError("");

    try {
      const capsuleBytes = bytesRef.current;
      const filename = filenameRef.current;
      if (!capsuleBytes || !filename) throw new Error("Recovery file is not ready. Please try preparing it again.");

      const blob = new Blob([new Uint8Array(capsuleBytes).buffer], {
        type: "application/octet-stream",
      });
      const objectUrl = URL.createObjectURL(blob);
      objectUrlsRef.current.add(objectUrl);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setDownloadInitiated(true);
      setSavedConfirmed(false);

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        objectUrlsRef.current.delete(objectUrl);
      }, 60000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The recovery capsule could not be prepared. Please try again.",
      );
    }
  }

  function handleContinue() {
    if (unavailable || !downloadInitiated || busy) return false;
    if (!confirmed && confirmationRef.current?.checked !== true) {
      setContinueError("Confirm that you saved the recovery file before continuing.");
      return false;
    }
    if (!savedConfirmed) {
      setContinueError("Confirm that you saved your recovery capsule before continuing.");
      return false;
    }
    setContinueError("");
    try {
      onContinue();
      return true;
    } catch (cause) {
      setContinueError(cause instanceof Error ? cause.message : "The completed draft could not be cleared. Your recovery capsule is still available.");
      return false;
    }
  }

  return (
    <main className="qrc-screen">
      <div className="qrc-shell">
        <header className="qrc-heading">
          <nav className="qrc-steps" aria-label="Creator authorization setup progress">
            {[
              { number: "01", label: "Create password", complete: true },
              { number: "02", label: "Prepare authorization", complete: authorizationAvailable },
              { number: "03", label: "Generate recovery capsule", current: authorizationAvailable && payload !== null },
              { number: "04", label: "Complete setup" },
            ].map((step, index) => (
              <div
                className={`qrc-step${step.complete ? " is-complete" : ""}${step.current ? " is-current" : ""}`}
                key={step.number}
                aria-current={step.current ? "step" : undefined}
              >
                <span className="qrc-step-number">{step.complete ? <Check size={13} /> : step.number}</span>
                <span className="qrc-step-label">{step.label}</span>
                {index < 3 && <span className="qrc-step-connector" aria-hidden="true" />}
              </div>
            ))}
          </nav>
          <div className="qrc-eyebrow">
            <span className="qrc-eyebrow-icon"><Fingerprint size={15} strokeWidth={1.8} /></span>
            <span>AUTHORIZATION SETUP <i /> RECOVERY</span>
          </div>
          <h1>Quantum Recovery Capsule</h1>
          <p>A post-launch file with your creator password, private key, and complete authorization hash chains.</p>
        </header>

        {unavailable ? (
          <section className="qrc-unavailable" role="status">
            <span className="qrc-unavailable-icon"><LockKeyhole size={20} /></span>
            <div>
              <h2>Recovery capsule unavailable</h2>
              <p>
                {!authorizationAvailable
                  ? "Prepare password authorization before creating a recovery capsule."
                  : "Recovery data is not available for this authorization. Return to setup and try again."}
              </p>
            </div>
          </section>
        ) : (
          <>
            <div className="qrc-content">
              <section className="qrc-main-panel" aria-labelledby="qrc-preview-heading">
                <div className="qrc-panel-topline">
                  <div className="qrc-file-mark"><FileKey2 size={19} strokeWidth={1.65} /></div>
                  <div className="qrc-panel-title">
                    <span>RECOVERY ARTIFACT</span>
                    <h2 id="qrc-preview-heading">Capsule preview</h2>
                  </div>
                  <span className="qrc-ready-tag"><i /> READY</span>
                </div>

                <div className="qrc-file-preview">
                  <div className="qrc-file-art" aria-hidden="true">
                    <div className="qrc-art-ring qrc-art-ring-outer" />
                    <div className="qrc-art-ring qrc-art-ring-inner" />
                    <div className="qrc-art-center"><ShieldCheck size={31} strokeWidth={1.35} /></div>
                    <span className="qrc-art-orbit qrc-orbit-one" />
                    <span className="qrc-art-orbit qrc-orbit-two" />
                  </div>
                  <div className="qrc-file-caption">
                    <span className="qrc-file-extension">.QRC</span>
                    <strong>Post-launch recovery capsule</strong>
                    <small>Password, creator key, and H100–H0 proof chains</small>
                  </div>
                  <div className="qrc-file-version">v3.0</div>
                </div>

                <div className="qrc-metadata">
                  <div className="qrc-meta-row"><span>Format</span><strong>{QRC_PARAMETERS.format} <em>.qrc</em></strong></div>
                  <div className="qrc-meta-row"><span>File access</span><strong>{QRC_PARAMETERS.access}</strong></div>
                  <div className="qrc-meta-row"><span>Encryption</span><strong>{QRC_PARAMETERS.encryption}</strong></div>
                  <div className="qrc-meta-row"><span>Integrity check</span><strong>{QRC_PARAMETERS.checksum}</strong></div>
                  <div className="qrc-meta-row"><span>Recovery protocol</span><strong>Armoreum password-derived hash-chain protocol</strong></div>
                </div>

                <div className="qrc-feature-list" aria-label="Capsule features">
                  <div><Check size={14} /><span>The file itself is the recovery key</span></div>
                  <div><Check size={14} /><span>Password, creator key, seed, and all proof chains are included</span></div>
                  <div><Check size={14} /><span>Open and inspect offline without entering a password</span></div>
                </div>
              </section>

              <aside className="qrc-side-panel">
                <div className="qrc-side-kicker"><Sparkles size={14} /> KEEP YOUR ACCESS RECOVERABLE</div>
                <h2>A recovery key, kept in your hands.</h2>
                <label className={`qrc-confirm ${confirmed ? "" : "is-locked"}`}>
                  <input
                    ref={confirmationRef}
                    type="checkbox"
                    autoComplete="off"
                    checked={confirmed}
                    onChange={(event) => {
                      setConfirmed(event.target.checked);
                      setContinueError("");
                    }}
                  />
                  <span className="qrc-custom-checkbox"><Check size={12} /></span>
                  <span>I understand this unencrypted file gives its holder access to the creator wallet.</span>
                </label>
                {continueError && <p className="qrc-error" role="alert">{continueError}</p>}

                <button className="qrc-download-button" type="button" onClick={handleDownload} disabled={busy || !capsuleReady} aria-busy={busy}>
                  {busy ? (
                    <span className="qrc-button-content"><span className="qrc-button-pulse" /> Preparing capsule…</span>
                  ) : downloadInitiated ? (
                    <span className="qrc-button-content"><Download size={17} /> Download again</span>
                  ) : (
                    <span className="qrc-button-content"><Download size={17} /> Download Recovery Capsule</span>
                  )}
                  {!busy && <ArrowRight className="qrc-button-arrow" size={16} />}
                </button>

                {downloadInitiated && tokenPageLinks.length > 0 && (
                  <div className="qrc-token-page-actions" aria-label="Launched token pages">
                    {tokenPageLinks.map((link) => (
                      <a
                        className="qrc-token-page-button"
                        href={link.href}
                        key={link.href}
                        data-testid="link-post-launch-token-page"
                        aria-disabled={!savedConfirmed}
                        onClick={(event) => {
                          if (!handleContinue()) event.preventDefault();
                        }}
                      >
                        {link.label}<ArrowRight size={15} aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                )}

                {error && <p className="qrc-error" role="alert">{error}</p>}
                {error && !capsuleReady && !busy && (
                  <button className="qrc-continue-button" type="button" onClick={() => setPreparationAttempt((attempt) => attempt + 1)}>
                    Try preparing again <ArrowRight size={16} />
                  </button>
                )}

                {downloadInitiated && (
                  <div className="qrc-download-status" role="status">
                    <CheckCircle2 size={15} />
                    <span>Download initiated. Confirm you have stored the file securely.</span>
                  </div>
                )}
                {downloadInitiated && (
                  <label className="qrc-confirm">
                    <input
                      type="checkbox"
                      checked={savedConfirmed}
                      onChange={(event) => {
                        setSavedConfirmed(event.target.checked);
                        setContinueError("");
                      }}
                      data-testid="checkbox-qrc-saved"
                    />
                    <span className="qrc-custom-checkbox"><Check size={12} /></span>
                    <span>I have saved my recovery capsule securely.</span>
                  </label>
                )}

                <button
                  className="qrc-continue-button"
                  type="button"
                  onClick={handleContinue}
                  disabled={!downloadInitiated || !confirmed || !savedConfirmed || busy}
                >
                  Continue to Armoreum <ArrowRight size={16} />
                </button>

              </aside>
            </div>
          </>
        )}

        <footer className="qrc-footer">
          <span><span className="qrc-footer-mark">A</span> ARMOREUM <i /> AUTHORIZATION INFRASTRUCTURE</span>
          <span>Recovery stays under your control.</span>
        </footer>
      </div>
    </main>
  );
}

export default QuantumRecoveryCapsule;
