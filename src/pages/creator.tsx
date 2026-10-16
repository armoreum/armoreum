import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowDownRight, ArrowRight, CircleAlert, CircleHelp, FileCheck2, Wallet } from 'lucide-react';
import { useArmoreumWallet } from '@/contexts/wallet-context';
import { useRecoverySession } from '@/contexts/recovery-session-context';
import { CreatorUnjailFlow } from '@/components/CreatorUnjailFlow';
import {
  getListActivityQueryKey,
  getListLaunchesQueryKey,
  useListActivity,
  useListLaunches,
} from '@workspace/api-client-react';
import type { ActivityEvent, LaunchSummary, ListActivityParams, ListLaunchesParams } from '@workspace/api-client-react';
import { getExplorerTransactionUrl, NETWORKS } from '@workspace/api-zod';
import { formatDateTimeUTC } from '../lib/date-format';

type CreatorSection = 'overview' | 'rewards' | 'activity' | 'security';
const sections: { id: CreatorSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'activity', label: 'Activity' },
  { id: 'security', label: 'Security' },
];
const legacySectionForPath: Record<string, CreatorSection> = {
  '/my-launches': 'overview',
  '/rewards': 'rewards',
  '/activity': 'activity',
};
const unavailableText = 'Unavailable';
const isSection = (value: string | null): value is CreatorSection =>
  sections.some((section) => section.id === value);

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{children}</span>;
}

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return <div className="section-title"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div></div>;
}

function EmptyState({ title, detail, error = false, retry }: { title: string; detail: string; error?: boolean; retry?: () => void }) {
  return <div className={`state-box ${error ? 'error-state' : 'empty-state'}`}>
    {error ? <CircleAlert size={18} /> : <CircleHelp size={18} />}
    <div><strong>{title}</strong><p>{detail}</p>{retry && <button className="button button-secondary compact" onClick={retry}>Retry</button>}</div>
  </div>;
}

function LaunchRows({ items }: { items: LaunchSummary[] }) {
  return <div className="creator-launch-list">{items.map((launch) => (
    <Link href={`/launch/${encodeURIComponent(launch.id)}`} className="creator-launch-row" key={launch.id}>
      <span className="token-badge">{(launch.symbol || launch.name || '?').slice(0, 1).toUpperCase()}</span>
      <span className="creator-launch-name"><strong>{launch.name || 'Name not provided'}{launch.symbol ? ` · $${launch.symbol}` : ''}</strong><small>{launch.networkId === 'multichain' ? 'Multichain' : launch.networkId ? NETWORKS[launch.networkId].name : launch.chainId === 1 ? 'Ethereum' : launch.chainId === 4663 ? 'Robinhood' : 'Network unverified'}</small><small className="mono">{launch.id}</small></span>
      <StatusPill tone={launch.graduationStatus === 'graduated' ? 'good' : 'neutral'}>{launch.graduationStatus?.replaceAll('-', ' ') || 'In progress'}</StatusPill>
      <ArrowRight size={15} />
    </Link>
  ))}</div>;
}

