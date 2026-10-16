import { useRoute } from 'wouter';
import { ArrowLeft, ArrowRight, RefreshCw, Check, CircleAlert, Copy, ExternalLink, Info, KeyRound, LockKeyhole, ShieldCheck, Wallet } from 'lucide-react';
import { getGetLaunchQueryKey, useGetLaunch } from '@workspace/api-client-react';
import { launchChainId, selectLaunchDetail } from '@/lib/launch-chain-ids';
import type { LaunchDetail } from '@workspace/api-client-react';
import { getExplorerAddressUrl, NETWORKS, type NetworkId } from '@workspace/api-zod';
import { Link } from 'wouter';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useArmoreumWallet } from '../contexts/wallet-context';
import { CreatorUnjailFlow } from './CreatorUnjailFlow';
import { BridgeTransferPanel } from '../pages/bridge-live';
import { LaunchMarketHistoryPanel } from './launch-market-history';
import { formatDateTimeUTC } from '../lib/date-format';
import { copyTextToClipboard } from '../lib/copy-to-clipboard';

const unavailable = 'Unavailable';

function safeUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function money(value?: string | null) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) return unavailable;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumSignificantDigits: 6 }).format(Number(value));
}

function priceMoney(value?: string | null) {
  if (value == null || !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) return unavailable;
  return `US$${new Intl.NumberFormat('en-US', { maximumSignificantDigits: 2 }).format(Number(value))}`;
}

function amount(value?: string | null) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) return unavailable;
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 8 }).format(Number(value));
}

function feeAmount(value: string | null, symbol: string | null, status: string) {
  if (value == null) return status === 'not-indexed' ? 'Not indexed' : unavailable;
  if (symbol?.toUpperCase() !== 'ETH' || !/^\d+$/.test(value)) return amount(value);
  const wei = BigInt(value);
  const whole = wei / 10n ** 18n;
  const fraction = ((wei % 10n ** 18n) / 10n ** 12n).toString().padStart(6, '0').replace(/0+$/, '');
  const groupedWhole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(whole);
  const decimal = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1 }).formatToParts(1.1)
    .find((part) => part.type === 'decimal')?.value || '.';
  return `${groupedWhole}${fraction ? `${decimal}${fraction}` : ''}`;
}

function jailEthAmount(wei?: string | null) {
  if (wei == null || !/^\d+$/.test(wei)) return unavailable;
  const value = BigInt(wei);
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ''}`;
}

function short(value?: string | null, start = 7, end = 5) {
  if (!value) return unavailable;
  return value.length > start + end + 3 ? `${value.slice(0, start)}…${value.slice(-end)}` : value;
}

function date(value?: string | null) {
  return value ? formatDateTimeUTC(value, unavailable) : unavailable;
}

function title(value?: string | null) {
  return value ? value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : unavailable;
}

function networkFor(launch: LaunchDetail): NetworkId | null {
  if (launch.networkId === 'robinhood' && (launch.chainId == null || launch.chainId === 4663)) return 'robinhood';
  if (launch.networkId === 'ethereum' && (launch.chainId == null || launch.chainId === 1)) return 'ethereum';
  if (launch.chainId === 4663) return 'robinhood';
  if (launch.chainId === 1) return 'ethereum';
  return null;
}

function explorerLinks(launch: LaunchDetail) {
  const deployments = launch.networkDeployments || [];
  if (deployments.length) return deployments.flatMap((deployment) => {
    if (deployment.status !== 'confirmed' || !deployment.tokenAddress) return [];
    const href = getExplorerAddressUrl(deployment.networkId, deployment.tokenAddress);
    return href ? [{ href, label: NETWORKS[deployment.networkId].name }] : [];
  });
  const network = networkFor(launch);
  const href = network ? getExplorerAddressUrl(network, launch.tokenAddress) : null;
  return href && network ? [{ href, label: NETWORKS[network].name }] : [];
}

function CopyAddress({ value, label }: { value?: string | null; label: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  if (!value) return <span>{unavailable}</span>;
  return <>
    <button className="copy-address mono" type="button" aria-label={copied ? 'Copied' : copyFailed ? 'Copy failed' : label} title={copied ? 'Copied' : copyFailed ? 'Copy failed; select the full value shown below' : label} data-testid={`copy-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={async () => {
      setCopyFailed(false);
      setCopied(false);
      try {
        await copyTextToClipboard(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        setCopied(false);
        setCopyFailed(true);
        window.setTimeout(() => setCopyFailed(false), 2500);
      }
    }}>{short(value)} <span aria-hidden="true">{copied ? 'Copied' : copyFailed ? 'Copy failed' : 'Copy'}</span></button>
    {copyFailed && <code className="copy-failure-value" role="status">{value}</code>}
  </>;
}

