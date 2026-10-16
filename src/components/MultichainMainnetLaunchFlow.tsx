import { useCallback, useEffect, useRef, useState } from "react";
import { formatEther, keccak256, parseEther, toUtf8Bytes } from "ethers";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH,
  ETHEREUM_FIXED_LAUNCH_DEPOSIT_WEI,
  PONS_REQUIRED_CREATOR_DEPOSIT_ETH,
} from "@workspace/api-zod";
import { copyTextToClipboard } from "../lib/copy-to-clipboard";
import { launchIsActive, launchPauseMessage, nextLaunchLeg } from "../lib/multichain-launch-sequence";
import type { QrcAuthorizationRecord, QrcPayload } from "../lib/qrc";
import {
  buildGmgnTokenUrl,
  buildLaunchDetailPath,
  buildPonsTokenUrl,
} from "../lib/post-launch-links";
import { multichainFundingOrderUrl } from "../lib/multichain-funding";
import {
  deriveCreatorPasswordKdf,
  derivePasswordAuthorizationProofChains,
  derivePasswordAuthorizationSigner,
  requestCreatorAuthorizationSeed,
  signPasswordAuthorizationDigest,
  type PasswordAuthorizationContext,
  validateCreatorAuthorizationPassword,
} from "../lib/creator-password-authorization";
import { QuantumRecoveryCapsule } from "./QuantumRecoveryCapsule";
import {
  PonsMainnetLaunchExecutor,
  type PonsFundingOrder,
  type PonsMainnetLaunchResult,
} from "./PonsMainnetLaunchExecutor";
import {
  EthereumMainnetLaunchExecutor,
  type EthereumFundingOrder,
  type EthereumMainnetLaunchResult,
} from "./EthereumMainnetLaunchExecutor";

const ZERO_ADDRESS = `0x${"00".repeat(20)}`;

type AuthorizationPair = {
  ethereum: QrcAuthorizationRecord;
  robinhood: QrcAuthorizationRecord;
};

type ActivityNetwork = "Robinhood" | "Ethereum" | "Multichain";
type ActivityEntry = {
  key: string;
  network: ActivityNetwork;
  message: string;
  txHash?: string;
  txUrl?: string;
};

type Props = {
  draftId: string;
  tokenName: string;
  tokenSymbol: string;
  initialBuyEth: string;
  canStartNewDraft: boolean;
  startingNewDraft: boolean;
  onStartNewDraft: () => Promise<void>;
  onInitialBuyLocked: () => void;
  onCapsuleDownloaded: (
    ponsResult: PonsMainnetLaunchResult,
    ethereumResult: EthereumMainnetLaunchResult,
  ) => void;
};

const EMPTY_PONS_ORDER: PonsFundingOrder = {
  depositStatus: "not-created",
  launchStatus: "not-submitted",
  launchLastStage: null,
  launchTransactions: {},
  launchResult: null,
  launchError: null,
  launchOrderId: null,
  requiredDepositWei: null,
  depositAddress: null,
  depositBalanceWei: null,
  depositChainId: null,
  depositNetworkName: null,
};

const EMPTY_ETHEREUM_ORDER: EthereumFundingOrder = {
  depositStatus: "not-created",
  launchStatus: "not-submitted",
  launchLastStage: null,
  launchTransactions: {},
  launchResult: null,
  launchError: null,
  launchOrderId: null,
  requiredDepositWei: null,
  depositAddress: null,
  depositBalanceWei: null,
  depositChainId: null,
  depositNetworkName: null,
};

