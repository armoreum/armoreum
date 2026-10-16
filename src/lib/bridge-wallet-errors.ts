export type BridgeWalletStage = 'preflight' | 'approval' | 'transfer' | 'confirmation';

/** Inspect known provider wrappers without printing calldata or the full RPC payload. */
export function bridgeWalletErrorMessage(cause: unknown, stage: BridgeWalletStage, transactionHash = ''): string {
  const codes = new Set<unknown>();
  const queue: unknown[] = [cause];
  const seen = new Set<unknown>();
  for (let index = 0; index < queue.length && index < 24; index += 1) {
    const item = queue[index];
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    const record = item as Record<string, unknown>;
    codes.add(record.code);
    for (const key of ['error', 'info', 'cause', 'data', 'originalError']) {
      if (record[key] && typeof record[key] === 'object') queue.push(record[key]);
    }
  }
  if (transactionHash) {
    return 'A transaction hash was returned, but confirmation could not be completed. Check the transaction below before sending again.';
  }
  if (codes.has(4001) || codes.has('4001') || codes.has('ACTION_REJECTED')) {
    return stage === 'approval' ? 'Token approval was cancelled in your wallet.' : 'The wallet request was cancelled.';
  }
  if (codes.has(-32002) || codes.has('-32002')) {
    return 'A wallet confirmation is already open. Approve or reject that request in your wallet before trying again.';
  }
  if (codes.has(-32603) || codes.has('-32603')) {
    if (stage === 'preflight') {
      return 'Your wallet returned an internal error while checking this transfer (RPC -32603). Check the wallet connection and selected network, then try again.';
    }
    const action = stage === 'approval' ? 'the token approval' : 'the bridge transaction';
    return `Your wallet returned an internal error while submitting ${action} (RPC -32603). No transaction hash was returned. Check wallet activity before retrying; a confirmed token approval remains valid.`;
  }
  if (codes.has('INSUFFICIENT_FUNDS')) return 'Not enough native ETH to cover the network fee. Token balance and ETH gas balance are separate.';
  const message = cause instanceof Error ? cause.message : '';
  if (message && message.length <= 320 && !/could not coalesce|payload=|jsonrpc|transaction=/i.test(message)) return message;
  return 'The wallet could not complete this step. Check wallet activity and the selected network before trying again.';
}