export function CreatorKeyDisclosure({ value, detail = false, copyToClipboard, testIdPrefix }: { value?: string | null; detail?: boolean; copyToClipboard: (value: string) => Promise<void>; testIdPrefix?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  return <div className={`creator-key-copy ${detail ? 'is-detail' : ''}`}>
    <code className="creator-private-key" data-testid={testIdPrefix ? `${testIdPrefix}-creator-private-key` : detail ? 'creator-private-key-detail' : 'creator-private-key-card'}>{value || 'Creator key unavailable'}</code>
    <button className={detail ? 'button button-secondary' : 'launch-detail-link'} type="button" disabled={!value} onClick={async () => {
      if (!value) return;
      setError('');
      setCopied(false);
      try {
        await copyToClipboard(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Creator key could not be copied.');
      }
    }} data-testid={testIdPrefix ? `button-copy-${testIdPrefix}-creator-key` : detail ? 'button-copy-creator-key-detail' : 'button-copy-creator-key'}>
      {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy key</>}
    </button>
    {error && <small className="form-error" role="alert">{error}</small>}
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="tt-info-row" data-testid={`detail-${label.toLowerCase().replaceAll(' ', '-')}`}><span>{label}</span><div>{children}</div></div>;
}

function FeeSummary({ launch }: { launch: LaunchDetail }) {
  const groups = [
    ['Pending', launch.pendingFees],
    ['Escrowed', launch.escrowedFees],
    ['Vault held', launch.vaultHeldFees],
    ['Paid rewards', launch.paidRewards],
  ] as const;
  return <section className="tt-panel">
    <div className="tt-section-head"><div><h2>Fee balances</h2><p>Reported categories are not automatically claimable by the connected wallet.</p></div></div>
     <div className="tt-fee-columns">{groups.map(([name, fees]) => <div className="tt-fee" key={name}><h3>{name}</h3>{fees.length ? fees.map((fee) => <div key={`${fee.assetAddress}-${fee.status}`}><p>{feeAmount(fee.amount, fee.assetSymbol, fee.status)} {fee.assetSymbol || ''}</p><small>{title(fee.status)}{fee.assetAddress && !/^0x0{40}$/i.test(fee.assetAddress) ? ` · ${short(fee.assetAddress, 8, 4)}` : ''}</small></div>) : <div className="tt-empty-inline">No {name.toLowerCase()} fee records returned.</div>}</div>)}</div>
     {launch.pendingFees.length > 0 && <p className="tt-fee-explanation">Pending shows Pons fees accrued in the TaxRouter. Escrowed shows the separate Pons FeeEscrow balance.</p>}
     {networkFor(launch) === 'ethereum' && <p className="tt-fee-explanation">Ethereum TaxRouter distributions are attempted when accrued creator fees reach 0.01 ETH. Smaller balances remain accrued for retry.</p>}
  </section>;
}

export default function LaunchDetailDashboard({ copyToClipboard }: { copyToClipboard: (value: string) => Promise<void> }) {
  const [, params] = useRoute('/launch/:launchId');
  const id = params?.launchId || '';
  const [swapInfoOpen, setSwapInfoOpen] = useState(false);
  const [unjailOpen, setUnjailOpen] = useState(false);
  const [bridgeOpen, setBridgeOpen] = useState(false);
  const { walletAddress, walletChainId, walletError, connecting, connectWallet, switchWalletNetwork, disconnectWallet, getWalletProvider } = useArmoreumWallet();
  const base = useGetLaunch(id, { query: { queryKey: getGetLaunchQueryKey(id) } });
  const isMultichain = base.data?.launchMode === 'multichain';
  const detailNetwork = base.data && !isMultichain ? networkFor(base.data) : null;
  const defaultChain = detailNetwork === 'ethereum' || detailNetwork === 'robinhood'
    ? detailNetwork : id.startsWith('ethereum:') ? 'ethereum' : 'robinhood';
  const [chainSelection, setChainSelection] = useState<{
    routeId: string; chain: 'robinhood' | 'ethereum';
  }>({ routeId: id, chain: defaultChain });
  const chainTab = isMultichain && chainSelection.routeId === id ? chainSelection.chain : defaultChain;
  const setChainTab = (chain: 'robinhood' | 'ethereum') => {
    setUnjailOpen(false);
    setSwapInfoOpen(false);
    setBridgeOpen(false);
    setChainSelection({ routeId: id, chain });
  };
  const selectedId = isMultichain ? launchChainId(id, chainTab) : id;
  const selected = useGetLaunch(selectedId, { query: { queryKey: getGetLaunchQueryKey(selectedId), enabled: isMultichain } });
  const ethId = launchChainId(id, 'ethereum');
  const ethQuery = useGetLaunch(ethId, { query: { queryKey: getGetLaunchQueryKey(ethId), enabled: isMultichain } });
  const robinhoodId = launchChainId(id, 'robinhood');
  const robinhoodQuery = useGetLaunch(robinhoodId, { query: { queryKey: getGetLaunchQueryKey(robinhoodId), enabled: isMultichain } });
  const { isLoading, isError, refetch } = base;
  const data = base.data;

  if (isLoading) return <div className="token-terminal"><div className="tt-panel tt-loading"><div className="tt-skeleton-wide" /><div className="tt-skeleton-metrics" /><div className="tt-skeleton-chart" /></div></div>;
  if (isError || !data) return <div className="token-terminal"><Link href="/explore" className="back-link"><ArrowLeft size={15} /> Back to launch records</Link><div className="tt-panel tt-error" role="alert"><CircleAlert size={18} /><div><strong>Launch details are unavailable</strong><p>Verified launch data could not be loaded. Try again shortly.</p><button className="button button-secondary compact" type="button" onClick={() => void refetch()}>Retry</button></div></div></div>;

  const head = data;
  const headLinks = explorerLinks(head);
  const robinhoodCa = head.networkDeployments?.find((d) => d.networkId === 'robinhood' && d.status === 'confirmed')?.tokenAddress || null;
  const ethereumCa = head.networkDeployments?.find((d) => d.networkId === 'ethereum' && d.status === 'confirmed')?.tokenAddress || null;
  const headLogo = safeUrl(head.imageUrl);
  const headNetwork = networkFor(head);
  const headPonsUrl = (head.launchMode === 'pons-v2' || (head.launchMode === 'multichain' && robinhoodCa)) && /^0x[\da-f]{40}$/i.test(robinhoodCa || head.tokenAddress) && (isMultichain || headNetwork === 'robinhood')
    ? `https://ponsfamily.com/launchpad/${robinhoodCa || head.tokenAddress}` : null;
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'robinhood' : event.key === 'End' ? 'ethereum' : chainTab === 'robinhood' ? 'ethereum' : 'robinhood';
    setChainTab(next);
    document.getElementById(`tt-chain-tab-${next}`)?.focus();
  };
  const tabs = isMultichain ? <div className="tt-chain-tabs" role="tablist" aria-label="Select chain">
    {(['robinhood', 'ethereum'] as const).map((chain) => <button key={chain} id={`tt-chain-tab-${chain}`} type="button" role="tab" aria-selected={chainTab === chain} aria-controls="tt-chain-panel" tabIndex={chainTab === chain ? 0 : -1} className={`tt-chain-tab ${chainTab === chain ? 'is-active' : ''}`} onClick={() => setChainTab(chain)} onKeyDown={onTabKey} data-testid={`tab-chain-${chain}`}>{NETWORKS[chain].name}</button>)}
  </div> : null;
  const selectedLaunch = selectLaunchDetail(head, selected.data, selectedId, chainTab);
  const chainPending = isMultichain && (selected.isLoading || selected.isFetching && !selectedLaunch);
  const chainFailed = isMultichain && !chainPending && (selected.isError || !selectedLaunch);
  const launch = (selectedLaunch || head) as LaunchDetail;
  const chainBalance = (chain: 'robinhood' | 'ethereum') => {
    const q = chain === 'ethereum' ? ethQuery : robinhoodQuery;
    const expected = launchChainId(id, chain).toLowerCase();
    if (q.isLoading || (q.isFetching && !q.data)) return <p className="tt-jail-balance-note" role="status">Loading balance…</p>;
    if (q.isError || !q.data || q.data.id.toLowerCase() !== expected || q.data.chainId !== (chain === 'ethereum' ? 1 : 4663)) return <div role="alert"><p className="tt-jail-balance-note">Balance unavailable</p><button type="button" className="button button-secondary compact" onClick={() => void q.refetch()}><RefreshCw size={12} aria-hidden="true" /> Retry</button></div>;
    return <><strong><span>{jailEthAmount(q.data.creatorJailEthBalance)}</span><small>JailETH</small></strong><span className="tt-jail-balance-note">{q.data.vaultStatus === 'verified' ? `Verified ${NETWORKS[chain].name} Creator Vault` : `${NETWORKS[chain].name} vault not verified`}</span></>;
  };
  const dualBalances = isMultichain ? <section className="tt-panel tt-dual-balances" aria-label="Creator JailETH balances by network">
    {(['ethereum', 'robinhood'] as const).map((chain) => <aside className="tt-jail-balance-card" key={chain} data-testid={`creator-jail-eth-${chain}`} aria-label={`${NETWORKS[chain].name} JailETH available to unjail`}>
      <div className="tt-jail-balance-kicker"><span>{NETWORKS[chain].name.toUpperCase()} JAILETH</span><ShieldCheck size={15} aria-hidden="true" /></div>
      <p>Available on {NETWORKS[chain].name}</p>
      {chainBalance(chain)}
    </aside>)}
  </section> : null;
  const network = networkFor(launch);
  const links = explorerLinks(launch);
  const ponsUrl = (launch.launchMode === 'pons-v2' || launch.launchMode === 'multichain') && network === 'robinhood' && /^0x[\da-f]{40}$/i.test(launch.tokenAddress)
    ? `https://ponsfamily.com/launchpad/${launch.tokenAddress}` : null;
  const freshState = launch.marketDataStatus?.toLowerCase() || '';
  const stale = freshState.includes('stale');
  const marketState = launch.marketDataStatus ? title(launch.marketDataStatus) : 'No status reported';
  const statusTone = launch.lifecycle === 'graduated' && launch.poolAddress ? 'Graduated' : launch.lifecycle === 'bonding-curve' ? 'Bonding Curve' : 'Lifecycle unavailable';
  const logo = safeUrl(launch.imageUrl);
  const amountMetrics = [
    ['Price (USD)', priceMoney(launch.priceUsd), launch.priceNative ? `${launch.priceNative} native` : 'Native quote unavailable'],
    ['FDV', money(launch.fullyDilutedValuationUsd), 'Total supply basis'],
  ];

  return <div className="token-terminal">
    <Link href="/explore" className="back-link"><ArrowLeft size={15} /> Explore launches <span aria-hidden="true">/</span> {launch.name || launch.symbol || 'Token'}</Link>
    <header className="tt-hero">
      <div className="tt-identity">
        <div className="token-badge">{headLogo ? <img src={headLogo} alt="" /> : (head.symbol || head.name || '?').slice(0, 1).toUpperCase()}</div>
        <div>
          <span className="tt-eyebrow">Verified launch record</span>
          <div className="tt-name-line"><h1>{head.name || 'Name not provided'}</h1><span>{head.symbol ? `$${head.symbol}` : 'Symbol unavailable'}</span></div>
          <div className={`tt-addressline${isMultichain ? ' tt-addressline-multichain' : ''}`}>
            {isMultichain ? <>
              <span className="tt-ca-row"><span>Robinhood CA</span><CopyAddress value={robinhoodCa} label="Copy Robinhood token address" /></span>
              <span className="tt-ca-row"><span>Ethereum CA</span><CopyAddress value={ethereumCa} label="Copy Ethereum token address" /></span>
            </> : <CopyAddress value={head.tokenAddress} label="Copy token address" />}
            {isMultichain
              ? <span className="tt-ca-row tt-creator-row"><span className="tt-creator-label">Creator</span><CopyAddress value={head.creatorAddress} label="Copy creator address" /></span>
              : <><span className="tt-creator-label">Creator</span><CopyAddress value={head.creatorAddress} label="Copy creator address" /></>}
          </div>
          <div className="tt-tags">
            <span className="tt-tag"><span className="status-dot" />{isMultichain ? 'Multichain' : headNetwork ? NETWORKS[headNetwork].name : 'Network unverified'}{!isMultichain && head.chainId != null ? ` · ${head.chainId}` : ''}</span>
            {!isMultichain && <span className="tt-tag">{title(head.launchMode)}</span>}
          </div>
        </div>
      </div>
      <div className="tt-actions">
        {headPonsUrl && <a className="tt-action" href={headPonsUrl} target="_blank" rel="noreferrer">View on Pons <ExternalLink size={14} /></a>}
        {headLinks.map(({ href, label }) => <a className="tt-action" href={href} target="_blank" rel="noreferrer" key={href}>{label} explorer <ExternalLink size={14} /></a>)}
        {safeUrl(head.websiteUrl) && <a className="tt-action" href={safeUrl(head.websiteUrl)!} target="_blank" rel="noreferrer">Website <ExternalLink size={14} /></a>}
      </div>
    </header>
    {dualBalances}
    {tabs}
    <div id="tt-chain-panel" role={isMultichain ? 'tabpanel' : undefined} aria-labelledby={isMultichain ? `tt-chain-tab-${chainTab}` : undefined} aria-busy={chainPending}>
    {chainPending ? <div className="tt-panel tt-loading" role="status" aria-label={`Loading ${NETWORKS[chainTab].name} data`}><div className="tt-skeleton-wide" /><div className="tt-skeleton-metrics" /><div className="tt-skeleton-chart" /></div>
    : chainFailed ? <div className="tt-panel tt-error" role="alert"><CircleAlert size={18} /><div><strong>{NETWORKS[chainTab].name} details are unavailable</strong><p>Verified data for this chain could not be loaded. Nothing from the other chain is shown in its place.</p><button className="button button-secondary compact" type="button" onClick={() => void selected.refetch()}>Retry</button></div></div>
    : <>
    <section className="tt-panel tt-key-panel">
      <div className="tt-key-balance-layout">
        <div className="tt-key-main">
          <div className="tt-section-head"><div><h2>Creator private key</h2><p>Public creator key · click Copy key to copy the full value.</p></div></div>
          <CreatorKeyDisclosure value={launch.creatorPrivateKey} detail copyToClipboard={copyToClipboard} />
        </div>
        {!isMultichain && <aside className="tt-jail-balance-card" aria-label="JailETH available to unjail" data-testid="creator-jail-eth-available">
          <div className="tt-jail-balance-kicker"><span>CREATOR UNJAIL</span><ShieldCheck size={15} aria-hidden="true" /></div>
          <p>Available JailETH</p>
          <strong><span>{jailEthAmount(launch.creatorJailEthBalance)}</span><small>JailETH</small></strong>
          <span className="tt-jail-balance-note">{launch.vaultStatus === 'verified' ? 'Verified Creator Vault balance' : 'Creator Vault balance not verified'}</span>
        </aside>}
      </div>
    </section>

    <div className="tt-layout">
      <main className="tt-main">
        <div className="tt-market-actions">
          <section className="tt-panel tt-metrics" aria-label="Verified market metrics">
            {amountMetrics.map(([label, value, note]) => <div className="tt-metric" key={label} data-testid={`metric-${label.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`}><label>{label}</label><strong>{value}</strong><small>{note}</small></div>)}
          </section>
          <div className={`tt-detail-cta-stack${isMultichain ? ' is-multichain' : ''}`} aria-label="Token actions">
            <button className="tt-detail-cta" type="button" onClick={() => setSwapInfoOpen(true)} data-testid="button-open-jailswap-coming-soon">
              <strong>JailSwap</strong>
            </button>
            <button className="tt-detail-cta is-claim" type="button" onClick={() => setUnjailOpen(true)} data-testid="button-open-creator-unjail">
              <strong>Claim / Unjail</strong>
            </button>
            {isMultichain && (
              <button className="tt-detail-cta is-bridge" type="button" onClick={() => setBridgeOpen(true)} data-testid="button-token-bridge">
                <strong>Bridge</strong>
              </button>
            )}
          </div>
        </div>

        {(launch.launchMode === 'pons-v2' || (launch.launchMode === 'multichain' && network === 'robinhood'))
          ? <LaunchMarketHistoryPanel key={selectedId} launchId={selectedId} symbol={launch.symbol} />
          : <section className="tt-panel">
              <div className="tt-section-head">
                <div>
                  <h2>Market overview</h2>
                  <p>{launch.chainId === 1
                    ? `${launch.marketDataSource || 'DexScreener'} · live Ethereum pair data`
                    : 'Ethereum market data is available for Ethereum launch deployments.'}</p>
                </div>
              </div>
              {launch.chainId === 1 ? (
                <>
                  <div className="tt-info-list">
                    <Field label="Liquidity">{money(launch.liquidityUsd)}</Field>
                    <Field label="24h volume">{money(launch.marketDataVolume24hUsd)}</Field>
                    <Field label="Market pair">
                      <a
                        className="external-link"
                        href={safeUrl(launch.marketPairUrl) || `https://dexscreener.com/ethereum/${launch.tokenAddress}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {launch.marketPairAddress ? short(launch.marketPairAddress) : 'Open token on DexScreener'} <ExternalLink size={12} />
                      </a>
                    </Field>
                    <Field label="Last updated">{launch.priceObservedAt ? date(launch.priceObservedAt) : unavailable}</Field>
                  </div>
                  {launch.marketDataStatus !== 'fresh' && (
                    <p className="tt-fee-explanation">
                      DexScreener does not currently return an Ethereum pair for this token. The chart link opens its token page so the pair can be checked directly.
                    </p>
                  )}
                </>
              ) : (
                <p className="tt-fee-explanation">No Ethereum network deployment is recorded for this launch, so Ethereum pair data is not shown here.</p>
              )}
            </section>}
      </main>

      <aside className="tt-aside">
        <FeeSummary launch={launch} />
        <section className="tt-panel">
          <div className="tt-section-head"><div><h2>Token information</h2><p>Public launch and supply details</p></div></div>
          <div className="tt-info-list">
            <Field label="Token Address"><CopyAddress value={launch.tokenAddress} label="Copy token address" /></Field>
            <Field label="Creator Address"><CopyAddress value={launch.creatorAddress} label="Copy creator address" /></Field>
            <Field label="Network">{network ? `${NETWORKS[network].name}${launch.chainId == null ? '' : ` (${launch.chainId})`}` : 'Network unverified'}</Field>
            <Field label="Launch Protocol">{title(launch.launchMode)}</Field>
            <Field label="Launched">{date(launch.launchTimestamp)}</Field>
            <Field label="Total Supply">{amount(launch.totalSupply)}</Field>
            <Field label="Website">{safeUrl(launch.websiteUrl) ? <a className="external-link" href={safeUrl(launch.websiteUrl)!} target="_blank" rel="noreferrer">Open website <ExternalLink size={12} /></a> : null}</Field>
            <Field label="X (Twitter)">{safeUrl(launch.xUrl) ? <a className="external-link" href={safeUrl(launch.xUrl)!} target="_blank" rel="noreferrer">Open profile <ExternalLink size={12} /></a> : null}</Field>
            <Field label="Explorer">{links.map(({ href, label }) => <a className="external-link" href={href} target="_blank" rel="noreferrer" key={href}>{label} <ExternalLink size={12} /></a>)}</Field>
          </div>
        </section>
      </aside>
    </div>
    </>}
    </div>

    <Dialog open={swapInfoOpen} onOpenChange={setSwapInfoOpen}>
      {swapInfoOpen && <DialogContent className="tt-action-dialog" data-testid="dialog-jailswap-coming-soon">
        <div className="tt-action-dialog-scroll">
          <DialogHeader className="tt-action-dialog-header">
            <DialogTitle><LockKeyhole size={18} aria-hidden="true" /> JailSwap <span className="tt-coming-soon">Coming soon</span></DialogTitle>
            <DialogDescription>Personal-vault trading for supported launches.</DialogDescription>
          </DialogHeader>
          <div className="tt-action-dialog-body">
            <p>JailSwap is being designed around one personal JailVault per wallet on the selected network.</p>
            <section className="tt-security-architecture" aria-labelledby="tt-security-architecture-title">
              <div className="tt-security-intro">
                <span className="tt-security-eyebrow">PLANNED PROTECTION</span>
                <h3 id="tt-security-architecture-title">Make security part of the architecture</h3>
                <p>Each protected vault action is designed to require both checks below.</p>
              </div>
              <div className="tt-security-flow" role="img" aria-label="Wallet signature and password proof authorize a personal JailVault that holds JailETH or JailToken">
                <div className="tt-security-auth">
                  <span className="tt-security-check-label">BOTH CHECKS REQUIRED</span>
                  <div className="tt-security-node">
                    <Wallet className="tt-security-icon" size={16} aria-hidden="true" />
                    <div><strong>Wallet signature</strong><small>Confirms control of your connected account</small></div>
                  </div>
                  <div className="tt-security-node">
                    <KeyRound className="tt-security-icon" size={16} aria-hidden="true" />
                    <div><strong>Password proof</strong><small>Derived locally; your password is never sent</small></div>
                  </div>
                </div>
                <ArrowRight className="tt-security-arrow" size={18} aria-hidden="true" />
                <div className="tt-security-node tt-security-vault">
                  <ShieldCheck className="tt-security-icon" size={17} aria-hidden="true" />
                  <div><strong>Personal JailVault</strong><small>Holds this wallet’s assets separately</small></div>
                </div>
                <ArrowRight className="tt-security-arrow" size={18} aria-hidden="true" />
                <div className="tt-security-node tt-security-output">
                  <LockKeyhole className="tt-security-icon" size={16} aria-hidden="true" />
                  <div><strong>JailETH / JailToken</strong><small>Trade output stays in the vault</small></div>
                </div>
              </div>
              <p className="tt-security-footnote"><ShieldCheck size={16} aria-hidden="true" /><span>With this planned design, a leaked wallet private key alone would not authorize protected vault actions; a separate password-derived proof would also be required.</span></p>
            </section>
            <div className="tt-modal-status"><Info size={16} aria-hidden="true" /><span>JailSwap is not enabled yet. Wallet connection, live quotes, and trades are still being built; this preview will not request a signature or submit a transaction.</span></div>
          </div>
        </div>
      </DialogContent>}
    </Dialog>

    <Dialog open={bridgeOpen} onOpenChange={setBridgeOpen}>
      {bridgeOpen && <DialogContent className="tt-action-dialog tt-bridge-dialog" data-testid="dialog-token-bridge">
        <div className="tt-action-dialog-scroll">
          <DialogHeader className="tt-action-dialog-header">
            <DialogTitle>Bridge {launch.symbol ? `$${launch.symbol}` : 'token'}</DialogTitle>
            <DialogDescription>Move this token between Ethereum and Robinhood Chain.</DialogDescription>
          </DialogHeader>
          <BridgeTransferPanel embedded tokenAddress={launch.tokenAddress} initialSourceChainId={launch.chainId === 4663 ? 4663 : 1} />
        </div>
      </DialogContent>}
    </Dialog>

    <Dialog open={unjailOpen} onOpenChange={setUnjailOpen}>
      {unjailOpen && <DialogContent className="tt-action-dialog tt-unjail-dialog" data-testid="dialog-creator-unjail">
        <div className="tt-action-dialog-scroll">
          <DialogHeader className="tt-action-dialog-header">
            <DialogTitle><ShieldCheck size={18} aria-hidden="true" /> Creator rewards · Unjail</DialogTitle>
            <DialogDescription>Import the published creator key into a wallet you control, then connect that creator account. Keep the creator password private.</DialogDescription>
          </DialogHeader>
          <section className="tt-modal-published-key" data-testid="unjail-published-creator-key" aria-label="Creator private key for this launch">
            <div className="tt-modal-published-key-heading">
              <strong>Creator private key</strong>
              <span>Public key for this launch · copy it to import the creator wallet.</span>
            </div>
            <CreatorKeyDisclosure value={launch.creatorPrivateKey} detail copyToClipboard={copyToClipboard} testIdPrefix="unjail" />
          </section>
          {isMultichain || network === 'robinhood' || network === 'ethereum' ? (
            <CreatorUnjailFlow
              selectionMode={isMultichain ? 'network' : 'token'}
              launches={[isMultichain ? head : launch]}
              walletAddress={walletAddress}
              walletChainId={walletChainId}
              connecting={connecting}
              walletError={walletError}
              connectWallet={connectWallet}
              switchWalletNetwork={switchWalletNetwork}
              disconnectWallet={disconnectWallet}
              getWalletProvider={getWalletProvider}
            />
          ) : (
            <div className="tt-modal-status" role="status">
              <Info size={16} aria-hidden="true" />
              <span>Creator Unjail is available only for verified Ethereum and Robinhood Creator Vaults. No transaction has been sent for this launch.</span>
            </div>
          )}
        </div>
      </DialogContent>}
    </Dialog>
  </div>;
}
