import { createElement, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import type { Root } from "react-dom/client";
import {
  ArrowRight,
  Check,
  CircleAlert,
  FileLock2,
  Info,
  LoaderCircle,
  ShieldCheck,
  Upload,
  WifiOff,
} from "lucide-react";
import type { OpenedQrcCapsule } from "@/lib/qrc";
import { openQrcCapsule, QRC_PARAMETERS, QrcOpenError } from "@/lib/qrc";
import { OfflineRecoveryViewer } from "@/components/OfflineRecoveryViewer";
import {
  canEnterOfflineRecovery,
  prepareOfflineRecoveryCache,
  verifyOfflineRecoveryCache,
  type RecoveryCacheStatus,
  type RecoveryNetworkStatus,
} from "@/lib/offline-recovery-cache";

import "./offline-recovery.css";

const formatBytes = (bytes: number) => bytes < 1024
  ? `${bytes} bytes`
  : `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;

function readNetworkStatus(): RecoveryNetworkStatus {
  if (typeof navigator.onLine !== "boolean") return "unknown";
  return navigator.onLine ? "online" : "offline";
}

function OfflineRecoveryApp() {
  const [networkStatus, setNetworkStatus] = useState<RecoveryNetworkStatus>(readNetworkStatus);
  const [cacheStatus, setCacheStatus] = useState<RecoveryCacheStatus>({
    ready: false,
    verifiedAssetCount: 0,
    missingAssetCount: 0,
    source: "none",
  });
  const [checkingAssets, setCheckingAssets] = useState(true);
  const [cacheError, setCacheError] = useState("");
  const [localChecksReady, setLocalChecksReady] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [entered, setEntered] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveredCapsule, setRecoveredCapsule] = useState<OpenedQrcCapsule | null>(null);
  const payloadRef = useRef<OpenedQrcCapsule | null>(null);
  const readGenerationRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const dialogHeadingRef = useRef<HTMLHeadingElement>(null);

  const refreshCache = async () => {
    setCheckingAssets(true);
    setCacheError("");
    try {
      const result = await prepareOfflineRecoveryCache();
      setCacheStatus(result);
      if (!result.ready) {
        setCacheError(networkStatus === "offline"
          ? "The offline files are incomplete. Reconnect, load this page again, and verify the cache before disconnecting."
          : "Not every recovery file could be verified. Keep this device online and retry.");
      }
    } catch {
      const existing = await verifyOfflineRecoveryCache().catch(() => ({
        ready: false,
        verifiedAssetCount: 0,
        missingAssetCount: 0,
        source: "none" as const,
      }));
      setCacheStatus(existing);
      setCacheError(existing.ready
        ? ""
        : "The offline files could not be prepared. Keep this device online and retry.");
    } finally {
      setCheckingAssets(false);
    }
  };

  useEffect(() => {
    const onOnline = () => setNetworkStatus("online");
    const onOffline = () => setNetworkStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    setLocalChecksReady(
      Boolean(
        window.isSecureContext
        && globalThis.crypto?.subtle
        && Boolean(globalThis.crypto)
        && "File" in window
        && "TextEncoder" in window
        && "serviceWorker" in navigator
        && "caches" in window,
      ),
    );
    void refreshCache();
  }, []);

  useEffect(() => {
    if (!cacheStatus.ready) return;
    dialogHeadingRef.current?.focus();
  }, [cacheStatus.ready]);

  useEffect(() => {
    if (!entered) return;
    if (networkStatus === "online") {
      clearRecoveryData();
      setEntered(false);
      setAcknowledged(false);
      setError("The browser now reports an online connection. Recovery data was cleared. Disconnect again before opening a file.");
    }
  }, [entered, networkStatus]);

  useEffect(() => {
    const clearSensitiveReferences = () => {
      readGenerationRef.current += 1;
      payloadRef.current = null;
      flushSync(() => {
        setRecoveredCapsule(null);
        setSelectedFile(null);
        setBusy(false);
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    window.addEventListener("pagehide", clearSensitiveReferences);
    return () => {
      window.removeEventListener("pagehide", clearSensitiveReferences);
      readGenerationRef.current += 1;
      payloadRef.current = null;
    };
  }, []);

  const mayContinue = canEnterOfflineRecovery({
    assetsReady: cacheStatus.ready && !checkingAssets,
    networkStatus,
    acknowledged,
    localChecksReady,
  });

  function focusTrap(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [href], [tabindex="0"]',
      ) ?? [],
    ).filter((element) => element.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function acceptFile(file?: File) {
    if (busy) return;
    clearRecoveryData();
    if (!file) return;
    if (networkStatus !== "offline" || !cacheStatus.ready || !localChecksReady) {
      setError("The recovery file opens only after the offline tool is ready and the browser reports no network connection.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".qrc") || file.size < 1 || file.size > QRC_PARAMETERS.maxFileBytes) {
      setError("Choose a valid Armoreum .qrc file no larger than 4 MB.");
      return;
    }
    setSelectedFile(file);
    void openCapsuleLocally(file);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length) acceptFile(event.dataTransfer.files[0]);
  }

  async function openCapsuleLocally(file: File) {
    if (busy || networkStatus !== "offline" || !cacheStatus.ready || !localChecksReady) return;
    if (file.size > QRC_PARAMETERS.maxFileBytes) {
      setError("The recovery file exceeds the 4 MB limit.");
      return;
    }
    setBusy(true);
    setError("");
    const generation = ++readGenerationRef.current;
    let bytes: Uint8Array | null = null;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      const capsule = await openQrcCapsule(bytes);
      if (generation !== readGenerationRef.current) return;
      if (readNetworkStatus() !== "offline") {
        throw new Error("network-state-changed");
      }
      payloadRef.current = capsule;
      setRecoveredCapsule(capsule);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (cause) {
      if (generation !== readGenerationRef.current) return;
      if (cause instanceof QrcOpenError && cause.code === "PASSWORD_PROTECTED_LEGACY") {
        setError("This QRC v1 file is password-encrypted. File-only recovery cannot open or convert it. This tool requires a QRC v2 or v3 file.");
      } else if (cause instanceof Error && cause.message === "network-state-changed") {
        setError("The browser now reports an online connection. The recovery file was not opened.");
      } else {
        setError(cause instanceof Error ? cause.message : "Unable to open this QRC file locally. Check the file and try again.");
      }
    } finally {
      bytes?.fill(0);
      if (generation === readGenerationRef.current) setBusy(false);
    }
  }

  function clearRecoveryData() {
    readGenerationRef.current += 1;
    payloadRef.current = null;
    setRecoveredCapsule(null);
    setSelectedFile(null);
    setBusy(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const networkLabel = networkStatus === "offline"
    ? "Browser reports offline"
    : networkStatus === "online"
      ? "Browser reports online"
      : "Network status unknown";

  return (
    <div className="offline-recovery-page">
      <header className="offline-recovery-header">
        <div className="offline-brand">
          <span className="offline-brand-mark" aria-hidden="true"><ShieldCheck size={20} /></span>
          <span className="offline-brand-word">armoreum</span>
        </div>
        <span className="offline-tool-label">OFFLINE RECOVERY TOOL</span>
        <span className="offline-local-indicator"><span />LOCAL PROCESSING</span>
      </header>

      {checkingAssets && !cacheStatus.ready ? (
        <main className="offline-loading-state" aria-live="polite">
          <LoaderCircle className="offline-loading-icon" size={28} aria-hidden="true" />
          <p className="offline-eyebrow">PREPARING THIS DEVICE</p>
          <h1>Checking offline recovery files</h1>
          <p>Armoreum is caching and verifying the recovery page and its required local code before opening the instructions.</p>
        </main>
      ) : !cacheStatus.ready ? (
        <main className="offline-loading-state">
          <CircleAlert size={28} aria-hidden="true" />
          <p className="offline-eyebrow">RECOVERY TOOL LOCKED</p>
          <h1>Offline files are not ready</h1>
          <p>{cacheError || "Reconnect to the internet, load the complete recovery page, and verify its local cache before disconnecting."}</p>
          {networkStatus === "online" && <button type="button" className="offline-button offline-button-secondary" onClick={() => void refreshCache()} disabled={checkingAssets}>
            {checkingAssets ? "Checking files…" : "Retry offline cache check"}
          </button>}
        </main>
      ) : (
        <>
          <main className="offline-recovery-content" aria-hidden={!entered}>
            {!entered ? (
              <section className="offline-loading-state">
                <FileLock2 size={28} aria-hidden="true" />
                <p className="offline-eyebrow">LOCAL CAPSULE RECOVERY</p>
                <h1>Recover Your Capsule</h1>
                <p>The offline assets are verified. Follow the instructions before opening the recovery controls.</p>
              </section>
            ) : recoveredCapsule ? (
              <section className="offline-tool-card" aria-labelledby="recovery-success-heading">
                <div className="offline-tool-heading">
                  <span className="offline-section-icon"><Check size={19} aria-hidden="true" /></span>
                  <div><p className="offline-eyebrow">LOCAL CAPSULE CONTENTS</p><h1 id="recovery-success-heading">Recovery Capsule Viewer</h1></div>
                </div>
                <OfflineRecoveryViewer capsule={recoveredCapsule} fileName={selectedFile?.name || "Recovery capsule"} onClear={clearRecoveryData} />
              </section>
            ) : (
              <section className="offline-tool-card" aria-labelledby="recovery-title">
                <div className="offline-tool-heading">
                  <span className="offline-section-icon"><FileLock2 size={20} aria-hidden="true" /></span>
                  <div><p className="offline-eyebrow">LOCAL PROCESSING</p><h1 id="recovery-title">Recover Your Capsule</h1></div>
                </div>
                <p className="offline-subtitle">Select a QRC file to open and validate it locally on this device. No password is requested.</p>
                <div className="offline-network-chip"><WifiOff size={15} aria-hidden="true" />{networkLabel}</div>
                {networkStatus !== "offline" && <p className="offline-inline-warning" role="alert">Disconnect this device before selecting a recovery file.</p>}
                <div className="offline-file-risk" role="note">
                  <CircleAlert size={17} aria-hidden="true" />
                  <p>QRC (Quantum Recovery Capsule) is an offline recovery file containing your launch password, creator private key, authorization seed, and hash-based H100–H0 proof chains. These cryptographic materials support Armoreum’s hash-based transaction authorization system. Anyone with access to the file can read its contents and control the creator wallet. Keep it offline, secure, and never share it.</p>
                </div>
                <button
                  type="button"
                  className={`offline-file-drop ${selectedFile ? "has-file" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  aria-label="Choose or drop an Armoreum QRC recovery file"
                  disabled={networkStatus !== "offline" || busy}
                >
                  {busy ? <LoaderCircle className="offline-loading-icon" size={22} aria-hidden="true" /> : selectedFile ? <FileLock2 size={22} aria-hidden="true" /> : <Upload size={22} aria-hidden="true" />}
                  <strong>{busy ? "Opening recovery file locally…" : selectedFile ? selectedFile.name : "Choose or drop a .qrc file"}</strong>
                  <span>{selectedFile ? `${formatBytes(selectedFile.size)} · stored in this page only` : "Selecting a file opens it automatically"}</span>
                </button>
                <input
                  ref={fileInputRef}
                  className="offline-visually-hidden"
                  type="file"
                  accept=".qrc,application/octet-stream"
                  aria-label="Select Armoreum recovery capsule"
                  disabled={networkStatus !== "offline" || busy}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    acceptFile(file);
                  }}
                />
                {error && <p className="offline-inline-error" role="alert"><CircleAlert size={15} aria-hidden="true" />{error}</p>}
                {selectedFile && <button type="button" className="offline-button offline-button-secondary" onClick={clearRecoveryData}>Clear Recovery Data</button>}
                <p className="offline-no-upload"><ShieldCheck size={15} aria-hidden="true" />The file and opened contents stay in this page's memory. No upload is made.</p>
              </section>
            )}
          </main>

          {!entered && (
            <div className="offline-modal-backdrop">
              <section
                ref={dialogRef}
                className="offline-notice-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="offline-notice-title"
                aria-describedby="offline-notice-description"
                onKeyDown={focusTrap}
              >
                <div className="offline-modal-icon"><WifiOff size={22} aria-hidden="true" /></div>
                <p className="offline-eyebrow">RECOVERY SESSION PRECHECK</p>
                <h2 id="offline-notice-title" ref={dialogHeadingRef} tabIndex={-1}>Disconnect From the Internet</h2>
                <p id="offline-notice-description" className="offline-modal-intro">For maximum isolation, disconnect this device from Wi-Fi, cellular data, Ethernet, and any other network before opening your recovery file.</p>
                {networkStatus !== "offline" && <p className="offline-state-warning" role="status">This page stays locked until your browser reports that the device is offline. Turn off Wi-Fi, cellular data, and Ethernet yourself; Armoreum cannot disable them.</p>}
                <div className="offline-instructions">
                  <h3>How to go offline</h3>
                  <ol>
                    <li>Turn on Airplane Mode on your phone, if available.</li>
                    <li>Turn off Wi-Fi and mobile data separately if your device keeps either enabled.</li>
                    <li>On desktop, disconnect Wi-Fi and unplug Ethernet if connected.</li>
                    <li>Confirm that your device is disconnected from the network.</li>
                    <li>Return to this tool and continue.</li>
                  </ol>
                </div>
                <div className="offline-security-note">
                  <Info size={17} aria-hidden="true" />
                  <p>Offline mode reduces network exposure. A browser's offline indicator cannot prove that every network interface is disabled or that a device is malware-free. Continue only on a device you trust.</p>
                </div>
                {!localChecksReady && <p className="offline-inline-error" role="alert">This browser does not support all local recovery requirements. The file will not be opened through a server fallback.</p>}
                <label className="offline-acknowledgement">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    disabled={!cacheStatus.ready || !localChecksReady}
                  />
                  <span>I have disconnected this device from the internet and understand the instructions.</span>
                </label>
                <button type="button" className="offline-button offline-button-primary" disabled={!mayContinue} onClick={() => {
                  setEntered(true);
                  setError("");
                }}>
                  Continue to Offline Recovery <ArrowRight size={17} aria-hidden="true" />
                </button>
              </section>
            </div>
          )}
        </>
      )}

      <footer className="offline-recovery-footer">
        <span><ShieldCheck size={14} aria-hidden="true" /> No secret leaves this page while the file is opened locally.</span>
        <span>{networkLabel}</span>
      </footer>
    </div>
  );
}

export function mountOfflineRecovery(root: Root) {
  let preference = "";
  try {
    preference = localStorage.getItem("armoreum-theme-preference") || "";
  } catch {
    preference = "";
  }
  const hour = new Date().getHours();
  const theme = preference === "light" || preference === "dark"
    ? preference
    : hour >= 6 && hour < 18 ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference || "system-auto-time";
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f1f3ef" : "#071116");
  root.render(createElement(OfflineRecoveryApp));
}
