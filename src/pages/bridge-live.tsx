import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  BrowserProvider,
  Contract,
  formatEther,
  formatUnits,
  parseUnits,
} from 'ethers';
import { ArrowLeftRight, ChevronDown, ExternalLink, RefreshCw, Route, Wallet } from 'lucide-react';
import { BrandTextTree } from '@/lib/brand-text';
import { transactionGasOverrides } from '@/lib/evmGasPolicy';
import { useArmoreumWallet } from '@/contexts/wallet-context';
import { bridgeBalanceAmount, readBridgeTokenBalance } from '@/lib/bridge-wallet-balance';
import { useBridgeWalletBalance } from '@/hooks/use-bridge-wallet-balance';
import { getAlchemyReadProvider, requireNativeGas } from '@/lib/alchemy-rpc';
import { loadBridgeLiquidity, useBridgeLiquidity } from '@/hooks/use-bridge-liquidity';
import { bridgeWalletErrorMessage, type BridgeWalletStage } from '@/lib/bridge-wallet-errors';
import { LayerZeroTransferStatus } from '@/components/layerzero-transfer-status';
import { submitBridgeForTracking } from '@/hooks/use-bridge-submission-tracking';
import { explorerAmount, explorerUtc, layerZeroScanTransactionUrl } from '@/lib/bridge-explorer-format';
import { Link } from 'wouter';
import './defi-flow.css';
import './bridge-transfer-history.css';
import './bridge-page-header.css';

type ChainId = 1 | 4663;
type Direction = 'ethereum-to-robinhood' | 'robinhood-to-ethereum';
type BridgePair = {
  launchDraftId: string;
  launchId: string;
  name: string;
  symbol: string;
  imageUrl: string;
  ethereumToken: string;
  robinhoodToken: string;
  ethereumBridge: string;
  robinhoodBridge: string;
  sharedCapacity: string;
};
type Transfer = {
  id: string;
  sourceChainId: number;
  destinationChainId: number;
  sender: string;
  recipient: string;
  grossAmount: string;
  destinationFee: string;
  recipientAmount: string;
  sourceTransactionHash: string;
  destinationTransactionHash: string | null;
  status: string;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
};
type Quote = {
  amount: string;
  destinationFee: string;
  recipientAmount: string;
  nativeFee: string;
  lzTokenFee: string;
};
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

const tokenAbi = [
  'function allowance(address owner,address spender) view returns(uint256)',
  'function approve(address spender,uint256 amount) returns(bool)',
];
const bridgeAbi = [
  'function lockAndSend(address recipient,uint256 amount,bytes options) payable returns(bytes32 transferId)',
];
const networkInfo: Record<ChainId, { name: string; explorer: string }> = {
  1: { name: 'Ethereum', explorer: 'https://etherscan.io/tx/' },
  4663: { name: 'Robinhood Chain', explorer: 'https://robin.etherscan.io/tx/' },
};

function chainIdFromDirection(direction: Direction): ChainId {
  return direction === 'ethereum-to-robinhood' ? 1 : 4663;
}

function parseChainId(value: string): number | null {
  if (/^0x[\da-f]+$/i.test(value)) return Number.parseInt(value, 16);
  if (/^\d+$/.test(value)) return Number(value);
  return null;
}

