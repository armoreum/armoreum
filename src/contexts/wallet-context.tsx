import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { getWalletConnectConfig } from '@workspace/api-client-react';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitNetworkCore, useAppKitProvider, useAppKitState, useDisconnect, type Provider } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain } from '@reown/appkit/networks';
import { NETWORKS } from '@workspace/api-zod';
import { alchemyGatewayUrl, withAlchemyReads } from '@/lib/alchemy-rpc';

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletContextValue = {
  walletAddress: string;
  walletChainId: string;
  walletProvider: Eip1193Provider | null;
  getWalletProvider: () => Eip1193Provider | null;
  walletError: string;
  connecting: boolean;
  connectWallet: () => Promise<boolean>;
  switchWalletNetwork: (chainId: number) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  forgetWallet: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

let reownInitialized = false;
let reownAppKit: ReturnType<typeof createAppKit> | null = null;
const reownNetworks = new Map<number, ReturnType<typeof defineChain>>();
const walletReadyListeners = new Set<() => void>();
let walletInitialization: Promise<boolean> | null = null;

function subscribeWalletReady(listener: () => void) {
  walletReadyListeners.add(listener);
  return () => { walletReadyListeners.delete(listener); };
}

/** Configuration is retriable, deduplicated, and independent of page rendering. */
export function ensureReownWallet(): Promise<boolean> {
  if (reownInitialized) return Promise.resolve(true);
  if (walletInitialization) return walletInitialization;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10_000);
  walletInitialization = getWalletConnectConfig({ signal: controller.signal })
    .then(config => initializeReownWallet(config.projectId))
    .catch(() => false)
    .finally(() => {
      window.clearTimeout(timer);
      walletInitialization = null;
    });
  return walletInitialization;
}

function currentWalletTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function initializeReownWallet(projectId: string): boolean {
  if (reownInitialized) return true;
  if (!projectId.trim()) return false;
  try {
    const ethereumNetwork = defineChain({
      id: NETWORKS.ethereum.chainId!,
      caipNetworkId: `eip155:${NETWORKS.ethereum.chainId}`,
      chainNamespace: 'eip155',
      name: NETWORKS.ethereum.name,
      nativeCurrency: { name: 'Ether', symbol: NETWORKS.ethereum.nativeCurrency, decimals: 18 },
      rpcUrls: { default: { http: [alchemyGatewayUrl(1)] } },
      blockExplorers: { default: { name: 'Etherscan', url: NETWORKS.ethereum.explorerUrl } },
      testnet: false,
    });
    const chainId = NETWORKS.robinhood.chainId!;
    const robinhoodNetwork = defineChain({
      id: chainId,
      caipNetworkId: `eip155:${chainId}`,
      chainNamespace: 'eip155',
      name: NETWORKS.robinhood.name,
      nativeCurrency: { name: 'Ether', symbol: NETWORKS.robinhood.nativeCurrency, decimals: 18 },
      rpcUrls: { default: { http: [alchemyGatewayUrl(chainId)] } },
      blockExplorers: { default: { name: 'Robinhood Explorer', url: NETWORKS.robinhood.explorerUrl } },
      testnet: false,
    });
    reownNetworks.set(ethereumNetwork.id, ethereumNetwork);
    reownNetworks.set(robinhoodNetwork.id, robinhoodNetwork);
    reownAppKit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [ethereumNetwork, robinhoodNetwork],
      // Explicit overrides prevent AppKit replacing known-chain URLs with its RPC service.
      customRpcUrls: {
        'eip155:1': [{ url: alchemyGatewayUrl(1) }],
        'eip155:4663': [{ url: alchemyGatewayUrl(chainId) }],
      },
      projectId,
      themeMode: currentWalletTheme(),
      metadata: {
        name: 'Armoreum',
        description: 'Creator vaults and verified token launches',
        url: window.location.origin,
        icons: [`${window.location.origin}${import.meta.env.BASE_URL}armoreum-logo-light.png`],
      },
      features: { analytics: false },
    });
    reownInitialized = true;
    for (const listener of walletReadyListeners) listener();
    return true;
  } catch {
    return false;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribeWalletReady, () => reownInitialized, () => false);
  const [session, setSession] = useState<WalletContextValue | null>(null);
  const sessionRef = useRef<WalletContextValue | null>(null);
  const publishSession = useCallback((value: WalletContextValue) => {
    sessionRef.current = value;
    // Some AppKit action hooks return a new function on every render. Publishing
    // those identities into parent state would cause a parent/child effect loop.
    // Publish observable state only; actions always delegate to the latest bridge.
    setSession(previous => {
      if (previous
        && previous.walletAddress === value.walletAddress
        && previous.walletChainId === value.walletChainId
        && previous.walletProvider === value.walletProvider
        && previous.walletError === value.walletError
        && previous.connecting === value.connecting) return previous;
      return {
        ...value,
        getWalletProvider: () => sessionRef.current?.getWalletProvider() ?? null,
        connectWallet: () => sessionRef.current!.connectWallet(),
        switchWalletNetwork: chainId => sessionRef.current!.switchWalletNetwork(chainId),
        disconnectWallet: () => sessionRef.current!.disconnectWallet(),
        forgetWallet: () => sessionRef.current!.forgetWallet(),
      };
    });
  }, []);
  const [walletError, setWalletError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const connectWallet = useCallback(async () => {
    setWalletError('');
    setConnecting(true);
    try {
      if (!await ensureReownWallet()) {
        throw new Error('Wallet connection is temporarily unavailable. Check your connection and try again.');
      }
      // The hook bridge mounts without replacing the page/form subtree.
      const startedAt = Date.now();
      while (!sessionRef.current && Date.now() - startedAt < 3000) {
        await new Promise(resolve => window.setTimeout(resolve, 25));
      }
      if (!sessionRef.current) throw new Error('Wallet is still initializing. Try connecting again.');
      return await sessionRef.current.connectWallet();
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'Wallet connection failed. Try again.');
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);
  const switchWalletNetwork = useCallback(async () => {
    const message = 'Reown network switching is not configured. Reconnect after the wallet configuration is fixed.';
    setWalletError(message);
    throw new Error(message);
  }, []);
  const disconnectWallet = useCallback(async () => {
    setWalletError('');
  }, []);
  const forgetWallet = useCallback(() => setWalletError(''), []);
  const value = useMemo<WalletContextValue>(() => ({
    walletAddress: '',
    walletChainId: '',
    walletProvider: null,
    getWalletProvider: () => null,
    walletError,
    connecting,
    connectWallet,
    switchWalletNetwork,
    disconnectWallet,
    forgetWallet,
  }), [walletError, connecting, connectWallet, switchWalletNetwork, disconnectWallet, forgetWallet]);
  return (
    <WalletContext.Provider value={session ?? value}>
      {ready && <ReownWalletSession onChange={publishSession} />}
      {children}
    </WalletContext.Provider>
  );
}

function ReownWalletSession({ onChange }: { onChange: (value: WalletContextValue) => void }) {
  useEffect(() => {
    const synchronizeTheme = () => reownAppKit?.setThemeMode(currentWalletTheme());
    synchronizeTheme();
    const observer = new MutationObserver(synchronizeTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  const { address, isConnected } = useAppKitAccount({ namespace: 'eip155' });
  const { chainId } = useAppKitNetworkCore();
  const { switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<Provider>('eip155');
  const { open } = useAppKit();
  const { open: modalOpen } = useAppKitState();
  const { disconnect } = useDisconnect();
  const [walletError, setWalletError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const stateRef = useRef({ address: '', isConnected: false, modalOpen: false });
  const providerRef = useRef<Eip1193Provider | null>(null);
  stateRef.current = { address: address || '', isConnected, modalOpen };
  const alchemyWallet = useMemo(() => walletProvider
    ? withAlchemyReads(walletProvider as unknown as Eip1193Provider) : null, [walletProvider]);
  providerRef.current = alchemyWallet;

  const walletAddress = isConnected && address ? address : '';
  const walletChainId = typeof chainId === 'number'
    ? `0x${chainId.toString(16)}`
    : typeof chainId === 'string'
      ? chainId
      : '';

  const connectWallet = useCallback(async () => {
    if (isConnected && address) return true;
    setWalletError('');
    setConnecting(true);
    let interval = 0;
    let sawModalOpen = false;
    let finishConnection: ((connected: boolean) => void) | null = null;
    try {
      const connection = new Promise<boolean>((resolve) => {
        finishConnection = resolve;
        const startedAt = Date.now();
        interval = window.setInterval(() => {
          if (stateRef.current.isConnected && /^0x[a-fA-F0-9]{40}$/.test(stateRef.current.address)) {
            window.clearInterval(interval);
            resolve(true);
            return;
          }
          if (stateRef.current.modalOpen) sawModalOpen = true;
          if (sawModalOpen && !stateRef.current.modalOpen) {
            window.clearInterval(interval);
            resolve(false);
            return;
          }
          if (Date.now() - startedAt >= 120_000) {
            window.clearInterval(interval);
            resolve(false);
          }
        }, 200);
      });
      void Promise.resolve(open({ view: 'Connect', namespace: 'eip155' })).catch(() => {
        window.clearInterval(interval);
        finishConnection?.(false);
      });
      const connected = await connection;
      if (!connected) setWalletError('Wallet connection was cancelled or timed out.');
      return connected;
    } catch {
      setWalletError('Wallet connection failed. Try again.');
      return false;
    } finally {
      if (interval) window.clearInterval(interval);
      setConnecting(false);
    }
  }, [address, isConnected, open]);

  const switchWalletNetwork = useCallback(async (targetChainId: number) => {
    const targetNetwork = reownNetworks.get(targetChainId);
    if (!targetNetwork) throw new Error('Select Ethereum or Robinhood.');
    setWalletError('');
    try {
      await switchNetwork(targetNetwork);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reown could not switch the connected wallet network.';
      setWalletError(message);
      throw new Error(message);
    }
  }, [switchNetwork]);

  const disconnectWallet = useCallback(async () => {
    setWalletError('');
    try {
      await disconnect();
    } catch {
      const message = 'Wallet could not be disconnected.';
      setWalletError(message);
      throw new Error(message);
    }
  }, [disconnect]);

  const forgetWallet = useCallback(() => {
    void disconnectWallet().catch(() => undefined);
  }, [disconnectWallet]);

  const value = useMemo(
    () => ({
      walletAddress,
      walletChainId,
      walletProvider: providerRef.current,
      getWalletProvider: () => providerRef.current,
      walletError,
      connecting,
      connectWallet,
      switchWalletNetwork,
      disconnectWallet,
      forgetWallet,
    }),
    [walletAddress, walletChainId, walletError, connecting, connectWallet, switchWalletNetwork, disconnectWallet, forgetWallet, walletProvider],
  );

  useEffect(() => { onChange(value); }, [onChange, value]);
  return null;
}

export function useArmoreumWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useArmoreumWallet must be used inside WalletProvider.');
  return value;
}
