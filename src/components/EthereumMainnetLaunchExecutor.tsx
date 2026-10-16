import { useEffect, useRef, useState } from "react";
import { formatEther, Wallet } from "ethers";
import { ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH, ETHEREUM_FIXED_LAUNCH_DEPOSIT_WEI } from "@workspace/api-zod";
import { Check, CircleAlert, Copy, ExternalLink, LoaderCircle } from "lucide-react";
import type { QrcAuthorizationRecord, QrcPayload } from "../lib/qrc";
import { buildLaunchDetailPath, buildGmgnTokenUrl } from "../lib/post-launch-links";
import { copyTextToClipboard } from "../lib/copy-to-clipboard";
import {
  derivePasswordAuthorizationMaterial,
  derivePasswordAuthorizationProofChains,
  signPasswordAuthorizationDigest,
  type PasswordAuthorizationContext,
} from "../lib/creator-password-authorization";
import { QuantumRecoveryCapsule } from "./QuantumRecoveryCapsule";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import "./ethereum-post-launch-dialog.css";

const DEPOSIT_WEI = ETHEREUM_FIXED_LAUNCH_DEPOSIT_WEI;
const ZERO_ADDRESS = `0x${"00".repeat(20)}`;

export type EthereumMainnetLaunchResult = {
  launchId: string;
  creatorAddress: string;
  creatorVault: string;
  taxRouter: string;
  tokenAddress: string;
  hookAddress: string;
  poolId: string;
  creatorSurplusWei: string;
  creatorJailETHWei: string;
  authorizationEpochRoot: string;
  transactions: Record<string, string>;
};

export type EthereumFundingOrder = {
  depositStatus: string;
  launchStatus: string;
  launchLastStage?: string | null;
  launchTransactions?: Record<string, string>;
  launchResult?: EthereumMainnetLaunchResult | null;
  launchError?: string | null;
  launchOrderId?: string | null;
  requiredDepositWei: string | null;
  depositAddress: string | null;
  depositBalanceWei: string | null;
  depositChainId: number | null;
  depositNetworkName: string | null;
};

type Props = {
  draftId: string;
  authorization: QrcAuthorizationRecord;
  creatorPassword: string;
  tokenName: string;
  tokenSymbol: string;
  fundingOrder: EthereumFundingOrder;
  fundingQrDataUrl: string;
  onCreateFundingOrder: (body?: unknown) => Promise<EthereumFundingOrder>;
  multichainInitialBuyEth?: string;
  hideFundingCard?: boolean;
  hideProgressDetails?: boolean;
  hideLaunchAction?: boolean;
  hideLaunchIntro?: boolean;
  launchTrigger?: number;
  onProgress?: (message: string) => void;
  onExecutionState?: (state: "running" | "failed" | "completed", error?: string) => void;
  canExecute?: boolean;
  deferRecoveryCapsule?: boolean;
  initialResult?: EthereumMainnetLaunchResult | null;
  onLaunched: (result: EthereumMainnetLaunchResult) => void;
  onContinue: () => void;
};

const STAGES = [
  { status: "deposit-confirmed", label: `${ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH creator balance confirmed` },
  { status: "token-deployed", label: "Fixed-supply token deployed", tx: "token" },
  { status: "creator-vault-ready", label: "Password-protected Creator Vault created", tx: "factory" },
  { status: "tax-router-ready", label: "TaxRouter and 0.01 ETH retry threshold verified", tx: "factory" },
  { status: "hook-ready", label: "Uniswap V4 tax hook deployed", tx: "hook" },
  { status: "hook-bound", label: "Hook bound to token; owner control renounced", tx: "bind" },
  { status: "approving-seed", label: "Approve the 1 billion token pool supply", tx: "approve" },
  { status: "pool-seeded", label: "Full supply seeded into the 0.3% V4 pool", tx: "seed" },
  { status: "launched", label: "On-chain setup verified" },
] as const;

const STAGE_ORDER = [
  "verifying", "deploying-token", "token-deployed", "setting-up-vaults",
  "creator-vault-ready", "tax-router-ready", "deploying-hook", "hook-ready",
  "binding-hook", "hook-bound", "approving-seed", "seeding-v4-pool",
  "pool-seeded", "crediting-creator-surplus", "launched",
];

