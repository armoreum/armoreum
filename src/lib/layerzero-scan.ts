export type LayerZeroScanResult = { state: 'indexed' | 'not-indexed' | 'unavailable'; statuses: string[] };
const statusLabels: Record<string, string> = {
  INFLIGHT: 'In flight', CONFIRMING: 'Confirming', FAILED: 'Failed', DELIVERED: 'Delivered',
  BLOCKED: 'Blocked', PAYLOAD_STORED: 'Payload stored', APPLICATION_BURNED: 'Application burned',
  APPLICATION_SKIPPED: 'Application skipped', UNRESOLVABLE_COMMAND: 'Unresolvable command',
  MALFORMED_COMMAND: 'Malformed command',
};
const cache = new Map<string, { expires: number; result: Promise<LayerZeroScanResult> }>();

/** Supplementary explorer data only: this never changes on-chain/relay completion state. */
export async function readLayerZeroScanStatus(
  hash: string, sourceBridge: string, destinationBridge: string, fetcher: typeof fetch = fetch,
): Promise<LayerZeroScanResult> {
  if (!/^0x[\da-f]{64}$/i.test(hash) || ![sourceBridge, destinationBridge].every(address => /^0x[\da-f]{40}$/i.test(address))) {
    return { state: 'unavailable', statuses: [] };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(`https://scan.layerzero-api.com/v1/messages/tx/${hash}`, {
      signal: controller.signal, credentials: 'omit',
    });
    const payload = await response.json();
    if (response.status === 404 && payload.code === 4040) return { state: 'not-indexed', statuses: [] };
    if (!response.ok || !Array.isArray(payload.data)) return { state: 'unavailable', statuses: [] };
    const messages = payload.data.filter((message: {
      source?: { tx?: { txHash?: string } };
      pathway?: { sender?: { address?: string }; receiver?: { address?: string } };
    }) => message?.source?.tx?.txHash?.toLowerCase() === hash.toLowerCase()
      && message?.pathway?.sender?.address?.toLowerCase() === sourceBridge.toLowerCase()
      && message?.pathway?.receiver?.address?.toLowerCase() === destinationBridge.toLowerCase());
    if (!messages.length) return { state: 'not-indexed', statuses: [] };
    const statuses = [...new Set<string>(messages.map((message: { status?: { name?: string } }) =>
      statusLabels[message.status?.name ?? '']).filter(Boolean))];
    return { state: statuses.length ? 'indexed' : 'unavailable', statuses };
  } catch {
    return { state: 'unavailable', statuses: [] };
  } finally {
    clearTimeout(timer);
  }
}

export function loadLayerZeroScanStatus(hash: string, sourceBridge: string, destinationBridge: string) {
  const key = `${hash}:${sourceBridge}:${destinationBridge}`.toLowerCase();
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.result;
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  const result = readLayerZeroScanStatus(hash, sourceBridge, destinationBridge);
  cache.set(key, { expires: Date.now() + 20_000, result });
  return result;
}
