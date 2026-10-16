import { useEffect, useRef, useState } from "react";
import { formatEther, Wallet } from "ethers";
import { Check, CircleAlert, Copy, ExternalLink, LoaderCircle } from "lucide-react";
import { PONS_REQUIRED_CREATOR_DEPOSIT_ETH, PONS_REQUIRED_CREATOR_DEPOSIT_WEI } from "@workspace/api-zod";
import type { QrcAuthorizationRecord, QrcPayload } from "../lib/qrc";
import { buildLaunchDetailPath } from "../lib/post-launch-links";
import { copyTextToClipboard } from "../lib/copy-to-clipboard";
import {
  derivePasswordAuthorizationProofChains,
  derivePasswordAuthorizationMaterial,
  signPasswordAuthorizationDigest,
  type PasswordAuthorizationContext,
} from "../lib/creator-password-authorization";
import { QuantumRecoveryCapsule } from "./QuantumRecoveryCapsule";

type Props = {
  draftId: string;
  authorization: QrcAuthorizationRecord;
  tokenName: string;
  tokenSymbol: string;
  fundingOrder: PonsFundingOrder;
  fundingQrDataUrl: string;
  onCreateFundingOrder: (body: unknown) => Promise<PonsFundingOrder>;
  multichainInitialBuyEth?: string;
  canExecute?: boolean;
  launchTrigger?: number;
  hideLaunchAction?: boolean;
  hideFundingCard?: boolean;
  hideProgressDetails?: boolean;
  hideLaunchIntro?: boolean;
  onProgress?: (message: string) => void;
  onExecutionState?: (state: "running" | "failed" | "completed", error?: string) => void;
  initialResult?: PonsMainnetLaunchResult | null;
  onLaunched: (result: PonsMainnetLaunchResult) => void;
};

const FIXED_LAUNCH_DEPOSIT_WEI = PONS_REQUIRED_CREATOR_DEPOSIT_WEI;

export type PonsMainnetLaunchResult = {
  tokenAddress: string;
  creatorVault: string;
  taxRouter: string;
  bridgeVault?: string;
  curveAddress: string;
  authorizationEpochRoot: string;
  creatorSurplusWei?: string;
  creatorJailETHWei?: string;
  transactions: Record<string, string | undefined>;
};

export type PonsFundingOrder = {
  depositStatus: string;
  launchStatus: string;
  launchLastStage?: string | null;
  launchTransactions?: Record<string, string>;
  launchResult?: PonsMainnetLaunchResult | null;
  launchError?: string | null;
  launchOrderId?: string | null;
  requiredDepositWei: string | null;
  depositAddress: string | null;
  depositBalanceWei: string | null;
  depositChainId: number | null;
  depositNetworkName: string | null;
};

const LAUNCH_STAGES = [
  { status: "deposit-confirmed", label: "Deposit confirmed" },
  { status: "creator-authorization-initialized", label: "Creator authorization initialized", tx: "factory" },
  { status: "creator-vault-ready", label: "Creator Vault verified", tx: "factory" },
  { status: "tax-router-ready", label: "TaxRouter verified before Pons", tx: "factory" },
  { status: "launching-pons-token", label: "Pons launch submitted", tx: "pons" },
  { status: "pons-launch-confirmed", label: "Pons launch confirmed", tx: "pons" },
  { status: "token-binding-confirmed", label: "Token binding confirmed", tx: "bind" },
  { status: "launch-registration-confirmed", label: "Launch registration confirmed", tx: "complete" },
  { status: "surplus-processing-confirmed", label: "Creator surplus processed", tx: "surplus" },
  { status: "jail-eth-accounting-verified", label: "JailETH backing verified", tx: "surplus" },
] as const;
const STAGE_SEQUENCE = [
  "setting-up-vaults", "creator-authorization-initialized", "creator-vault-ready",
  "tax-router-ready", "launching-pons-token", "pons-launch-confirmed",
  "binding-tax-router", "token-binding-confirmed", "completing-launch",
  "launch-registration-confirmed", "onchain-verification-confirmed",
  "crediting-creator-surplus", "surplus-processing-confirmed",
  "jail-eth-accounting-verified", "launched",
];

