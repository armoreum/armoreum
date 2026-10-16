import { useState } from "react";
import { keccak256, toUtf8Bytes } from "ethers";
import { PONS_REQUIRED_CREATOR_DEPOSIT_ETH } from "@workspace/api-zod";
import {
  deriveCreatorPasswordKdf,
  derivePasswordAuthorizationSigner,
  CreatorWalletMismatchError,
  requestCreatorAuthorizationSeed,
  validateCreatorAuthorizationPassword,
} from "../lib/creator-password-authorization";
import type { QrcAuthorizationRecord } from "../lib/qrc";

const EMPTY_VAULT = `0x${"00".repeat(20)}`;

interface PasswordCreatorAuthorizationSetupProps {
  draftId: string;
  onReady: (authorization: QrcAuthorizationRecord, password: string) => void;
  canStartNewDraft: boolean;
  startingNewDraft: boolean;
  onStartNewDraft: () => Promise<void>;
}

function asHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function PasswordCreatorAuthorizationSetup({
  draftId,
  onReady,
  canStartNewDraft,
  startingNewDraft,
  onStartNewDraft,
}: PasswordCreatorAuthorizationSetupProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [preparedAddress, setPreparedAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [walletMismatch, setWalletMismatch] = useState(false);

  async function prepareAuthorization() {
    if (busy || !draftId) return;
    setError("");
    try {
      validateCreatorAuthorizationPassword(password);
      if (password !== confirmation) throw new Error("The passwords do not match.");
      setBusy(true);
      const launchId = keccak256(toUtf8Bytes(`armoreum-launch:${draftId}`));
      const passwordKdf = await deriveCreatorPasswordKdf(password, launchId);
      let recovery;
      try {
        recovery = await requestCreatorAuthorizationSeed(draftId, passwordKdf);
      } finally {
        passwordKdf.fill(0);
      }
      if (recovery.launchId.toLowerCase() !== launchId.toLowerCase()) {
        recovery.seed.fill(0);
        throw new Error("The server returned a different launch authorization.");
      }
      const context = {
        chainId: 4663,
        vaultAddress: EMPTY_VAULT,
        creatorAddress: recovery.creatorAddress,
        launchId,
      };
      const authorizationSigner = await derivePasswordAuthorizationSigner(recovery.seed, context);
      const authorization: QrcAuthorizationRecord = {
        chainId: 4663,
        launchId,
        creatorAddress: recovery.creatorAddress,
        vaultAddress: null,
        authorizationSigner,
        creatorPrivateKey: recovery.creatorPrivateKey,
        serverKeyId: recovery.serverKeyId,
        authorizationSeed: asHex(recovery.seed),
      };
      recovery.seed.fill(0);
      setPreparedAddress(recovery.creatorAddress);
      setPassword("");
      setConfirmation("");
      onReady(authorization, password);
    } catch (cause) {
      if (cause instanceof CreatorWalletMismatchError) {
        setWalletMismatch(true);
        setError(
          "This saved draft is tied to a different creator wallet. The existing draft was left unchanged.",
        );
      } else {
        setWalletMismatch(false);
        setError(cause instanceof Error ? cause.message : "Password authorization could not be prepared.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (preparedAddress) {
    return (
      <section className="launch-progress-section" aria-live="polite">
        <h3>Password authorization prepared</h3>
        <p>
          Your creator wallet is ready. The recovery capsule will be prepared after the token launch
          has been confirmed.
        </p>
        <p className="optional">
          Keep this page open until the launch completes and you download the capsule. The password
          remains only in page memory until then; it is not sent to or stored by the server.
        </p>
      </section>
    );
  }

  return (
    <section className="launch-progress-section" aria-labelledby="creator-password-heading">
      <h3 id="creator-password-heading">Create Pons V2 creator password</h3>
      <p>
        One generated creator wallet will sign on Robinhood Chain. Fund it with {PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH on
        Robinhood Chain.
      </p>
      <p className="optional">
        Use at least 6 characters with letters and numbers; there is no maximum length. After launch,
        download the .qrc recovery file containing this password, the creator private key, and the
        H100–H0 authorization proof chains.
      </p>
      <label>
        Password
        <input
          type="password"
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          data-testid="input-creator-password"
        />
      </label>
      <label>
        Confirm password
        <input
          type="password"
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          data-testid="input-creator-password-confirm"
        />
      </label>
      {error && <p className="creator-inline-error" role="alert">{error}</p>}
      <button
        className="button button-primary"
        type="button"
        disabled={busy || startingNewDraft || !draftId || !password || !confirmation}
        onClick={() => void prepareAuthorization()}
        data-testid="button-prepare-creator-password"
      >
        {busy ? "Preparing creator authorization…" : "Prepare password authorization"}
      </button>
      {walletMismatch && canStartNewDraft && (
        <div className="launch-progress-section">
          <p>
            Start a fresh password-first draft using these saved token details. The old draft and
            its creator wallet will remain unchanged.
          </p>
          <button
            className="button button-secondary"
            type="button"
            disabled={busy || startingNewDraft}
            onClick={() => void onStartNewDraft()}
            data-testid="button-start-password-first-draft"
          >
            {startingNewDraft ? "Preparing a fresh draft…" : "Start new password-first draft"}
          </button>
        </div>
      )}
      {walletMismatch && !canStartNewDraft && (
        <p className="optional" role="status">
          This draft has a funding or launch record, so it cannot be replaced from this screen.
        </p>
      )}
    </section>
  );
}
