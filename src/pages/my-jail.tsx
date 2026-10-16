import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserProvider, Contract, formatEther, formatUnits, parseEther, parseUnits, ZeroAddress } from 'ethers';
import { NETWORKS } from '@workspace/api-zod';
import { getListLaunchesQueryKey, useListLaunches, type LaunchSummary } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useArmoreumWallet } from '@/contexts/wallet-context';
import { transactionGasOverrides } from '@/lib/evmGasPolicy';
import { MY_JAIL_DEPLOYMENTS } from '@/lib/my-jail-deployments';
import MyJailPage, { type MyJailAction, type MyJailPosition, type MyJailStatus } from '@/components/my-jail-page';
import JailBankComingSoon from '@/components/jail-bank-coming-soon';

export default function JailBankRoute() {
  return <JailBankComingSoon />;
}

const PERSONAL_FACTORY_ABI = [
  'function vaultByOwner(address owner) view returns (address)',
  'function createVault() returns (address)',
];

const VAULT_FACTORY_ABI = [
  'function getJailAssetBalances(address account, bytes32[] launchIds) view returns ((bytes32 launchId,address jailSwapVault,address launchToken,address jailToken,uint256 jailTokenBalance,address jailEthReceipt,uint256 jailEthBalance)[])',
];

const PERSONAL_VAULT_ABI = [
  'function trackedLaunchIds() view returns (bytes32[])',
  'function buy(bytes32 launchId,uint256 amountIn,uint256 minimumJailTokenOut,uint256 deadline) payable returns (uint256)',
  'function sell(bytes32 launchId,uint256 jailTokenAmount,uint256 minimumJailEthOut,uint256 deadline) returns (uint256)',
  'function unjailToken(bytes32 launchId,uint256 amount,uint256 deadline)',
  'function redeemJailETH(bytes32 launchId,uint256 amount,uint256 deadline)',
  'function withdrawETH(uint256 amount)',
];

const TOKEN_METADATA_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

type PageState = {
  status: MyJailStatus;
  walletEthBalance: string | null;
  vaultAddress: string | null;
  vaultEthBalance: string | null;
  positions: MyJailPosition[];
  errorMessage: string | null;
};

type ActiveAction = {
  action: MyJailAction;
  launchId?: string;
};

const EMPTY_STATE: PageState = {
  status: 'loading',
  walletEthBalance: null,
  vaultAddress: null,
  vaultEthBalance: null,
  positions: [],
  errorMessage: null,
};

function parseChainId(value: string) {
  if (!value) return null;
  const chainId = value.startsWith('0x') ? Number.parseInt(value, 16) : Number(value);
  return Number.isSafeInteger(chainId) ? chainId : null;
}

function userError(error: unknown) {
  if (error && typeof error === 'object' && 'shortMessage' in error && typeof error.shortMessage === 'string') {
    return error.shortMessage;
  }
  if (error && typeof error === 'object' && 'reason' in error && typeof error.reason === 'string') {
    return error.reason;
  }
  return error instanceof Error ? error.message : 'The wallet request failed. No success is assumed.';
}

function parsePositiveAmount(value: string, unit: 'eth' | 'receipt') {
  const amount = unit === 'eth' ? parseEther(value) : parseUnits(value, 18);
  if (amount <= 0n) throw new Error('Enter an amount greater than zero.');
  return amount;
}

