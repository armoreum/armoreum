import { JsonRpcProvider, type Eip1193Provider, type Provider } from 'ethers';

const walletMethods = new Set([
  'eth_chainId', 'eth_accounts', 'eth_requestAccounts', 'eth_sendTransaction', 'eth_signTransaction',
  'eth_sign', 'personal_sign', 'personal_ecRecover', 'eth_decrypt', 'eth_getEncryptionPublicKey',
]);
export function alchemyGatewayUrl(chainId: number) {
  if (chainId !== 1 && chainId !== 4663) throw new Error('Unsupported Alchemy network.');
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');
  return new URL(`${base}/api/evm-rpc/${chainId}`, window.location.origin).href;
}
const providers = new Map<number, JsonRpcProvider>();
export function getAlchemyReadProvider(chainId: number) {
  let provider = providers.get(chainId);
  if (!provider) {
    provider = new JsonRpcProvider(alchemyGatewayUrl(chainId), chainId, {
      staticNetwork: true, batchMaxCount: 1, pollingInterval: 1_200, cacheTimeout: 0,
    });
    providers.set(chainId, provider);
  }
  return provider;
}

/** Keep account/network authority and interactive signing with the actual wallet.
 * All application-initiated chain reads use the credential-free Alchemy gateway. */
export function withAlchemyReads<T extends Eip1193Provider>(
  wallet: T, readProvider: (chainId: number) => Pick<JsonRpcProvider, 'send'> = getAlchemyReadProvider,
): T {
  let chainRequest: Promise<unknown> | null = null;
  const request: Eip1193Provider['request'] = async args => {
    if (walletMethods.has(args.method) || args.method.startsWith('wallet_')
      || args.method.startsWith('metamask_') || args.method.startsWith('eth_signTypedData')) {
      return wallet.request(args);
    }
    const current = chainRequest ??= wallet.request({ method: 'eth_chainId' }).finally(() => { chainRequest = null; });
    const chainId = Number(BigInt(String(await current)));
    const provider = readProvider(chainId);
    if (args.params && !Array.isArray(args.params)) throw new Error('RPC parameters must be positional.');
    return provider.send(args.method, args.params ?? []);
  };
  // Some injected wallets freeze their request property. Proxy our own target,
  // not theirs, so redirecting request never violates Proxy invariants.
  return new Proxy({ request } as T, { get(_target, key) {
    if (key === 'request') return request;
    const value = Reflect.get(wallet, key, wallet);
    return typeof value === 'function' ? value.bind(wallet) : value;
  }, has: (_target, key) => key in wallet });
}

export async function requireNativeGas(
  provider: Pick<Provider, 'getBalance'>, account: string,
  gas: { gasLimit: bigint; maxFeePerGas: bigint }, value = 0n,
) {
  const balance = await provider.getBalance(account);
  if (balance < gas.gasLimit * gas.maxFeePerGas + value) {
    throw new Error('Insufficient native ETH on the source network for this transaction. Add ETH for gas before continuing.');
  }
}
