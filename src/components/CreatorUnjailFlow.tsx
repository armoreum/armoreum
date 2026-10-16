import { useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  getAddress,
  getBytes,
  hexlify,
  isAddress,
  parseEther,
  TypedDataEncoder,
  type TypedDataDomain,
  type TypedDataField,
} from "ethers";
import { ArrowRight, CircleAlert, ExternalLink, LoaderCircle, LogOut, Network, ShieldCheck, Wallet } from "lucide-react";
import {
  getGetLaunchQueryKey,
  useDeriveLaunchCreatorAuthorizationSeed,
  useGetLaunch,
  useRedeemCreatorRewardUnjail,
  useRequestCreatorRewardUnjail,
} from "@workspace/api-client-react";
import type { LaunchDetail, LaunchSummary, RelayedCreatorRewardTransaction } from "@workspace/api-client-react";
import type { Eip1193Provider } from "../contexts/wallet-context";
import {
  deriveCreatorPasswordKdf,
  derivePasswordAuthorizationProof,
  derivePasswordAuthorizationSigner,
  signPasswordAuthorizationDigest,
  validateCreatorAuthorizationPassword,
  type PasswordAuthorizationContext,
} from "../lib/creator-password-authorization";
import { launchChainId } from "../lib/launch-chain-ids";

type Props = {
  launches: LaunchSummary[];
  walletAddress: string;
  walletChainId: string;
  connecting: boolean;
  walletError: string;
  connectWallet: () => Promise<boolean>;
  switchWalletNetwork: (chainId: number) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  getWalletProvider: () => Eip1193Provider | null;
  selectionMode?: "token" | "network";
};

type RewardTransaction = {
  label: string;
  transaction: RelayedCreatorRewardTransaction;
};

type ReadyAuthorizationState = Omit<
  LaunchDetail["creatorRewardAuthorization"],
  | "passwordAuthorizationSigner"
  | "authorizationEpoch"
  | "redemptionCommitment"
  | "redemptionProofsRemaining"
  | "nonce"
  | "credentialVersion"
> & {
  passwordAuthorizationSigner: string;
  authorizationEpoch: number;
  claimCommitment: string;
  claimProofsRemaining: number;
  redemptionCommitment: string;
  redemptionProofsRemaining: number;
  nonce: string;
  credentialVersion: string;
};

const VAULT_ABI = [
  "function unjailRequestAuthorizationDigest(uint256 amount,address recipient,uint256 deadline) view returns (bytes32)",
];
const UNJAIL_TYPES: Record<string, TypedDataField[]> = {
  UnjailRequest: [
    { name: "launchId", type: "bytes32" },
    { name: "creator", type: "address" },
    { name: "chainId", type: "uint256" },
    { name: "vault", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "credentialVersion", type: "uint256" },
  ],
};

