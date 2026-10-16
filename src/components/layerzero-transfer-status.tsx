import { useEffect, useState } from 'react';
import { loadLayerZeroScanStatus, type LayerZeroScanResult } from '@/lib/layerzero-scan';

export function LayerZeroTransferStatus({ hash, sourceBridge, destinationBridge }: {
  hash: string; sourceBridge: string; destinationBridge: string;
}) {
  const key = `${hash}:${sourceBridge}:${destinationBridge}`;
  const [snapshot, setSnapshot] = useState<{ key: string; result: LayerZeroScanResult } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await loadLayerZeroScanStatus(hash, sourceBridge, destinationBridge);
      if (!cancelled) setSnapshot({ key, result });
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [hash, sourceBridge, destinationBridge, key]);
  const result = snapshot?.key === key ? snapshot.result : null;
  const label = !result ? 'Checking…'
    : result.state === 'not-indexed' ? 'Not indexed yet'
    : result.state === 'unavailable' ? 'Temporarily unavailable'
    : result.statuses.join(' · ');
  return <small role="status" title="Supplementary explorer status. On-chain destination confirmation determines completion.">
    LayerZero Scan: <a href={`https://layerzeroscan.com/tx/${hash}`} target="_blank" rel="noreferrer">{label}</a>
  </small>;
}