function ActivityTable({ items }: { items: ActivityEvent[] }) {
  const short = (value?: string | null) => value && value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-6)}` : value || unavailableText;
  const date = (value?: string | null) => {
    return value ? formatDateTimeUTC(value, unavailableText) : unavailableText;
  };
  return <div className="table-wrap"><table className="activity-table"><thead><tr><th>Event</th><th>Launch</th><th>Network</th><th>Amount</th><th>Transaction</th><th>Time (UTC)</th><th>Status</th></tr></thead><tbody>
    {items.map((event) => <tr key={event.id}>
      <td><span className="event-marker"><FileCheck2 size={15} /></span><strong>{event.eventType.replaceAll('-', ' ')}</strong></td>
      <td>{event.launchId ? <Link href={`/launch/${encodeURIComponent(event.launchId)}`} className="text-link">{event.launchLabel || short(event.launchId)}</Link> : event.launchLabel || unavailableText}</td>
      <td>{event.networkId ? NETWORKS[event.networkId].name : unavailableText}</td>
      <td className="mono">{event.amount ?? unavailableText} {event.assetSymbol || ''}</td>
      <td>{getExplorerTransactionUrl(event.networkId, event.transactionHash) ? <a className="external-link" href={getExplorerTransactionUrl(event.networkId, event.transactionHash)!} target="_blank" rel="noreferrer">{short(event.transactionHash)}</a> : short(event.transactionHash)}</td>
      <td>{date(event.timestamp)}</td>
      <td><StatusPill tone={event.status === 'confirmed' ? 'good' : event.status === 'failed' ? 'bad' : 'warn'}>{event.status.replaceAll('-', ' ')}</StatusPill></td>
    </tr>)}
  </tbody></table></div>;
}

export default function CreatorPage() {
  const [location, navigate] = useLocation();
  const [section, setSection] = useState<CreatorSection>('overview');
  const { walletAddress, walletChainId, walletError, connecting, connectWallet, forgetWallet, switchWalletNetwork, disconnectWallet, getWalletProvider } = useArmoreumWallet();
  const { records: recoveredAuthorizations, clearRecoverySession } = useRecoverySession();
  const [selectedLaunchId, setSelectedLaunchId] = useState('');
  const [activityCursor, setActivityCursor] = useState('');
  const currentPath = location.split('?')[0];
  const launchParams = useMemo<ListLaunchesParams>(() => ({}), []);
  const launchesQuery = useListLaunches(launchParams, {
    query: { queryKey: getListLaunchesQueryKey(launchParams), enabled: Boolean(walletAddress) },
  });
  const creatorLaunches = useMemo(
    () => (launchesQuery.data?.items || []).filter((launch) =>
      launch.creatorAddress?.toLowerCase() === walletAddress.toLowerCase()),
    [launchesQuery.data?.items, walletAddress],
  );
  const activityParams = useMemo<ListActivityParams>(
    () => ({ ...(selectedLaunchId ? { launchId: selectedLaunchId } : {}), ...(activityCursor ? { cursor: activityCursor } : {}) }),
    [selectedLaunchId, activityCursor],
  );
  const activityQuery = useListActivity(activityParams, {
    query: { queryKey: getListActivityQueryKey(activityParams), enabled: Boolean(selectedLaunchId) },
  });
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('section');
    const nextSection = legacySectionForPath[currentPath] || (isSection(requested) ? requested : 'overview');
    setSection(nextSection);
    if (legacySectionForPath[currentPath]) navigate(`/creator?section=${nextSection}`);
  }, [currentPath, location, navigate]);

  useEffect(() => {
    if (!creatorLaunches.some((launch) => launch.id === selectedLaunchId)) {
      setSelectedLaunchId(creatorLaunches[0]?.id || '');
      setActivityCursor('');
    }
  }, [creatorLaunches, selectedLaunchId]);

  const connectCreatorWallet = async () => {
    const connected = await connectWallet();
    if (connected) {
      setSelectedLaunchId('');
      setActivityCursor('');
    }
  };

  const selectSection = (next: CreatorSection) => {
    setSection(next);
    setActivityCursor('');
    navigate(`/creator?section=${next}`);
  };

  const renderLaunchMatch = () => {
    if (!walletAddress) return <EmptyState title="Connect a creator wallet" detail="Your matching launches will appear here." />;
    if (launchesQuery.isLoading) return <div className="skeleton-stack"><div className="skeleton-row" /><div className="skeleton-row" /></div>;
    if (launchesQuery.isError) return <EmptyState error title="Launch records unavailable" detail="Try again later." retry={() => void launchesQuery.refetch()} />;
    if (!creatorLaunches.length) return <EmptyState title="No creator launches found" detail="No launch matches this address." />;
    return <LaunchRows items={creatorLaunches} />;
  };

  return <div className="creator-page">
    <PageHeader title="Creator" description="Wallet, launches, rewards, and activity." />
    <div className="creator-tabs" role="tablist" aria-label="Creator dashboard sections">
      {sections.map((item, index) => <button key={item.id} type="button" role="tab" id={`creator-tab-${item.id}`} tabIndex={section === item.id ? 0 : -1} aria-selected={section === item.id} aria-controls={`creator-panel-${item.id}`} className={`creator-tab ${section === item.id ? 'selected' : ''}`} onClick={() => selectSection(item.id)} onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const offset = event.key === 'ArrowRight' ? 1 : -1;
          selectSection(sections[(index + offset + sections.length) % sections.length].id);
        }
      }}>{item.label}</button>)}
    </div>
    <section className="creator-tab-panel" role="tabpanel" id={`creator-panel-${section}`} aria-labelledby={`creator-tab-${section}`} key={section}>
      {section === 'overview' && <>
        <div className="creator-grid">
          <article className="panel creator-card">
            <SectionTitle title="Creator wallet" detail="Connect a wallet to match public launch records." />
            {walletAddress ? <div className="creator-address-card"><div><span>Connected address</span><strong className="mono">{walletAddress}</strong></div><div><span>Current chain ID</span><strong className="mono">{walletChainId || unavailableText}</strong></div><button className="button button-secondary compact" onClick={() => { forgetWallet(); setSelectedLaunchId(''); setActivityCursor(''); }}>Forget address</button></div> : <button className="button button-primary" onClick={() => void connectCreatorWallet()} disabled={connecting} data-testid="button-connect-creator-wallet"><Wallet size={15} />{connecting ? 'Connecting…' : 'Connect creator wallet'}</button>}
            {walletError && <p className="creator-inline-error" role="alert">{walletError}</p>}
            <p className="creator-connection-note">Address matching does not authorize Unjail or register a protected payout destination.</p>
          </article>
          <article className="panel creator-card">
            <SectionTitle title="Creator launches" detail="Launches associated with this address." />
            {renderLaunchMatch()}
          </article>
        </div>
      </>}
      {section === 'rewards' && <>
        {recoveredAuthorizations.length > 0 && <section className="panel creator-card" aria-labelledby="recovered-capsule-heading">
          <SectionTitle
            title="Recovered creator capsule"
            detail="The capsule was decrypted locally and is held in memory for this page session."
          />
          <p className="creator-connection-note" id="recovered-capsule-heading">This confirms that the capsule password authenticated its contents. It does not verify the current on-chain authorization root or submit an Unjail transaction.</p>
          <div className="creator-launch-list">
            {recoveredAuthorizations.map((record) => {
              const connectedChainId = walletChainId
                ? Number.parseInt(walletChainId, walletChainId.startsWith('0x') ? 16 : 10)
                : null;
              const addressMatches = walletAddress?.toLowerCase() === record.creatorAddress.toLowerCase();
              const chainMatches = connectedChainId === record.chainId;
              return <article className="creator-launch-row" key={`${record.chainId}:${record.launchId}`}>
                <span className="token-badge"><FileCheck2 size={16} aria-hidden="true" /></span>
                <span className="creator-launch-name">
                  <strong>{record.chainId === 1 ? 'Ethereum' : 'Robinhood'} · creator address</strong>
                  <small className="mono">{record.creatorAddress}</small>
                  <small className="mono">Launch · {record.launchId}</small>
                  <small className="mono">Creator vault · {record.vaultAddress || unavailableText}</small>
                </span>
                <StatusPill tone={addressMatches && chainMatches ? 'good' : 'warn'}>
                  {walletAddress
                    ? addressMatches && chainMatches ? 'Connected wallet matches' : 'Wallet does not match'
                    : 'Connect wallet to compare'}
                </StatusPill>
              </article>;
            })}
          </div>
          <p className="creator-connection-note">Private keys, authorization seeds, and proof values are not displayed here. No recovery data is sent to the server by this panel.</p>
          <button type="button" className="button button-secondary compact" onClick={clearRecoverySession}>Clear recovered data from this session</button>
        </section>}
        <CreatorUnjailFlow
          launches={creatorLaunches}
          walletAddress={walletAddress}
          walletChainId={walletChainId}
          connecting={connecting}
          walletError={walletError}
          connectWallet={connectWallet}
          switchWalletNetwork={switchWalletNetwork}
          disconnectWallet={disconnectWallet}
          getWalletProvider={getWalletProvider}
        />
      </>}
      {section === 'activity' && <section className="panel creator-card creator-activity">
        <SectionTitle title="Creator activity" detail="Recent events for this creator." />
        {!walletAddress ? <EmptyState title="Connect a creator wallet" detail="Your matching activity will appear here." />
          : launchesQuery.isLoading ? <div className="skeleton-stack"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div>
            : launchesQuery.isError ? <EmptyState error title="Creator activity unavailable" detail="Try again later." retry={() => void launchesQuery.refetch()} />
              : !creatorLaunches.length ? <EmptyState title="No creator launches found" detail="No launch matches this address." />
                : <>
                  <label className="creator-field launch-picker">Choose a launch<select value={selectedLaunchId} onChange={(event) => { setSelectedLaunchId(event.target.value); setActivityCursor(''); }} aria-label="Choose a creator launch">{creatorLaunches.map((launch) => <option value={launch.id} key={launch.id}>{launch.name || launch.symbol || launch.id} · {launch.id}</option>)}</select></label>
                  {activityQuery.isLoading ? <div className="skeleton-stack"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div>
                    : activityQuery.isError ? <EmptyState error title="Activity unavailable" detail="Try again later." retry={() => void activityQuery.refetch()} />
                      : !activityQuery.data?.items?.length ? <EmptyState title="No activity yet" detail="No events to show." />
                        : <><div className="explorer-meta"><span>{activityQuery.data.items.length} events</span></div><ActivityTable items={activityQuery.data.items} />{activityQuery.data.nextCursor && <button className="button button-secondary load-more" onClick={() => setActivityCursor(activityQuery.data?.nextCursor || '')} data-testid="button-next-creator-activity">Next page <ArrowDownRight size={15} /></button>}</>}
                </>}
      </section>}
      {section === 'security' && <section className="panel creator-card">
        <h2>Security status</h2>
        <Link href="/security" className="text-link">View current status <ArrowRight size={14} /></Link>
      </section>}
    </section>
  </div>;
}
