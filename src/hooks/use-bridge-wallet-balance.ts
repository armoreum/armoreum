import { useCallback, useEffect, useState } from 'react';
import { readBridgeTokenBalance } from '@/lib/bridge-wallet-balance';

type Snapshot = { key: string; raw: bigint | null; loading: boolean; error: string };

export function useBridgeWalletBalance({
  account, chainId, token, refreshIntervalMs = 5_000,
}: {
  account: string;
  chainId: number;
  token: string;
  refreshIntervalMs?: number;
}) {
  const key = `${account.toLowerCase()}:${chainId}:${token.toLowerCase()}`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const refresh = useCallback(() => setRefreshNonce((value) => value + 1), []);

  useEffect(() => {
    if (!account || !token) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      setSnapshot({ key, raw: null, loading: true, error: '' });
      try {
        const raw = await readBridgeTokenBalance(chainId, token, account);
        if (!cancelled) setSnapshot({ key, raw, loading: false, error: '' });
      } catch (cause) {
        if (!cancelled) setSnapshot({
          key, raw: null, loading: false,
          error: cause instanceof Error ? cause.message : 'Could not read the token balance.',
        });
      } finally {
        inFlight = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), Math.max(1_000, refreshIntervalMs));
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [account, chainId, key, refreshNonce, refreshIntervalMs, token]);

  const current = snapshot?.key === key ? snapshot : null;
  const status = !account ? 'disconnected'
    : !token ? 'unavailable'
    : !current || current.loading ? 'loading'
    : current.error ? 'error' : 'ready';
  return { status, raw: status === 'ready' ? current!.raw : null, error: current?.error ?? '', refresh };
}
