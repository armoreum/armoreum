import { useEffect } from 'react';
import { trackBridgeSubmission } from '@workspace/api-client-react';
import { createBridgeSubmissionQueue, type BridgeSubmissionInput } from '@/lib/bridge-submission-queue';

let queue: ReturnType<typeof createBridgeSubmissionQueue> | undefined;
function getQueue() {
  if (!queue) {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Browser privacy settings may block storage. */ }
    queue = createBridgeSubmissionQueue(storage, input =>
      trackBridgeSubmission(input, { keepalive: true, signal: AbortSignal.timeout(12_000) }));
  }
  return queue;
}

export function submitBridgeForTracking(input: BridgeSubmissionInput) {
  return getQueue().track(input);
}

export function useBridgeSubmissionTracking() {
  useEffect(() => {
    const retry = () => { void getQueue().retry(); };
    retry();
    const timer = window.setInterval(retry, 15_000);
    window.addEventListener('online', retry);
    return () => { window.clearInterval(timer); window.removeEventListener('online', retry); };
  }, []);
}