export function PersonalVaultRoute() {
  const {
    walletAddress, walletChainId, walletProvider, getWalletProvider,
    connectWallet, switchWalletNetwork, connecting,
  } = useArmoreumWallet();
  const chainId = parseChainId(walletChainId);
  const network = chainId === 1 ? NETWORKS.ethereum : chainId === 4663 ? NETWORKS.robinhood : null;
  const deployment = chainId === null ? null : MY_JAIL_DEPLOYMENTS[chainId] ?? null;
  const [pageState, setPageState] = useState<PageState>(EMPTY_STATE);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [networkSwitching, setNetworkSwitching] = useState<number | null>(null);
  const [networkSwitchError, setNetworkSwitchError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [amount, setAmount] = useState('');
  const [slippagePercent, setSlippagePercent] = useState('1');
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [marketCursor, setMarketCursor] = useState<string | undefined>();
  const [allLaunches, setAllLaunches] = useState<LaunchSummary[]>([]);
  const marketParams = useMemo(
    () => ({ lifecycle: 'all' as const, ...(marketCursor ? { cursor: marketCursor } : {}) }),
    [marketCursor],
  );
  const launchQuery = useListLaunches(
    marketParams,
    { query: { queryKey: getListLaunchesQueryKey(marketParams), enabled: Boolean(walletAddress) } },
  );
  const currentLaunches = launchQuery.data?.items ?? [];
  useEffect(() => {
    if (!currentLaunches.length) return;
    setAllLaunches((previous) => {
      const byId = new Map(previous.map((launch) => [launch.id, launch]));
      currentLaunches.forEach((launch) => byId.set(launch.id, launch));
      return Array.from(byId.values());
    });
  }, [currentLaunches]);
  const marketLaunches = allLaunches;
  const loadMoreLaunches = useCallback(() => {
    const nextCursor = launchQuery.data?.nextCursor;
    if (nextCursor) setMarketCursor(nextCursor);
  }, [launchQuery.data?.nextCursor]);

  const refresh = useCallback(() => setRefreshVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!walletAddress) {
        setPageState({ ...EMPTY_STATE, status: 'disconnected' });
        return;
      }
      if (!network || !deployment) {
        setPageState({
          ...EMPTY_STATE,
          status: chainId === 1 || chainId === 4663 ? 'error' : 'unsupported-network',
          errorMessage: chainId === 1 || chainId === 4663
            ? 'The personal-vault deployment has not been verified and enabled on this network yet.'
            : null,
        });
        return;
      }
      const injectedProvider = getWalletProvider() || walletProvider;
      if (!injectedProvider) {
        setPageState({ ...EMPTY_STATE, status: 'error', errorMessage: 'Reown did not provide a connected wallet session.' });
        return;
      }
      setPageState((previous) => ({ ...previous, status: 'loading', errorMessage: null }));
      try {
        const provider = new BrowserProvider(injectedProvider as never);
        const liveNetwork = await provider.getNetwork();
        if (Number(liveNetwork.chainId) !== chainId) {
          throw new Error('The wallet network changed. Refresh the page after Reown updates the connected chain.');
        }
        const [walletBalance, vaultFactoryCode, personalFactoryCode] = await Promise.all([
          provider.getBalance(walletAddress),
          provider.getCode(deployment.vaultFactory),
          provider.getCode(deployment.personalVaultFactory),
        ]);
        if (vaultFactoryCode === '0x' || personalFactoryCode === '0x') {
          throw new Error('The configured personal-vault contracts do not have verified code on this network.');
        }
        const personalFactory = new Contract(deployment.personalVaultFactory, PERSONAL_FACTORY_ABI, provider);
        const vaultAddress = await personalFactory.vaultByOwner(walletAddress) as string;
        if (!vaultAddress || vaultAddress.toLowerCase() === ZeroAddress) {
          if (cancelled) return;
          setPageState({
            status: 'no-vault',
            walletEthBalance: formatEther(walletBalance),
            vaultAddress: null,
            vaultEthBalance: null,
            positions: [],
            errorMessage: null,
          });
          return;
        }
        const [vaultBalance, trackedLaunchIds] = await Promise.all([
          provider.getBalance(vaultAddress),
          new Contract(vaultAddress, PERSONAL_VAULT_ABI, provider).trackedLaunchIds() as Promise<string[]>,
        ]);
        const matchingLaunchIds = marketLaunches
          .filter((launch) => launch.chainId === chainId || launch.networkId === network.id)
          .map((launch) => launch.id);
        const launchIds = Array.from(new Set([...trackedLaunchIds, ...matchingLaunchIds]));
        const rows = launchIds.length
          ? await new Contract(deployment.vaultFactory, VAULT_FACTORY_ABI, provider)
            .getJailAssetBalances(vaultAddress, launchIds) as Array<{
              launchId: string;
              jailSwapVault: string;
              launchToken: string;
              jailToken: string;
              jailTokenBalance: bigint;
              jailEthReceipt: string;
              jailEthBalance: bigint;
            }>
          : [];
        const positions = await Promise.all(rows
          .filter((row) => row.jailSwapVault !== ZeroAddress && row.launchToken !== ZeroAddress)
          .map(async (row) => {
            let name = 'Token';
            let symbol = 'TOKEN';
            try {
              const token = new Contract(row.launchToken, TOKEN_METADATA_ABI, provider);
              [name, symbol] = await Promise.all([token.name(), token.symbol()]);
            } catch {
              // Keep a truthful address-based position when a token omits optional metadata.
            }
            return {
              launchId: row.launchId,
              name,
              symbol,
              tokenAddress: row.launchToken,
              jailTokenAddress: row.jailToken,
              jailTokenBalance: formatUnits(row.jailTokenBalance, 18),
              jailEthAddress: row.jailEthReceipt,
              jailEthBalance: formatEther(row.jailEthBalance),
            };
          }));
        if (cancelled) return;
        setPageState({
          status: 'ready',
          walletEthBalance: formatEther(walletBalance),
          vaultAddress,
          vaultEthBalance: formatEther(vaultBalance),
          positions,
          errorMessage: null,
        });
      } catch (error) {
        if (!cancelled) {
          setPageState({
            ...EMPTY_STATE,
            status: 'error',
            errorMessage: userError(error),
          });
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [walletAddress, walletChainId, walletProvider, getWalletProvider, chainId, network, deployment, refreshVersion, marketLaunches]);

  const activePosition = useMemo(
    () => pageState.positions.find((position) => position.launchId === activeAction?.launchId) ?? null,
    [pageState.positions, activeAction],
  );

  const connect = useCallback(() => {
    void connectWallet();
  }, [connectWallet]);

  const selectChain = useCallback(async (targetChainId: number) => {
    if (targetChainId === chainId || networkSwitching !== null) return;
    setNetworkSwitchError(null);
    setNetworkSwitching(targetChainId);
    try {
      await switchWalletNetwork(targetChainId);
      if (walletAddress) {
        const deadline = Date.now() + 12_000;
        let confirmedChainId: number | null = null;
        while (Date.now() < deadline) {
          const currentProvider = getWalletProvider() || walletProvider;
          if (!currentProvider) throw new Error('Reown wallet session ended while switching networks.');
          const rawChainId = await currentProvider.request({ method: 'eth_chainId' });
          confirmedChainId = parseChainId(String(rawChainId));
          if (confirmedChainId === targetChainId) break;
          await new Promise((resolve) => window.setTimeout(resolve, 300));
        }
        if (confirmedChainId !== targetChainId) {
          throw new Error('The wallet did not confirm the selected network. Jail Bank will keep showing the chain the wallet is actually on.');
        }
      }
      refresh();
    } catch (error) {
      setNetworkSwitchError(userError(error));
    } finally {
      setNetworkSwitching(null);
    }
  }, [chainId, networkSwitching, switchWalletNetwork, walletAddress, getWalletProvider, walletProvider, refresh]);

  const openAction = useCallback((action: MyJailAction, launchId?: string) => {
    setActiveAction({ action, launchId });
    setAmount('');
    setQuoteText(null);
    setActionError(null);
  }, []);

  const getFreshContractContext = useCallback(async () => {
    if (!walletAddress || !pageState.vaultAddress || !deployment) {
      throw new Error('Connect the wallet and create its personal vault first.');
    }
    const injectedProvider = getWalletProvider() || walletProvider;
    if (!injectedProvider) throw new Error('Reown wallet provider is unavailable.');
    const provider = new BrowserProvider(injectedProvider as never);
    const signer = await provider.getSigner(walletAddress);
    const vault = new Contract(pageState.vaultAddress, PERSONAL_VAULT_ABI, signer);
    return { provider, signer, vault };
  }, [walletAddress, pageState.vaultAddress, deployment, getWalletProvider, walletProvider]);

  const createVault = useCallback(async () => {
    if (!walletAddress || !deployment) return;
    setBusyAction('Creating personal vault');
    try {
      const injectedProvider = getWalletProvider() || walletProvider;
      if (!injectedProvider) throw new Error('Reown wallet provider is unavailable.');
      const provider = new BrowserProvider(injectedProvider as never);
      const signer = await provider.getSigner(walletAddress);
      const factory = new Contract(deployment.personalVaultFactory, PERSONAL_FACTORY_ABI, signer);
      const createVaultCall = factory.getFunction('createVault');
      const estimatedGas = await createVaultCall.estimateGas();
      const gasOverrides = await transactionGasOverrides(
        provider,
        BigInt(estimatedGas),
        network?.name ?? 'selected network',
      );
      const transaction = await createVaultCall(gasOverrides);
      const receipt = await transaction.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The personal-vault deployment transaction did not confirm successfully.');
      setBusyAction(null);
      refresh();
    } catch (error) {
      setPageState((previous) => ({ ...previous, errorMessage: userError(error) }));
      setBusyAction(null);
    }
  }, [walletAddress, deployment, getWalletProvider, walletProvider, refresh, network]);

  const quoteSwap = useCallback(async () => {
    if (!activeAction || (activeAction.action !== 'buy' && activeAction.action !== 'sell')) return null;
    if (!activeAction.launchId) throw new Error('Select a launch before requesting a swap quote.');
    const { vault } = await getFreshContractContext();
    const input = parsePositiveAmount(amount, activeAction.action === 'buy' ? 'eth' : 'receipt');
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
    const simulatedOutput = activeAction.action === 'buy'
      ? await vault.buy.staticCall(activeAction.launchId, input, 1n, deadline, { value: input })
      : await vault.sell.staticCall(activeAction.launchId, input, 1n, deadline);
    const output = BigInt(simulatedOutput);
    if (output <= 0n) throw new Error('The on-chain simulation returned no output for this amount.');
    return { input, output, deadline };
  }, [activeAction, amount, getFreshContractContext]);

  const requestQuote = useCallback(async () => {
    setActionError(null);
    setQuoteLoading(true);
    try {
      const result = await quoteSwap();
      if (!result || !activeAction) return;
      const output = activeAction.action === 'buy'
        ? `${formatUnits(result.output, 18)} ${activePosition?.symbol ? `$${activePosition.symbol}` : 'JailToken'}`
        : `${formatEther(result.output)} JailETH`;
      setQuoteText(output);
    } catch (error) {
      setQuoteText(null);
      setActionError(userError(error));
    } finally {
      setQuoteLoading(false);
    }
  }, [quoteSwap, activeAction, activePosition]);

  const submitAction = useCallback(async () => {
    if (!activeAction) return;
    setActionError(null);
    setBusyAction(actionLabel(activeAction.action));
    try {
      const { provider, signer, vault } = await getFreshContractContext();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
      let transaction;
      if (activeAction.action === 'deposit') {
        if (!pageState.vaultAddress) throw new Error('Create the personal vault first.');
        const value = parsePositiveAmount(amount, 'eth');
        const estimatedGas = await provider.estimateGas({
          from: await signer.getAddress(),
          to: pageState.vaultAddress,
          value,
        });
        const gasOverrides = await transactionGasOverrides(
          provider,
          BigInt(estimatedGas),
          network?.name ?? 'selected network',
        );
        transaction = await signer.sendTransaction({
          to: pageState.vaultAddress,
          value,
          ...gasOverrides,
        });
      } else if (activeAction.action === 'withdraw') {
        const value = parsePositiveAmount(amount, 'eth');
        const withdrawCall = vault.getFunction('withdrawETH');
        const estimatedGas = await withdrawCall.estimateGas(value);
        const gasOverrides = await transactionGasOverrides(
          provider,
          BigInt(estimatedGas),
          network?.name ?? 'selected network',
        );
        transaction = await withdrawCall(value, gasOverrides);
      } else if (activeAction.action === 'buy') {
        const quote = await quoteSwap();
        if (!quote || quote.output === 0n) throw new Error('Get a fresh on-chain quote before buying.');
        const slippageBps = Math.round(Number(slippagePercent) * 100);
        if (!Number.isFinite(slippageBps) || slippageBps < 1 || slippageBps > 500) {
          throw new Error('Slippage must be between 0.01% and 5%.');
        }
        const minimumOut = quote.output * BigInt(10_000 - slippageBps) / 10_000n;
        if (minimumOut === 0n) throw new Error('The amount is too small to set a non-zero minimum output.');
        const buyCall = vault.getFunction('buy');
        const estimatedGas = await buyCall.estimateGas(
          activeAction.launchId,
          quote.input,
          minimumOut,
          quote.deadline,
          { value: quote.input },
        );
        const gasOverrides = await transactionGasOverrides(
          provider,
          BigInt(estimatedGas),
          network?.name ?? 'selected network',
        );
        transaction = await buyCall(
          activeAction.launchId,
          quote.input,
          minimumOut,
          quote.deadline,
          { value: quote.input, ...gasOverrides },
        );
      } else if (activeAction.action === 'sell') {
        const quote = await quoteSwap();
        if (!quote || quote.output === 0n) throw new Error('Get a fresh on-chain quote before selling.');
        const slippageBps = Math.round(Number(slippagePercent) * 100);
        if (!Number.isFinite(slippageBps) || slippageBps < 1 || slippageBps > 500) {
          throw new Error('Slippage must be between 0.01% and 5%.');
        }
        const minimumOut = quote.output * BigInt(10_000 - slippageBps) / 10_000n;
        if (minimumOut === 0n) throw new Error('The amount is too small to set a non-zero minimum output.');
        const sellCall = vault.getFunction('sell');
        const estimatedGas = await sellCall.estimateGas(
          activeAction.launchId,
          quote.input,
          minimumOut,
          quote.deadline,
        );
        const gasOverrides = await transactionGasOverrides(
          provider,
          BigInt(estimatedGas),
          network?.name ?? 'selected network',
        );
        transaction = await sellCall(
          activeAction.launchId,
          quote.input,
          minimumOut,
          quote.deadline,
          gasOverrides,
        );
      } else if (activeAction.action === 'unjail') {
        const value = parsePositiveAmount(amount, 'receipt');
        const unjailCall = vault.getFunction('unjailToken');
        const estimatedGas = await unjailCall.estimateGas(activeAction.launchId, value, deadline);
        const gasOverrides = await transactionGasOverrides(
          provider,
          BigInt(estimatedGas),
          network?.name ?? 'selected network',
        );
        transaction = await unjailCall(activeAction.launchId, value, deadline, gasOverrides);
      } else if (activeAction.action === 'redeem') {
        const value = parsePositiveAmount(amount, 'receipt');
        const redeemCall = vault.getFunction('redeemJailETH');
        const estimatedGas = await redeemCall.estimateGas(activeAction.launchId, value, deadline);
        const gasOverrides = await transactionGasOverrides(
          provider,
          BigInt(estimatedGas),
          network?.name ?? 'selected network',
        );
        transaction = await redeemCall(activeAction.launchId, value, deadline, gasOverrides);
      }
      if (!transaction) throw new Error('This action is not available.');
      const receipt = await transaction.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The transaction did not confirm successfully.');
      setActiveAction(null);
      setAmount('');
      setQuoteText(null);
      setBusyAction(null);
      refresh();
      await provider.getBlockNumber();
    } catch (error) {
      setActionError(userError(error));
      setBusyAction(null);
    }
  }, [
    activeAction, amount, getFreshContractContext, pageState.vaultAddress, quoteSwap,
    slippagePercent, refresh, network,
  ]);

  const activeNetworkName = network?.name ?? null;
  return <>
    <MyJailPage
      status={!walletAddress ? 'disconnected' : pageState.status}
      walletAddress={walletAddress || null}
      chainName={activeNetworkName}
      chainId={chainId}
      walletEthBalance={pageState.walletEthBalance}
      vaultAddress={pageState.vaultAddress}
      vaultEthBalance={pageState.vaultEthBalance}
      positions={pageState.positions}
      errorMessage={pageState.errorMessage}
      busyAction={busyAction}
      networkSwitching={networkSwitching}
      networkSwitchError={networkSwitchError}
      onConnect={connect}
      onSelectChain={(targetChainId) => void selectChain(targetChainId)}
      onCreateVault={() => void createVault()}
      onRefresh={refresh}
      onLoadMore={loadMoreLaunches}
      hasMoreLaunches={Boolean(launchQuery.data?.nextCursor)}
      onOpenAction={openAction}
    />
    {activeAction && <Dialog open onOpenChange={(open) => {
      if (!open && !busyAction) {
        setActiveAction(null);
        setActionError(null);
      }
    }}>
      <DialogContent className="my-jail-action-dialog" data-testid="dialog-my-jail-action">
        <DialogHeader>
          <DialogTitle>{actionTitle(activeAction.action, activePosition)}</DialogTitle>
          <DialogDescription>{actionDescription(activeAction.action, activePosition)}</DialogDescription>
        </DialogHeader>
        <div className="my-jail-action-body">
          <label className="my-jail-field">
            <span>{amountLabel(activeAction.action, activePosition)}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setQuoteText(null);
                setActionError(null);
              }}
              placeholder={activeAction.action === 'buy' || activeAction.action === 'deposit' ? '0.01' : '0'}
              disabled={busyAction !== null}
              data-testid="input-my-jail-amount"
            />
          </label>
          <p className="my-jail-available-balance">
            Available: <strong>{availableAmount(activeAction.action, activePosition, pageState.walletEthBalance, pageState.vaultEthBalance)}</strong>
          </p>
          {activeAction.action === 'buy' || activeAction.action === 'sell' ? <>
            <label className="my-jail-field">
              <span>Maximum slippage</span>
              <select value={slippagePercent} onChange={(event) => {
                setSlippagePercent(event.target.value);
                setQuoteText(null);
              }} disabled={busyAction !== null}>
                <option value="0.5">0.5%</option>
                <option value="1">1%</option>
                <option value="2">2%</option>
                <option value="5">5%</option>
              </select>
            </label>
            <button className="jail-action" type="button" onClick={() => void requestQuote()} disabled={!amount || quoteLoading || busyAction !== null} data-testid="button-my-jail-quote">
              {quoteLoading ? 'Simulating on-chain…' : 'Get on-chain estimate'}
            </button>
            {quoteText && <p className="my-jail-quote" role="status">Estimated output: <strong>{quoteText}</strong>. Minimum output is protected by your slippage setting.</p>}
          </> : <p className="my-jail-action-note">{actionNote(activeAction.action, activePosition, walletAddress)}</p>}
          {actionError && <p className="my-jail-action-error" role="alert">{actionError}</p>}
        </div>
        <div className="my-jail-action-footer">
          <button className="jail-action" type="button" onClick={() => setActiveAction(null)} disabled={busyAction !== null}>Cancel</button>
          <button
            className="jail-action jail-action-primary"
            type="button"
            onClick={() => void submitAction()}
            disabled={!amount || busyAction !== null || ((activeAction.action === 'buy' || activeAction.action === 'sell') && !quoteText)}
            data-testid="button-my-jail-submit"
          >
            {busyAction ? 'Waiting for wallet…' : actionButtonLabel(activeAction.action)}
          </button>
        </div>
      </DialogContent>
    </Dialog>}
  </>;
}

