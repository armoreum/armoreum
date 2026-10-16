import { useCallback, useEffect, useState } from 'react';

export type BridgeLiquidity = {
  launchDraftId: string;
  sourceChainId: number;
  destinationChainId: number;
  destinationToken: string;
  destinationInventory: string;
  pendingInboundAmount: string;
  maxAmount: string;
};

export async function loadBridgeLiquidity(draftId: string, sourceChainId: number): Promise<BridgeLiquidity> {
  const response = await fetch(`/api/launch-drafts/${encodeURIComponent(draftId)}/multichain-bridge/liquidity/${sourceChainId}`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not check the destination reserve.');
  if (data.launchDraftId !== draftId || data.sourceChainId !== sourceChainId ||
      data.destinationChainId !== (sourceChainId === 1 ? 4663 : 1) ||
      typeof data.maxAmount !== 'string' || !/^\d+$/.test(data.maxAmount)) {
    throw new Error('The destination reserve response did not match this bridge direction.');
  }
  return data as BridgeLiquidity;
}

export function useBridgeLiquidity(draftId: string, sourceChainId: number) {
  const key = `${draftId}:${sourceChainId}`;
  const [snapshot, setSnapshot] = useState<{ key: string; data: BridgeLiquidity | null; error: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((value) => value + 1), []);
  useEffect(() => {
    if (!draftId) { setSnapshot(null); return; }
    let cancelled = false;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await loadBridgeLiquidity(draftId, sourceChainId);
        if (!cancelled) setSnapshot({ key, data, error: '' });
      } catch (cause) {
        if (!cancelled) setSnapshot({ key, data: null, error: cause instanceof Error ? cause.message : 'Destination reserve unavailable.' });
      } finally { inFlight = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    const focus = () => void load();
    window.addEventListener('focus', focus);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [draftId, sourceChainId, key, nonce]);
  const current = snapshot?.key === key ? snapshot : null;
  return { data: current?.data ?? null, error: current?.error ?? '', refresh };
}