const MULTICHAIN_EXTRA_STAGES = [
  { status: "binding-multichain-token", label: "Token bound to the Multichain launch registry", tx: "bindToken" },
  { status: "reserving-bridge-inventory", label: "Bridge Vault reserve verified", tx: "bridgeReserve" },
  { status: "completing-multichain-launch", label: "Multichain launch registration confirmed", tx: "multichainComplete" },
  { status: "multichain-ethereum-ready", label: "Ethereum pool and launch configuration verified", tx: "multichainComplete" },
];

function formatEth(value: string | null | undefined): string {
  if (!value || !/^\d+$/.test(value)) return "0";
  try {
    return Number(formatEther(BigInt(value))).toLocaleString("en-US", {
      maximumFractionDigits: 6,
    });
  } catch {
    return "0";
  }
}

function hexBytes(value: string): Uint8Array {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[\da-f]+$/i.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("The password authorization material is invalid.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let payload: T & { error?: string };
  try {
    payload = raw ? JSON.parse(raw) as T & { error?: string } : {} as T & { error?: string };
  } catch {
    throw new Error(`Ethereum launch service returned an invalid response (${response.status}).`);
  }
  if (!response.ok) throw new Error(payload.error || `Ethereum launch failed (${response.status}).`);
  if (!raw) throw new Error("Ethereum launch service returned an empty response.");
  return payload;
}

export function EthereumMainnetLaunchExecutor({
  draftId,
  authorization,
  creatorPassword,
  tokenName,
  tokenSymbol,
  fundingOrder,
  fundingQrDataUrl,
  onCreateFundingOrder,
  multichainInitialBuyEth,
  hideFundingCard = false,
  hideProgressDetails = false,
  hideLaunchAction = false,
  hideLaunchIntro = false,
  launchTrigger = 0,
  onProgress,
  onExecutionState,
  canExecute = true,
  deferRecoveryCapsule = false,
  initialResult = null,
  onLaunched,
  onContinue,
}: Props) {
  const base = `/api/launch-drafts/${encodeURIComponent(draftId)}/ethereum-mainnet`;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [fundingError, setFundingError] = useState("");
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingReady, setFundingReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addressCopyError, setAddressCopyError] = useState("");
  const [result, setResult] = useState<EthereumMainnetLaunchResult | null>(initialResult);
  const autoQuoteKey = useRef("");
  const handledLaunchTrigger = useRef(0);
  const launchLock = useRef(false);
  const launchRef = useRef<() => Promise<boolean>>(async () => false);
  function reportProgress(message: string) {
    setProgress(message);
    if (message) onProgress?.(message);
  }

  const funded = fundingOrder.depositStatus === "confirmed" &&
    Boolean(fundingOrder.depositAddress) && Boolean(fundingOrder.requiredDepositWei);
  const hasLaunchProgress = Object.keys(fundingOrder.launchTransactions ?? {}).length > 0;
  const startingBalanceConfirmed = funded &&
    /^\d+$/.test(fundingOrder.depositBalanceWei ?? "") &&
    BigInt(fundingOrder.depositBalanceWei ?? "0") >= BigInt(DEPOSIT_WEI);
  const stageOrder = multichainInitialBuyEth
    ? [
        ...STAGE_ORDER.slice(0, STAGE_ORDER.indexOf("deploying-hook")),
        "binding-multichain-token",
        ...STAGE_ORDER.slice(STAGE_ORDER.indexOf("deploying-hook"), -2),
        ...MULTICHAIN_EXTRA_STAGES.slice(1).map((stage) => stage.status),
        ...STAGE_ORDER.slice(-2),
      ]
    : [...STAGE_ORDER];
  const progressStages: { status: string; label: string; tx?: string }[] = multichainInitialBuyEth
    ? [
        ...STAGES.slice(0, 4),
        MULTICHAIN_EXTRA_STAGES[0],
        ...STAGES.slice(4, 8).map((stage) => ({
          ...stage,
          ...(stage.status === "approving-seed" ? { label: "Approve the remaining pool supply" } : {}),
          ...(stage.status === "pool-seeded" ? { label: "Remaining supply seeded into the 0.3% V4 pool" } : {}),
        })),
        ...MULTICHAIN_EXTRA_STAGES.slice(1),
        STAGES[8],
      ]
    : [...STAGES];
  const activeStatuses = stageOrder.filter((status) => status !== "launched");
  const executing = activeStatuses.includes(fundingOrder.launchStatus);

  useEffect(() => {
    if (initialResult) setResult(initialResult);
  }, [initialResult]);

  async function refreshFunding() {
    if (fundingLoading || result) return null;
    setFundingLoading(true);
    setFundingError("");
    reportProgress("Checking the Ethereum creator wallet balance");
    try {
      const order = await onCreateFundingOrder(
        multichainInitialBuyEth ? { multichainInitialBuyEth } : {},
      );
      setFundingReady(true);
      reportProgress("");
      return order;
    } catch (cause) {
      reportProgress("");
      const message = cause instanceof Error ? cause.message : "Ethereum deposit status could not be checked.";
      setFundingError(message);
      return null;
    } finally {
      setFundingLoading(false);
    }
  }

  useEffect(() => {
    if (initialResult || fundingOrder.launchStatus === "launched") return;
    const key = `${draftId}:${authorization.authorizationSigner.toLowerCase()}:${multichainInitialBuyEth ?? "ethereum-only"}`;
    if (autoQuoteKey.current === key) return;
    autoQuoteKey.current = key;
    void refreshFunding();
  }, [draftId, authorization.authorizationSigner, initialResult, fundingOrder.launchStatus, multichainInitialBuyEth]);

  async function signedAuthorization() {
    const seed = hexBytes(authorization.authorizationSeed);
    const context: PasswordAuthorizationContext = {
      chainId: 1,
      vaultAddress: ZERO_ADDRESS,
      creatorAddress: authorization.creatorAddress,
      launchId: authorization.launchId,
    };
    try {
      const plan = await postJson<{
        creatorVault: string;
        authorizationSigner: string;
        deadline: string;
        nonce: string;
      }>(`${base}/prepare`, {
        authorizationSigner: authorization.authorizationSigner,
        ...(multichainInitialBuyEth ? { multichainInitialBuyEth } : {}),
      });
      context.vaultAddress = plan.creatorVault;
      const material = await derivePasswordAuthorizationMaterial(seed, context);
      if (material.authorizationSigner.toLowerCase() !== plan.authorizationSigner.toLowerCase()) {
        throw new Error("The password proof does not match this Ethereum launch draft.");
      }
      const signingMaterial = {
        ...material,
        authorizationSigner: material.authorizationSigner,
        deadline: plan.deadline,
        nonce: plan.nonce,
        ...(multichainInitialBuyEth ? { multichainInitialBuyEth } : {}),
      };
      const { digest } = await postJson<{ digest: string }>(`${base}/digest`, signingMaterial);
      return {
        request: {
          ...signingMaterial,
          creatorSignature: new Wallet(authorization.creatorPrivateKey)
            .signingKey.sign(digest).serialized,
          passwordSignature: await signPasswordAuthorizationDigest(seed, context, digest),
        },
        authorizationEpochRoot: material.authorizationEpochRoot,
      };
    } finally {
      seed.fill(0);
    }
  }

  async function launch(): Promise<boolean> {
    if (launchLock.current || busy || executing || fundingLoading || !fundingReady || !funded || result || !canExecute) return false;
    launchLock.current = true;
    setBusy(true);
    setError("");
    onExecutionState?.("running");
    reportProgress("Checking password proof, creator authorization, and confirmed Ethereum balance");
    try {
      const auth = await signedAuthorization();
      const currentOrder = await onCreateFundingOrder(
        multichainInitialBuyEth ? { multichainInitialBuyEth } : {},
      );
      if (currentOrder.depositStatus !== "confirmed") {
        throw new Error(`The creator wallet needs at least ${ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH on Ethereum mainnet. No launch transaction was submitted.`);
      }
      reportProgress("Submitting the Ethereum mainnet launch phases");
      const launchResult = await postJson<EthereumMainnetLaunchResult>(
        `${base}/execute`,
        {
          ...auth.request,
          authorizationEpochRoot: auth.authorizationEpochRoot,
          ...(multichainInitialBuyEth ? { multichainInitialBuyEth } : {}),
        },
      );
      if (launchResult.authorizationEpochRoot.toLowerCase() !== auth.authorizationEpochRoot.toLowerCase()) {
        throw new Error("The launch result does not match the password authorization root.");
      }
      setResult(launchResult);
      onLaunched(launchResult);
      onExecutionState?.("completed");
      reportProgress("Ethereum token, vault, tax hook, and V4 pool verified");
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Ethereum mainnet launch failed.";
      reportProgress("");
      setError(message);
      onExecutionState?.("failed", message);
      return false;
    } finally {
      launchLock.current = false;
      setBusy(false);
    }
  }

  launchRef.current = launch;

  useEffect(() => {
    if (!launchTrigger) {
      handledLaunchTrigger.current = 0;
      return;
    }
    if (handledLaunchTrigger.current === launchTrigger || !canExecute ||
      !fundingReady || !funded || fundingLoading || busy || executing || result) return;
    handledLaunchTrigger.current = launchTrigger;
    void launchRef.current();
  }, [
    busy,
    canExecute,
    draftId,
    executing,
    funded,
    fundingLoading,
    fundingOrder.launchStatus,
    fundingReady,
    launchTrigger,
    result,
  ]);

  async function copyAddress() {
    if (!fundingOrder.depositAddress) {
      setAddressCopyError("Creator address is unavailable.");
      return;
    }
    setCopied(false);
    setAddressCopyError("");
    try {
      await copyTextToClipboard(fundingOrder.depositAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setAddressCopyError("Copy failed. Select the creator address above and copy it manually.");
    }
  }

  return (
    <section
      className="launch-progress-section ethereum-mainnet-launch"
      aria-labelledby={hideLaunchIntro ? undefined : "ethereum-executor-heading"}
      aria-label={hideLaunchIntro ? "Ethereum launch progress" : undefined}
    >
      {!hideLaunchIntro && <>
        <h3 id="ethereum-executor-heading">Ethereum mainnet launch</h3>
        <p>
          The fixed {ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH is the total starting balance, not an extra platform fee. Mainnet gas
          comes from this balance. After the launch, any remaining ETH is credited to the token’s
          Creator Vault as backed JailETH.
        </p>
      </>}
      {!hideFundingCard && <section className="pons-funding-card" aria-label="Ethereum launch deposit">
        <h4>Creator wallet balance</h4>
        {fundingLoading && (
          <p role="status"><LoaderCircle size={15} aria-hidden="true" className="spin" /> Checking Ethereum mainnet…</p>
        )}
        {fundingOrder.depositAddress && (
          <div className="review-grid">
            <div>
              <strong>Network</strong>
              <span>Ethereum · chain ID 1</span>
            </div>
            <div>
              <strong>Required starting balance</strong>
              <span>{ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH</span>
            </div>
            <div>
              <strong>Confirmed balance</strong>
              <span>{formatEth(fundingOrder.depositBalanceWei)} ETH</span>
            </div>
            <div className="pons-funding-address">
              <strong>Creator wallet</strong>
              <code>{fundingOrder.depositAddress}</code>
              <button type="button" className="button button-secondary compact" onClick={() => void copyAddress()}>
                {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                {copied ? "Copied" : "Copy address"}
              </button>
              {addressCopyError && <small className="creator-inline-error" role="status">{addressCopyError}</small>}
            </div>
          </div>
        )}
        <p className="pons-funding-explainer">
          A fresh launch needs {ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH in this creator wallet. If resuming after confirmed launch steps,
          top up enough to cover the next gas estimate. Gas is paid by the creator wallet—not by a relayer.
        </p>
        {funded ? (
          <p role="status" className="pons-funding-confirmed"><Check size={16} aria-hidden="true" /> {startingBalanceConfirmed
            ? `${ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH starting balance confirmed.`
            : hasLaunchProgress
              ? "Creator balance available to resume; each next transaction checks its gas requirement."
              : "Creator balance confirmed."}</p>
        ) : (
          <p role="status" className="optional">
            Waiting for at least {ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH. Current confirmed balance: {formatEth(fundingOrder.depositBalanceWei)} ETH.
          </p>
        )}
        {fundingQrDataUrl && fundingOrder.depositAddress && (
          <img className="pons-funding-qr" src={fundingQrDataUrl} alt="QR code for the Ethereum creator wallet" />
        )}
        {(fundingError || !fundingOrder.depositAddress) && (
          <button type="button" className="button button-secondary" disabled={fundingLoading} onClick={() => void refreshFunding()}>
            {fundingOrder.depositAddress ? "Refresh Ethereum balance" : "Check Ethereum creator wallet"}
          </button>
        )}
        {fundingError && <p role="alert" className="creator-inline-error">{fundingError}</p>}
      </section>}
      {!hideFundingCard && fundingError && <p role="alert" className="creator-inline-error">{fundingError}</p>}

      {!hideLaunchAction && <button
        type="button"
        className={`button ${result ? "button-secondary" : "button-primary"} primary-action`}
        aria-busy={busy || executing}
        disabled={!fundingReady || !funded || fundingLoading || busy || executing || Boolean(result) || !canExecute}
        onClick={() => void launch()}
        data-testid="button-ethereum-launch-confirm"
      >
        {busy || executing ? "Launching on Ethereum…" : result ? "Launch completed" :
          error || fundingOrder.launchStatus === "needs-attention" ? "Resume Ethereum launch" : "Confirm and launch on Ethereum"}
      </button>}
      {!hideProgressDetails && error && <p role="alert" className="creator-inline-error pons-launch-error">{error}</p>}
      {!hideProgressDetails && !error && fundingOrder.launchError && <p role="alert" className="creator-inline-error pons-launch-error">{fundingOrder.launchError}</p>}
      {progress && !hideProgressDetails && <p role="status" className="optional pons-launch-progress">{progress}</p>}

      {!hideProgressDetails && <>
        <h3>Ethereum launch phases</h3>
        <p>{tokenName} ({tokenSymbol}) · Uniswap V4 · 0.3% pool fee · {multichainInitialBuyEth ? "Bridge reserve withheld; remaining supply seeded." : "100% of supply seeded."}</p>
      </>}
      {!hideProgressDetails && !funded && !busy && !executing && <p role="status" className="pons-launch-progress">A fresh launch needs {ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH on Ethereum.</p>}
      {!hideProgressDetails && <ol className="pons-launch-stages" aria-label="Ethereum mainnet launch progress">
        {progressStages.map(({ status, label, ...item }) => {
          const currentIndex = stageOrder.indexOf(fundingOrder.launchLastStage ?? "");
          const stageIndex = stageOrder.indexOf(status);
          const stageLabel = status === "deposit-confirmed" && hasLaunchProgress && !startingBalanceConfirmed
            ? "Creator gas balance available to resume"
            : label;
          const done = status === "deposit-confirmed"
            ? funded || currentIndex >= 0 || Boolean(result)
            : Boolean(result) || (stageIndex >= 0 && currentIndex > stageIndex);
          const active = !done && (status === "deposit-confirmed" ? !funded : currentIndex === stageIndex);
          const hash = item.tx ? fundingOrder.launchTransactions?.[item.tx] : undefined;
          return (
            <li key={status} className={done ? "is-done" : active ? "is-active" : ""}>
              <span className="pons-stage-marker" aria-hidden="true">
                {done ? <Check size={14} /> : active && executing ? <LoaderCircle size={14} className="spin" /> : null}
              </span>
              <span>{stageLabel}</span>
              {hash && (
                <a href={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">
                  View transaction <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </li>
          );
        })}
      </ol>}
      {result && !deferRecoveryCapsule && (
        <EthereumPostLaunchRecoveryCapsule
          authorization={authorization}
          creatorPassword={creatorPassword}
          launch={result}
          onContinue={onContinue}
        />
      )}
    </section>
  );
}

function EthereumPostLaunchRecoveryCapsule({
  authorization,
  creatorPassword,
  launch,
  onContinue,
}: {
  authorization: QrcAuthorizationRecord;
  creatorPassword: string;
  launch: EthereumMainnetLaunchResult;
  onContinue: () => void;
}) {
  const [payload, setPayload] = useState<QrcPayload | null>(null);
  const [progress, setProgress] = useState("Preparing the Ethereum recovery capsule");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [canDismiss, setCanDismiss] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    setDialogOpen(true);
    setCanDismiss(false);
    setCopied(false);
    setCopyError("");
  }, [launch.launchId]);

  async function copyTokenAddress() {
    setCopied(false);
    setCopyError("");
    try {
      await copyTextToClipboard(launch.tokenAddress);
      setCopied(true);
      setCopyError("");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError("Copy failed. Select and copy the token address.");
    }
  }

  function continueFromDialog() {
    if (!canDismiss) return;
    onContinue();
    setDialogOpen(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    const seed = hexBytes(authorization.authorizationSeed);
    const context: PasswordAuthorizationContext = {
      chainId: 1,
      vaultAddress: launch.creatorVault,
      creatorAddress: authorization.creatorAddress,
      launchId: authorization.launchId,
    };
    setPayload(null);
    setError("");
    setProgress("Generating the 256 operation and epoch hash chains");
    void derivePasswordAuthorizationProofChains(seed, context, (completed, total) => {
      setProgress(`Generating offline recovery chains · ${completed}/${total}`);
    }, controller.signal)
      .then((derived) => {
        if (controller.signal.aborted) return;
        if (derived.authorizationEpochRoot.toLowerCase() !== launch.authorizationEpochRoot.toLowerCase()) {
          throw new Error("Recovery proof chains do not match the Ethereum launch authorization root.");
        }
        const record: QrcAuthorizationRecord = {
          ...authorization,
          creatorPassword,
          vaultAddress: launch.creatorVault,
          tokenAddress: launch.tokenAddress,
          taxRouterAddress: launch.taxRouter,
          // QRC v2 requires this legacy field; zero means not applicable to a V4 pool launch.
          curveAddress: ZERO_ADDRESS,
          authorizationEpochRoot: launch.authorizationEpochRoot,
          proofChains: derived.chains,
        };
        setPayload({
          format: "armoreum-qrc",
          version: 2,
          protocol: "armoreum.creator.password.authorization.v2",
          authorizations: [record],
        });
        setProgress("Ethereum launch verified. The offline recovery capsule is ready.");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "The recovery capsule could not be prepared.");
          setProgress("");
        }
      })
      .finally(() => seed.fill(0));
    return () => controller.abort();
  }, [authorization, creatorPassword, launch, attempt]);

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (open) {
          setDialogOpen(true);
        }
      }}
    >
      <DialogContent
        className="ethereum-post-launch-dialog"
        hideCloseButton
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        aria-describedby="ethereum-post-launch-description"
      >
        <DialogTitle className="sr-only">Ethereum launch complete and recovery file download</DialogTitle>
        <DialogDescription id="ethereum-post-launch-description" className="sr-only">
          Copy the launched token address, open its GMGN page, and download the recovery capsule before closing.
        </DialogDescription>
        <header className="ethereum-post-launch-header">
          <div className="ethereum-post-launch-heading">
            <span className="ethereum-post-launch-eyebrow"><Check size={14} /> Ethereum launch complete</span>
            <strong>Token address</strong>
            <div className="ethereum-post-launch-address-row">
              <code>{launch.tokenAddress}</code>
              <button type="button" className="ethereum-post-launch-copy" onClick={() => void copyTokenAddress()} aria-label="Copy token address">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            {copyError && <span className="ethereum-post-launch-copy-error" role="alert">{copyError}</span>}
          </div>
          <div className="ethereum-post-launch-header-actions">
            {buildGmgnTokenUrl(launch.tokenAddress) && (
              <a
                className="ethereum-post-launch-dex-link"
                href={buildGmgnTokenUrl(launch.tokenAddress)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GMGN <ExternalLink size={15} />
              </a>
            )}
          </div>
        </header>

        <div className="ethereum-post-launch-body" aria-live="polite">
          {payload ? (
            <QuantumRecoveryCapsule
              payload={payload}
              authorizationAvailable
              onContinue={() => continueFromDialog()}
              onCanDismissChange={setCanDismiss}
              tokenPageLinks={(() => {
                const href = buildLaunchDetailPath("ethereum", authorization.launchId);
                return href ? [{ href, label: "View token page" }] : [];
              })()}
            />
          ) : (
            <section className="launch-progress-section ethereum-post-launch-progress" aria-labelledby="ethereum-recovery-capsule-heading">
              <h3 id="ethereum-recovery-capsule-heading">Prepare the offline recovery capsule</h3>
              <p>The .qrc file contains the creator password, private key, and authorization proof chains. Download it and store it securely before leaving this screen.</p>
              {progress && <p role="status" className="optional"><LoaderCircle size={15} aria-hidden="true" className="spin" /> {progress}</p>}
              {error && <p className="creator-inline-error" role="alert"><CircleAlert size={16} aria-hidden="true" /> {error}</p>}
              {error && <button type="button" className="button button-secondary compact" onClick={() => setAttempt((value) => value + 1)}>Retry recovery capsule</button>}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
