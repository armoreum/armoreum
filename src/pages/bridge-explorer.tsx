import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Check, Copy, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { getListBridgeTransfersQueryKey, useListBridgeTransfers, type BridgeTransferRow } from '@workspace/api-client-react';
import { LayerZeroTransferStatus } from '@/components/layerzero-transfer-status';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';
import { explorerAmount as amount, explorerUtc as utc, explorerStatus as statusInfo, explorerStages, layerZeroScanTransactionUrl } from '@/lib/bridge-explorer-format';
import './defi-flow.css';
import './bridge-explorer.css';

type Filter = 'all' | 'pending' | 'retrying' | 'delivered' | 'failed';
const FILTERS: Filter[] = ['all', 'pending', 'retrying', 'delivered', 'failed'];
const CHAINS: Record<number, { name: string; tx: string }> = {
  1: { name: 'Ethereum', tx: 'https://etherscan.io/tx/' },
  4663: { name: 'Robinhood Chain', tx: 'https://robin.etherscan.io/tx/' },
};

function short(v: string | null) { return !v ? 'Awaiting confirmation' : v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v; }
function chainName(id: number) { return CHAINS[id]?.name ?? `Chain ${id}`; }

function CopyBtn({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return <>
    <button type="button" className="bx-copy" aria-label={state === 'ok' ? 'Transaction hash copied' : 'Copy transaction hash'} onClick={async () => {
      try {
        await copyTextToClipboard(value); setState('ok');
        window.setTimeout(() => setState('idle'), 2500);
      } catch { setState('fail'); }
    }}>{state === 'ok' ? <Check size={13} /> : <Copy size={13} />}</button>
    {state === 'fail' && <code className="bx-fail" role="status">{value}</code>}
  </>;
}

function TxLine({ label, chainId, hash, emptyLabel = 'Not delivered yet' }: { label: string; chainId: number; hash: string | null; emptyLabel?: string }) {
  const base = CHAINS[chainId]?.tx;
  return <div className="bx-tx"><span>{label}</span>
    {hash ? <span className="bx-tx-val">
      {base ? <a href={`${base}${hash}`} target="_blank" rel="noreferrer" className="mono">{short(hash)}<ExternalLink size={12} /></a> : <span className="mono">{short(hash)}</span>}
      <CopyBtn value={hash} /></span>
      : <em>{emptyLabel}</em>}
  </div>;
}

function Row({ row }: { row: BridgeTransferRow }) {
  const st = statusInfo(row);
  return <article className="bx-row" data-testid={`row-bridge-transfer-${row.id}`}>
    <header>
      <div><strong>{row.name || 'Unnamed token'}</strong> <span className="bx-sym">{row.symbol ? `$${row.symbol}` : ''}</span></div>
      <span className={`bx-pill ${st.tone}`} data-testid={`status-bridge-${row.id}`}>{st.label}{row.hasRetryError && st.tone !== 'good' && row.retryCount > 0 ? ` · ${row.retryCount} retries` : ''}</span>
    </header>
    <div className="bx-route">{chainName(row.sourceChainId)} <ArrowRight size={13} /> {chainName(row.destinationChainId)}</div>
    <dl className="bx-progress" aria-label="Bridge transfer progress">
      {explorerStages(row).map(stage => <div key={stage.label}>
        <dt>{stage.label}</dt><dd className={stage.done ? 'is-complete' : ''}>{stage.status}</dd>
      </div>)}
    </dl>
    <dl className="bx-grid">
      <div><dt>Sender</dt><dd className="mono" title={row.sender ?? undefined}>{short(row.sender)}</dd></div>
      <div><dt>Recipient</dt><dd className="mono" title={row.recipient ?? undefined}>{short(row.recipient)}</dd></div>
      <div><dt>Sent</dt><dd>{amount(row.grossAmount)} {row.symbol ?? ''}</dd></div>
      <div><dt>{row.status === 'delivered' ? 'Received' : 'Expected receipt'}{row.destinationFee == null ? '' : ` (after ${amount(row.destinationFee)} fee)`}</dt><dd>{amount(row.recipientAmount)} {row.symbol ?? ''}</dd></div>
      <div><dt>Tracked</dt><dd>{utc(row.createdAt)}</dd></div>
      <div><dt>Updated</dt><dd>{utc(row.updatedAt)}</dd></div>
    </dl>
    <TxLine label="Source tx" chainId={row.sourceChainId} hash={row.sourceTransactionHash} />
    <TxLine label="Destination tx" chainId={row.destinationChainId} hash={row.destinationTransactionHash}
      emptyLabel={row.status === 'delivered' ? 'Receipt lookup pending' : 'Not delivered yet'} />
    <a className="bx-scan-link" href={layerZeroScanTransactionUrl(row.sourceTransactionHash)}
      target="_blank" rel="noopener noreferrer" data-testid={`link-layerzero-scan-${row.id}`}>
      View on LayerZero Scan <ExternalLink size={14} aria-hidden="true" />
    </a>
    <LayerZeroTransferStatus hash={row.sourceTransactionHash} sourceBridge={row.sourceBridge} destinationBridge={row.destinationBridge} />
  </article>;
}

export default function BridgeExplorerPage() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Filter>('all');
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors[cursors.length - 1];
  useEffect(() => {
    const t = window.setTimeout(() => { setQ(input.trim()); setCursors([]); }, 350);
    return () => window.clearTimeout(t);
  }, [input]);
  const params = { limit: 25, status, ...(q ? { q } : {}), ...(cursor ? { cursor } : {}) };
  const query = useListBridgeTransfers(params, { query: { queryKey: getListBridgeTransfersQueryKey(params), refetchInterval: 3_000 } });
  const data = query.data;

  return <div className="defi-flow-page bx-page" data-testid="page-bridge-explorer">
    <header className="defi-flow-header">
      <span className="defi-flow-eyebrow">ARMOREUM MULTICHAIN</span>
      <div className="bx-title"><h1>Bridge Explorer</h1>
        <Link href="/bridge" className="bx-cta" data-testid="link-open-bridge">Open Bridge <ArrowRight size={14} /></Link></div>
      <p className="defi-flow-intro">Read-only history of Armoreum token-pair bridge transfers. Delivered means the destination transaction is confirmed on-chain; LayerZero Scan is supplementary. All times are UTC.</p>
      <p className="bx-note" role="note">Transfers submitted through Armoreum appear as soon as their source transaction hash is reported. Source pending does not mean confirmed. Source confirmations, LayerZero verification, and destination delivery are tracked separately. Direct contract transfers are recovered by the background indexer.</p>
    </header>

    <div className="bx-tools">
      <label className="bx-search"><Search size={14} />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search token, address or tx hash" aria-label="Search bridge transfers" data-testid="input-bridge-search" />
      </label>
      <div className="bx-filters" role="group" aria-label="Status filter">
        {FILTERS.map((f) => <button key={f} type="button" aria-pressed={status === f} className={status === f ? 'on' : ''}
          onClick={() => { setStatus(f); setCursors([]); }} data-testid={`button-filter-${f}`}>{f[0].toUpperCase() + f.slice(1)}</button>)}
      </div>
      <button type="button" className="bridge-history-refresh" onClick={() => void query.refetch()} disabled={query.isFetching} data-testid="button-refresh"><RefreshCw size={13} /> Refresh</button>
    </div>
    <p className="bx-meta" role="status">
      {data ? `${data.total} matching transfer${data.total === 1 ? '' : 's'} · observed ${utc(data.observedAt)} · refreshes every 3 s` : 'Loading…'}
    </p>

    {query.isLoading ? <div className="bx-list" aria-label="Loading transfers">{[0, 1, 2].map((i) => <div key={i} className="bx-row bx-skel" />)}</div>
      : query.isError && !data ? <div className="bx-state" role="alert"><strong>Unable to load bridge transfers</strong><p>The explorer service did not respond.</p><button type="button" className="bridge-history-refresh" onClick={() => void query.refetch()} data-testid="button-retry">Retry</button></div>
      : data && data.items.length === 0 ? <div className="bx-state"><strong>No transfers found</strong><p>{q || status !== 'all' ? 'Nothing matches these filters.' : 'No bridge transfers have been indexed yet.'}</p></div>
      : <>
        {query.isError && <p className="bx-note" role="alert">Latest refresh failed; showing the last loaded results.</p>}
        <div className="bx-list">{data?.items.map((r) => <Row key={r.id} row={r} />)}</div>
        <nav className="bx-pager" aria-label="Pagination">
          <button type="button" className="bridge-history-refresh" disabled={!cursors.length || query.isFetching} onClick={() => setCursors((c) => c.slice(0, -1))} data-testid="button-prev">Newer</button>
          <span>Page {cursors.length + 1}</span>
          <button type="button" className="bridge-history-refresh" disabled={!data?.nextCursor || query.isFetching} onClick={() => data?.nextCursor && setCursors((c) => [...c, data.nextCursor as string])} data-testid="button-next">Older</button>
        </nav>
      </>}
  </div>;
}