function formatEth(wei: string | null | undefined): string {
  if (!wei || !/^\d+$/.test(wei)) return "—";
  try {
    return formatEther(BigInt(wei));
  } catch {
    return "—";
  }
}

function hexBytes(value: string): Uint8Array {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[\da-f]+$/i.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("The recovery capsule authorization data is invalid.");
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
  let result: T & { error?: string };
  try {
    result = raw ? JSON.parse(raw) as T & { error?: string } : {} as T & { error?: string };
  } catch {
    throw new Error(`The launch service returned an invalid response (${response.status}).`);
  }
  if (!response.ok) throw new Error(result.error || `Mainnet launch request failed (${response.status}).`);
  if (!raw) throw new Error("The launch service returned an empty response.");
  return result;
}

export function PonsMainnetLaunchExecutor({
  draftId,
  authorization,
  tokenName,
  tokenSymbol,
  fundingOrder,
  fundingQrDataUrl,
  onCreateFundingOrder,
  multichainInitialBuyEth,
  canExecute = true,
  launchTrigger = 0,
  hideLaunchAction = false,
  hideFundingCard = false,
  hideProgressDetails = false,
  hideLaunchIntro = false,
  onProgress,
  onExecutionState,
  initialResult = null,
  onLaunched,
}: Props) {
  const [depositAddressCopied, setDepositAddressCopied] = useState(false);
  const [depositAddressCopyError, setDepositAddressCopyError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [fundingQuoteLoading, setFundingQuoteLoading] = useState(false);
  const [fundingQuoteError, setFundingQuoteError] = useState("");
  const [result, setResult] = useState<PonsMainnetLaunchResult | null>(initialResult);
  const autoQuoteKey = useRef("");
  const launchLock = useRef(false);
  const launchRef = useRef<() => Promise<boolean>>(async () => false);
  const handledLaunchTrigger = useRef(0);
  const [fundingOrderReady, setFundingOrderReady] = useState(false);
  function reportProgress(message: string) {
    setProgress(message);
    if (message) onProgress?.(message);
  }
  const fundingConfirmed =
    fundingOrder.depositStatus === "confirmed" &&
    Boolean(fundingOrder.depositAddress) &&
    Boolean(fundingOrder.requiredDepositWei);
  const executionActive = [
    "verifying", ...STAGE_SEQUENCE.filter((stage) => stage !== "launched"),
  ].includes(fundingOrder.launchStatus);

  useEffect(() => {
    if (initialResult) setResult(initialResult);
  }, [initialResult]);

  useEffect(() => {
    if (initialResult || fundingOrder.launchStatus === "launched") return;
    const key = `${draftId}:${authorization.authorizationSigner.toLowerCase()}:${multichainInitialBuyEth ?? "pons-only"}`;
    if (autoQuoteKey.current === key) return;
    autoQuoteKey.current = key;
    void refreshFundingQuote();
  }, [draftId, authorization.authorizationSigner, multichainInitialBuyEth]);

  async function buildSignedAuthorization() {
    const seed = hexBytes(authorization.authorizationSeed);
    try {
      const base = `/api/launch-drafts/${encodeURIComponent(draftId)}/pons-mainnet`;
      const plan = await postJson<{
        creatorVault: string;
        authorizationSigner: string;
        deadline: string;
        nonce: string;
        launchFeeWei: string;
      }>(`${base}/prepare`, {
        authorizationSigner: authorization.authorizationSigner,
        ...(multichainInitialBuyEth ? { multichainInitialBuyEth } : {}),
      });
      const context: PasswordAuthorizationContext = {
        chainId: 4663,
        vaultAddress: plan.creatorVault,
        creatorAddress: authorization.creatorAddress,
        launchId: authorization.launchId,
      };
      const material = await derivePasswordAuthorizationMaterial(seed, context);
      if (material.authorizationSigner.toLowerCase() !== plan.authorizationSigner.toLowerCase()) {
        throw new Error("The recovery capsule does not match this launch draft.");
      }
      const signingMaterial = {
        ...material,
        authorizationSigner: material.authorizationSigner,
        deadline: plan.deadline,
        nonce: plan.nonce,
        ...(multichainInitialBuyEth ? { multichainInitialBuyEth } : {}),
      };
      const digest = await postJson<{ digest: string }>(`${base}/digest`, signingMaterial);
      const creatorSignature = new Wallet(authorization.creatorPrivateKey)
        .signingKey.sign(digest.digest).serialized;
      const passwordSignature = await signPasswordAuthorizationDigest(seed, context, digest.digest);
      return {
        base,
        authorizationEpochRoot: material.authorizationEpochRoot,
        request: {
          ...signingMaterial,
          creatorSignature,
          passwordSignature,
        },
      };
    } finally {
      seed.fill(0);
    }
  }

  async function refreshFundingQuote(): Promise<PonsFundingOrder | null> {
    if (fundingQuoteLoading) return null;
    setFundingQuoteLoading(true);
    setFundingQuoteError("");
    setFundingOrderReady(false);
    reportProgress(`Preparing the fixed ${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH creator-wallet deposit`);
    try {
      const order = await onCreateFundingOrder(
        multichainInitialBuyEth ? { multichainInitialBuyEth } : {},
      );
      setFundingOrderReady(true);
      setFundingQuoteError("");
      reportProgress("");
      return order;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Robinhood funding quote could not be prepared.";
      setFundingQuoteError(message);
      reportProgress("");
      return null;
    } finally {
      setFundingQuoteLoading(false);
    }
  }

  async function launch(): Promise<boolean> {
    if (launchLock.current || busy || executionActive || fundingQuoteLoading || !fundingConfirmed || !canExecute || result) return false;
    launchLock.current = true;
    setBusy(true);
    setError("");
    onExecutionState?.("running");
    reportProgress("Checking creator authorization and current balance");
    try {
      const authorizationRequest = await buildSignedAuthorization();
      const latestOrder = await onCreateFundingOrder(
        multichainInitialBuyEth ? { multichainInitialBuyEth } : {},
      );
      if (latestOrder.depositStatus !== "confirmed") {
        throw new Error(
          `The creator wallet does not yet have the fixed deposit and current minimum balance of ${formatEth(latestOrder.requiredDepositWei)} ETH. ` +
          "No launch transaction was submitted.",
        );
      }
      reportProgress(multichainInitialBuyEth
        ? "Launching on Pons and buying Bridge Vault inventory"
        : "Submitting creator-funded Robinhood launch transactions");
      const launchResult = await postJson<PonsMainnetLaunchResult>(
        `${authorizationRequest.base}/execute`,
        authorizationRequest.request,
      );
      if (launchResult.authorizationEpochRoot.toLowerCase() !== authorizationRequest.authorizationEpochRoot.toLowerCase()) {
        throw new Error("The completed launch does not match this password authorization.");
      }
      const completedResult = launchResult;
      setResult(completedResult);
      onLaunched(completedResult);
      onExecutionState?.("completed");
      reportProgress(multichainInitialBuyEth
        ? "Pons launch and Bridge Vault reserve verified"
        : "Launch and on-chain routing verified");
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Robinhood mainnet launch failed.";
      setError(message);
      onExecutionState?.("failed", message);
      reportProgress("");
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
    if (handledLaunchTrigger.current === launchTrigger ||
      !canExecute || !fundingOrderReady || !fundingConfirmed || fundingQuoteLoading ||
      busy || executionActive || result) return;
    handledLaunchTrigger.current = launchTrigger;
    void launchRef.current();
  }, [
    busy,
    canExecute,
    executionActive,
    fundingConfirmed,
    fundingOrder.launchStatus,
    fundingOrderReady,
    fundingQuoteLoading,
    launchTrigger,
    result,
  ]);

  async function copyDepositAddress() {
    if (!fundingOrder.depositAddress) {
      setDepositAddressCopyError("Deposit address is unavailable.");
      return;
    }
    setDepositAddressCopied(false);
    setDepositAddressCopyError("");
    try {
      await copyTextToClipboard(fundingOrder.depositAddress);
      setDepositAddressCopied(true);
      window.setTimeout(() => setDepositAddressCopied(false), 1800);
    } catch {
      setDepositAddressCopyError("Copy failed. Select the deposit address above and copy it manually.");
    }
  }

  return (
    <section
      className="launch-progress-section pons-mainnet-launch"
      aria-labelledby={hideLaunchIntro ? undefined : "pons-executor-heading"}
      aria-label={hideLaunchIntro ? "Robinhood launch progress" : undefined}
    >
      {!hideLaunchIntro && <>
        <h3 id="pons-executor-heading">
          {multichainInitialBuyEth ? "Multichain · Robinhood leg" : "Robinhood launch funding"}
        </h3>
        <p>
          {multichainInitialBuyEth
            ? `The ${multichainInitialBuyEth} ETH Pons initial buy is executed atomically with launch, and the bought tokens go directly to this launch's Bridge Vault.`
            : `Password authorization is ready. Send exactly ${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH to the generated creator wallet below. The live launch and gas requirement is checked before any transaction; if it exceeds the fixed deposit, the flow waits for the balance to cover it.`}
        </p>
      </>}
      {!hideFundingCard && <section className="pons-funding-card" aria-label="Robinhood launch deposit">
        <h4>{multichainInitialBuyEth ? "Deposit for Pons launch and Bridge Vault inventory" : `Deposit ${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH for launch`}</h4>
        {fundingQuoteLoading && (
          <p role="status"><LoaderCircle size={15} aria-hidden="true" className="spin" /> Preparing the Robinhood deposit address…</p>
        )}
        {fundingOrder.depositAddress && fundingOrder.requiredDepositWei && (
          <>
            <div className="review-grid">
              <div>
                <strong>Network</strong>
                <span>{fundingOrder.depositNetworkName?.replace(/\s+chain$/i, "") || "Robinhood"} · chain ID {fundingOrder.depositChainId ?? 4663}</span>
              </div>
              <div>
                <strong>{multichainInitialBuyEth ? "Launch deposit + initial buy" : "Fixed deposit"}</strong>
                <span>{multichainInitialBuyEth ? `${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH + ${multichainInitialBuyEth} ETH` : `${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH`}</span>
              </div>
              <div>
                <strong>Current minimum balance</strong>
                <span>{formatEth(fundingOrder.requiredDepositWei)} ETH</span>
              </div>
              <div className="pons-funding-address">
                <strong>Deposit address</strong>
                <code>{fundingOrder.depositAddress}</code>
                <button type="button" className="button button-secondary compact" onClick={() => void copyDepositAddress()}>
                  {depositAddressCopied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  {depositAddressCopied ? "Copied" : "Copy address"}
                </button>
                {depositAddressCopyError && <small className="creator-inline-error" role="status">{depositAddressCopyError}</small>}
              </div>
            </div>
            <p className="pons-funding-explainer">
              {multichainInitialBuyEth
                ? `The Robinhood deposit target is ${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH plus the ${multichainInitialBuyEth} ETH initial buy. The executor verifies the live balance and fee cap before sending; Pons sends all initial-buy tokens directly to this launch's Bridge Vault.`
                : `The QR code requests ${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH. Before launch, the executor estimates every required transaction using the current fee cap (base fee + 20%) and rechecks the creator wallet balance. After successful launch, eligible remaining ETH is credited to Creator Vault as backed JailETH.`}
            </p>
            {fundingQrDataUrl && (
              <img className="pons-funding-qr" src={fundingQrDataUrl} alt="QR code for the Robinhood creator-wallet deposit" />
            )}
            {fundingConfirmed ? (
              <p role="status" className="pons-funding-confirmed">
                <Check size={16} aria-hidden="true" />
                Deposit target and current launch balance confirmed. Confirm below to start the launch.
              </p>
            ) : (
              <p role="status" className="optional">
                Waiting for at least {formatEth(fundingOrder.requiredDepositWei)} ETH. Current balance
                observed at a confirmed block: {formatEth(fundingOrder.depositBalanceWei)} ETH.
                The balance is checked automatically every 10 seconds. Keep this page open until you confirm the launch.
              </p>
            )}
          </>
        )}
        {!fundingQuoteLoading && (fundingQuoteError || !fundingOrder.depositAddress) && (
          <button type="button" className="button button-secondary" onClick={() => void refreshFundingQuote()}>
            {fundingOrder.depositAddress ? "Refresh deposit status" : `Prepare ${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH deposit`}
          </button>
        )}
        {fundingQuoteError && <p role="alert" className="creator-inline-error pons-launch-error">{fundingQuoteError}</p>}
      </section>}
      {!hideFundingCard && fundingQuoteError && <p role="alert" className="creator-inline-error pons-launch-error">{fundingQuoteError}</p>}
      {!hideLaunchAction && <button
        type="button"
        className={`button ${result ? "button-secondary" : "button-primary"} primary-action`}
        disabled={!fundingOrderReady || !fundingConfirmed || !canExecute || fundingQuoteLoading || busy || executionActive || Boolean(result)}
        onClick={() => void launch()}
        data-testid="button-robinhood-launch-confirm"
      >
        {busy || executionActive ? "Launching on Robinhood…" : result ? "Launch completed" :
          error || fundingOrder.launchStatus === "needs-attention" ? "Resume Robinhood launch" : "Confirm and launch on Robinhood"}
      </button>}
      {progress && !hideProgressDetails && <p role="status" className="optional pons-launch-progress">{progress}</p>}
      {!hideProgressDetails && error && <p role="alert" className="creator-inline-error pons-launch-error">{error}</p>}
      {!hideProgressDetails && !error && fundingOrder.launchError && <p role="alert" className="creator-inline-error pons-launch-error">{fundingOrder.launchError}</p>}
      {!hideProgressDetails && <>
        <h3>Robinhood launch progress</h3>
        <p>
          {multichainInitialBuyEth
            ? "After you confirm, the Pons launch and initial buy run on Robinhood; bought tokens go directly to this launch's Bridge Vault."
            : "After you confirm, the system submits vault setup, Pons token launch, TaxRouter binding, launch registration, and Creator Vault surplus processing."}
        </p>
        <p className="optional">
          Token: {tokenName} ({tokenSymbol}) · maximum fee per gas: live base fee + 20%.
        </p>
        {!fundingConfirmed && !busy && !executionActive && <p role="status" className="pons-launch-progress">Waiting for creator-wallet deposit</p>}
        <ol className="pons-launch-stages" aria-label="Live launch progress">
         {LAUNCH_STAGES.map(({ status, label, ...step }) => {
           const currentIndex = STAGE_SEQUENCE.indexOf(fundingOrder.launchLastStage ?? "");
           const stageIndex = STAGE_SEQUENCE.indexOf(status);
           const done = status === "deposit-confirmed"
             ? fundingConfirmed || currentIndex >= 0 || Boolean(result)
             : Boolean(result) || (stageIndex >= 0 && currentIndex > stageIndex);
           const active = !done && (status === "deposit-confirmed"
             ? !fundingConfirmed
             : currentIndex === stageIndex);
           const hash = "tx" in step ? fundingOrder.launchTransactions?.[step.tx] : undefined;
           return <li key={status} className={done ? "is-done" : active ? "is-active" : ""}>
             <span className="pons-stage-marker" aria-hidden="true">{done ? <Check size={14} /> : active && executionActive ? <LoaderCircle size={14} className="spin" /> : null}</span>
             <span>{label}</span>
             {hash && <a href={`https://robin.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer" aria-label={`View ${label} transaction`}>View transaction <ExternalLink size={13} aria-hidden="true" /></a>}
           </li>;
         })}
        </ol>
      </>}
      {result && (
        <div className="review-grid" aria-live="polite">
          <div><strong>Token</strong><code>{result.tokenAddress}</code></div>
          <div><strong>Creator Vault</strong><code>{result.creatorVault}</code></div>
          <div><strong>TaxRouter</strong><code>{result.taxRouter}</code></div>
          {result.creatorJailETHWei !== undefined && (
            <div><strong>JailETH issued</strong><span>{formatEth(result.creatorJailETHWei)} JailETH</span></div>
          )}
          {result.creatorSurplusWei !== undefined && (
            <div><strong>ETH credited to Creator Vault</strong><span>{formatEth(result.creatorSurplusWei)} ETH</span></div>
          )}
        </div>
      )}
    </section>
  );
}

export function PostLaunchRecoveryCapsule({
  authorization,
  creatorPassword,
  launch,
  onContinue,
}: {
  authorization: QrcAuthorizationRecord;
  creatorPassword: string;
  launch: PonsMainnetLaunchResult;
  onContinue: () => void;
}) {
  const [payload, setPayload] = useState<QrcPayload | null>(null);
  const [progress, setProgress] = useState("Preparing the post-launch recovery file");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const seed = hexBytes(authorization.authorizationSeed);
    const context: PasswordAuthorizationContext = {
      chainId: authorization.chainId,
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
          throw new Error("The generated recovery hash chains do not match the launch authorization root.");
        }
        const nextPayload: QrcPayload = {
          format: "armoreum-qrc",
          version: 2,
          protocol: "armoreum.creator.password.authorization.v2",
          authorizations: [{
            ...authorization,
            creatorPassword,
            vaultAddress: launch.creatorVault,
            tokenAddress: launch.tokenAddress,
            taxRouterAddress: launch.taxRouter,
            curveAddress: launch.curveAddress,
            authorizationEpochRoot: launch.authorizationEpochRoot,
            proofChains: derived.chains,
          }],
        };
        setPayload(nextPayload);
        setProgress("Token launch verified. The offline recovery capsule is ready.");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "The offline recovery capsule could not be prepared.");
          setProgress("");
        }
      })
      .finally(() => seed.fill(0));

    return () => controller.abort();
  }, [authorization, creatorPassword, launch, attempt]);

  if (payload) {
    const tokenPageHref = buildLaunchDetailPath("robinhood", authorization.launchId);
    return <QuantumRecoveryCapsule
      payload={payload}
      authorizationAvailable
      onContinue={onContinue}
      tokenPageLinks={tokenPageHref ? [{ href: tokenPageHref, label: "View token page" }] : []}
    />;
  }

  return (
    <section className="launch-progress-section" aria-live="polite" aria-labelledby="post-launch-capsule-heading">
      <h3 id="post-launch-capsule-heading">Prepare your offline recovery capsule</h3>
      <p>The token launch is confirmed. Armoreum is now generating the password, private key, and complete H100–H0 hash-chain data locally for the final .qrc file.</p>
      {progress && <p role="status" className="optional"><LoaderCircle size={15} aria-hidden="true" className="spin" /> {progress}</p>}
      {error && <p className="creator-inline-error" role="alert"><CircleAlert size={16} aria-hidden="true" /> {error}</p>}
      {error && <button type="button" className="button button-secondary compact" onClick={() => setAttempt((value) => value + 1)}>Retry capsule preparation</button>}
    </section>
  );
}
