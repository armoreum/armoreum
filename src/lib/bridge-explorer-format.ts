import { formatUnits } from 'ethers';

export function layerZeroScanTransactionUrl(sourceTransactionHash: string) {
  return `https://layerzeroscan.com/tx/${sourceTransactionHash}`;
}

export function explorerUtc(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable'
    : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function explorerAmount(value: string | null | undefined) {
  if (value == null) return 'Pending';
  if (!/^\d+$/.test(value)) return 'Unavailable';
  const [whole, fraction = ''] = formatUnits(BigInt(value), 18).split('.');
  if (BigInt(value) > 0n && whole === '0' && !/[1-9]/.test(fraction.slice(0, 6))) return '<0.000001';
  const decimals = fraction.slice(0, 6).replace(/0+$/, '');
  return `${whole.replace(/\B(?=(\d{3})+$)/g, ',')}${decimals ? `.${decimals}` : ''}`;
}

export function explorerStatus(row: { status: string; hasRetryError: boolean }): { label: string; tone: string } {
  if (row.status === 'delivered') return { label: 'Delivered', tone: 'good' };
  if (row.status === 'source-submitted') return { label: 'Source pending', tone: 'neutral' };
  if (row.status === 'source-failed') return { label: 'Source failed', tone: 'bad' };
  if (row.status === 'failed') return { label: 'Failed', tone: 'bad' };
  if (row.hasRetryError) return { label: 'Retrying', tone: 'warn' };
  if (row.status === 'source-pending-finality') return { label: 'Awaiting confirmations', tone: 'neutral' };
  if (row.status === 'source-confirmed') return { label: 'Pending delivery', tone: 'neutral' };
  if (row.status === 'destination-submitted') return { label: 'Destination pending', tone: 'neutral' };
  if (row.status === 'source-finalized') return { label: 'Pending delivery', tone: 'neutral' };
  return { label: `Unknown state: ${row.status}`, tone: 'neutral' };
}

export function explorerStages(row: {
  sourceChainId: number; destinationChainId: number; status: string;
  hasRetryError: boolean; verificationConfirmedAt?: string | null;
}) {
  const delivered = row.status === 'delivered';
  const verified = delivered || Boolean(row.verificationConfirmedAt);
  const confirmed = verified || ['source-finalized', 'source-confirmed', 'destination-submitted'].includes(row.status);
  const source = row.sourceChainId === 1 ? 'Ethereum' : 'Robinhood';
  const destination = row.destinationChainId === 1 ? 'Ethereum' : 'Robinhood';
  const failed = row.status === 'failed' || row.status === 'source-failed';
  const submitted = row.status === 'source-submitted';
  return [
    { label: `${source} transaction`, status: failed ? 'Needs review' : submitted ? 'Pending' : 'Confirmed', done: !failed && !submitted },
    { label: 'Source confirmations', status: confirmed ? 'Confirmed' : 'Waiting', done: confirmed },
    { label: 'LayerZero verification', status: verified ? 'Verified' : row.hasRetryError && confirmed ? 'Retrying' : 'Waiting', done: verified },
    { label: `${destination} delivery`, status: delivered ? 'Delivered' : failed ? 'Needs review' : row.hasRetryError && verified ? 'Retrying' : 'Pending', done: delivered },
  ];
}