function formatEthAmount(wei: string | null | undefined): string {
  if (!wei || !/^\d+$/.test(wei)) return "—";
  const formatted = formatEther(BigInt(wei));
  return formatted.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function transactionLabel(network: ActivityNetwork, key: string): string {
  const labels: Record<string, string> = {
    factory: "Vault and TaxRouter setup",
    pons: "Pons token launch",
    bind: "TaxRouter binding",
    complete: "Launch registration",
    surplus: "Creator Vault surplus credit",
    token: "Token deployment",
    hook: "V4 hook deployment",
    approve: "Pool supply approval",
    seed: "V4 pool seed",
    bindToken: "Multichain token binding",
    bridgeReserve: "Bridge reserve",
    multichainComplete: "Multichain registration",
  };
  return `${network} · ${labels[key] ?? key}`;
}

function toHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function fromHex(value: string): Uint8Array {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[\da-f]+$/i.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("The password authorization material is invalid.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

async function requestJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined
    ? { method: "GET" }
    : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
  const text = await response.text();
  let payload: T & { error?: string };
  try {
    payload = text ? JSON.parse(text) as T & { error?: string } : {} as T & { error?: string };
  } catch {
    throw new Error(`The launch service returned an invalid response (${response.status}).`);
  }
  if (!response.ok) throw new Error(payload.error || `Mainnet launch request failed (${response.status}).`);
  if (!text) throw new Error("The launch service returned an empty response.");
  return payload;
}

type ChainLaunchOrderStatus = {
  launchStatus?: string;
  launchResult?: Record<string, unknown> | null;
  launchLastStage?: string | null;
  launchTransactions?: Record<string, string>;
  error?: string;
};

async function requestCurrentLaunchOrder(url: string, signal: AbortSignal): Promise<ChainLaunchOrderStatus> {
  const response = await fetch(url, { signal });
  const text = await response.text();
  let payload: ChainLaunchOrderStatus;
  try {
    payload = text ? JSON.parse(text) as ChainLaunchOrderStatus : {};
  } catch {
    throw new Error(`The launch service returned an invalid status response (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(payload.error || `Launch status check failed (${response.status}).`);
  }
  return payload;
}

function chainLaunchIsConfirmed(order: ChainLaunchOrderStatus): boolean {
  return order.launchStatus === "launched" &&
    Boolean(order.launchResult && typeof order.launchResult === "object");
}

function restoredPonsResult(value: unknown): PonsMainnetLaunchResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  const candidate = result.robinhood && typeof result.robinhood === "object"
    ? result.robinhood as Record<string, unknown>
    : result;
  return typeof candidate.tokenAddress === "string" &&
    typeof candidate.creatorVault === "string" &&
    typeof candidate.taxRouter === "string" &&
    typeof candidate.curveAddress === "string" &&
    typeof candidate.authorizationEpochRoot === "string"
    ? candidate as unknown as PonsMainnetLaunchResult
    : null;
}

function restoredEthereumResult(value: unknown): EthereumMainnetLaunchResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  const candidate = result.ethereum && typeof result.ethereum === "object"
    ? result.ethereum as Record<string, unknown>
    : result;
  return typeof candidate.launchId === "string" &&
    typeof candidate.creatorVault === "string" &&
    typeof candidate.taxRouter === "string" &&
    typeof candidate.tokenAddress === "string" &&
    typeof candidate.poolId === "string" &&
    typeof candidate.authorizationEpochRoot === "string"
    ? candidate as unknown as EthereumMainnetLaunchResult
    : null;
}

function MultichainAuthorizationSetup({
  draftId,
  onReady,
  canStartNewDraft,
  startingNewDraft,
  onStartNewDraft,
}: {
  draftId: string;
  onReady: (pair: AuthorizationPair, password: string) => void;
  canStartNewDraft: boolean;
  startingNewDraft: boolean;
  onStartNewDraft: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [preparedAddress, setPreparedAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function prepare() {
    if (busy || !draftId) return;
    setError("");
    try {
      validateCreatorAuthorizationPassword(password);
      if (password !== confirmation) throw new Error("The passwords do not match.");
      setBusy(true);
      const launchId = keccak256(toUtf8Bytes(`armoreum-launch:${draftId}`));
      const kdf = await deriveCreatorPasswordKdf(password, launchId);
      let recovery;
      try {
        recovery = await requestCreatorAuthorizationSeed(draftId, kdf);
      } finally {
        kdf.fill(0);
      }
      if (recovery.launchId.toLowerCase() !== launchId.toLowerCase()) {
        recovery.seed.fill(0);
        throw new Error("The server returned a different launch authorization.");
      }
      const base = {
        vaultAddress: ZERO_ADDRESS,
        creatorAddress: recovery.creatorAddress,
        launchId,
      };
      const ethereumContext: PasswordAuthorizationContext = { ...base, chainId: 1 };
      const robinhoodContext: PasswordAuthorizationContext = { ...base, chainId: 4663 };
      const [ethereumSigner, robinhoodSigner] = await Promise.all([
        derivePasswordAuthorizationSigner(recovery.seed, ethereumContext),
        derivePasswordAuthorizationSigner(recovery.seed, robinhoodContext),
      ]);
      const common = {
        launchId,
        creatorAddress: recovery.creatorAddress,
        vaultAddress: null,
        creatorPrivateKey: recovery.creatorPrivateKey,
        serverKeyId: recovery.serverKeyId,
        authorizationSeed: toHex(recovery.seed),
      };
      const pair: AuthorizationPair = {
        ethereum: { ...common, chainId: 1, authorizationSigner: ethereumSigner },
        robinhood: { ...common, chainId: 4663, authorizationSigner: robinhoodSigner },
      };
      recovery.seed.fill(0);
      setPreparedAddress(recovery.creatorAddress);
      setPassword("");
      setConfirmation("");
      onReady(pair, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Multichain password authorization could not be prepared.");
    } finally {
      setBusy(false);
    }
  }

  if (preparedAddress) {
    return (
      <section className="launch-progress-section" aria-live="polite">
        <h3>Multichain creator authorization prepared</h3>
        <p>One password-derived creator account is ready for separate Ethereum and Robinhood signatures.</p>
        <p><code>{preparedAddress}</code></p>
        <p className="optional">Your password remains in page memory only. Keep this page open until both launch legs finish and the recovery capsule is downloaded.</p>
      </section>
    );
  }

  return (
    <section className="launch-progress-section" aria-labelledby="multichain-password-heading">
      <h3 id="multichain-password-heading">Create Multichain creator password</h3>
      <p>One generated creator wallet will sign both chains. The wallet must be funded separately with {ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH on Ethereum and {PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH plus the selected Pons buy on Robinhood.</p>
      <p className="optional">Use at least 6 characters with letters and numbers; there is no maximum length. The password stays in this page and is not stored by the server.</p>
      <label>
        Password
        <input type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} data-testid="input-multichain-creator-password" />
      </label>
      <label>
        Confirm password
        <input type="password" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} data-testid="input-multichain-creator-password-confirm" />
      </label>
      {error && <p className="creator-inline-error" role="alert">{error}</p>}
      <button className="button button-primary" type="button" disabled={busy || startingNewDraft || !draftId || !password || !confirmation} onClick={() => void prepare()}>
        {busy ? "Preparing both chain authorizations…" : "Prepare Multichain password authorization"}
      </button>
      {error.includes("different creator wallet") && canStartNewDraft && (
        <button className="button button-secondary" type="button" disabled={busy || startingNewDraft} onClick={() => void onStartNewDraft()}>
          {startingNewDraft ? "Preparing a fresh draft…" : "Start a fresh password-first draft"}
        </button>
      )}
      {error.includes("different creator wallet") && !canStartNewDraft && (
        <p className="optional" role="status">This draft already has funding or launch state and cannot be replaced here.</p>
      )}
    </section>
  );
}

export function MultichainMainnetLaunchFlow(props: Props) {
  const { draftId, tokenName, tokenSymbol, initialBuyEth, onCapsuleDownloaded, onInitialBuyLocked } = props;
  const [authorizations, setAuthorizations] = useState<AuthorizationPair | null>(null);
  const [creatorPassword, setCreatorPassword] = useState("");
  const [ponsOrder, setPonsOrder] = useState<PonsFundingOrder>(EMPTY_PONS_ORDER);
  const [ethereumOrder, setEthereumOrder] = useState<EthereumFundingOrder>(EMPTY_ETHEREUM_ORDER);
  const [fundingLoading, setFundingLoading] = useState({ robinhood: false, ethereum: false });
  const [fundingErrors, setFundingErrors] = useState({ robinhood: "", ethereum: "" });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [ponsQr, setPonsQr] = useState("");
  const [ethereumQr, setEthereumQr] = useState("");
  const [ponsResult, setPonsResult] = useState<PonsMainnetLaunchResult | null>(null);
  const [ethereumResult, setEthereumResult] = useState<EthereumMainnetLaunchResult | null>(null);
  const [launchTrigger, setLaunchTrigger] = useState(0);
  const [ponsLaunchTrigger, setPonsLaunchTrigger] = useState(0);
  const [sequenceArmed, setSequenceArmed] = useState(false);
  const [launchRequested, setLaunchRequested] = useState(false);
  const [ethereumServerConfirmed, setEthereumServerConfirmed] = useState(false);
  const [checkingLaunch, setCheckingLaunch] = useState(false);
  const [launchIssue, setLaunchIssue] = useState<string | null>(null);
  const [launchStalled, setLaunchStalled] = useState(false);
  const ponsDispatched = useRef(false);
  const launchClickLock = useRef(false);
  const statusReadEpoch = useRef(0);
  const completedActivity = useRef(new Set<string>());
  const lastProgress = useRef({ fingerprint: "", at: Date.now() });
  const [launchStates, setLaunchStates] = useState<{
    robinhood: "idle" | "running" | "failed" | "completed";
    ethereum: "idle" | "running" | "failed" | "completed";
  }>({ robinhood: "idle", ethereum: "idle" });
  const [recoveryPayload, setRecoveryPayload] = useState<QrcPayload | null>(null);
  const [recoveryProgress, setRecoveryProgress] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [launchRecordsVerified, setLaunchRecordsVerified] = useState(false);
  const [launchVerificationError, setLaunchVerificationError] = useState("");
  const [launchVerificationAttempt, setLaunchVerificationAttempt] = useState(0);
  const recoveryDialog = useRef<HTMLDialogElement>(null);
  const [copiedNetwork, setCopiedNetwork] = useState<ActivityNetwork | null>(null);
  const bothLaunchesConfirmed = Boolean(
    ponsResult &&
    ethereumResult &&
    launchStates.robinhood === "completed" &&
    launchStates.ethereum === "completed",
  );
  const bothDepositsConfirmed = Boolean(
    authorizations &&
    ponsOrder.depositStatus === "confirmed" &&
    ethereumOrder.depositStatus === "confirmed",
  );
  const backendLaunchInProgress = [ponsOrder.launchStatus, ethereumOrder.launchStatus].some(launchIsActive);
  const shouldObserveLaunch = launchRequested || backendLaunchInProgress;
  const launchInProgress = Object.values(launchStates).includes("running") || backendLaunchInProgress ||
    (sequenceArmed && !bothLaunchesConfirmed);
  const canConfirmLaunch = bothDepositsConfirmed && (!launchInProgress || launchStalled) &&
    !checkingLaunch && !bothLaunchesConfirmed;
  const launchNeedsResume = Object.values(launchStates).includes("failed") ||
    ponsOrder.launchStatus === "needs-attention" ||
    ethereumOrder.launchStatus === "needs-attention";

  const appendActivity = useCallback((
    network: ActivityNetwork,
    message: string,
    txHash?: string,
    txUrl?: string,
  ) => {
    if (!message) return;
    const progressMessage = message.replace(/ · \d+\/\d+$/, " · progress");
    const key = `${network}:${txHash ?? progressMessage}`;
    setActivity((current) => {
      if (txHash && current.some((entry) => entry.key === key)) return current;
      const lastIndex = current.length - 1;
      const last = current[lastIndex];
      if (!txHash && last?.key === key) {
        if (last.message === message) return current;
        const updated = [...current];
        updated[lastIndex] = { ...last, message };
        return updated;
      }
      return [...current, { key, network, message, ...(txHash ? { txHash, txUrl } : {}) }].slice(-40);
    });
  }, []);

  function updateLaunchState(
    network: "Robinhood" | "Ethereum",
    state: "running" | "failed" | "completed",
    error?: string,
  ) {
    // A late transport error must not overwrite completion already verified by GET.
    if (state !== "completed" && completedActivity.current.has(network)) return;
    setLaunchStates((current) => ({
      ...current,
      [network === "Robinhood" ? "robinhood" : "ethereum"]: state,
    }));
    if (state === "failed" && error) {
      setLaunchIssue(error);
      setSequenceArmed(false);
    }
  }

  const reconcileLaunch = useCallback(async (signal: AbortSignal) => {
    const epoch = ++statusReadEpoch.current;
    const [ethereum, robinhood] = await Promise.all([
      requestCurrentLaunchOrder(multichainFundingOrderUrl(draftId, "ethereum"), signal),
      requestCurrentLaunchOrder(multichainFundingOrderUrl(draftId, "robinhood"), signal),
    ]);
    if (signal.aborted || epoch !== statusReadEpoch.current) return null;
    setEthereumOrder(current => ({ ...current, ...ethereum } as EthereumFundingOrder));
    setPonsOrder(current => ({ ...current, ...robinhood } as PonsFundingOrder));
    setFundingErrors(current => current.ethereum || current.robinhood
      ? { ethereum: "", robinhood: "" } : current);
    const eth = chainLaunchIsConfirmed(ethereum) ? restoredEthereumResult(ethereum.launchResult) : null;
    const pons = chainLaunchIsConfirmed(robinhood) ? restoredPonsResult(robinhood.launchResult) : null;
    setEthereumServerConfirmed(Boolean(eth));
    for (const [network, order, result] of [
      ["Ethereum", ethereum, eth], ["Robinhood", robinhood, pons],
    ] as const) {
      const key = network === "Ethereum" ? "ethereum" : "robinhood";
      if (result) {
        if (network === "Ethereum") setEthereumResult(current => current ?? result as EthereumMainnetLaunchResult);
        else setPonsResult(current => current ?? result as PonsMainnetLaunchResult);
        setLaunchStates(current => current[key] === "completed" ? current : { ...current, [key]: "completed" });
        if (!completedActivity.current.has(network)) {
          completedActivity.current.add(network);
          appendActivity(network, `${network} launch complete. Confirmed transactions are preserved.`);
        }
      } else if (launchIsActive(order.launchStatus)) {
        setLaunchStates(current => current[key] === "running" ? current : { ...current, [key]: "running" });
      }
    }
    const fingerprint = JSON.stringify([ethereum.launchStatus, ethereum.launchLastStage, ethereum.launchTransactions,
      robinhood.launchStatus, robinhood.launchLastStage, robinhood.launchTransactions]);
    if (fingerprint !== lastProgress.current.fingerprint) {
      lastProgress.current = { fingerprint, at: Date.now() };
      setLaunchStalled(false);
    } else {
      setLaunchStalled(Date.now() - lastProgress.current.at > 180_000);
    }
    if (eth && pons) setLaunchIssue(null);
    return { ethereum, robinhood, eth, pons };
  }, [draftId, appendActivity]);

  async function confirmMultichainLaunch() {
    if (!canConfirmLaunch || launchClickLock.current) return;
    launchClickLock.current = true;
    setCheckingLaunch(true);
    setLaunchRequested(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const saved = await reconcileLaunch(controller.signal);
      if (!saved) return;
      setLaunchIssue(null);
      setLaunchStalled(false);
      setSequenceArmed(true);
      ponsDispatched.current = false;
      const next = nextLaunchLeg(Boolean(saved.eth), Boolean(saved.pons));
      if (next === "ethereum") {
        if (launchIsActive(saved.ethereum.launchStatus)) return;
        setLaunchStates({ ethereum: "running", robinhood: saved.pons ? "completed" : "idle" });
        appendActivity("Ethereum", "Starting Ethereum. Robinhood will start automatically after Ethereum is confirmed complete.");
        setLaunchTrigger(current => current + 1);
      } else if (next === "robinhood") {
        setLaunchStates(current => ({ ...current, robinhood: launchIsActive(saved.robinhood.launchStatus) ? "running" : "idle" }));
      }
      // Robinhood is dispatched by the verified-Ethereum effect below.
    } catch {
      setSequenceArmed(false);
      setLaunchIssue("We could not check the saved launch progress. Please try Resume again.");
    } finally {
      window.clearTimeout(timeout);
      launchClickLock.current = false;
      setCheckingLaunch(false);
    }
  }

  useEffect(() => {
    if (!authorizations || !shouldObserveLaunch || bothLaunchesConfirmed) return;
    let stopped = false;
    let controller: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout>;
    let next: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (launchClickLock.current) {
        next = setTimeout(poll, 4_000);
        return;
      }
      controller = new AbortController();
      timeout = setTimeout(() => controller?.abort(), 12_000);
      try { await reconcileLaunch(controller.signal); }
      catch {
        if (!stopped) {
          setLaunchIssue("Connection interrupted. Saved launch progress is being checked.");
          setLaunchStalled(Date.now() - lastProgress.current.at > 180_000);
        }
      }
      finally {
        clearTimeout(timeout);
        if (!stopped) next = setTimeout(poll, 4_000);
      }
    };
    void poll();
    return () => { stopped = true; controller?.abort(); clearTimeout(timeout); clearTimeout(next); };
  }, [draftId, Boolean(authorizations), shouldObserveLaunch, bothLaunchesConfirmed, reconcileLaunch]);

  useEffect(() => {
    if (!sequenceArmed || checkingLaunch || !ethereumServerConfirmed || !ethereumResult ||
        ponsResult || ponsDispatched.current || launchStates.robinhood === "failed") return;
    if (launchIsActive(ponsOrder.launchStatus)) return;
    ponsDispatched.current = true;
    setLaunchStates(current => ({ ...current, robinhood: "running" }));
    appendActivity("Robinhood", "Ethereum launch complete. Starting Robinhood automatically.");
    setPonsLaunchTrigger(current => current + 1);
  }, [sequenceArmed, checkingLaunch, ethereumServerConfirmed, ethereumResult, ponsResult,
    ponsOrder.launchStatus, launchStates.robinhood, appendActivity]);

  async function createPonsFundingOrder(body: unknown): Promise<PonsFundingOrder> {
    onInitialBuyLocked();
    setFundingLoading((current) => ({ ...current, robinhood: true }));
    setFundingErrors((current) => ({ ...current, robinhood: "" }));
    try {
      const fundingUrl = multichainFundingOrderUrl(draftId, "robinhood");
      const preparedOrder = await requestJson<PonsFundingOrder>(
        fundingUrl,
        { ...(body as object), multichainInitialBuyEth: initialBuyEth },
      );
      if (
        !preparedOrder.depositAddress?.trim() ||
        preparedOrder.depositChainId !== 4663 ||
        preparedOrder.depositNetworkName?.trim().toLowerCase() !== "robinhood" ||
        !preparedOrder.requiredDepositWei?.trim()
      ) {
        throw new Error("The Robinhood funding order is missing its address, network, or total.");
      }
      // POST persists the order; a separate GET must freshly verify the chain balance.
      setPonsOrder({ ...preparedOrder, depositStatus: "awaiting", depositBalanceWei: null });
      const ponsPaymentUri = `ethereum:${preparedOrder.depositAddress}@${preparedOrder.depositChainId}?value=${preparedOrder.requiredDepositWei}`;
      setPonsQr(await QRCode.toDataURL(ponsPaymentUri, { width: 220, margin: 1 }));
      const order = await requestJson<PonsFundingOrder>(fundingUrl);
      if (
        !order.depositAddress?.trim() ||
        order.depositChainId !== 4663 ||
        order.depositNetworkName?.trim().toLowerCase() !== "robinhood" ||
        !order.requiredDepositWei?.trim()
      ) {
        throw new Error("The Robinhood funding status is missing its address, network, or total.");
      }
      setPonsOrder(order);
      if (order.depositStatus === "confirmed") {
        appendActivity("Robinhood", `Required Robinhood balance confirmed: ${formatEthAmount(order.requiredDepositWei)} ETH.`);
      }
      const restored = restoredPonsResult(order.launchResult);
      if (restored) {
        setPonsResult(restored);
        setLaunchStates((current) => ({ ...current, robinhood: "completed" }));
        recordTransactions("Robinhood", restored.transactions);
      }
      return order;
    } catch (cause) {
      setFundingErrors((current) => ({
        ...current,
        robinhood: cause instanceof Error ? cause.message : "Robinhood deposit details could not be loaded.",
      }));
      throw cause;
    } finally {
      setFundingLoading((current) => ({ ...current, robinhood: false }));
    }
  }

  async function createEthereumFundingOrder(body: unknown = {}): Promise<EthereumFundingOrder> {
    onInitialBuyLocked();
    setFundingLoading((current) => ({ ...current, ethereum: true }));
    setFundingErrors((current) => ({ ...current, ethereum: "" }));
    try {
      const order = await requestJson<EthereumFundingOrder>(
        multichainFundingOrderUrl(draftId, "ethereum"),
        { ...(body as object), multichainInitialBuyEth: initialBuyEth },
      );
      if (!order.depositAddress || order.depositChainId !== 1 || !order.requiredDepositWei) {
        throw new Error("The Ethereum funding order is missing its address, network, or total.");
      }
      setEthereumOrder(order);
      const ethereumPaymentUri = `ethereum:${order.depositAddress}@${order.depositChainId}?value=${order.requiredDepositWei}`;
      setEthereumQr(await QRCode.toDataURL(ethereumPaymentUri, { width: 220, margin: 1 }));
      if (order.depositStatus === "confirmed") {
        appendActivity("Ethereum", `Required Ethereum balance confirmed: ${formatEthAmount(order.requiredDepositWei)} ETH.`);
      }
      const restored = restoredEthereumResult(order.launchResult);
      if (restored) {
        setEthereumResult(restored);
        setLaunchStates((current) => ({ ...current, ethereum: "completed" }));
        recordTransactions("Ethereum", restored.transactions);
      }
      return order;
    } catch (cause) {
      setFundingErrors((current) => ({
        ...current,
        ethereum: cause instanceof Error ? cause.message : "Ethereum deposit details could not be loaded.",
      }));
      throw cause;
    } finally {
      setFundingLoading((current) => ({ ...current, ethereum: false }));
    }
  }

  async function copyCreatorAddress(network: ActivityNetwork, address: string | null) {
    if (!address) return;
    try {
      await copyTextToClipboard(address);
      setCopiedNetwork(network);
      window.setTimeout(() => setCopiedNetwork((current) => current === network ? null : current), 1800);
    } catch {
      setFundingErrors((current) => ({
        ...current,
        ...(network === "Robinhood"
          ? { robinhood: "Copy failed. Select the address and copy it manually." }
          : network === "Ethereum"
            ? { ethereum: "Copy failed. Select the address and copy it manually." }
            : {}),
      }));
    }
  }

  function recordTransactions(network: "Robinhood" | "Ethereum", transactions: Record<string, string | undefined>) {
    for (const [step, hash] of Object.entries(transactions)) {
      if (!hash) continue;
      const url = network === "Ethereum"
        ? `https://etherscan.io/tx/${hash}`
        : `https://robin.etherscan.io/tx/${hash}`;
      appendActivity(network, transactionLabel(network, step), hash, url);
    }
  }

  useEffect(() => {
    setAuthorizations(null);
    setCreatorPassword("");
    setPonsOrder(EMPTY_PONS_ORDER);
    setEthereumOrder(EMPTY_ETHEREUM_ORDER);
    setPonsQr("");
    setEthereumQr("");
    setPonsResult(null);
    setEthereumResult(null);
    setLaunchTrigger(0);
    setPonsLaunchTrigger(0);
    setSequenceArmed(false);
    setLaunchRequested(false);
    setEthereumServerConfirmed(false);
    setCheckingLaunch(false);
    setLaunchIssue(null);
    setLaunchStalled(false);
    ponsDispatched.current = false;
    launchClickLock.current = false;
    statusReadEpoch.current += 1;
    completedActivity.current.clear();
    lastProgress.current = { fingerprint: "", at: Date.now() };
    setLaunchStates({ robinhood: "idle", ethereum: "idle" });
    setRecoveryPayload(null);
    setRecoveryOpen(false);
    setRecoveryProgress("");
    setRecoveryError("");
    setRecoveryAttempt(0);
    setLaunchRecordsVerified(false);
    setLaunchVerificationError("");
    setLaunchVerificationAttempt(0);
    setActivity([]);
    setFundingLoading({ robinhood: false, ethereum: false });
    setFundingErrors({ robinhood: "", ethereum: "" });
    setCopiedNetwork(null);
  }, [draftId, initialBuyEth]);

  useEffect(() => {
    if (!bothLaunchesConfirmed) {
      setLaunchRecordsVerified(false);
      setLaunchVerificationError("");
      return;
    }
    const controller = new AbortController();
    setLaunchRecordsVerified(false);
    setLaunchVerificationError("");
    setRecoveryOpen(false);
    setRecoveryPayload(null);
    appendActivity("Multichain", "Verifying the completed Robinhood and Ethereum launch records.");
    void Promise.all([
      requestCurrentLaunchOrder(
        multichainFundingOrderUrl(draftId, "robinhood"),
        controller.signal,
      ),
      requestCurrentLaunchOrder(
        multichainFundingOrderUrl(draftId, "ethereum"),
        controller.signal,
      ),
    ])
      .then(([ponsOrderStatus, ethereumOrderStatus]) => {
        if (controller.signal.aborted) return;
        if (!chainLaunchIsConfirmed(ponsOrderStatus) || !chainLaunchIsConfirmed(ethereumOrderStatus)) {
          throw new Error("Both mainnet launch records are not confirmed yet. The recovery capsule will stay closed.");
        }
        setLaunchRecordsVerified(true);
        appendActivity("Multichain", "Both mainnet launch records are confirmed.");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setLaunchVerificationError(
            cause instanceof Error
              ? cause.message
              : "The two launch records could not be verified yet.",
          );
          appendActivity("Multichain", "Final launch verification is still pending.");
        }
      });
    return () => controller.abort();
  }, [draftId, bothLaunchesConfirmed, launchVerificationAttempt, appendActivity]);

  useEffect(() => {
    if (
      !authorizations ||
      !creatorPassword ||
      !bothLaunchesConfirmed ||
      !launchRecordsVerified ||
      !ponsResult ||
      !ethereumResult
    ) {
      setRecoveryOpen(false);
      setRecoveryPayload(null);
      setRecoveryProgress("");
      setRecoveryError("");
      return;
    }
    setRecoveryOpen(false);
    const controller = new AbortController();
    const seed = fromHex(authorizations.ethereum.authorizationSeed);
    setRecoveryPayload(null);
    setRecoveryError("");
    setRecoveryProgress("Preparing recovery proofs for both networks…");
    appendActivity("Multichain", "Both launches are confirmed. Preparing the recovery capsule.");
    const ethereumContext: PasswordAuthorizationContext = {
      chainId: 1,
      vaultAddress: ethereumResult.creatorVault,
      creatorAddress: authorizations.ethereum.creatorAddress,
      launchId: authorizations.ethereum.launchId,
    };
    const robinhoodContext: PasswordAuthorizationContext = {
      chainId: 4663,
      vaultAddress: ponsResult.creatorVault,
      creatorAddress: authorizations.robinhood.creatorAddress,
      launchId: authorizations.robinhood.launchId,
    };
    void Promise.all([
      derivePasswordAuthorizationProofChains(seed, ethereumContext, undefined, controller.signal),
      derivePasswordAuthorizationProofChains(seed, robinhoodContext, undefined, controller.signal),
    ])
      .then(([ethereumProofs, robinhoodProofs]) => {
        if (controller.signal.aborted) return;
        if (ethereumProofs.authorizationEpochRoot.toLowerCase() !== ethereumResult.authorizationEpochRoot.toLowerCase()) {
          throw new Error("Ethereum recovery proofs do not match the confirmed launch.");
        }
        if (robinhoodProofs.authorizationEpochRoot.toLowerCase() !== ponsResult.authorizationEpochRoot.toLowerCase()) {
          throw new Error("Robinhood recovery proofs do not match the confirmed launch.");
        }
        setRecoveryPayload({
          format: "armoreum-qrc",
          version: 2,
          protocol: "armoreum.creator.password.authorization.v2",
          authorizations: [
            {
              ...authorizations.ethereum,
              creatorPassword,
              vaultAddress: ethereumResult.creatorVault,
              tokenAddress: ethereumResult.tokenAddress,
              taxRouterAddress: ethereumResult.taxRouter,
              curveAddress: ZERO_ADDRESS,
              authorizationEpochRoot: ethereumResult.authorizationEpochRoot,
              proofChains: ethereumProofs.chains,
            },
            {
              ...authorizations.robinhood,
              creatorPassword,
              vaultAddress: ponsResult.creatorVault,
              tokenAddress: ponsResult.tokenAddress,
              taxRouterAddress: ponsResult.taxRouter,
              curveAddress: ponsResult.curveAddress,
              authorizationEpochRoot: ponsResult.authorizationEpochRoot,
              proofChains: robinhoodProofs.chains,
            },
          ],
        });
        setRecoveryProgress("Both launch legs are confirmed. The recovery capsule is ready.");
        setRecoveryOpen(true);
        appendActivity("Multichain", "Recovery capsule ready.");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setRecoveryOpen(false);
          setRecoveryPayload(null);
          setRecoveryError(cause instanceof Error ? cause.message : "The recovery capsule could not be prepared.");
          setRecoveryProgress("");
          appendActivity("Multichain", "Recovery capsule preparation failed.");
        }
      })
      .finally(() => seed.fill(0));
    return () => controller.abort();
  }, [
    authorizations,
    creatorPassword,
    ponsResult,
    ethereumResult,
    bothLaunchesConfirmed,
    launchRecordsVerified,
    recoveryAttempt,
    appendActivity,
  ]);

  useEffect(() => {
    const dialog = recoveryDialog.current;
    if (!dialog) return;
    const canShowCapsule = bothLaunchesConfirmed &&
      launchRecordsVerified &&
      Boolean(ponsResult && ethereumResult && recoveryPayload);
    if (recoveryOpen && canShowCapsule && !dialog.open) dialog.showModal();
    else if ((!recoveryOpen || !canShowCapsule) && dialog.open) dialog.close();
  }, [recoveryOpen, recoveryPayload, bothLaunchesConfirmed, launchRecordsVerified, ponsResult, ethereumResult]);

  const creatorWallet = authorizations?.ethereum.creatorAddress;
  const robinhoodAddress = ponsOrder.depositAddress ?? creatorWallet ?? null;
  const ethereumAddress = ethereumOrder.depositAddress ?? creatorWallet ?? null;
  const robinhoodExpectedWei = ponsOrder.requiredDepositWei ??
    (parseEther(PONS_REQUIRED_CREATOR_DEPOSIT_ETH) + parseEther(initialBuyEth)).toString();
  const ethereumExpectedWei = ethereumOrder.requiredDepositWei ?? ETHEREUM_FIXED_LAUNCH_DEPOSIT_WEI;
  const completed = launchRecordsVerified;
  const robinhoodTokenPage = authorizations
    ? buildLaunchDetailPath("robinhood", authorizations.robinhood.launchId)
    : null;
  const ethereumTokenPage = authorizations
    ? buildLaunchDetailPath("ethereum", authorizations.ethereum.launchId)
    : null;
  const tokenPageLinks = [
    robinhoodTokenPage ? { href: robinhoodTokenPage, label: "View Robinhood token page" } : null,
    ethereumTokenPage ? { href: ethereumTokenPage, label: "View Ethereum token page" } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);

  return (
    <section className="launch-progress-section local-launch-panel" aria-labelledby="multichain-mainnet-heading">
      <h2 id="multichain-mainnet-heading">Multichain mainnet launch</h2>
      <p>Fund the creator wallet separately on both networks. One confirmation launches Ethereum first, then starts Robinhood automatically after Ethereum is confirmed complete.</p>
      {!authorizations && <MultichainAuthorizationSetup
        key={draftId}
        draftId={draftId}
        onReady={(pair, password) => {
          setAuthorizations(pair);
          setCreatorPassword(password);
          appendActivity("Multichain", "Creator wallet authorization prepared.");
        }}
        canStartNewDraft={props.canStartNewDraft}
        startingNewDraft={props.startingNewDraft}
        onStartNewDraft={props.onStartNewDraft}
      />}
       <section className="multichain-funding-summary" aria-labelledby="multichain-funding-heading">
         <h3 id="multichain-funding-heading">Fund both networks</h3>
         <p>Use the same creator address, but send the required amount separately on each network. The Pons contract fee is included in Robinhood’s launch balance; the selected buy is additional.</p>
         <div className="multichain-funding-table-wrap">
           <table className="multichain-funding-table">
             <thead>
               <tr><th scope="col">Network</th><th scope="col">Total required</th><th scope="col">Creator address</th><th scope="col">Deposit status</th></tr>
             </thead>
             <tbody>
               <tr>
                 <th scope="row">Robinhood Chain <small>Chain ID 4663</small></th>
                 <td data-label="Total required">
                   <strong>{formatEthAmount(robinhoodExpectedWei)} ETH</strong>
                   <small>{PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH launch balance + {initialBuyEth} ETH initial buy</small>
                 </td>
                 <td data-label="Creator address" className="multichain-funding-address">
                   <code>{robinhoodAddress ?? "Create the Multichain password to generate the address."}</code>
                   {robinhoodAddress && <button type="button" className="button button-secondary compact" onClick={() => void copyCreatorAddress("Robinhood", robinhoodAddress)}>
                     {copiedNetwork === "Robinhood" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                     {copiedNetwork === "Robinhood" ? "Copied" : "Copy"}
                   </button>}
                   {ponsQr && <img className="multichain-funding-qr" src={ponsQr} alt="Robinhood deposit address QR code" />}
                 </td>
                 <td data-label="Deposit status">
                   <span className="multichain-funding-status">{ponsOrder.depositStatus === "confirmed" ? "Confirmed" : fundingLoading.robinhood ? "Preparing address…" : robinhoodAddress ? "Ready to fund" : "Password required"}</span>
                   {ponsOrder.depositAddress && <small>Balance: {formatEthAmount(ponsOrder.depositBalanceWei)} ETH</small>}
                   {!launchRequested && fundingErrors.robinhood && <small className="creator-inline-error" role="status">Robinhood funding could not be refreshed. Saved launch progress is preserved. Please refresh the balance.</small>}
                   {authorizations && ponsOrder.depositStatus !== "confirmed" && <button type="button" className="button button-secondary compact" disabled={fundingLoading.robinhood} onClick={() => void createPonsFundingOrder({ multichainInitialBuyEth: initialBuyEth }).catch(() => undefined)}>
                     {fundingLoading.robinhood ? "Checking…" : robinhoodAddress ? "Refresh balance" : "Prepare deposit"}
                   </button>}
                 </td>
               </tr>
               <tr>
                 <th scope="row">Ethereum <small>Chain ID 1</small></th>
                 <td data-label="Total required">
                   <strong>{formatEthAmount(ethereumExpectedWei)} ETH</strong>
                   <small>{ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH launch balance</small>
                 </td>
                 <td data-label="Creator address" className="multichain-funding-address">
                   <code>{ethereumAddress ?? "Create the Multichain password to generate the address."}</code>
                   {ethereumAddress && <button type="button" className="button button-secondary compact" onClick={() => void copyCreatorAddress("Ethereum", ethereumAddress)}>
                     {copiedNetwork === "Ethereum" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                     {copiedNetwork === "Ethereum" ? "Copied" : "Copy"}
                   </button>}
                   {ethereumQr && <img className="multichain-funding-qr" src={ethereumQr} alt="Ethereum deposit address QR code" />}
                 </td>
                 <td data-label="Deposit status">
                   <span className="multichain-funding-status">{ethereumOrder.depositStatus === "confirmed" ? "Confirmed" : fundingLoading.ethereum ? "Preparing address…" : ethereumAddress ? "Ready to fund" : "Password required"}</span>
                   {ethereumOrder.depositAddress && <small>Balance: {formatEthAmount(ethereumOrder.depositBalanceWei)} ETH</small>}
                   {!launchRequested && fundingErrors.ethereum && <small className="creator-inline-error" role="status">Ethereum funding could not be refreshed. Saved launch progress is preserved. Please refresh the balance.</small>}
                   {authorizations && ethereumOrder.depositStatus !== "confirmed" && <button type="button" className="button button-secondary compact" disabled={fundingLoading.ethereum} onClick={() => void createEthereumFundingOrder({ multichainInitialBuyEth: initialBuyEth }).catch(() => undefined)}>
                     {fundingLoading.ethereum ? "Checking…" : ethereumAddress ? "Refresh balance" : "Prepare deposit"}
                   </button>}
                 </td>
               </tr>
             </tbody>
           </table>
         </div>
         <p className="multichain-funding-note">Robinhood total = 0.0025 ETH launch funding (including the 0.0005 ETH Pons contract fee) + the selected initial buy. Ethereum total = 0.0025 ETH. Both chain balances are checked before launch transactions begin.</p>
       </section>
       <button
         type="button"
         className="button button-primary primary-action multichain-confirm-launch"
         disabled={!canConfirmLaunch}
         onClick={() => void confirmMultichainLaunch()}
         aria-busy={launchInProgress}
         data-testid="button-multichain-confirm-launch"
       >
         {checkingLaunch
           ? "Checking saved launch progress…"
           : launchInProgress && !launchStalled
           ? ethereumServerConfirmed ? "Launching on Robinhood…" : ethereumResult ? "Confirming Ethereum completion…" : "Launching on Ethereum…"
           : bothLaunchesConfirmed
             ? "Both launches complete"
             : launchNeedsResume || launchIssue || launchStalled || ethereumResult
               ? ethereumResult ? "Resume Robinhood launch" : "Resume Ethereum launch"
               : bothDepositsConfirmed
                 ? "Start Ethereum launch"
                 : "Waiting for both network deposits"}
       </button>
       <p className="optional" role="status" data-testid="multichain-launch-status">
         {bothLaunchesConfirmed
           ? "Ethereum and Robinhood launches complete. Bridge setup is handled automatically."
           : launchStalled
             ? "Confirmation is taking longer than expected. Click Resume to check saved progress before continuing."
             : launchIssue && !backendLaunchInProgress
               ? launchPauseMessage(Boolean(ethereumResult))
               : ethereumResult && !ethereumServerConfirmed && sequenceArmed
                 ? "Verifying Ethereum completion before Robinhood starts."
               : ethereumResult
                 ? sequenceArmed || launchIsActive(ponsOrder.launchStatus)
                   ? "Ethereum launch complete. Robinhood is processing next."
                   : "Ethereum launch complete. Click Resume to continue on Robinhood."
                 : launchInProgress
                   ? "Ethereum is processing. Robinhood will start automatically when Ethereum is confirmed complete."
                   : "Launch order: Ethereum, then Robinhood, then automatic bridge setup."}
       </p>
       <section className="multichain-activity" aria-labelledby="multichain-activity-heading">
         <h3 id="multichain-activity-heading">Multichain activity</h3>
         {activity.length ? <ol aria-live="polite">
           {activity.map((entry, index) => <li key={`${entry.key}:${index}`}>
             <span className={`multichain-activity-network network-${entry.network.toLowerCase()}`}>{entry.network}</span>
             <span>{entry.message}</span>
             {entry.txUrl && <a href={entry.txUrl} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13} aria-hidden="true" /></a>}
           </li>)}
         </ol> : <p role="status">Deposit and launch updates will appear here.</p>}
       </section>
      {authorizations && (
        <>
          <PonsMainnetLaunchExecutor
            draftId={draftId}
            authorization={authorizations.robinhood}
            tokenName={tokenName}
            tokenSymbol={tokenSymbol}
            fundingOrder={ponsOrder}
            fundingQrDataUrl={ponsQr}
            onCreateFundingOrder={createPonsFundingOrder}
            multichainInitialBuyEth={initialBuyEth}
            canExecute={bothDepositsConfirmed && ethereumServerConfirmed && sequenceArmed}
            launchTrigger={ponsLaunchTrigger}
            hideLaunchAction
            hideFundingCard
            hideProgressDetails
            hideLaunchIntro
            onProgress={(message) => appendActivity("Robinhood", message)}
            onExecutionState={(state, error) => updateLaunchState("Robinhood", state, error)}
            initialResult={ponsResult}
            onLaunched={(result) => {
              setPonsResult(result);
              setLaunchStates((current) => ({ ...current, robinhood: "completed" }));
              appendActivity("Robinhood", `Pons launch confirmed for ${result.tokenAddress}.`);
              recordTransactions("Robinhood", result.transactions);
            }}
          />
          <EthereumMainnetLaunchExecutor
            draftId={draftId}
            authorization={authorizations.ethereum}
            creatorPassword={creatorPassword}
            tokenName={tokenName}
            tokenSymbol={tokenSymbol}
            fundingOrder={ethereumOrder}
            fundingQrDataUrl={ethereumQr}
            onCreateFundingOrder={createEthereumFundingOrder}
            multichainInitialBuyEth={initialBuyEth}
            launchTrigger={launchTrigger}
            hideLaunchAction
            hideFundingCard
            hideProgressDetails
            hideLaunchIntro
            onProgress={(message) => appendActivity("Ethereum", message)}
            onExecutionState={(state, error) => updateLaunchState("Ethereum", state, error)}
            canExecute={bothDepositsConfirmed}
            deferRecoveryCapsule
            initialResult={ethereumResult}
            onLaunched={(result) => {
              setEthereumResult(result);
              setLaunchStates((current) => ({ ...current, ethereum: "completed" }));
              appendActivity("Ethereum", `Launch confirmed for ${result.tokenAddress}.`);
              recordTransactions("Ethereum", result.transactions);
            }}
            onContinue={() => undefined}
          />
        </>
      )}
      {completed && (
        <div className="review-grid" role="status">
          <div>
            <strong>Ethereum token</strong><code>{ethereumResult?.tokenAddress}</code>
            {ethereumResult && buildGmgnTokenUrl(ethereumResult.tokenAddress) && (
              <a href={buildGmgnTokenUrl(ethereumResult.tokenAddress)!} target="_blank" rel="noopener noreferrer">
                View on GMGN <ExternalLink size={13} />
              </a>
            )}
          </div>
          <div>
            <strong>Robinhood token</strong><code>{ponsResult?.tokenAddress}</code>
            {ponsResult && buildPonsTokenUrl(ponsResult.tokenAddress) && (
              <a href={buildPonsTokenUrl(ponsResult.tokenAddress)!} target="_blank" rel="noopener noreferrer">
                View on Pons <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      )}
      {bothLaunchesConfirmed && !launchRecordsVerified && !launchVerificationError && (
        <p className="optional" role="status">Verifying both mainnet launch records. The recovery capsule will remain closed until this check passes.</p>
      )}
      {bothLaunchesConfirmed && launchVerificationError && (
        <div className="creator-inline-error" role="alert">
          <p>Both launch results are available. We could not confirm the latest server status for the recovery file. Check again below; this will not repeat your launches.</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setLaunchVerificationAttempt((attempt) => attempt + 1)}
          >
            Retry launch status check
          </button>
        </div>
      )}
      {launchRecordsVerified && recoveryProgress && <p className="optional" role="status">{recoveryProgress}</p>}
      {launchRecordsVerified && recoveryError && <p className="creator-inline-error" role="alert">{recoveryError}</p>}
      {launchRecordsVerified && recoveryError && ponsResult && ethereumResult && creatorPassword && (
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            setRecoveryError("");
            setRecoveryAttempt((attempt) => attempt + 1);
          }}
        >
          Retry recovery capsule preparation
        </button>
      )}
      {bothLaunchesConfirmed && launchRecordsVerified && <dialog
        ref={recoveryDialog}
        className="launch-recovery-dialog"
        aria-label="Multichain recovery capsule"
        onCancel={(event) => event.preventDefault()}
      >
        <div className="launch-recovery-dialog-toolbar">
          <span>Both launch legs completed</span>
          <div className="launch-recovery-dialog-token">
            {ponsResult && buildPonsTokenUrl(ponsResult.tokenAddress) && (
              <a href={buildPonsTokenUrl(ponsResult.tokenAddress)!} target="_blank" rel="noopener noreferrer">
                View on Pons <ExternalLink size={13} />
              </a>
            )}
            {ethereumResult && buildGmgnTokenUrl(ethereumResult.tokenAddress) && (
              <a href={buildGmgnTokenUrl(ethereumResult.tokenAddress)!} target="_blank" rel="noopener noreferrer">
                View on GMGN <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
        <QuantumRecoveryCapsule
          payload={recoveryPayload}
          authorizationAvailable={Boolean(creatorPassword && recoveryPayload)}
          onContinue={() => {
            if (!ponsResult || !ethereumResult) throw new Error("Both launch records must be confirmed before completing recovery.");
            onCapsuleDownloaded(ponsResult, ethereumResult);
            setRecoveryOpen(false);
            setCreatorPassword("");
          }}
          tokenPageLinks={tokenPageLinks}
        />
      </dialog>}
    </section>
  );
}