function actionLabel(action: MyJailAction) {
  return action === 'unjail' ? 'Unjailing' : action === 'redeem' ? 'Redeeming JailETH' : `${action}ing`;
}

function actionTitle(action: MyJailAction, position: MyJailPosition | null) {
  const token = position?.name ? ` · ${position.name}` : '';
  return `${actionButtonLabel(action)}${token}`;
}

function actionDescription(action: MyJailAction, position: MyJailPosition | null) {
  if (action === 'buy') return 'Buy JailToken using ETH from your connected wallet. The receipt stays in your personal vault.';
  if (action === 'sell') return 'Sell JailToken from your personal vault. The proceeds are issued as this launch’s JailETH receipt.';
  if (action === 'unjail') return `Burn this launch’s JailToken receipt and return the underlying token to ${position?.name || 'your connected wallet'}.`;
  if (action === 'redeem') return 'Burn JailETH held in this personal vault and redeem the matching native ETH into the vault.';
  if (action === 'deposit') return 'Move native ETH from your connected wallet into your personal Jail Vault.';
  return 'Withdraw native ETH from your personal Jail Vault to your connected wallet.';
}

function amountLabel(action: MyJailAction, position: MyJailPosition | null) {
  if (action === 'buy' || action === 'deposit' || action === 'withdraw') return 'Amount (ETH)';
  if (action === 'sell' || action === 'unjail') return `Amount (${position?.symbol ? `$${position.symbol}` : 'JailToken'})`;
  return 'Amount (JailETH)';
}