function formatEth(wei: string | null | undefined): string {
  if (!wei || !/^\d+$/.test(wei)) return "Unavailable";
  const value = BigInt(wei);
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function formatEthExact(wei: string): string {
  if (!/^\d+$/.test(wei)) return "";
  const value = BigInt(wei);
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function shortAddress(value: string | null | undefined): string {
  return value && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value || "Not set";
}

function chainNumber(value: string): number | null {
  if (!value) return null;
  try {
    return Number(BigInt(value));
  } catch {
    return null;
  }
}

async function hashProof(proof: string): Promise<string> {
  const source = new Uint8Array(getBytes(proof).length);
  source.set(getBytes(proof));
  const digest = await crypto.subtle.digest("SHA-256", source.buffer as ArrayBuffer);
  return hexlify(new Uint8Array(digest)).toLowerCase();
}

async function getCreatorSigner(
  expectedCreator: string,
  expectedChainId: number,
  connectWallet: () => Promise<boolean>,
  switchWalletNetwork: (chainId: number) => Promise<void>,
  getWalletProvider: () => Eip1193Provider | null,
): Promise<{ signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>; provider: BrowserProvider }> {
  if (!getWalletProvider() && !(await connectWallet())) throw new Error("Connect the creator wallet to continue.");
  const injected = getWalletProvider();
  if (!injected) throw new Error("Reown did not provide a connected wallet. Connect again and retry.");

  const currentChain = await injected.request({ method: "eth_chainId" });
  if (typeof currentChain !== "string" || chainNumber(currentChain) !== expectedChainId) {
    try {
      await switchWalletNetwork(expectedChainId);
    } catch {
      const networkName = expectedChainId === 1 ? "Ethereum" : "Robinhood";
      throw new Error(`Switch the connected wallet to ${networkName} (chain ID ${expectedChainId}), then try again.`);
    }
  }
  const verifiedChain = await injected.request({ method: "eth_chainId" });
  if (typeof verifiedChain !== "string" || chainNumber(verifiedChain) !== expectedChainId) {
    const networkName = expectedChainId === 1 ? "Ethereum" : "Robinhood";
    throw new Error(`The connected wallet is not on ${networkName} (chain ID ${expectedChainId}).`);
  }

  const accounts = await injected.request({ method: "eth_requestAccounts" });
  const activeAddress = Array.isArray(accounts)
    ? accounts.find((value): value is string => typeof value === "string" && isAddress(value))
    : undefined;
  if (!activeAddress || getAddress(activeAddress) !== getAddress(expectedCreator)) {
    throw new Error("The connected account must be the creator wallet for this token.");
  }
  const provider = new BrowserProvider(
    injected as unknown as ConstructorParameters<typeof BrowserProvider>[0],
  );
  const signer = await provider.getSigner(expectedCreator);
  return { signer, provider };
}

function requireRewardState(launch: LaunchDetail) {
  if (
    !launch.creatorAddress ||
    !launch.vaultAddress ||
    (launch.chainId !== 1 && launch.chainId !== 4663)
  ) {
    throw new Error("This launch is missing a verified creator vault mapping.");
  }
  const state = launch.creatorRewardAuthorization;
  if (!state.passwordAuthorizationMode || !state.authorizationConfigured) {
    throw new Error("This Creator Vault does not have verified password authorization enabled.");
  }
  if (
    !state.passwordAuthorizationSigner ||
    state.authorizationEpoch === null ||
    state.redemptionCommitment === null ||
    state.redemptionProofsRemaining === null ||
    state.nonce === null ||
    state.credentialVersion === null
  ) {
    throw new Error("The current on-chain authorization state is incomplete.");
  }
  return {
    state: state as ReadyAuthorizationState,
    creatorAddress: launch.creatorAddress,
    vaultAddress: launch.vaultAddress,
    chainId: launch.chainId,
    launchId: launch.launchMode === "ethereum" || launch.id.startsWith("ethereum:")
      ? launch.id.slice("ethereum:".length)
      : launch.ponsLaunchId || launch.id,
  };
}

export function CreatorUnjailFlow({
  launches,
  walletAddress,
  walletChainId,
  connecting,
  walletError,
  connectWallet,
  switchWalletNetwork,
  disconnectWallet,
  getWalletProvider,
  selectionMode = "token",
}: Props) {
  const networkMode = selectionMode === "network";
  const [networkChoice, setNetworkChoice] = useState<"" | "ethereum" | "robinhood">("");
  const eligibleLaunches = useMemo(
    () => networkMode ? launches.slice(0, 1) : launches.filter((item) => (item.chainId === 1 || item.chainId === 4663) && item.vaultStatus === "verified"),
    [launches, networkMode],
  );
  const [tokenLaunchId, setLaunchId] = useState("");
  const launchId = networkMode
    ? (networkChoice && launches[0] ? launchChainId(launches[0].id, networkChoice) : "")
    : tokenLaunchId;
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [walletAction, setWalletAction] = useState<"disconnect" | "switch" | null>(null);
  const [lastTransactions, setLastTransactions] = useState<RewardTransaction[]>([]);
  const launchQuery = useGetLaunch(launchId, {
    query: {
      queryKey: getGetLaunchQueryKey(launchId),
      enabled: Boolean(launchId),
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
  });
  const seedMutation = useDeriveLaunchCreatorAuthorizationSeed();
  const requestMutation = useRequestCreatorRewardUnjail();
  const redeemMutation = useRedeemCreatorRewardUnjail();

  useEffect(() => {
    if (networkMode) return;
    if (!eligibleLaunches.some((item) => item.id === launchId)) {
      setLaunchId(eligibleLaunches[0]?.id || "");
    }
  }, [launchId, eligibleLaunches, networkMode]);

  useEffect(() => {
    const clear = () => setPassword("");
    window.addEventListener("pagehide", clear);
    return () => window.removeEventListener("pagehide", clear);
  }, []);

  useEffect(() => {
    setPassword("");
  }, [walletAddress, walletChainId]);

  const expectedChain = networkChoice === "ethereum" ? 1 : networkChoice === "robinhood" ? 4663 : null;
  const responseValid = (item: LaunchDetail | undefined) => !networkMode || Boolean(
    item && launchId && item.id.toLowerCase() === launchId.toLowerCase() && item.chainId === expectedChain,
  );
  const mismatch = networkMode && Boolean(launchQuery.data) && !launchQuery.isFetching && !responseValid(launchQuery.data);
  const activeLaunch = responseValid(launchQuery.data) ? launchQuery.data : undefined;
  const authState = activeLaunch?.creatorRewardAuthorization;
  const launchBalance = activeLaunch?.creatorJailEthBalance;
  const recipientAddress = isAddress(recipient.trim()) ? getAddress(recipient.trim()) : "";
  let weiAmount = 0n;
  try {
    if (/^\d+(?:\.\d{1,18})?$/.test(amount.trim())) weiAmount = parseEther(amount.trim());
  } catch {
    weiAmount = 0n;
  }
  const jailBalance = launchBalance && /^\d+$/.test(launchBalance) ? BigInt(launchBalance) : 0n;
  const amountValid = weiAmount > 0n && weiAmount <= jailBalance;
  const pendingUnjail = authState?.pendingOperation?.operation === "unjail"
    ? authState.pendingOperation
    : null;

  async function refreshLaunch() {
    await launchQuery.refetch();
  }

  async function passwordSeed(
    launch: NonNullable<typeof activeLaunch>,
    task: (seed: Uint8Array, context: PasswordAuthorizationContext, provider: BrowserProvider, signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>) => Promise<void>,
  ) {
    validateCreatorAuthorizationPassword(password);
    if (networkMode && !responseValid(launch)) throw new Error("The launch state does not match the selected network. Reload and try again.");
    const creatorContext = requireRewardState(launch);
    const { signer, provider } = await getCreatorSigner(
      creatorContext.creatorAddress,
      creatorContext.chainId,
      connectWallet,
      switchWalletNetwork,
      getWalletProvider,
    );
    const kdf = await deriveCreatorPasswordKdf(password, creatorContext.launchId);
    try {
      const response = await seedMutation.mutateAsync({
        launchId: creatorContext.launchId,
        data: { passwordKdf: hexlify(kdf) },
      });
      if (
        response.chainId !== creatorContext.chainId ||
        response.launchId.toLowerCase() !== creatorContext.launchId.toLowerCase() ||
        getAddress(response.creatorAddress) !== getAddress(creatorContext.creatorAddress) ||
        getAddress(response.vaultAddress) !== getAddress(creatorContext.vaultAddress)
      ) {
        throw new Error("The password response does not match this verified Creator Vault.");
      }
      const seed = getBytes(response.seed);
      try {
        const context: PasswordAuthorizationContext = {
          chainId: creatorContext.chainId,
          vaultAddress: creatorContext.vaultAddress,
          creatorAddress: creatorContext.creatorAddress,
          launchId: creatorContext.launchId,
        };
        const signerAddress = await derivePasswordAuthorizationSigner(seed, context);
        if (getAddress(signerAddress) !== getAddress(creatorContext.state.passwordAuthorizationSigner!)) {
          throw new Error("This password does not derive the active on-chain authorization signer.");
        }
        await task(seed, context, provider, signer);
      } finally {
        seed.fill(0);
      }
    } finally {
      kdf.fill(0);
      seedMutation.reset();
    }
  }

  async function onRequestUnjail() {
    setError("");
    setIsWorking(true);
    try {
      if (!activeLaunch || !recipientAddress || !amountValid) {
        throw new Error("Choose a valid recipient and a positive amount no greater than the available JailETH balance.");
      }
      if (recipientAddress === getAddress(activeLaunch.creatorAddress!)) {
        throw new Error("The ETH payout address must not be the creator wallet.");
      }
      if (recipientAddress === getAddress(activeLaunch.vaultAddress!)) {
        throw new Error("The payout address cannot be this launch’s Creator Vault.");
      }
      const fresh = await launchQuery.refetch();
      if (!fresh.data) throw new Error("Current on-chain launch state could not be refreshed.");
      await passwordSeed(fresh.data, async (seed, context, provider, signer) => {
        const { state, creatorAddress, vaultAddress, chainId, launchId: authorizationLaunchId } = requireRewardState(fresh.data!);
        if (state.pendingOperation) throw new Error("Another creator reward operation is pending. Finish it before requesting another Unjail.");
        if (state.redemptionProofsRemaining < 2) {
          throw new Error("At least two redemption proofs must remain: one for the request and one for the final burn-and-payout.");
        }
        if (BigInt(fresh.data!.creatorJailEthBalance || "0") < weiAmount) {
          throw new Error("The current JailETH balance is lower than the requested amount.");
        }
        const proof = await derivePasswordAuthorizationProof(
          seed,
          context,
          "redemption",
          state.authorizationEpoch!,
          state.redemptionProofsRemaining,
        );
        if ((await hashProof(proof)) !== state.redemptionCommitment!.toLowerCase()) {
          throw new Error("The locally derived proof does not match the current on-chain commitment.");
        }
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        const domain: TypedDataDomain = {
          name: "ArmoreumCreatorRewardVault",
          version: "2",
          chainId,
          verifyingContract: vaultAddress,
        };
        const message = {
          launchId: authorizationLaunchId,
          creator: creatorAddress,
          chainId,
          vault: vaultAddress,
          amount: weiAmount,
          recipient: recipientAddress,
          nonce: BigInt(state.nonce!),
          deadline,
          credentialVersion: BigInt(state.credentialVersion!),
        };
        const digest = await new Contract(vaultAddress, VAULT_ABI, provider)
          .unjailRequestAuthorizationDigest(weiAmount, recipientAddress, deadline) as string;
        if (TypedDataEncoder.hash(domain, UNJAIL_TYPES, message).toLowerCase() !== digest.toLowerCase()) {
          throw new Error("The local typed-data format does not match the deployed Creator Vault.");
        }
        const creatorSignature = await signer.signTypedData(domain, UNJAIL_TYPES, message);
        const passwordSignature = await signPasswordAuthorizationDigest(seed, context, digest);
        const result = await requestMutation.mutateAsync({
          launchId: authorizationLaunchId,
          data: {
            amountWei: weiAmount.toString(),
            recipient: recipientAddress,
            deadline: deadline.toString(),
            oneTimeProof: proof,
            creatorSignature,
            passwordSignature,
          },
        });
        setLastTransactions((current) => [{ label: "Unjail request", transaction: result }, ...current].slice(0, 4));
        await refreshLaunch();
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unjail request failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function onRedeem() {
    setError("");
    setIsWorking(true);
    try {
      if (!activeLaunch) throw new Error("Select a verified launch.");
      const fresh = await launchQuery.refetch();
      if (!fresh.data) throw new Error("Current on-chain launch state could not be refreshed.");
      await passwordSeed(fresh.data, async (seed, context) => {
        const { state, launchId: authorizationLaunchId } = requireRewardState(fresh.data!);
        const pending = state.pendingOperation;
        if (!pending || pending.operation !== "unjail") {
          throw new Error("There is no pending Unjail request to redeem.");
        }
        if (pending.expectedEpoch !== state.authorizationEpoch) {
          throw new Error("The pending request belongs to a different authorization epoch.");
        }
        if (state.redemptionProofsRemaining < 1) {
          throw new Error("No redemption proof remains to complete this Unjail.");
        }
        const proof = await derivePasswordAuthorizationProof(
          seed,
          context,
          "redemption",
          pending.expectedEpoch,
          state.redemptionProofsRemaining,
        );
        if ((await hashProof(proof)) !== state.redemptionCommitment!.toLowerCase()) {
          throw new Error("The locally derived proof does not match the current on-chain commitment.");
        }
        const result = await redeemMutation.mutateAsync({
          launchId: authorizationLaunchId,
          data: { expectedEpoch: pending.expectedEpoch, oneTimeProof: proof },
        });
        setLastTransactions((current) => [{ label: "JailETH burn and ETH payout", transaction: result }, ...current].slice(0, 4));
        setPassword("");
        await refreshLaunch();
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unjail redemption failed.");
    } finally {
      setIsWorking(false);
    }
  }

  const selectedLaunchLabel = eligibleLaunches.find((item) => item.id === launchId);
  const available = authState?.passwordAuthorizationMode && authState.authorizationConfigured;
  const connectedChain = chainNumber(walletChainId);
  const selectedChainId = networkMode ? (expectedChain ?? 0) : (selectedLaunchLabel?.chainId ?? 4663);
  const selectedNetworkName = networkMode && !networkChoice ? "the selected network" : selectedChainId === 1 ? "Ethereum" : "Robinhood";
  const networkPending = networkMode && !networkChoice;
  const walletAccountMatches = Boolean(
    activeLaunch?.creatorAddress &&
    walletAddress &&
    getAddress(activeLaunch.creatorAddress) === getAddress(walletAddress),
  );
  const walletChainMatches = connectedChain === selectedChainId;
  const walletMatches = walletAccountMatches && walletChainMatches;
  const hasPendingAction = Boolean(authState?.pendingOperation);

  async function switchToSelectedNetwork() {
    setWalletAction("switch");
    setError("");
    try {
      await switchWalletNetwork(selectedChainId);
      const provider = getWalletProvider();
      const chain = await provider?.request({ method: "eth_chainId" });
      if (typeof chain !== "string" || chainNumber(chain) !== selectedChainId) {
        throw new Error(`Wallet did not switch to ${selectedNetworkName}.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not switch to ${selectedNetworkName}.`);
    } finally {
      setWalletAction(null);
    }
  }

  async function disconnectCreatorWallet() {
    setWalletAction("disconnect");
    setError("");
    try {
      await disconnectWallet();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet could not be disconnected.");
    } finally {
      setWalletAction(null);
    }
  }

  return (
    <section className="panel unjail-panel creator-unjail-flow">
      <div className="claim-flow-heading">
        <div>
          <h2>Creator Unjail</h2>
          <p>Burn the selected launch’s JailETH and pay native ETH from that launch’s isolated Creator Vault to a different address.</p>
        </div>
        <span className={`creator-unjail-status ${available ? "is-ready" : ""}`}>
          {launchQuery.isLoading ? "Loading on-chain state" : available ? "On-chain auth ready" : "Not available"}
        </span>
      </div>

      {(!networkMode || Boolean(activeLaunch)) && (!walletAddress ? (
        <div className="creator-unjail-wallet-note">
          <p>Import the published creator key into a wallet you control, then connect that creator account. You can choose a different wallet in the connection window. The creator account signs authorization; Armoreum’s {selectedNetworkName} sponsor pays transaction gas.</p>
          <button type="button" className="button button-secondary" onClick={() => void connectWallet()} disabled={connecting} data-testid="button-connect-creator-wallet">
            <Wallet size={15} aria-hidden="true" />{connecting ? "Connecting…" : "Connect creator wallet"}
          </button>
        </div>
      ) : (
        <div className="creator-unjail-wallet-note">
          <span data-testid="status-connected-creator-wallet"><Wallet size={15} aria-hidden="true" /> Connected creator account</span>
          <strong className="mono" data-testid="text-connected-creator-wallet">{shortAddress(walletAddress)}</strong>
          <span className={walletChainMatches ? "creator-unjail-chain-ok" : "creator-unjail-chain-warn"} data-testid="status-creator-wallet-network">
            {networkPending ? "Choose a network below" : walletChainMatches ? `${selectedNetworkName} · ${selectedChainId}` : `Wallet chain ${connectedChain ?? "unknown"} · ${selectedNetworkName} required`}
          </span>
          {activeLaunch && !walletAccountMatches && (
            <span className="creator-unjail-chain-warn">This token requires creator account {shortAddress(activeLaunch.creatorAddress)}.</span>
          )}
          <div className="creator-unjail-wallet-actions">
            <p>To use another account, disconnect this wallet and then reconnect the creator account.</p>
            {!networkPending && !walletChainMatches && (
              <button type="button" className="button button-secondary compact" onClick={() => void switchToSelectedNetwork()} disabled={walletAction !== null || isWorking} data-testid="button-switch-creator-network">
                {walletAction === "switch" ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Network size={14} aria-hidden="true" />}
                {walletAction === "switch" ? "Switching…" : `Switch to ${selectedNetworkName}`}
              </button>
            )}
            <button type="button" className="button button-secondary compact" onClick={() => void disconnectCreatorWallet()} disabled={walletAction !== null || isWorking} data-testid="button-disconnect-creator-wallet">
              {walletAction === "disconnect" ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <LogOut size={14} aria-hidden="true" />}
              {walletAction === "disconnect" ? "Disconnecting…" : "Disconnect wallet"}
            </button>
          </div>
        </div>
      ))}

      {eligibleLaunches.length === 0 ? (
        <div className="state-box empty-state">
          <CircleAlert size={18} aria-hidden="true" />
          <div><strong>No verified Creator Vault found</strong><p>Creator launch cards appear here only after their on-chain launch and isolated vault mapping have been verified on Ethereum or Robinhood.</p></div>
        </div>
      ) : (
        <>
          {networkMode && <label className="creator-field launch-picker">
            Choose network first
            <select value={networkChoice} disabled={isWorking || walletAction !== null} data-testid="select-unjail-network" onChange={(event) => { setNetworkChoice(event.target.value as "" | "ethereum" | "robinhood"); setPassword(""); setAmount(""); setRecipient(""); setError(""); setLastTransactions([]); }}>
              <option value="" disabled>Select Ethereum or Robinhood</option>
              <option value="ethereum">Ethereum</option>
              <option value="robinhood">Robinhood</option>
            </select>
          </label>}
          {networkPending ? <div className="state-box empty-state" role="status"><Network size={18} aria-hidden="true" /><div><strong>Select a network to continue</strong><p>This Multichain token has a separate Creator Vault on each network. Balances and actions appear only after you choose one.</p></div></div> : <>
          {!networkMode && <label className="creator-field launch-picker">
            Select your token
            <select value={launchId} onChange={(event) => { setLaunchId(event.target.value); setPassword(""); setAmount(""); setRecipient(""); setError(""); setLastTransactions([]); }}>
              {eligibleLaunches.map((item) => (
                <option value={item.id} key={item.id}>{item.name || item.symbol || item.id} {item.symbol ? `(${item.symbol})` : ""} · {item.networkId === "ethereum" ? "Ethereum" : "Robinhood"} · {shortAddress(item.tokenAddress)}</option>
              ))}
            </select>
          </label>}

          {mismatch ? (
            <div className="state-box error-state" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>Response did not match {selectedNetworkName}</strong><p>The returned launch is not the {selectedNetworkName} record. No action is available.</p><button type="button" className="button button-secondary compact" onClick={() => void launchQuery.refetch()}>Retry</button></div></div>
          ) : launchQuery.isError ? (
            <div className="state-box error-state"><CircleAlert size={18} aria-hidden="true" /><div><strong>Live vault state unavailable</strong><p>The page could not read the verified contract state. No action has been sent.</p><button type="button" className="button button-secondary compact" onClick={() => void launchQuery.refetch()}>Retry</button></div></div>
          ) : launchQuery.isLoading ? (
            <div className="creator-unjail-loading"><LoaderCircle size={17} className="spin" aria-hidden="true" />Reading this token’s Creator Vault on {selectedNetworkName}…</div>
          ) : activeLaunch ? (
            <>
              <div className="creator-unjail-facts">
                <div><span>Creator address</span><strong className="mono">{shortAddress(activeLaunch.creatorAddress)}</strong></div>
                <div><span>Creator Vault</span><strong className="mono">{shortAddress(activeLaunch.vaultAddress)}</strong></div>
                <div><span>JailETH available to burn</span><strong>{formatEth(activeLaunch.creatorJailEthBalance)} ETH</strong></div>
                <div><span>Vault ETH accrued</span><strong>{formatEth(activeLaunch.vaultHeldFees?.find((fee) => fee.assetSymbol === "ETH")?.amount)} ETH</strong></div>
                <div><span>Authorization epoch / proofs left</span><strong>{authState?.authorizationEpoch ?? "—"} / {authState?.redemptionProofsRemaining ?? "—"}</strong></div>
                <div><span>Minimum Unjail</span><strong>None; limited by JailETH balance</strong></div>
              </div>

              {(activeLaunch.chainId !== 1 && activeLaunch.chainId !== 4663) || activeLaunch.authorizationStatus !== "verified" || !available ? (
                <div className="state-box error-state"><CircleAlert size={18} aria-hidden="true" /><div><strong>Actions blocked by live contract state</strong><p>This launch is not reporting a verified password-authorized vault. The UI will not submit a substitute or guessed transaction.</p></div></div>
              ) : (
                <>
                  <div className="creator-unjail-form-grid">
                    <label className="creator-field">
                      ETH recipient (must differ from creator wallet)
                      <input value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="off" inputMode="text" placeholder="0x…" aria-invalid={Boolean(recipient && !recipientAddress)} />
                    </label>
                    <label className="creator-field">
                      JailETH amount to burn
                      <div className="creator-unjail-amount">
                        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Enter any amount" aria-invalid={Boolean(amount && !amountValid)} />
                        <button type="button" onClick={() => setAmount(formatEthExact(jailBalance.toString()))} disabled={jailBalance === 0n || isWorking}>Max</button>
                      </div>
                    </label>
                    <label className="creator-field creator-unjail-password">
                      Creator password
                      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" spellCheck={false} placeholder="Enter the launch password" />
                    </label>
                  </div>
                  <p className="creator-unjail-balance-hint">Any positive amount up to {formatEth(activeLaunch.creatorJailEthBalance)} ETH is eligible. JailETH issued from launch surplus can be redeemed; there is no 0.01 ETH minimum.</p>
                  <p className="creator-unjail-note"><ShieldCheck size={15} aria-hidden="true" />Your password stays in this page; only its Argon2id output is sent to derive the launch authorization seed. The server relays actions only after both signatures and the one-time proof are supplied. The creator key shown above is only for importing the creator account; it is not sent with the Unjail request. The recovery file is not needed.</p>

                  {!walletAccountMatches && <p className="creator-unjail-warning">Connect the creator account shown for this token before signing an action.</p>}
                  {walletAddress && walletAccountMatches && !walletChainMatches && <p className="creator-unjail-warning">Switch the connected wallet to {selectedNetworkName} before signing an action.</p>}
                  {authState?.redemptionProofsRemaining === 0 && <p className="creator-unjail-warning">This authorization epoch has no redemption proofs left. The contract requires an epoch rotation before another Unjail.</p>}

                  {!pendingUnjail && (
                    <button type="button" className="button button-primary creator-unjail-action" onClick={() => void onRequestUnjail()} disabled={!walletMatches || isWorking || !amountValid || !recipientAddress || recipientAddress.toLowerCase() === activeLaunch.creatorAddress?.toLowerCase() || recipientAddress.toLowerCase() === activeLaunch.vaultAddress?.toLowerCase() || (authState?.redemptionProofsRemaining ?? 0) < 2 || hasPendingAction}>
                      {isWorking ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />}Sign and request Unjail
                    </button>
                  )}

                  {pendingUnjail && (
                    <div className="creator-unjail-pending">
                      <div><strong>Unjail request confirmed as pending</strong><span>Burn {formatEth(pendingUnjail.amountWei)} JailETH · get {formatEth(pendingUnjail.amountWei)} ETH at {shortAddress(pendingUnjail.recipient)}</span></div>
                      <button type="button" className="button button-primary" onClick={() => void onRedeem()} disabled={!walletMatches || isWorking || (authState?.redemptionProofsRemaining ?? 0) < 1}>
                        {isWorking ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />}Burn JailETH and get ETH
                      </button>
                    </div>
                  )}

                  <div className="creator-unjail-review">
                    <span>Expected payout</span><strong>{amountValid ? `${formatEth(weiAmount.toString())} ETH` : "Enter an amount within the JailETH balance"}</strong>
                    <span>Destination</span><strong className="mono">{recipientAddress ? shortAddress(recipientAddress) : "Not set"}</strong>
                    <span>Gas payer</span><strong>{activeLaunch.chainId === 1 ? "Armoreum Ethereum sponsor · EIP-1559 fee estimate" : "Armoreum Robinhood sponsor · base fee + 20% cap"}</strong>
                    <span>Vault rule</span><strong>1 JailETH burned = 1 ETH sent from this token’s Creator Vault</strong>
                  </div>
                </>
              )}
            </>
          ) : null}
          </>}
        </>
      )}

      {error && <p className="creator-inline-error" role="alert">{error}</p>}
      {walletError && <p className="creator-inline-error" role="alert">{walletError}</p>}

      {lastTransactions.length > 0 && (
        <div className="creator-unjail-transactions" aria-live="polite">
          <h3>On-chain transaction status</h3>
          {lastTransactions.map(({ label, transaction }) => (
            <div className="creator-unjail-tx" key={`${label}:${transaction.transactionHash}`}>
              <span><strong>{label}</strong><small>{transaction.status === "confirmed" ? `Confirmed on ${selectedNetworkName}` : transaction.status === "failed" ? `Transaction failed on ${selectedNetworkName}` : "Submitted; confirmation is still pending"}</small></span>
              <a href={transaction.explorerUrl} target="_blank" rel="noreferrer" aria-label={`View ${label} on ${selectedNetworkName} explorer`}>
                {shortAddress(transaction.transactionHash)} <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          ))}
        </div>
      )}

      {selectedLaunchLabel && <p className="creator-unjail-footer">This screen reads the selected launch’s own Creator Vault. It does not combine balances or recipients across tokens.</p>}
    </section>
  );
}
