import { formatUnits } from 'ethers';
import type { BridgeTokenBalanceSnapshot } from '@workspace/api-client-react';

export async function readBridgeTokenBalance(
  chainId: number,
  token: string,
  account: string,
  fetcher: typeof fetch = fetch,
): Promise<bigint> {
  if (![1, 4663].includes(chainId) || !/^0x[\da-f]{40}$/i.test(token) || !/^0x[\da-f]{40}$/i.test(account)) {
    throw new Error('Select a supported network, token, and wallet to read the balance.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(`/api/bridge-token-balances/${chainId}/${token}/${account}`, {
      cache: 'no-store', signal: controller.signal,
    });
    const result = await response.json() as Partial<BridgeTokenBalanceSnapshot>;
    if (!response.ok) throw new Error('Could not read your token balance. Refresh to try again.');
    if (result.chainId !== chainId || result.token?.toLowerCase() !== token.toLowerCase()
      || result.account?.toLowerCase() !== account.toLowerCase() || result.decimals !== 18
      || typeof result.balance !== 'string' || !/^\d+$/.test(result.balance)) {
      throw new Error('The balance service returned a mismatched token, wallet, or network.');
    }
    return BigInt(result.balance);
  } finally {
    clearTimeout(timer);
  }
}

export function bridgeBalanceAmount(balance: bigint, percent: 50 | 100): string {
  if (balance < 0n) throw new RangeError('Token balance cannot be negative.');
  return formatUnits(balance * BigInt(percent) / 100n, 18);
}