function availableAmount(
  action: MyJailAction,
  position: MyJailPosition | null,
  walletEthBalance: string | null,
  vaultEthBalance: string | null,
) {
  if (action === 'buy' || action === 'deposit') return `${walletEthBalance ?? '—'} ETH in connected wallet`;
  if (action === 'withdraw') return `${vaultEthBalance ?? '—'} ETH in personal vault`;
  if (action === 'sell' || action === 'unjail') {
    return `${position?.jailTokenBalance ?? '—'} ${position?.symbol ? `$${position.symbol}` : 'JailToken'}`;
  }
  return `${position?.jailEthBalance ?? '—'} ETH JailETH receipt`;
}

function actionNote(action: MyJailAction, position: MyJailPosition | null, walletAddress: string) {
  if (action === 'unjail') return `The token will be sent directly to your connected wallet${walletAddress ? ` (${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)})` : ''}.`;
  if (action === 'redeem') return 'The redeemed ETH remains in your personal vault until you withdraw it.';
  if (action === 'deposit') return 'Your wallet signs and pays gas for this deposit.';
  if (action === 'withdraw') return 'The destination is fixed to the wallet that owns this personal vault.';
  return position?.symbol ? `Only this launch’s protected JailToken and JailETH receipts are handled here.` : 'Only the selected launch’s protected receipt assets are handled here.';
}

function actionButtonLabel(action: MyJailAction) {
  return action === 'unjail' ? 'Unjail token'
    : action === 'redeem' ? 'Redeem JailETH'
      : action === 'buy' ? 'Buy JailToken'
        : action === 'sell' ? 'Sell JailToken'
          : action === 'deposit' ? 'Deposit ETH'
            : 'Withdraw ETH';
}
