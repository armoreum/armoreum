export type BridgeSubmissionInput = {
  launchDraftId: string; sourceChainId: 1 | 4663; transactionHash: string;
};
const key = 'armoreum.bridge.pending-submissions';
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;

/** Retry registration of an already-broadcast hash, never the wallet transaction itself. */
export function createBridgeSubmissionQueue(
  storage: StorageAccess | null, send: (input: BridgeSubmissionInput) => Promise<unknown>,
) {
  const pending = new Map<string, BridgeSubmissionInput>();
  const inFlight = new Map<string, Promise<boolean>>();
  const identity = (input: BridgeSubmissionInput) => `${input.sourceChainId}:${input.transactionHash.toLowerCase()}`;
  try {
    const saved: unknown = JSON.parse(storage?.getItem(key) || '[]');
    if (Array.isArray(saved)) for (const input of saved) {
      if (input && [1, 4663].includes(input.sourceChainId)
        && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(input.launchDraftId)
        && /^0x[\da-f]{64}$/i.test(input.transactionHash)) pending.set(identity(input), input);
    }
  } catch { /* Storage may be blocked. The in-memory queue and server fallback still work. */ }
  const save = () => {
    try { storage?.setItem(key, JSON.stringify([...pending.values()])); } catch { /* Do not interrupt a broadcast transfer. */ }
  };
  const track = (input: BridgeSubmissionInput): Promise<boolean> => {
    const id = identity(input);
    const running = inFlight.get(id);
    if (running) return running;
    pending.set(id, input);
    save();
    const task = Promise.resolve().then(async () => {
      try {
        await send(input);
        pending.delete(id);
        save();
        return true;
      } catch { return false; }
      finally { inFlight.delete(id); }
    });
    inFlight.set(id, task);
    return task;
  };
  return { track, retry: () => Promise.all([...pending.values()].slice(0, 25).map(track)) };
}
