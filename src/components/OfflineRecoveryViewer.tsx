import { useState } from "react";
import { Check, ChevronDown, Copy, Eye, EyeOff, Info, Trash2 } from "lucide-react";
import type { OpenedQrcCapsule } from "../lib/qrc";
import { buildQrcViewerModel, QRC_MISSING_VALUE, type QrcViewerField } from "../lib/qrc-view-model";
import { copyTextToClipboard } from "../lib/copy-to-clipboard";

function RecoveryValue({ field }: { field: QrcViewerField }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const hasValue = field.value !== null;
  const masked = hasValue && field.sensitive && !revealed;

  async function copyValue() {
    if (field.value === null) return;
    setCopyError("");
    setCopied(false);
    try {
      await copyTextToClipboard(field.value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError("Clipboard access is unavailable. Reveal the value and copy it manually.");
    }
  }

  return (
    <div className="offline-viewer-field">
      <dt>{field.label}</dt>
      <dd>
        <code className={hasValue ? "offline-viewer-value" : "offline-viewer-missing"}>
          {masked ? "••••••••••••••••" : field.value ?? QRC_MISSING_VALUE}
        </code>
        {hasValue && (
          <div className="offline-value-actions">
            {field.sensitive && (
              <button type="button" aria-pressed={revealed} aria-label={`${revealed ? "Hide" : "Reveal"} ${field.label}`} onClick={() => setRevealed(!revealed)}>
                {revealed ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                {revealed ? "Hide" : "Reveal"}
              </button>
            )}
            <button type="button" aria-label={`Copy ${field.label}`} onClick={() => void copyValue()}>
              {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        {copyError && <p className="offline-copy-error" role="status">{copyError}</p>}
      </dd>
    </div>
  );
}

function FieldList({ fields }: { fields: QrcViewerField[] }) {
  return <dl className="offline-viewer-fields">{fields.map((field) => <RecoveryValue key={field.id} field={field} />)}</dl>;
}

function ProofChainGroup({ chain }: {
  chain: ReturnType<typeof buildQrcViewerModel>["records"][number]["proofChains"][number];
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="offline-viewer-proof-chain">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{chain.operation} · Epoch {chain.epoch} · H100–H0</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && <FieldList fields={chain.fields} />}
    </section>
  );
}

export function OfflineRecoveryViewer({ capsule, fileName, onClear }: {
  capsule: OpenedQrcCapsule;
  fileName: string;
  onClear: () => void;
}) {
  const model = buildQrcViewerModel(capsule);
  return (
    <div className="offline-capsule-viewer" data-testid="qrc-contents-viewer">
      <p className="offline-success-copy">{fileName} was opened locally. No password, account login, or server verification was used.</p>
      <div className="offline-file-risk" role="note">
        <Info size={17} aria-hidden="true" />
        <p>This file grants access to its recovery material. Anyone possessing it can read its contents. Revealing or copying a secret exposes it on this device and may leave it in the clipboard.</p>
      </div>
      {model.records.map((record) => (
        <div className="offline-viewer-record" key={record.id}>
          <h2>{record.network}</h2>
          <details className="offline-viewer-section" open>
            <summary>Creator Credentials</summary>
            <FieldList fields={record.credentials} />
          </details>
          <details className="offline-viewer-section" open>
            <summary>Hash-Chain Authorization</summary>
            <FieldList fields={record.authorization} />
            {record.proofChains.length > 0 ? (
              <div className="offline-viewer-proof-chains">
                <h3>Stored one-time proof chains</h3>
                <p className="offline-viewer-note">These are stored H100 commitments and H99–H0 proofs for each authorization action and epoch. The live on-chain usage counter is not stored and can change after this file is created.</p>
                {record.proofChains.map((chain) => <ProofChainGroup key={chain.id} chain={chain} />)}
              </div>
            ) : (
              <p className="offline-viewer-note">This older capsule predates stored password and H100–H0 proof chains.</p>
            )}
          </details>
          <details className="offline-viewer-section" open>
            <summary>Account Metadata</summary>
            <FieldList fields={record.metadata} />
          </details>
        </div>
      ))}
      <details className="offline-viewer-section" open>
        <summary>Capsule Metadata</summary>
        <FieldList fields={model.capsuleFields} />
        <p className="offline-viewer-note">The checksum detects accidental corruption; it does not authenticate the file or prevent deliberate modification.</p>
      </details>
      <div className="offline-action-row">
        <button type="button" className="offline-button offline-button-secondary" onClick={onClear} data-testid="clear-recovery-data">
          <Trash2 size={17} aria-hidden="true" /> Clear Recovery Data
        </button>
      </div>
      <p className="offline-viewer-note">Clearing removes the file reference and parsed data from this viewer. It does not erase the downloaded file or any secrets you copied to the clipboard.</p>
    </div>
  );
}