function shortAddress(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function statusLabel(status: string) {
  if (status === 'delivered') return 'Delivered';
  if (status === 'source-finalized') return 'Verifying and relaying';
  if (status === 'source-confirmed') return 'Verifying and relaying';
  if (status === 'destination-submitted') return 'Destination transaction pending';
  return status.replaceAll('-', ' ');
}

export function BridgeTransferPanel({ tokenAddress, embedded = false, initialSourceChainId = 1 }: { tokenAddress?: string; embedded?: boolean; initialSourceChainId?: ChainId }) {
  const {
    walletAddress,
    walletChainId,
    walletError,
    connecting,
    connectWallet,
    switchWalletNetwork,
    disconnectWallet,
    getWalletProvider,
  } = useArmoreumWallet();
  const [pairs, setPairs] = useState<BridgePair[]>([]);
  const [searchToken, setSearchToken] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [pairsLoading, setPairsLoading] = useState(true);
  const [pairsError, setPairsError] = useState('');
  const [direction, setDirection] = useState<Direction>(initialSourceChainId === 4663 ? 'robinhood-to-ethereum' : 'ethereum-to-robinhood');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const account = walletAddress;
  const connectedChainId = parseChainId(walletChainId);
  const [savedQuote, setQuote] = useState<(Quote & { contextKey: string }) | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastTx, setLastTx] = useState<{ hash: string; chainId: ChainId; kind: 'approval' | 'bridge' } | null>(null);
  const amountInputId = useId();

  const requestedLaunchId = useMemo(
    () => embedded ? '' : new URLSearchParams(window.location.search).get('launchId')?.toLowerCase() ?? '',
    [embedded],
  );
  const requestedToken = useMemo(
    () => (embedded ? tokenAddress ?? '' : searchToken.trim()).toLowerCase(),
    [embedded, searchToken, tokenAddress],
  );
  const hasRequestedPair = embedded || Boolean(requestedLaunchId || requestedToken);
  const scopedPairs = useMemo(() => {
    if (!hasRequestedPair) return [];
    return pairs.filter((item) =>
      item.launchId.toLowerCase() === requestedLaunchId ||
      item.ethereumToken.toLowerCase() === requestedToken ||
      item.robinhoodToken.toLowerCase() === requestedToken,
    );
  }, [hasRequestedPair, pairs, requestedLaunchId, requestedToken]);
  const pair = useMemo(
    () => scopedPairs.length === 1 ? scopedPairs[0] : null,
    [scopedPairs],
  );
  const selectedId = pair?.launchDraftId ?? '';
  const matchedInputChain = pair?.robinhoodToken.toLowerCase() === requestedToken ? 4663 : 1;
  useEffect(() => {
    if (!embedded && selectedId) setDirection(matchedInputChain === 4663 ? 'robinhood-to-ethereum' : 'ethereum-to-robinhood');
  }, [embedded, selectedId, requestedToken, matchedInputChain]);
  const sourceChainId = chainIdFromDirection(direction);
  const transactionContext = `${account?.toLowerCase() ?? ''}:${sourceChainId}:${selectedId}`;
  const currentTransactionContext = useRef('');
  useEffect(() => {
    currentTransactionContext.current = transactionContext;
    return () => { currentTransactionContext.current = ''; };
  }, [transactionContext]);
  const destinationChainId: ChainId = sourceChainId === 1 ? 4663 : 1;
  const sourceName = networkInfo[sourceChainId].name;
  const destinationName = networkInfo[destinationChainId].name;
  const sourceBridge = pair
    ? sourceChainId === 1 ? pair.ethereumBridge : pair.robinhoodBridge
    : '';
  const sourceToken = pair
    ? sourceChainId === 1 ? pair.ethereumToken : pair.robinhoodToken
    : '';
  const destinationToken = pair
    ? destinationChainId === 1 ? pair.ethereumToken : pair.robinhoodToken
    : '';
  const effectiveRecipient = recipient.trim() || account || '';
  const quoteContextKey = JSON.stringify([pair?.launchDraftId, sourceChainId, account, effectiveRecipient, amount]);
  const quote = savedQuote?.contextKey === quoteContextKey ? savedQuote : null;
  const walletBalance = useBridgeWalletBalance({
    account: account || '', chainId: sourceChainId, token: sourceToken,
    refreshIntervalMs: busy ? 2_000 : 5_000,
  });
  let amountBaseUnits: bigint | null = null;
  try { if (amount) amountBaseUnits = parseUnits(amount, 18); } catch { /* Incomplete input is not transferable. */ }
  const exceedsBalance = walletBalance.raw !== null && amountBaseUnits !== null && amountBaseUnits > walletBalance.raw;
  const liquidity = useBridgeLiquidity(selectedId, sourceChainId);
  const reserveMax = liquidity.data ? BigInt(liquidity.data.maxAmount) : null;
  const exceedsReserve = reserveMax !== null && amountBaseUnits !== null && amountBaseUnits > reserveMax;
  const maximumAvailable = walletBalance.raw !== null && reserveMax !== null
    ? walletBalance.raw < reserveMax ? walletBalance.raw : reserveMax : null;
  const limitFallback = maximumAvailable ?? reserveMax;

  const loadPairs = useCallback(async () => {
    try {
      const response = await fetch('/api/multichain-bridges');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load active Armoreum Multichain launches.');
      const active = Array.isArray(payload) ? payload as BridgePair[] : [];
      setPairs(active);
      setPairsError('');
    } catch (cause) {
      setPairsError(cause instanceof Error ? cause.message : 'Could not load active bridge pairs.');
    }
    finally { setPairsLoading(false); }
  }, []);

  const loadTransfers = useCallback(async (draftId: string) => {
    if (!draftId) {
      setTransfers([]);
      return;
    }
    try {
      const response = await fetch(`/api/launch-drafts/${encodeURIComponent(draftId)}/multichain-bridge`);
      const payload = await response.json();
      if (response.ok && Array.isArray(payload.transfers)) setTransfers(payload.transfers as Transfer[]);
    } catch {
      // Existing history stays visible while the next poll retries.
    }
  }, []);

  useEffect(() => {
    void loadPairs();
    const timer = window.setInterval(() => void loadPairs(), 12_000);
    return () => window.clearInterval(timer);
  }, [loadPairs]);

  useEffect(() => {
    setQuote(null);
    setError('');
    setNotice('');
    setRecipient('');
  }, [account, selectedId]);

  const historyPollMs = busy || transfers.some(row => !['delivered', 'failed', 'source-failed'].includes(row.status)) ? 2_000 : 6_000;
  useEffect(() => {
    void loadTransfers(selectedId);
    const timer = window.setInterval(() => void loadTransfers(selectedId), historyPollMs);
    return () => window.clearInterval(timer);
  }, [account, loadTransfers, selectedId, historyPollMs]);

  useEffect(() => {
    setError('');
  }, [amount, recipient]);

  useEffect(() => {
    setQuote(null);
    setQuoteError('');
    if (!pair || !account || !amount || reserveMax === null || amountBaseUnits === null || amountBaseUnits <= 0n || exceedsBalance || exceedsReserve || !/^0x[\da-f]{40}$/i.test(effectiveRecipient)) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const baseUnits = parseUnits(amount, 18).toString();
        const response = await fetch(
          `/api/launch-drafts/${encodeURIComponent(pair.launchDraftId)}/multichain-bridge/quote`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sourceChainId, recipient: effectiveRecipient, amount: baseUnits }),
          },
        );
        const payload = await response.json();
        if (!response.ok) {
          if (payload.code === 'DESTINATION_LIQUIDITY_EXCEEDED' && typeof payload.maxAmount === 'string' && /^\d+$/.test(payload.maxAmount)) {
            liquidity.refresh();
            throw new Error(`Per-transfer limit changed. Maximum: ${formatUnits(payload.maxAmount, 18)} ${pair.symbol} to ${destinationName}.`);
          }
          throw new Error(payload.error || 'Bridge quote unavailable.');
        }
        if (!cancelled) setQuote({ ...payload as Quote, contextKey: quoteContextKey });
      } catch (cause) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(cause instanceof Error ? cause.message : 'Bridge quote unavailable.');
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [account, amount, amountBaseUnits, effectiveRecipient, exceedsBalance, exceedsReserve, reserveMax, pair, quoteContextKey, sourceChainId, destinationName, liquidity.refresh]);

  const onConnectWallet = async () => {
    setError('');
    try {
      const connected = await connectWallet();
      if (!connected) setError(walletError || 'Wallet connection was not approved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wallet connection was not approved.');
    }
  };

  const switchNetwork = async () => {
    try {
      await switchWalletNetwork(sourceChainId);
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : `Switch your wallet to ${sourceName}.`);
    }
  };

  const submitTransfer = async () => {
    const injected = getWalletProvider() as unknown as Eip1193Provider | null;
    if (!pair || !injected || !account || !quote) return;
    if (walletBalance.raw === null) {
      setError('Refresh your token balance before bridging.');
      return;
    }
    if (exceedsBalance) {
      setError(`Amount exceeds your token balance on ${sourceName}.`);
      return;
    }
    if (reserveMax === null || exceedsReserve) {
      setError('Check the current per-transfer limit before bridging.');
      return;
    }
    const destinationRecipient = effectiveRecipient;
    if (!/^0x[\da-f]{40}$/i.test(destinationRecipient)) {
      setError('Enter a valid destination wallet or leave it blank to use your connected wallet.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    setLastTx(null);
    let walletStage: BridgeWalletStage = 'preflight';
    let submittedHash = '';
    try {
      const provider = new BrowserProvider(injected as never);
      const readProvider = getAlchemyReadProvider(sourceChainId);
      const chain = await provider.getNetwork();
      if (Number(chain.chainId) !== sourceChainId) {
        throw new Error(`Switch your wallet to ${sourceName} before continuing.`);
      }
      const signer = await provider.getSigner(account);
      const amountBaseUnits = parseUnits(amount, 18);
      const freshBalance = await readBridgeTokenBalance(sourceChainId, sourceToken, account);
      if (amountBaseUnits > freshBalance) {
        walletBalance.refresh();
        throw new Error(`Amount exceeds your current token balance on ${sourceName}.`);
      }
      const checkDestinationReserve = async () => {
        const latest = await loadBridgeLiquidity(pair.launchDraftId, sourceChainId);
        if (amountBaseUnits > BigInt(latest.maxAmount)) {
          liquidity.refresh();
          throw new Error(`Per-transfer limit changed. Maximum: ${formatUnits(latest.maxAmount, 18)} ${pair.symbol} to ${destinationName}.`);
        }
      };
      await checkDestinationReserve();
      const checkWalletContext = async () => {
        const activeChain = await injected.request({ method: 'eth_chainId' });
        const activeAccounts = await injected.request({ method: 'eth_accounts' });
        if (currentTransactionContext.current !== transactionContext ||
            typeof activeChain !== 'string' || Number(BigInt(activeChain)) !== sourceChainId ||
            !Array.isArray(activeAccounts) || !activeAccounts.some((value) => typeof value === 'string' && value.toLowerCase() === account.toLowerCase())) {
          throw new Error('Your wallet account or network changed. Check the bridge direction and try again.');
        }
      };
      await checkWalletContext();
      const token = new Contract(sourceToken, tokenAbi, readProvider);
      const currentAllowance = BigInt(await token.allowance(account, sourceBridge));
      if (currentAllowance < amountBaseUnits) {
        setNotice('Approve the token allowance in your wallet.');
        const approve = token.getFunction('approve');
        const approveEstimate = await approve.estimateGas(sourceBridge, amountBaseUnits, { from: account });
        const approveGas = await transactionGasOverrides(readProvider, approveEstimate, sourceName);
        await requireNativeGas(readProvider, account, approveGas);
        await checkWalletContext();
        walletStage = 'approval';
        const approveHash = await signer.sendUncheckedTransaction({
          to: sourceToken, data: token.interface.encodeFunctionData('approve', [sourceBridge, amountBaseUnits]), ...approveGas,
        });
        submittedHash = approveHash;
        setLastTx({ hash: approveHash, chainId: sourceChainId, kind: 'approval' });
        const approvalReceipt = await readProvider.waitForTransaction(approveHash, 1, 180_000);
        if (!approvalReceipt || approvalReceipt.status !== 1) throw new Error('The token approval failed on the source network.');
        submittedHash = '';
        walletStage = 'preflight';
        setNotice('Token approval confirmed. Checking the bridge transfer.');
      }
      const postApprove = await provider.getNetwork();
      if (Number(postApprove.chainId) !== sourceChainId) {
        throw new Error(`The wallet network changed. Switch back to ${sourceName} and submit again.`);
      }
      const freshSigner = await provider.getSigner(account);
      if ((await freshSigner.getAddress()).toLowerCase() !== account.toLowerCase()) {
        throw new Error('The connected wallet account changed. Reconnect the original account and submit again.');
      }
      const bridge = new Contract(sourceBridge, bridgeAbi, readProvider);
      await checkDestinationReserve();
      const freshQuoteResponse = await fetch(`/api/launch-drafts/${encodeURIComponent(pair.launchDraftId)}/multichain-bridge/quote`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceChainId, recipient: destinationRecipient, amount: amountBaseUnits.toString() }),
      });
      const freshQuote = await freshQuoteResponse.json();
      if (!freshQuoteResponse.ok) {
        liquidity.refresh();
        throw new Error(freshQuote.code === 'DESTINATION_LIQUIDITY_EXCEEDED' && typeof freshQuote.maxAmount === 'string'
          ? `Per-transfer limit changed. Maximum: ${formatUnits(freshQuote.maxAmount, 18)} ${pair.symbol} to ${destinationName}.`
          : freshQuote.error || 'The latest bridge quote is unavailable.');
      }
      const nativeFee = BigInt(freshQuote.nativeFee);
      if (freshQuote.launchDraftId !== pair.launchDraftId || freshQuote.sourceChainId !== sourceChainId ||
          freshQuote.amount !== amountBaseUnits.toString() ||
          typeof freshQuote.recipient !== 'string' || freshQuote.recipient.toLowerCase() !== destinationRecipient.toLowerCase() ||
          typeof freshQuote.sourceToken !== 'string' || freshQuote.sourceToken.toLowerCase() !== sourceToken.toLowerCase() ||
          typeof freshQuote.sourceBridge !== 'string' || freshQuote.sourceBridge.toLowerCase() !== sourceBridge.toLowerCase()) {
        throw new Error('The latest quote does not match this token, network, amount, or recipient.');
      }
      await checkWalletContext();
      const send = bridge.getFunction('lockAndSend');
      const sendEstimate = await send.estimateGas(
        destinationRecipient,
        amountBaseUnits,
        '0x',
        { value: nativeFee, from: account },
      );
      const sendGas = await transactionGasOverrides(readProvider, sendEstimate, sourceName);
      await requireNativeGas(readProvider, account, sendGas, nativeFee);
      setNotice('Confirm the bridge transfer in your wallet.');
      await checkWalletContext();
      walletStage = 'transfer';
      const hash = await freshSigner.sendUncheckedTransaction({
        to: sourceBridge, data: bridge.interface.encodeFunctionData('lockAndSend', [destinationRecipient, amountBaseUnits, '0x']),
        value: nativeFee, ...sendGas,
      });
      submittedHash = hash;
      walletStage = 'confirmation';
      setLastTx({ hash, chainId: sourceChainId, kind: 'bridge' });
      const trackingInput = { launchDraftId: pair.launchDraftId, sourceChainId, transactionHash: hash };
      const initialTracking = submitBridgeForTracking(trackingInput);
      setNotice('Transaction submitted. Waiting for source-chain confirmation.');
      const receipt = await readProvider.waitForTransaction(hash, 1, 180_000);
      if (!receipt || receipt.status !== 1) throw new Error('The source-chain transaction failed.');
      await initialTracking;
      const tracked = await submitBridgeForTracking(trackingInput);
      setNotice(tracked
        ? 'Source transaction confirmed. Explorer tracking is active; waiting for source finality and destination delivery.'
        : 'Source transaction confirmed. Explorer tracking will retry automatically. Do not send the transaction again.');
      walletBalance.refresh();
      liquidity.refresh();
      await loadTransfers(pair.launchDraftId);
    } catch (cause) {
      setNotice('');
      setError(bridgeWalletErrorMessage(cause, walletStage, submittedHash));
      walletBalance.refresh();
      liquidity.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <BrandTextTree>
      <div className={`defi-flow-page bridge-live-page${embedded ? ' is-embedded' : ''}`} data-testid={embedded ? 'panel-bridge-embedded' : 'page-bridge'}>
        {!embedded && <header className="bridge-page-header">
          <div className="bridge-page-heading">
            <span className="bridge-page-heading-icon" aria-hidden="true"><ArrowLeftRight size={22} /></span>
            <div className="bridge-page-title">
              <span className="bridge-page-eyebrow">ARMOREUM MULTICHAIN</span>
              <h1>Bridge</h1>
            </div>
          </div>
          <div className="bridge-page-header-meta">
            <p className="bridge-page-networks"><span>Ethereum</span><ArrowLeftRight size={14} aria-hidden="true" /><span>Robinhood Chain</span></p>
            <span className="bridge-page-scope"><span aria-hidden="true" />Armoreum launch pairs only</span>
          </div>
          <p className="bridge-page-description">
            Move tokens between Ethereum and Robinhood Chain, with live transfer tracking.
          </p>
        </header>}

        <div className="defi-flow-layout">
          <section className="defi-flow-card bridge-card" aria-labelledby={embedded ? undefined : 'bridge-form-title'} aria-label={embedded ? 'Bridge transfer' : undefined}>
            <div className="defi-flow-card-heading">
              {embedded ? <span className="defi-flow-card-kicker">LayerZero transfer</span> : <div><span className="defi-flow-card-kicker">LIVE TRANSFER</span><h2 id="bridge-form-title">Route your transfer</h2></div>}
              <span className="defi-flow-card-status">{pair ? 'Bridge active' : hasRequestedPair ? 'Bridge not active' : 'No active pairs'}</span>
            </div>
            {!embedded && <label className="defi-flow-field bridge-token-lookup">
              <span>Token contract address</span>
              <input value={searchToken} disabled={busy} onChange={(event) => setSearchToken(event.target.value)}
                placeholder="Paste Ethereum or Robinhood CA" autoComplete="off" spellCheck={false}
                aria-label="Token contract address" data-testid="input-bridge-token-address" />
              <small>Enter either contract address. Its paired token is found automatically.</small>
            </label>}
            {pairsError && <p className="defi-flow-error" role="alert">{pairsError}</p>}
            {!pair ? (
              <p className="defi-flow-inline-note">
                {pairsLoading ? 'Checking active token pairs…'
                  : !hasRequestedPair ? 'Paste a token contract address to get started.'
                  : requestedToken && !/^0x[\da-f]{40}$/i.test(requestedToken) ? 'Enter a valid Ethereum or Robinhood token contract address.'
                  : scopedPairs.length > 1 ? 'More than one bridge matched this token. Enter its exact contract address.'
                  : 'No active Multichain bridge was found for this token. This page checks again automatically.'}
              </p>
            ) : (
              <>
                {!embedded && <p className="bridge-matched-token" role="status" data-testid="bridge-matched-token">{pair.name} <strong>{pair.symbol}</strong></p>}
                <div className="bridge-route-picker">
                  <div className="bridge-network-field">
                    <span>From</span><strong>{embedded && sourceChainId === 4663 ? 'Robinhood' : sourceName}</strong>
                    <small className="font-mono text-[10px] text-muted-foreground" title={sourceToken} data-testid="text-bridge-source-token">{pair?.symbol}<br />{sourceToken.slice(0, 6)}...{sourceToken.slice(-4)}</small>
                  </div>
                  <button
                    type="button"
                    className="bridge-direction-toggle"
                    aria-label="Reverse bridge direction"
                    disabled={busy}
                    onClick={() => setDirection((current) => current === 'ethereum-to-robinhood' ? 'robinhood-to-ethereum' : 'ethereum-to-robinhood')}
                  ><ArrowLeftRight size={17} /></button>
                  <div className="bridge-network-field">
                    <span>To</span><strong>{embedded && destinationChainId === 4663 ? 'Robinhood' : destinationName}</strong>
                    <small className="font-mono text-[10px] text-muted-foreground" title={destinationToken} data-testid="text-bridge-destination-token">{pair?.symbol}<br />{destinationToken.slice(0, 6)}...{destinationToken.slice(-4)}</small>
                  </div>
                </div>
                <div className="defi-flow-field bridge-amount-field">
                  <div className="bridge-amount-heading">
                    <label htmlFor={amountInputId}>Amount ({pair?.symbol})</label>
                    <div className="bridge-amount-shortcuts" role="group" aria-label="Set bridge amount">
                      <button type="button" disabled={busy || maximumAvailable === null || maximumAvailable < 2n}
                        onClick={() => maximumAvailable !== null && setAmount(bridgeBalanceAmount(maximumAvailable, 50))}
                        data-testid="button-bridge-half">50%</button>
                      <button type="button" disabled={busy || maximumAvailable === null || maximumAvailable <= 0n}
                        onClick={() => maximumAvailable !== null && setAmount(bridgeBalanceAmount(maximumAvailable, 100))}
                        data-testid="button-bridge-max">Max</button>
                    </div>
                  </div>
                  <input
                    id={amountInputId}
                    disabled={busy}
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    aria-label="Bridge amount"
                    aria-invalid={exceedsBalance || exceedsReserve}
                  />
                  <div className="bridge-wallet-balance" role="status" data-testid="bridge-wallet-token-balance">
                    <span>{walletBalance.status === 'disconnected' ? 'Connect wallet to view balance.'
                      : walletBalance.status === 'unavailable' ? 'Wallet balance unavailable.'
                      : `Balance on ${sourceName}`}</span>
                    {account && <div className="bridge-wallet-balance-value">
                      <strong>{walletBalance.status === 'loading' ? 'Loading…'
                        : walletBalance.raw !== null ? `${formatUnits(walletBalance.raw, 18)} ${pair?.symbol}`
                        : 'Unavailable'}</strong>
                      <button type="button" onClick={walletBalance.refresh}
                        disabled={walletBalance.status === 'loading' || walletBalance.status === 'unavailable'}
                        aria-label="Refresh token balance" title="Refresh token balance"><RefreshCw size={13} /></button>
                    </div>}
                  </div>
                  {walletBalance.status === 'error' && <small role="alert">Could not read your token balance. Refresh to try again.</small>}
                  {exceedsBalance && <small className="bridge-balance-warning" role="alert">Amount exceeds your balance on {sourceName}.</small>}
                  <div className="bridge-reserve-status" data-testid="bridge-destination-reserve">
                    <span>Max per transfer to {destinationChainId === 4663 ? 'Robinhood' : 'Ethereum'}</span>
                    <strong>{reserveMax !== null ? `${formatUnits(reserveMax, 18)} ${pair.symbol}` : liquidity.error ? 'Unavailable' : 'Checking reserve…'}</strong>
                  </div>
                  <small>Each transfer is limited to 10% of the available destination reserve.</small>
                  {liquidity.error && <div className="bridge-reserve-warning" role="alert">
                    <span>Could not check the destination reserve.</span>
                    <button type="button" onClick={liquidity.refresh}>Retry</button>
                  </div>}
                  {exceedsReserve && <div className="bridge-reserve-warning" role="alert">
                    <span>Amount exceeds the per-transfer limit. Maximum: {formatUnits(reserveMax!, 18)} {pair.symbol} to {destinationChainId === 4663 ? 'Robinhood' : 'Ethereum'}.</span>
                    {limitFallback !== null && limitFallback > 0n && <button type="button" disabled={busy}
                      onClick={() => setAmount(bridgeBalanceAmount(limitFallback, 100))}
                      data-testid="button-bridge-use-max">Use max: {formatUnits(limitFallback, 18)} {pair.symbol}</button>}
                  </div>}
                </div>
                <label className="defi-flow-field">
                  <span>Destination wallet (optional)</span>
                  <input
                    value={recipient}
                    disabled={busy}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder="0x... (optional)"
                    aria-label="Optional destination wallet address"
                  />
                  <small>Defaults to your connected wallet.</small>
                </label>
                <div className="bridge-quote-summary">
                <div className="defi-flow-summary-row">
                  <span>Destination receives</span>
                  <strong>{quote ? `${formatUnits(quote.recipientAmount, 18)} ${pair?.symbol}` : 'Get a quote'}</strong>
                </div>
                <div className="defi-flow-summary-row">
                  <span>Destination fee · 0.2%</span>
                  <span>{quote ? `${formatUnits(quote.destinationFee, 18)} ${pair?.symbol}` : '—'}</span>
                </div>
                <div className="defi-flow-summary-row">
                  <span>LayerZero fee</span>
                  <span>{quote ? `${formatEther(quote.nativeFee)} ETH` : '—'}</span>
                </div>
                <small className="bridge-gas-note">Source-chain gas is paid separately.</small>
                </div>
                {!account ? (
                  <button type="button" className="defi-flow-submit" onClick={() => void connectWallet()}>
                    <Wallet size={16} /> Connect wallet
                  </button>
                ) : connectedChainId !== sourceChainId ? (
                  <button type="button" className="defi-flow-submit" onClick={() => void switchNetwork()}>
                    Switch wallet to {sourceName}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="defi-flow-submit"
                    disabled={!quote || busy || !amount || !effectiveRecipient || walletBalance.status !== 'ready' || reserveMax === null || exceedsReserve || exceedsBalance || amountBaseUnits === null || amountBaseUnits <= 0n}
                    onClick={() => void submitTransfer()}
                  >
                    {busy ? 'Confirm in wallet…' : `Bridge ${pair?.symbol}`}
                  </button>
                )}
                {account && (
                  <div className="defi-flow-inline-note bridge-connected-wallet">
                    <span>Connected {shortAddress(account)}</span>
                    <button
                      type="button"
                      className="bridge-history-refresh"
                      onClick={() => void disconnectWallet().catch((cause) => {
                        setError(cause instanceof Error ? cause.message : 'Wallet could not be disconnected.');
                      })}
                    >
                      Disconnect wallet
                    </button>
                  </div>
                )}
              </>
            )}
            {(error || walletError || quoteError) && <p className="defi-flow-error" role="alert">{error || walletError || quoteError}</p>}
            {notice && <p className="defi-flow-inline-note" role="status">{notice}</p>}
            {lastTx && (
              <a href={`${networkInfo[lastTx.chainId].explorer}${lastTx.hash}`} target="_blank" rel="noreferrer">
                {lastTx.kind === 'approval' ? 'View token approval' : 'View bridge transaction'} <ExternalLink size={14} />
              </a>
            )}
          </section>

          <details className="bridge-history-section" open={embedded ? undefined : true}>
            <summary>Transfer history <ChevronDown size={16} aria-hidden="true" /></summary>
          <aside className="defi-flow-info-card bridge-tracking-card" aria-labelledby={embedded ? undefined : 'bridge-tracking-title'} aria-label={embedded ? 'Transfer history' : undefined}>
            {!embedded && <><div className="defi-flow-info-icon" aria-hidden="true"><Route size={19} /></div>
            <span className="defi-flow-eyebrow">TRANSFER HISTORY</span>
            <h2 id="bridge-tracking-title">Tracking & confirmation</h2></>}
            <div className="bridge-history-toolbar">
            <Link href="/bridge-explorer" className="bridge-history-explorer">Bridge explorer <ExternalLink size={13} /></Link>
            <button type="button" className="bridge-history-refresh" onClick={() => void loadTransfers(selectedId)}>
              <RefreshCw size={14} /> Refresh
            </button>
            </div>
            {transfers.length === 0 ? (
              <p className="defi-flow-inline-note">Submitted transactions are tracked in Bridge explorer. Confirmed transfers appear here automatically.</p>
            ) : (
              <div className="bridge-history-list">
                {[...transfers].reverse().map((transfer) => (
                  <article className="bridge-history-item" key={transfer.id}>
                    <header className="bridge-history-top">
                      <strong>{explorerAmount(transfer.grossAmount)} <span>{pair?.symbol}</span></strong>
                    <span className="defi-flow-card-status">{statusLabel(transfer.status)}</span>
                    </header>
                    <p className="bridge-history-route">{networkInfo[transfer.sourceChainId as ChainId].name} <span aria-hidden="true">→</span> {networkInfo[transfer.destinationChainId as ChainId].name}</p>
                    <time dateTime={transfer.createdAt}>{explorerUtc(transfer.createdAt)}</time>
                    <nav className="bridge-history-links" aria-label="Transfer transaction links">
                    <a href={`${networkInfo[transfer.sourceChainId as ChainId].explorer}${transfer.sourceTransactionHash}`} target="_blank" rel="noreferrer">
                      Source <ExternalLink size={13} />
                    </a>
                    {transfer.destinationTransactionHash && (
                      <a href={`${networkInfo[transfer.destinationChainId as ChainId].explorer}${transfer.destinationTransactionHash}`} target="_blank" rel="noreferrer">
                        Destination <ExternalLink size={13} />
                      </a>
                    )}
                    <a href={layerZeroScanTransactionUrl(transfer.sourceTransactionHash)} target="_blank" rel="noopener noreferrer">LayerZero Scan <ExternalLink size={13} /></a>
                    </nav>
                    <div className="bridge-history-scan">
                    {pair && <LayerZeroTransferStatus
                      hash={transfer.sourceTransactionHash}
                      sourceBridge={transfer.sourceChainId === 1 ? pair.ethereumBridge : pair.robinhoodBridge}
                      destinationBridge={transfer.sourceChainId === 1 ? pair.robinhoodBridge : pair.ethereumBridge}
                    />}
                    </div>
                    {transfer.lastError && <small role="status">Relay retrying: {transfer.lastError}</small>}
                  </article>
                ))}
              </div>
            )}
          </aside>
          </details>
        </div>
      </div>
    </BrandTextTree>
  );
}

export default function BridgePage() {
  return <BridgeTransferPanel />;
}
