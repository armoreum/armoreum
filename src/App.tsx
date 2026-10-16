import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatDateTimeUTC } from './lib/date-format';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useRoute } from 'wouter';
import { Activity, ArrowDownRight, ArrowLeft, ArrowLeftRight, ArrowRight, Atom, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleHelp, Coins, Copy, ExternalLink, FileCheck2, Fingerprint, Globe, Home, KeyRound, Layers3, LayoutGrid, LockKeyhole, Search, ShieldAlert, ShieldCheck, UserRound, Wallet, WifiOff } from 'lucide-react';
import { SiEthereum, SiOpenzeppelin, SiRobinhood, SiWalletconnect } from 'react-icons/si';
import QRCode from "qrcode";
import {
  getGetOverviewQueryKey,
  getListActivityQueryKey, getListLaunchesQueryKey,
  useGetOverview, useListActivity, useListLaunches,
} from '@workspace/api-client-react';
import type { ActivityEvent, LaunchSummary, ListActivityParams, ListLaunchesParams } from '@workspace/api-client-react';
import { ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH, ETHEREUM_FIXED_LAUNCH_DEPOSIT_WEI, PONS_REQUIRED_CREATOR_DEPOSIT_ETH, PONS_REQUIRED_CREATOR_DEPOSIT_WEI, getExplorerAddressUrl, getExplorerTransactionUrl, getMultichainLaunchPreset, LAUNCH_MODES, MULTICHAIN_LAUNCH_PRESETS, NETWORKS, type LaunchModeId, type NetworkId } from '@workspace/api-zod';
import {
  clearLocalLaunchDrafts,
  clearCompletedLaunchDraft,
  getLaunchDraftStorageKey,
  hasSavedLaunchDraft,
  legacyLaunchDraftStorageKeys,
  readLaunchDraftStorageValue,
} from '@/lib/launch-draft-storage';
import { ErrorBoundary } from '@/components/error-boundary';
import { useBridgeSubmissionTracking } from '@/hooks/use-bridge-submission-tracking';
import CreatorPage from '@/pages/creator';
import MyJailRoute from '@/pages/my-jail';
import DeFiToolsPage from '@/pages/defi-tools';
import JailSwapPage from '@/pages/jailswap';
import BridgePage from '@/pages/bridge';
import BridgeExplorerPage from '@/pages/bridge-explorer';
import DocsPage from '@/pages/docs';
import SecurityPage from '@/pages/security';
import LaunchpadInfoPage from '@/pages/info/launchpad';
import JailSwapInfoPage from '@/pages/info/jailswap';
import BridgeInfoPage from '@/pages/info/bridge';
import StatusInfoPage from '@/pages/info/status';
import IntegrationsInfoPage from '@/pages/info/integrations';
import AboutInfoPage from '@/pages/info/about';
import PrivacyInfoPage from '@/pages/info/privacy';
import TermsInfoPage from '@/pages/info/terms';
import ContactInfoPage from '@/pages/info/contact';
import { DeFiToolsGateway } from '@/components/defi-tools-gateway';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ThemeControl } from '@/components/theme-control';
import { LandingHeroModel } from '@/components/landing-hero-model';
import { LandingSecurityFooter } from '@/components/landing-security-footer';
import { ArmorProofDialog } from '@/components/armorproof-dialog';
import { PasswordCreatorAuthorizationSetup } from '@/components/PasswordCreatorAuthorizationSetup';
import { EthereumPasswordCreatorAuthorizationSetup } from '@/components/EthereumPasswordCreatorAuthorizationSetup';
import { MultichainMainnetLaunchFlow } from '@/components/MultichainMainnetLaunchFlow';
import {
  PonsMainnetLaunchExecutor,
  PostLaunchRecoveryCapsule,
  type PonsFundingOrder,
  type PonsMainnetLaunchResult,
} from '@/components/PonsMainnetLaunchExecutor';
import {
  EthereumMainnetLaunchExecutor,
  type EthereumFundingOrder,
  type EthereumMainnetLaunchResult,
} from '@/components/EthereumMainnetLaunchExecutor';
import type { QrcAuthorizationRecord } from '@/lib/qrc';
import { buildPonsTokenUrl } from '@/lib/post-launch-links';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';
import { BrandTextTree, formatBrandText } from '@/lib/brand-text';
import { ArmoreumLogoImages } from '@/components/armoreum-logo-images';
import LaunchDetailDashboard, { CreatorKeyDisclosure } from '@/components/launch-detail-dashboard';
import { ThemeProvider } from '@/contexts/theme-context';
import NotFound from '@/pages/not-found';
import { useArmoreumWallet, WalletProvider } from '@/contexts/wallet-context';
import { migrateStorageKey } from '@/lib/storage-key-migration.js';
import './app.css';
import './theme.css';
import './launch-modes.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });
const unavailableText = 'Unavailable';

const navItems = [
  { href: '/explore', label: 'Explore', icon: Search },
  { href: '/launch-token', label: 'Launchpad', icon: Layers3 },
  { href: '/bridge', label: 'Bridge', icon: ArrowLeftRight },
  { href: '/bridge-explorer', label: 'Bridge Explorer', icon: ArrowLeftRight },
  { href: '/creator', label: 'Creator Dashboard', icon: UserRound },
  { href: '/my-jail', label: 'Jail Bank', icon: LockKeyhole },
  { href: '/offline-recovery', label: 'Offline Recovery', icon: WifiOff },
  { href: '/activity', label: 'Activity', icon: Activity },
];
const resourceItems = [
  { href: '/security', label: 'Security', icon: ShieldCheck },
  { href: '/docs', label: 'Documentation', icon: BookOpen },
];
const primaryNavItems = [
  { href: '/explore', label: 'Explore' },
  { href: '/launch-token', label: 'Launchpad' },
  { href: '/defi-tools', label: 'DeFi Tools' },
  { href: '/bridge-explorer', label: 'Bridge Explorer' },
  { href: '/security', label: 'Security' },
  { href: '/docs', label: 'Documentation' },
];
const mobilePrimaryItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Search },
  { href: '/launch-token', label: 'Launchpad', icon: Layers3 },
  { href: '/bridge', label: 'Bridge', icon: ArrowLeftRight },
  { href: '/offline-recovery', label: 'Offline Recovery', icon: WifiOff },
];
const mobileMoreItems = [
  { href: '/bridge-explorer', label: 'Bridge Explorer', icon: ArrowLeftRight },
  { href: '/my-jail', label: 'Jail Bank', icon: LockKeyhole },
  { href: '/creator', label: 'Creator Dashboard', icon: UserRound },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/security', label: 'Security', icon: ShieldCheck },
  { href: '/docs', label: 'Documentation', icon: BookOpen },
];
const launcherItems = [
  { href: '/explore', label: 'Explore', icon: Search },
  { href: '/launch-token', label: 'Launchpad', icon: Layers3 },
  { href: '/defi-tools', label: 'DeFi Tools', icon: Coins },
  { href: '/bridge-explorer', label: 'Bridge Explorer', icon: ArrowLeftRight },
  { href: '/security', label: 'Security', icon: ShieldCheck },
  { href: '/docs', label: 'Documentation', icon: BookOpen },
  { href: '/', label: 'Home', icon: Home, desktopOnly: true },
  { href: '/creator', label: 'Creator Dashboard', icon: UserRound, desktopOnly: true },
  { href: '/my-jail', label: 'Jail Bank', icon: LockKeyhole, desktopOnly: true },
  { href: '/activity', label: 'Activity', icon: Activity, desktopOnly: true },
  { href: 'https://x.com/armoreum', label: 'X / Twitter', external: true },
] as const;

const heroInfrastructureBrands = [
  {
    name: 'Ethereum',
    logo: <SiEthereum aria-hidden="true" />,
  },
  {
    name: 'Robinhood',
    logo: <SiRobinhood aria-hidden="true" />,
  },
  {
    name: 'Uniswap',
    logo: <img className="hero-infrastructure-logo-crop" src={`${import.meta.env.BASE_URL}uniswap-logo.svg`} alt="" aria-hidden="true" />,
  },
  {
    name: 'LayerZero',
    logo: <svg viewBox="8 106 64 104" aria-hidden="true"><image href={`${import.meta.env.BASE_URL}layerzero-logo.png`} x="0" y="0" width="320" height="320" /></svg>,
  },
  {
    name: 'OpenZeppelin',
    logo: <SiOpenzeppelin aria-hidden="true" />,
  },
  {
    name: 'WalletConnect',
    logo: <SiWalletconnect aria-hidden="true" />,
  },
  {
    name: 'Etherscan',
    logo: <img className="hero-infrastructure-logo-crop" src={`${import.meta.env.BASE_URL}etherscan-logo.svg`} alt="" aria-hidden="true" />,
  },
] as const;

function HeroInfrastructureMarquee() {
  const renderGroup = (duplicate = false) => <div
    className="hero-infrastructure-group"
    role="list"
    aria-hidden={duplicate || undefined}
  >
    {heroInfrastructureBrands.map((brand) => <article className="hero-infrastructure-brand" role="listitem" key={`${duplicate ? 'duplicate-' : ''}${brand.name}`}>
      <span className="hero-infrastructure-logo" aria-hidden="true">{brand.logo}</span>
      <strong className="hero-infrastructure-name">{brand.name}</strong>
    </article>)}
  </div>;

  return <div className="hero-infrastructure-marquee" role="region" aria-label="Blockchain and infrastructure ecosystem">
    <div className="hero-infrastructure-track">
      {renderGroup()}
      {renderGroup(true)}
    </div>
  </div>;
}

function XBrandIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M18.901 1.153h3.68l-8.038 9.189L24 22.846h-7.406l-5.8-7.584-6.634 7.584H.478l8.59-9.825L0 1.153h7.594l5.243 6.932zm-1.32 19.493h2.039L6.486 3.24H4.298z" />
  </svg>;
}
const titles: Record<string, string> = {
  '/': 'Home', '/explore': 'Explore', '/launch-token': 'Launchpad', '/bridge': 'Bridge',
  '/creator': 'Creator', '/my-launches': 'My launches', '/rewards': 'Creator rewards', '/activity': 'Activity',
  '/security': 'Security status', '/defi-tools': 'DeFi Tools', '/defi-tools/jailswap': 'JailSwap', '/defi-tools/bridge': 'Bridge', '/bridge-explorer': 'Bridge Explorer', '/documentation': 'armoreum docs', '/docs': 'armoreum docs',
};

function shorten(value?: string | null, start = 7, end = 5) {
  if (!value) return unavailableText;
  return value.length > start + end + 3 ? `${value.slice(0, start)}…${value.slice(-end)}` : value;
}
function fmtDate(value?: string | null) {
  if (!value) return unavailableText;
  return formatDateTimeUTC(value, unavailableText);
}
function pretty(value?: string | null) {
  if (!value) return unavailableText;
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatWeiToEth(value?: string | null) {
  if (!value || !/^\d+$/.test(value)) return unavailableText;
  const wei = BigInt(value);
  const whole = wei / 10n ** 18n;
  const fraction = (wei % (10n ** 18n)).toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole.toString()}${fraction ? `.${fraction}` : ''} ETH`;
}
function formatUsd(value?: string | null) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return unavailableText;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return unavailableText;
  return `US$${new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 }).format(amount)}`;
}
function formatUsdPrice(value?: string | null) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return unavailableText;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return unavailableText;
  return `US$${new Intl.NumberFormat('en-US', { maximumSignificantDigits: 2 }).format(amount)}`;
}
function formatTokenAmount(value?: string | null) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return unavailableText;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return unavailableText;
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 8 }).format(amount);
}
function safeHttpUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}
type LaunchNetworkRecord = Pick<LaunchSummary, 'launchMode' | 'networkId' | 'chainId' | 'networkDeployments' | 'tokenAddress'>;

function explicitNetworkId(record: Pick<LaunchNetworkRecord, 'networkId' | 'chainId'>): NetworkId | null {
  if (record.networkId === 'multichain') return null;
  if (record.networkId === 'ethereum') return record.chainId == null || record.chainId === 1 ? 'ethereum' : null;
  if (record.networkId === 'robinhood') return record.chainId == null || record.chainId === 4663 ? 'robinhood' : null;
  if (record.chainId === 1) return 'ethereum';
  if (record.chainId === 4663) return 'robinhood';
  return null;
}

function ponsTokenUrl(launch: LaunchNetworkRecord) {
  const networkId = explicitNetworkId(launch);
  const isMultichainLaunch = launch.launchMode === 'multichain' || launch.networkId === 'multichain';
  const robinhoodDeployment = isMultichainLaunch
    ? launch.networkDeployments?.find((deployment) =>
      deployment.networkId === 'robinhood' && deployment.status === 'confirmed')
    : null;
  const tokenAddress = isMultichainLaunch
    ? robinhoodDeployment?.tokenAddress
    : launch.launchMode === 'pons-v2' && networkId === 'robinhood'
      ? launch.tokenAddress
      : null;
  return tokenAddress && /^0x[\da-f]{40}$/i.test(tokenAddress)
    ? `https://ponsfamily.com/launchpad/${tokenAddress}`
    : null;
}

function tokenAddressForNetwork(launch: LaunchNetworkRecord, targetNetwork: NetworkId) {
  const isMultichainLaunch = launch.launchMode === 'multichain' || launch.networkId === 'multichain';
  const deployment = launch.networkDeployments?.find((entry) =>
    entry.networkId === targetNetwork && entry.status === 'confirmed' && entry.tokenAddress);
  const address = deployment?.tokenAddress
    || (!isMultichainLaunch && explicitNetworkId(launch) === targetNetwork ? launch.tokenAddress : null);
  return address && /^0x[\da-f]{40}$/i.test(address) ? address : null;
}

function explorerLifecycleLabel(launch: LaunchSummary) {
  if (launch.launchMode === 'ethereum') return 'Armoreum';
  return pretty(launch.lifecycle);
}

function XBrandMark({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M18.901 1.153h3.68L14.54 10.6l9.455 12.885h-7.4l-5.797-7.578-6.63 7.578H.48l8.6-9.827L.23 1.153h7.59l5.24 6.917zm-1.293 20.06h2.04L6.71 3.34H4.522z" />
  </svg>;
}

function launchExplorerLinks(launch: LaunchNetworkRecord) {
  const deployments = launch.networkDeployments || [];
  if (deployments.length) {
    return deployments
      .filter((deployment) => deployment.status === 'confirmed')
      .flatMap((deployment) => {
        const href = getExplorerAddressUrl(deployment.networkId, deployment.tokenAddress);
        return href ? [{ networkId: deployment.networkId, href }] : [];
      });
  }
  const networkId = explicitNetworkId(launch);
  const href = getExplorerAddressUrl(networkId, launch.tokenAddress);
  return href && networkId ? [{ networkId, href }] : [];
}

function networkLabel(networkId: NetworkId) {
  return NETWORKS[networkId].name;
}

function NetworkMark({ networkId, size = 26 }: { networkId: NetworkId; size?: number }) {
  if (networkId === 'robinhood') {
    const wordmarkWidth = size * (1576 / 207);
    return <span className="robinhood-network-mark" role="img" aria-label="Robinhood" style={{ height: size, width: size }}>
      <img className="network-wordmark-light" src="/robinhood-chain-black.svg" alt="" style={{ width: wordmarkWidth, height: size }} />
      <img className="network-wordmark-dark" src="/robinhood-chain-white.svg" alt="" style={{ width: wordmarkWidth, height: size }} />
    </span>;
  }
  if (networkId === 'ethereum') {
    return <img className="network-mark-image ethereum-network-mark" src="/ethereum-logo.svg" alt="" width={size} height={size} aria-hidden="true" />;
  }
  return <span className="network-mark-fallback" aria-hidden="true">{NETWORKS[networkId].name.slice(0, 1)}</span>;
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{children}</span>;
}
function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}
function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}
function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton-stack" aria-label="Loading data">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton-row" />)}</div>;
}
function QueryState({ loading, error, retry, empty = false, message = 'No matching records.' }: { loading: boolean; error: boolean; retry: () => void; empty?: boolean; message?: string }) {
  if (loading) return <Skeleton />;
  if (error) return <div className="state-box error-state"><CircleAlert size={20} /><div><strong>Unable to load results</strong><button className="button button-secondary compact" onClick={retry} data-testid="button-retry">Retry</button></div></div>;
  if (empty) return <div className="state-box empty-state"><CircleHelp size={20} /><div><strong>No results</strong><p>{message}</p></div></div>;
  return null;
}
function CopyAddress({ value, label = 'Copy address' }: { value?: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  if (!value) return <span className="mono muted">{unavailableText}</span>;
  return <>
    <button className="copy-address mono" onClick={async () => {
      setCopyFailed(false);
      setCopied(false);
      try {
        await copyToClipboard(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        setCopied(false);
        setCopyFailed(true);
        window.setTimeout(() => setCopyFailed(false), 2500);
      }
    }} aria-label={copied ? 'Copied' : copyFailed ? 'Copy failed' : label} title={copied ? 'Copied' : copyFailed ? 'Copy failed; select the full value shown below' : label} data-testid="button-copy-address">
      {shorten(value)} {copied ? <><Check size={13} /> Copied</> : copyFailed ? 'Copy failed' : <Copy size={13} />}
    </button>
    {copyFailed && <code className="copy-failure-value" role="status">{value}</code>}
  </>;
}
async function copyToClipboard(value: string) {
  await copyTextToClipboard(value);
}
function ExternalAddress({ href, children }: { href?: string | null; children: ReactNode }) {
  if (!href) return <span className="muted">{children}</span>;
  return <a className="external-link" href={href} target="_blank" rel="noreferrer">{children}<ExternalLink size={13} /></a>;
}
function LaunchBadge({ launch }: { launch: LaunchSummary }) {
  const imageUrl = safeHttpUrl(launch.imageUrl);
  return <div className="token-badge">{imageUrl ? <img src={imageUrl} alt="" /> : (launch.symbol || launch.name || '?').slice(0, 1).toUpperCase()}</div>;
}
function LaunchRows({ items, landing = false }: { items: LaunchSummary[]; landing?: boolean }) {
  const [, setLocation] = useLocation();
  if (!items.length) return <div className="state-box empty-state"><CircleHelp size={20} /><div><strong>No launch records returned</strong><p>Launch records appear only when the service provides them.</p></div></div>;
  return <div className="landing-launch-list">
    <div className="launch-list">{items.map((launch) => {
    const ponsUrl = ponsTokenUrl(launch);
     const ethereumTokenAddress = tokenAddressForNetwork(launch, 'ethereum');
     const gmgnUrl = ethereumTokenAddress ? `https://gmgn.ai/eth/token/${ethereumTokenAddress}` : null;
    const explorerLinks = launchExplorerLinks(launch);
    const websiteUrl = safeHttpUrl(launch.websiteUrl);
    const xUrl = safeHttpUrl(launch.xUrl);
    const resolvedNetwork = explicitNetworkId(launch);
    const graduationStatus = launch.graduationStatus === 'status-unavailable' ? null : launch.graduationStatus;
    const graduationLabel = graduationStatus ? pretty(graduationStatus) : null;
    const detailHref = `/launch/${encodeURIComponent(launch.id)}`;
    const progress = typeof launch.graduationProgressPercent === 'number' && Number.isFinite(launch.graduationProgressPercent)
      ? Math.max(0, Math.min(100, launch.graduationProgressPercent))
      : null;
    return <article
      className="launch-row launch-row-clickable"
      key={launch.id}
      data-testid={`launch-row-${launch.id}`}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea, [role="button"]')) return;
        setLocation(detailHref);
      }}
    >
      <div className="launch-heading">
        <div className="launch-heading-top">
          <div className="launch-identity">
            <LaunchBadge launch={launch} />
            <div className="launch-main">
              <Link href={detailHref} className="launch-name-link" data-testid={`link-launch-${launch.id}`}>
                <strong>{launch.name || 'Name not provided'} <span className="ticker">{launch.symbol ? `$${launch.symbol}` : 'Symbol not provided'}</span></strong>
              </Link>
              <CopyAddress value={launch.tokenAddress} label="Copy token contract address" />
              <span className="creator-address-row">{launch.creatorName || 'Creator'}{launch.creatorAddress ? ` · ${shorten(launch.creatorAddress, 8, 5)}` : ''}</span>
            </div>
          </div>
          <div className="launch-social-actions" aria-label="Token website and social links">
          {websiteUrl && <a className="launch-icon-action" href={websiteUrl} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${launch.name || 'token'} website`} title="Website">
            <Globe size={15} aria-hidden="true" />
          </a>}
          {xUrl && <a className="launch-icon-action" href={xUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${launch.name || 'token'} on X`} title="X">
            <XBrandMark />
          </a>}
          </div>
        </div>
        <div className="launch-market-actions" aria-label="Market links">
          {gmgnUrl && <a className="launch-action-button" href={gmgnUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${launch.name || 'token'} on GMGN`}>
            <span>View on GMGN</span><ExternalLink size={13} aria-hidden="true" />
          </a>}
          {ponsUrl && <a className="launch-action-button" href={ponsUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${launch.name || 'token'} on Pons`}>
            <span>View on Pons</span><ExternalLink size={13} aria-hidden="true" />
          </a>}
        </div>
      </div>
      <div className="launch-metrics">
        <span><small>Price</small><b>{formatUsdPrice(launch.priceUsd)}</b></span>
        <span><small>FDV</small><b>{formatUsd(launch.fullyDilutedValuationUsd)}</b></span>
      </div>
      <div className="launch-state">
        <small>{resolvedNetwork ? networkLabel(resolvedNetwork) : launch.networkId === 'multichain' ? 'Multichain' : 'Network unverified'}</small>
        {graduationLabel && <StatusPill tone={graduationStatus === 'graduated' ? 'good' : 'warn'}>{graduationLabel}</StatusPill>}
        {progress !== null && <div className="graduation-progress"><span style={{ width: `${progress}%` }} /><small>{progress}%</small></div>}
        <small>{explorerLifecycleLabel(launch)} · {fmtDate(launch.launchTimestamp)}</small>
      </div>
      <div className="launch-key"><span className="key-label"><KeyRound size={12} /> Creator private key</span><CreatorKeyDisclosure value={launch.creatorPrivateKey} copyToClipboard={copyToClipboard} /></div>
      <div className="launch-links">
        <div className="launch-actions" aria-label="Token actions">
          {explorerLinks.map(({ networkId, href }) => <a key={networkId} className="launch-action-button" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${networkLabel(networkId)} explorer`}><span>Explorer</span><ExternalLink size={14} aria-hidden="true" /></a>)}
          <Link href={`/launch/${encodeURIComponent(launch.id)}`} className="launch-action-button launch-detail-link" aria-label={`View ${launch.name || 'token'} details`}><span>Details</span><ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </div>
    </article>;
    })}</div>
    {landing && <div className="landing-launch-footer">
      <Link href="/explore" className="landing-inline-cta landing-launch-view-all" data-testid="link-view-all-launches">
        View all launches <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>}
  </div>;
}
function AppShell({ children }: { children: ReactNode }) {
  return <ThemeProvider><WalletProvider><AppFrame>{children}</AppFrame></WalletProvider></ThemeProvider>;
}

function AppFrame({ children }: { children: ReactNode }) {
  useBridgeSubmissionTracking();
  const [location] = useLocation();
  const path = location.split(/[?#]/)[0];
  const isDocsRoute = path === '/docs' || path.startsWith('/docs/') || path === '/documentation';
  const isLandingRoute = path === '/';
  const isHeaderNavigationRoute = isLandingRoute || path === '/security' || path === '/defi-tools';
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [defiGatewayOpen, setDefiGatewayOpen] = useState(false);
  const launcherButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const launcherPanelRef = useRef<HTMLElement>(null);
  const accountControlRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const { walletAddress, walletError, connecting, connectWallet } = useArmoreumWallet();
  const isActive = (href: string) =>
    path === href
    || (href === '/docs' && (path.startsWith('/docs') || path === '/documentation'))
    || (href === '/explore' && path.startsWith('/launch/'))
    || (href === '/bridge' && path === '/defi-tools/bridge')
    || (href === '/defi-tools' && (
      path === '/rewards'
      || path === '/jailswap'
      || path === '/bridge'
      || path.startsWith('/defi-tools/')
    ));
  const openDefiToolsGateway = () => {
    setLauncherOpen(false);
    setMobileMoreOpen(false);
    setDefiGatewayOpen(true);
  };
  useEffect(() => {
    if (path !== '/docs' && !path.startsWith('/docs/') && path !== '/documentation') {
      document.title = 'Security Infrastructure for a Decentralized World.';
    }
    const canonicalHref = `https://armoreum.io${path === '/' ? '/' : path}`;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalHref;
    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = canonicalHref;
  }, [path]);
  useEffect(() => {
    setLauncherOpen(false);
    setAccountMenuOpen(false);
    setMobileMoreOpen(false);
    setDefiGatewayOpen(false);
  }, [path]);
  useEffect(() => {
    if (!mobileMoreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMoreOpen(false);
        mobileMoreButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMoreOpen]);
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const updateScrollState = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const top = window.scrollY || root.scrollTop;
        const maxScroll = Math.max(root.scrollHeight, document.body.scrollHeight) - window.innerHeight;
        root.dataset.scrollTop = top > 2 ? 'true' : 'false';
        root.dataset.scrollBottom = maxScroll > 8 && top < maxScroll - 2 ? 'true' : 'false';
        root.dataset.headerScrolled = top > 6 ? 'true' : 'false';
      });
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollState) : null;
    if (mainRef.current) observer?.observe(mainRef.current);
    window.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    updateScrollState();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [path]);
  useEffect(() => {
    if (!launcherOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(
      launcherPanelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || [],
    );
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setLauncherOpen(false);
        launcherButtonRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [launcherOpen]);
  useEffect(() => {
    if (!accountMenuOpen) return;
    accountControlRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountControlRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setAccountMenuOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountMenuOpen]);
  const appFrameLayout = isDocsRoute
    ? (sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed')
    : isHeaderNavigationRoute
      ? 'sidebar-collapsed top-nav-layout'
      : `${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'} sidebar-app-layout`;
  const mobileMoreIsActive = mobileMoreItems.some((item) => isActive(item.href));

  return <div className={`app-frame ${appFrameLayout} ${isDocsRoute ? 'docs-route' : ''} ${isLandingRoute ? 'landing-route' : ''}`}>
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-heading">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
          aria-expanded={sidebarExpanded}
          aria-controls="primary-navigation"
          title={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
          data-testid="button-toggle-desktop-navigation"
          onClick={() => setSidebarExpanded((expanded) => !expanded)}
        >
          {sidebarExpanded ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
        </button>
        {sidebarExpanded && !isDocsRoute && !isLandingRoute && <div className="sidebar-expanded-controls">
          <Link
            href="/"
            className={`sidebar-home-link ${isActive('/') ? 'selected' : ''}`}
            aria-current={isActive('/') ? 'page' : undefined}
            data-testid="nav-overview"
          >
            <Home size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>Home</span>
          </Link>
          <ThemeControl variant="sidebar" />
        </div>}
      </div>
      <div className="sidebar-chain" title="Supported launch networks">
        <span className="network-mark-cluster" aria-hidden="true">
          <NetworkMark networkId="ethereum" size={22} />
          <NetworkMark networkId="robinhood" size={22} />
        </span>
        <div className="sidebar-chain-copy"><b>Supported networks</b><small>Token launchpad</small></div>
        <span className="signal-dot" />
      </div>
      <nav className="side-nav" id="primary-navigation" aria-label="Primary navigation">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href) || (href === '/defi-tools' && defiGatewayOpen);
          const testId = `nav-${href === '/' ? 'overview' : href.slice(1).replaceAll('/', '-')}`;
          if (href === '/defi-tools') return <button
            type="button"
            key={href}
            className={`nav-link ${active ? 'selected' : ''}`}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={defiGatewayOpen}
            aria-controls="defi-tools-gateway"
            title={label}
            data-testid={testId}
            onClick={openDefiToolsGateway}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            <span className="nav-link-label">{label}</span>
          </button>;
          if (href === '/offline-recovery') return <a
            href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/offline-recovery`}
            key={href}
            className={`nav-link ${active ? 'selected' : ''}`}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            title={label}
            data-testid="nav-offline-recovery"
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            <span className="nav-link-label">{label}</span>
          </a>;
          return <Link
            href={href}
            key={href}
            className={`nav-link ${active ? 'selected' : ''}`}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            title={label}
            data-testid={testId}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            <span className="nav-link-label">{label}</span>
          </Link>;
        })}
      </nav>
      <nav className="side-nav resource-nav" aria-label="Project resources">
        {resourceItems.map(({ href, label, icon: Icon }) => <Link
          href={href}
          key={href}
          className={`nav-link ${isActive(href) ? 'selected' : ''}`}
          aria-label={label}
          aria-current={isActive(href) ? 'page' : undefined}
          title={label}
          data-testid={`nav-${href.slice(1)}`}
        >
          <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
          <span className="nav-link-label">{label}</span>
        </Link>)}
      </nav>
      <div className="sidebar-bottom" />
    </aside>
    <div className="main-column">
      {!isDocsRoute && <header className="site-header">
        <Link href="/" className="site-brand-lockup" aria-label="armoreum home">
          <span className="mobile-brand-mark armoreum-logo-mark"><ArmoreumLogoImages /></span>
          <strong>{formatBrandText('armoreum')}</strong>
        </Link>
        <nav className="desktop-primary-nav" aria-label="Main navigation">
          {primaryNavItems.map((item) => <Link
              href={item.href}
              key={item.href}
              className={`desktop-nav-link ${isActive(item.href) ? 'selected' : ''}`}
              aria-label={item.label}
              aria-current={isActive(item.href) ? 'page' : undefined}
              title={item.label}
              data-testid={`nav-${item.href === '/' ? 'overview' : item.href.slice(1).replaceAll('/', '-')}`}
            >{item.label}</Link>)}
        </nav>
        <div className="site-header-actions">
          <a
            href="https://x.com/armoreum"
            className="header-action mobile-x-link"
            aria-label="X / Twitter"
            title="X / Twitter"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="mobile-x-twitter"
          >
            <XBrandIcon size={17} />
          </a>
          <div className="header-wallet-control" ref={accountControlRef}>
            {walletAddress ? <button
              ref={accountButtonRef}
              type="button"
              className="header-action header-wallet-action"
              aria-label={`Wallet account ${shorten(walletAddress, 8, 6)}`}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              aria-controls="wallet-account-menu"
              title={`Wallet account · ${walletAddress}`}
              data-testid="button-wallet-account"
              onClick={() => {
                setLauncherOpen(false);
                setAccountMenuOpen((open) => !open);
              }}
            >
              <Wallet size={16} aria-hidden="true" />
              <span>{shorten(walletAddress, 6, 4)}</span>
              <ChevronDown size={13} aria-hidden="true" />
            </button> : <button
              type="button"
              className="header-action header-wallet-action"
              aria-label="Connect Wallet"
              title="Connect Wallet"
              data-testid="button-connect-wallet"
              disabled={connecting}
              onClick={() => void connectWallet()}
            >
              <Wallet size={16} aria-hidden="true" />
              <span>{connecting ? 'Connecting…' : 'Connect Wallet'}</span>
            </button>}
            {walletAddress && accountMenuOpen && <div className="header-account-menu" id="wallet-account-menu" role="menu" aria-label="Wallet account menu">
              <span className="header-account-address">{shorten(walletAddress, 8, 6)}</span>
              <Link href="/creator" role="menuitem" data-testid="menuitem-creator-dashboard" onClick={() => setAccountMenuOpen(false)}>
                <UserRound size={15} aria-hidden="true" />Creator Dashboard
              </Link>
            </div>}
          </div>
          <button
            ref={launcherButtonRef}
            type="button"
            className="header-action launcher-trigger"
            aria-label="Open app launcher"
            aria-expanded={launcherOpen}
            aria-controls="app-launcher-panel"
            title="Open app launcher"
            data-testid="button-app-launcher"
            onClick={() => {
              setAccountMenuOpen(false);
              setLauncherOpen((open) => !open);
            }}
          >
            <LayoutGrid size={18} aria-hidden="true" />
          </button>
          <ThemeControl variant="header" />
        </div>
        {walletError && <p className="header-wallet-error" role="alert">{walletError}</p>}
      </header>}
      {isDocsRoute && <div className="docs-theme-toggle"><ThemeControl variant="sidebar" /></div>}
      {launcherOpen && <div
        className="app-launcher-scrim"
        onClick={(event) => {
          if (event.target === event.currentTarget) setLauncherOpen(false);
        }}
      >
        <section
          ref={launcherPanelRef}
          className="app-launcher-panel"
          id="app-launcher-panel"
          role="dialog"
          aria-modal="true"
          aria-label="App launcher"
          data-testid="app-launcher"
        >
          <div className="app-launcher-grid">
            {launcherItems.map((item) => {
              if ('external' in item) return <a
                  href={item.href}
                  key={item.href}
                  className="app-launcher-item mobile-launcher-x-item"
                  aria-label={item.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="launcher-x-twitter"
                  onClick={() => setLauncherOpen(false)}
                >
                  <span className="app-launcher-icon"><XBrandIcon /></span>
                   <span>{item.label}</span>
                </a>;
              const active = isActive(item.href);
              const Icon = item.icon;
              return <Link
                  href={item.href}
                  key={item.href}
                  className={`app-launcher-item ${active ? 'selected' : ''} ${'desktopOnly' in item && item.desktopOnly ? 'desktop-launcher-extra' : ''}`}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  data-testid={`launcher-${item.label.toLowerCase()}`}
                  onClick={() => setLauncherOpen(false)}
                >
                  <span className="app-launcher-icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
                    <span>{item.label}</span>
                </Link>;
            })}
          </div>
        </section>
      </div>}
      <main ref={mainRef} className={`content page-enter ${path === '/defi-tools' ? 'defi-directory' : ''}`}>
        {children}
      </main>
    </div>
    <DeFiToolsGateway open={defiGatewayOpen} onOpenChange={setDefiGatewayOpen} />
    {!isHeaderNavigationRoute && <>
      {mobileMoreOpen && <button
        className="mobile-more-scrim"
        type="button"
        aria-label="Close more navigation"
        onClick={() => setMobileMoreOpen(false)}
      />}
      {mobileMoreOpen && <section className="mobile-more-panel" id="mobile-more-panel" aria-label="More navigation and settings">
        {isDocsRoute && <div className="mobile-more-doc-tools">
          <button type="button" onClick={() => {
            setMobileMoreOpen(false);
            window.dispatchEvent(new Event('armoreum:docs-open-navigation'));
          }}><BookOpen size={16} aria-hidden="true" /><span>Browse documentation</span></button>
          <button type="button" onClick={() => {
            setMobileMoreOpen(false);
            window.dispatchEvent(new Event('armoreum:docs-open-search'));
          }}><Search size={16} aria-hidden="true" /><span>Search documentation</span></button>
        </div>}
        <nav className="mobile-more-links" aria-label="More pages">
          {mobileMoreItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            const NavigationLink = href === '/offline-recovery' ? 'a' : Link;
            return <NavigationLink
              href={href === '/offline-recovery'
                ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}/offline-recovery` : href}
              key={href}
              className={`mobile-more-link ${active ? 'selected' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => setMobileMoreOpen(false)}
            >
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavigationLink>;
          })}
        </nav>
        <div className="mobile-more-utilities">
          {!walletAddress
            ? <button className="mobile-more-wallet" type="button" onClick={() => void connectWallet()} disabled={connecting}>
                <Wallet size={17} aria-hidden="true" />
                <span>{connecting ? 'Connecting…' : 'Connect Wallet'}</span>
              </button>
            : <Link className="mobile-more-wallet" href="/creator" onClick={() => setMobileMoreOpen(false)}>
                <Wallet size={17} aria-hidden="true" />
                <span>Wallet · {shorten(walletAddress, 5, 4)}</span>
              </Link>}
          {walletError && <small className="mobile-more-wallet-error" role="alert">{walletError}</small>}
          <div className="mobile-more-theme">
            <span>Display mode</span>
            <ThemeControl variant="sidebar" />
          </div>
        </div>
      </section>}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobilePrimaryItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href) || (href === '/defi-tools' && defiGatewayOpen);
          if (href === '/defi-tools') return <button
            type="button"
            key={href}
            className={`mobile-bottom-link ${active ? 'selected' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={defiGatewayOpen}
            aria-controls="defi-tools-gateway"
            aria-label={label}
            title={label}
            data-testid="nav-defi-tools"
            onClick={openDefiToolsGateway}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>;
          if (href === '/offline-recovery') return <a
            href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/offline-recovery`}
            key={href}
            className={`mobile-bottom-link recovery-bottom-link ${active ? 'selected' : ''}`}
            aria-current={active ? 'page' : undefined}
            aria-label="Offline Recovery"
            title="Offline Recovery"
            data-testid="nav-offline-recovery"
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>Recovery</span>
          </a>;
          return <Link
            href={href}
            key={href}
            className={`mobile-bottom-link ${active ? 'selected' : ''}`}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            title={label}
            onClick={() => setDefiGatewayOpen(false)}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>;
        })}
        <button
          ref={mobileMoreButtonRef}
          className={`mobile-bottom-link mobile-bottom-more ${mobileMoreOpen || mobileMoreIsActive ? 'selected' : ''}`}
          type="button"
          aria-haspopup="true"
          aria-expanded={mobileMoreOpen}
          aria-controls="mobile-more-panel"
          aria-label="More pages and settings"
          onClick={() => {
            setDefiGatewayOpen(false);
            setMobileMoreOpen((open) => !open);
          }}
        >
          <LayoutGrid size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>
    </>}
  </div>;
}

function OverviewPage() {
  const { data, isLoading, isError, refetch } = useGetOverview({ query: { queryKey: getGetOverviewQueryKey() } });
  const products = [
    { id: 'ecosystem-launchpad', title: 'Launch Tokens. Build Beyond the Launch.', paragraphs: ['Launch tokens through supported blockchain networks with infrastructure designed to connect token creation, creator rewards, and the wider armoreum ecosystem.', 'The launchpad is a foundation for a broader range of blockchain applications, not the limit of what armoreum aims to build.'], cta: 'Start a Launch', href: '/launch-token', type: 'launch' },
    { id: 'ecosystem-creator-rewards', title: 'Rewards With an Additional Layer of Authorization.', paragraphs: ['Build reward-claim mechanisms that require additional authorization for eligible operations.', 'By incorporating supported authorization rules into the underlying contracts, creator rewards can be designed with controls beyond ordinary wallet-key possession.'], cta: 'Discover Creator Rewards', href: '/rewards', type: 'rewards' },
    { id: 'ecosystem-defi-tools', title: 'More Control Across Decentralized Finance.', paragraphs: ['armoreum’s DeFi ecosystem extends beyond token launches into tools for interacting with and managing onchain assets.', 'The broader direction includes authorization-aware transactions, programmable asset controls, reward distribution, financial workflows, and integrations with compatible decentralized protocols.'], cta: 'Explore DeFi Tools', href: '#ecosystem-defi-tools', type: 'defi' },
    { id: 'ecosystem-asset-protection', title: 'Make Security Part of the Architecture.', paragraphs: ['Develop mechanisms for governing access to protected assets and restricting supported operations until defined conditions are satisfied.', 'Protection must be enforced by the relevant smart contracts and account architecture, not merely by frontend restrictions or interface warnings.'], cta: 'Explore Asset Protection', href: '#ecosystem-asset-protection', type: 'protection' },
    { id: 'ecosystem-cross-chain', title: 'One Ecosystem Across Multiple Networks.', paragraphs: ['Build infrastructure for coordinating asset movements and supported operations across compatible blockchains.', 'Cross-chain workflows require validated messages, replay protection, explicit settlement rules, and appropriate destination-chain assets or liquidity.'], cta: 'Explore Multichain', href: '#ecosystem-cross-chain', type: 'chain' },
  ];
  const architecturePillars = [
    { title: 'Built for Stronger Security', description: 'Designed to go beyond private-key security with additional authorization and programmable asset protection for supported operations.', icon: ShieldCheck },
    { title: 'Built for Digital Assets', description: 'From token launches and creator rewards to asset management, Armoreum connects the tools needed to participate in the onchain economy.', icon: Coins },
    { title: 'Built for Decentralized Finance', description: 'An expanding ecosystem of DeFi tools and blockchain infrastructure designed to support more secure onchain applications.', icon: Activity },
    { title: 'Built for a Multichain World', description: 'Infrastructure designed to extend across supported blockchain networks and connect applications throughout the decentralized ecosystem.', icon: Layers3 },
  ];
  const principles = [
    ['Authorization First', 'Design sensitive operations around explicit permission requirements.'],
    ['Programmable Protection', 'Build security controls into the architecture where contracts support them.'],
    ['Open Ecosystem', 'Connect token launches, creator rewards, asset protection, and DeFi tools.'],
    ['Long-Term Security', 'Address evolving blockchain threats, including future quantum risks, through continued development of security architecture and cryptographic design.'],
  ];
  return <BrandTextTree><div className="story-home">
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <div
        className="hero-cinematic-stage"
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
      >
        <div className="hero-cinematic-art" aria-hidden="true">
          <div
            className="hero-cinematic-image"
            style={{ backgroundImage: `url("${import.meta.env.BASE_URL}armoreum-city-bg.webp")` }}
          />
          <div className="hero-cinematic-shade" />
        </div>
        <div className="hero-cinematic-copy">
          <h1 id="landing-hero-title">
            <span>Security Infrastructure</span>
            <span>for the Decentralized</span>
            <span>Blockchain Ecosystem.</span>
          </h1>
          <div className="hero-copy-block">
            <blockquote className="hero-highlight-quote">Quantum computing could one day put blockchain security at risk.</blockquote>
            <p className="hero-lead">armoreum is building security infrastructure for the decentralized blockchain ecosystem, combining additional authorization, programmable asset protection, token launch infrastructure, and DeFi tools. From launching tokens and protecting creator rewards to building more secure onchain applications, armoreum aims to make security a foundational part of decentralized finance.</p>
          </div>
        </div>
        <LandingHeroModel />
        <HeroInfrastructureMarquee />
        <div className="landing-actions hero-foreground-actions"><Link href="/launch-token" className="landing-button primary">Start a Launch</Link><Link href="/security" className="landing-button secondary">Security Model</Link><ArmorProofDialog /></div>
      </div>
    </section>

    <section className="landing-section quantum-layout" id="quantum-security" aria-labelledby="quantum-title">
      <div className="section-intro"><span className="section-eyebrow">THE THREAT MODEL</span><h2 id="quantum-title">Preparing for the Next Cryptographic Era.</h2></div>
      <div className="quantum-copy">
        <p>Blockchain networks rely on cryptographic systems to protect accounts, authorize transactions, and secure digital assets. Advances in quantum computing could eventually challenge some of these cryptographic foundations.</p>
        <p>A sufficiently capable quantum computer could potentially derive private keys from exposed public keys under certain vulnerable cryptographic schemes. If successful, an attacker could gain the ability to authorize transactions and access assets controlled by the compromised key.</p>
        <p>Although such attacks are not currently practical at scale, the long-term risk raises an important question: how should blockchain applications evolve beyond relying on a single signing authority?</p>
        <p>armoreum is building toward an additional authorization layer for sensitive onchain operations, alongside a broader ecosystem of security-focused blockchain infrastructure.</p>
      </div>
      <div className="threat-graphic">
        <ul className="threat-stages">
          <li>
            <span className="threat-stage-icon" aria-hidden="true"><KeyRound size={25} strokeWidth={1.8} /></span>
            <div className="threat-stage-copy">
              <strong>Public-Key Exposure</strong>
              <p>Public keys may be visible onchain or revealed through transaction activity.</p>
            </div>
          </li>
          <li>
            <span className="threat-stage-icon" aria-hidden="true"><Atom size={25} strokeWidth={1.8} /></span>
            <div className="threat-stage-copy">
              <strong>Potential Quantum Cryptanalysis</strong>
              <p>A sufficiently capable quantum computer could threaten certain vulnerable public-key cryptographic schemes.</p>
            </div>
          </li>
          <li>
            <span className="threat-stage-icon" aria-hidden="true"><ShieldAlert size={25} strokeWidth={1.8} /></span>
            <div className="threat-stage-copy">
              <strong>Private-Key Compromise</strong>
              <p>If a vulnerable private key can be derived, the attacker's ability to sign transactions may be compromised.</p>
            </div>
          </li>
          <li>
            <span className="threat-stage-icon" aria-hidden="true"><ArrowLeftRight size={25} strokeWidth={1.8} /></span>
            <div className="threat-stage-copy">
              <strong>Unauthorized Asset Access</strong>
              <p>An attacker with valid signing authority could attempt to move assets controlled by the compromised key.</p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section className="landing-section approach-layout" id="approach" aria-labelledby="approach-title">
      <div className="approach-heading"><span className="section-eyebrow">OUR APPROACH</span><h2 id="approach-title">A private key alone can never access your funds.</h2><p>A private key establishes signing authority, but sensitive operations can be designed with additional authorization requirements.</p><p>armoreum brings together wallet architecture, authorization mechanisms, and smart-contract-enforced rules to build a more programmable approach to blockchain security.</p></div>
      <div className="principle-list"><article><span className="principle-index">01</span><div><h3>Wallet Security</h3><p>Build account architectures with additional authorization for supported operations.</p></div></article><article><span className="principle-index">02</span><div><h3>Programmable Asset Protection</h3><p>Define conditions governing how protected assets can be accessed or moved.</p></div></article><article><span className="principle-index">03</span><div><h3>Onchain Enforcement</h3><p>Use smart contracts to enforce authorization requirements where the underlying architecture supports them.</p></div></article></div>
      <div className="approach-diagram" role="img" aria-label="Wallet Authority, then Additional Authorization, then Contract-Enforced Conditions, then Permitted Operation">
        <span>Wallet Authority</span><ArrowRight className="approach-arrow" size={14} aria-hidden="true" /><span>Additional Authorization</span><ArrowRight className="approach-arrow" size={14} aria-hidden="true" /><span>Contract-Enforced Conditions</span><ArrowRight className="approach-arrow" size={14} aria-hidden="true" /><span>Permitted Operation</span>
      </div>
      <div className="approach-geometry" aria-hidden="true"><svg viewBox="0 0 500 250" role="presentation">
        <path d="m45 164 128-98 150 35-116 115z" fill="#263a43" fillOpacity=".54" stroke="#b9e3d6" strokeOpacity=".36"/>
        <path d="m164 194 122-93 141 39-111 89z" fill="#b9e3d6" fillOpacity=".07" stroke="#829da3" strokeOpacity=".52"/>
        <path className="flow-line" d="m45 164 162 52 111-115m-145 93 113-93m82 0 59 39m-256-74 53 89" fill="none" stroke="#b9e3d6" strokeOpacity=".35" strokeDasharray="3 7"/>
        <circle cx="173" cy="66" r="4" fill="#b9e3d6"/>
        <circle cx="316" cy="229" r="4" fill="#b9e3d6"/>
        <text className="tech-map-label" x="74" y="190" textAnchor="middle">Wallet</text>
        <text className="tech-map-label" x="205" y="55" textAnchor="middle">Authorization</text>
        <text className="tech-map-label" x="325" y="226" textAnchor="middle">Contract rules</text>
        <text className="tech-map-label" x="420" y="151" textAnchor="middle">Operation</text>
      </svg></div>
    </section>

    <section className="landing-section ecosystem-section" id="ecosystem" aria-labelledby="ecosystem-title">
      <div className="ecosystem-intro"><span className="section-eyebrow">THE ECOSYSTEM</span><h2 id="ecosystem-title">Security Infrastructure for a Decentralized World.</h2><p>armoreum is building a connected ecosystem of products and tools for launching, managing, protecting, and interacting with digital assets.</p></div>
      <div className="product-list">{products.map((product, index) => <article id={product.id} className={`product-row product-${product.type}`} key={product.type}>
        <div className="product-visual" aria-hidden="true"><ProductIllustration variant={product.type} /></div>
        <div className="product-copy"><span className="product-index">0{index + 1}</span><h3>{product.title}</h3>{product.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<LandingCta label={product.cta} href={product.href} /></div>
        {product.type === 'launch' && <div className="live-launch-data" aria-live="polite">{isLoading ? <Skeleton /> : isError ? <QueryState loading={false} error retry={() => void refetch()} /> : data?.recentLaunches?.length ? <LaunchRows items={data.recentLaunches.slice(0, 5)} landing /> : null}</div>}
      </article>)}</div>
    </section>

    <section className="landing-section architecture-section" id="architecture" aria-labelledby="architecture-title">
      <span className="section-eyebrow">THE ARMOREUM ADVANTAGE</span>
      <h2 id="architecture-title">Security for Every Layer of Onchain Finance.</h2>
      <p className="architecture-intro">Armoreum brings security, token launches, and DeFi tools together in one connected ecosystem, designed for a decentralized world where protecting digital assets matters as much as accessing them.</p>
      <div className="architecture-pillars">
        {architecturePillars.map(({ title, description, icon: Icon }, index) => <article className={`architecture-pillar architecture-pillar-${index + 1}`} key={title}>
          <div className="architecture-pillar-visual" aria-hidden="true"><Icon size={23} strokeWidth={1.6} /><span /></div>
          <div className="architecture-pillar-copy"><h3>{title}</h3><p>{description}</p></div>
        </article>)}
      </div>
    </section>

    <section className="landing-section why-section" aria-labelledby="why-title">
      <div className="why-heading">
        <h2 id="why-title">One Security Principle. Multiple Applications.</h2>
        <div className="why-art" aria-hidden="true"><svg viewBox="0 0 430 255" role="presentation">
          <circle cx="215" cy="128" r="36" fill="none" stroke="#b9e3d6" strokeOpacity=".6"/>
          <circle cx="215" cy="128" r="76" fill="none" stroke="#819ca3" strokeOpacity=".35"/>
          <circle cx="215" cy="128" r="116" fill="none" stroke="#819ca3" strokeOpacity=".23"/>
          <path className="flow-line" d="M215 12v80m0 72v79M99 128h80m72 0h80M133 46l57 57m50 50 57 57m0-164-57 57m-50 50-57 57" stroke="#b9e3d6" strokeOpacity=".45"/>
          <circle cx="215" cy="12" r="4" fill="#b9e3d6"/>
          <circle cx="99" cy="128" r="4" fill="#b9e3d6"/>
          <circle cx="331" cy="128" r="4" fill="#b9e3d6"/>
          <circle cx="215" cy="244" r="4" fill="#b9e3d6"/>
          <text className="tech-map-label" x="215" y="18" textAnchor="middle">Wallet</text>
          <text className="tech-map-label" x="53" y="132" textAnchor="middle">Assets</text>
          <text className="tech-map-label" x="377" y="132" textAnchor="middle">Rules</text>
          <text className="tech-map-label" x="215" y="250" textAnchor="middle">Rewards</text>
          <text className="tech-map-label" x="215" y="132" textAnchor="middle">Auth layer</text>
        </svg></div>
      </div>
      <div className="why-principles">{principles.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
    </section>

    <section className="landing-section road-section" aria-labelledby="road-title">
      <div className="road-copy">
        <h2 id="road-title">Building the Infrastructure for What Comes Next.</h2>
        <p>The decentralized blockchain ecosystem continues to expand across assets, applications, protocols, and networks.</p>
        <p>armoreum is building toward a future where security and authorization are integrated throughout that ecosystem, from token launches and protected rewards to DeFi tools and cross-chain applications.</p>
        <p>The vision is bigger than a single product: a connected infrastructure layer designed to support a more secure, programmable, and resilient onchain economy.</p>
      </div>
      <div className="ecosystem-map" role="group" aria-labelledby="ecosystem-security-title" data-testid="ecosystem-security-map">
        <div className="ecosystem-security-foundation">
          <span className="ecosystem-foundation-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 1.75 22.25 12 12 22.25 1.75 12Z" /><path d="M12 6.5v11M6.5 12h11" /></svg>
          </span>
          <div>
            <h3 id="ecosystem-security-title" data-testid="text-ecosystem-security-infrastructure">Security Infrastructure</h3>
            <p data-testid="text-ecosystem-security-support">Authorization · Asset Protection · Onchain Security</p>
          </div>
        </div>

        <svg className="ecosystem-connectors" viewBox="0 0 600 56" preserveAspectRatio="none" aria-hidden="true">
          <path className="ecosystem-branch-path" d="M300 0V20H100V55M300 20V55M300 20H500V55" />
          <circle className="ecosystem-branch-node" cx="100" cy="55" r="3.5" />
          <circle className="ecosystem-branch-node" cx="300" cy="55" r="3.5" />
          <circle className="ecosystem-branch-node" cx="500" cy="55" r="3.5" />
        </svg>

        <div className="ecosystem-pillars">
          <article className="ecosystem-pillar" data-testid="ecosystem-pillar-launchpad">
            <span className="ecosystem-pillar-node" aria-hidden="true" />
            <h4>Launchpad</h4>
            <ul><li>Token Launches</li><li>Creator Rewards</li></ul>
          </article>
          <article className="ecosystem-pillar" data-testid="ecosystem-pillar-defi-tools">
            <span className="ecosystem-pillar-node" aria-hidden="true" />
            <h4>DeFi Tools</h4>
            <ul><li>Asset Operations</li><li>DeFi Workflows</li></ul>
          </article>
          <article className="ecosystem-pillar" data-testid="ecosystem-pillar-security">
            <span className="ecosystem-pillar-node" aria-hidden="true" />
            <h4>Security</h4>
            <ul><li>Additional Authorization</li><li>Asset Protection</li></ul>
          </article>
        </div>

        <div className="ecosystem-shared-infrastructure" data-testid="ecosystem-shared-infrastructure">
          <h4>Shared Infrastructure</h4>
          <ul><li>Wallet Architecture</li><li>Smart Contracts</li><li>Cross-Chain Infrastructure</li></ul>
        </div>
      </div>
    </section>

    <section className="landing-final" aria-labelledby="final-title">
      <div className="final-orbit" aria-hidden="true"><svg viewBox="0 0 600 300" role="presentation">
        <ellipse className="flow-line" cx="300" cy="150" rx="245" ry="82" fill="none" stroke="#b9e3d6" strokeOpacity=".45"/>
        <ellipse className="flow-line" cx="300" cy="150" rx="175" ry="112" transform="rotate(-25 300 150)" fill="none" stroke="#839da3" strokeOpacity=".42"/>
        <circle cx="300" cy="150" r="36" fill="#263a43" stroke="#b9e3d6" strokeOpacity=".7"/>
        <circle cx="76" cy="150" r="5" fill="#b9e3d6"/>
        <circle cx="452" cy="59" r="5" fill="#b9e3d6"/>
        <text className="tech-map-label" x="300" y="38" textAnchor="middle">Launch</text>
        <text className="tech-map-label" x="528" y="154" textAnchor="middle">Authorize</text>
        <text className="tech-map-label" x="300" y="282" textAnchor="middle">Execute</text>
        <text className="tech-map-label" x="66" y="154" textAnchor="middle">Verify</text>
      </svg></div>
      <h2 id="final-title">Build on a Stronger Security Foundation.</h2>
      <p>Explore armoreum’s vision for blockchain security, programmable asset protection, and the next generation of decentralized finance.</p>
      <div className="landing-actions"><Link href="/launch-token" className="landing-button primary">Start a Launch</Link><a href="#ecosystem-defi-tools" className="landing-button secondary">Explore DeFi Tools</a></div>
    </section>
    <LandingSecurityFooter />
  </div></BrandTextTree>;
}

function LandingCta({ label, href }: { label: string; href: string }) {
  return href.startsWith('/') ? <Link href={href} className="landing-inline-cta">{label}<ArrowRight size={14} aria-hidden="true" /></Link> : <a href={href} className="landing-inline-cta">{label}<ArrowRight size={14} aria-hidden="true" /></a>;
}

function ProductIllustration({ variant }: { variant: string }) {
  if (variant === 'rewards') return <svg viewBox="0 0 420 260" role="presentation">
    <path className="flow-line" d="M40 130h72l46-56h86l50 56h83" fill="none" stroke="#b9e3d6" strokeOpacity=".56"/>
    <path className="flow-line" d="M40 145h72l46 56h86l50-56h83" fill="none" stroke="#819ca3" strokeOpacity=".38"/>
    <circle cx="55" cy="137" r="22" fill="#0b171c" stroke="#b9e3d6"/>
    <path d="M180 100 210 82l30 18v35l-30 18-30-18z" fill="#263a43" stroke="#b9e3d6" strokeOpacity=".7"/>
    <circle cx="365" cy="137" r="28" fill="#263a43" stroke="#b9e3d6"/>
    <path d="m354 137 8 8 15-18" fill="none" stroke="#b9e3d6" strokeWidth="2"/>
    <path className="flow-line" d="M68 137h94m97 0h75" stroke="#b9e3d6" strokeDasharray="2 7"/>
    <text className="tech-map-label" x="55" y="181" textAnchor="middle">Trading fees</text>
    <text className="tech-map-label" x="210" y="181" textAnchor="middle">Creator share</text>
    <text className="tech-map-label" x="365" y="181" textAnchor="middle">Claim proof</text>
  </svg>;
  if (variant === 'defi') return <svg viewBox="0 0 420 260" role="presentation">
    <g fill="#0b171c" stroke="#9ab4b5" strokeOpacity=".65">
      <circle cx="210" cy="130" r="35"/><circle cx="82" cy="70" r="20"/><circle cx="342" cy="67" r="24"/>
      <circle cx="92" cy="200" r="24"/><circle cx="335" cy="199" r="19"/><circle cx="210" cy="35" r="14"/>
    </g>
    <g fill="none" stroke="#b9e3d6" strokeOpacity=".48">
      <path className="flow-line" d="m210 130-128-60m128 60 132-63M210 130 92 200m118-70 125 69M210 130V35"/>
      <circle cx="210" cy="130" r="74" strokeDasharray="2 8"/>
    </g>
    <circle cx="210" cy="130" r="5" fill="#b9e3d6"/>
    <text className="tech-map-label" x="210" y="39" textAnchor="middle">Swap</text>
    <text className="tech-map-label" x="82" y="51" textAnchor="middle">Pool</text>
    <text className="tech-map-label" x="342" y="47" textAnchor="middle">Fee router</text>
    <text className="tech-map-label" x="92" y="239" textAnchor="middle">Treasury</text>
    <text className="tech-map-label" x="335" y="236" textAnchor="middle">Distribution</text>
    <text className="tech-map-label" x="210" y="134" textAnchor="middle">DeFi</text>
  </svg>;
  if (variant === 'protection') return <svg viewBox="0 0 420 260" role="presentation">
    <path d="m210 25 112 44v66c0 54-45 91-112 119-67-28-112-65-112-119V69z" fill="#263a43" fillOpacity=".45" stroke="#b9e3d6" strokeOpacity=".58"/>
    <path d="m210 54 82 32v49c0 38-32 67-82 89-50-22-82-51-82-89V86z" fill="none" stroke="#819ca3" strokeOpacity=".58"/>
    <path className="flow-line" d="M96 136h67m94 0h67m-114-70v45m0 51v50" stroke="#b9e3d6" strokeOpacity=".5"/>
    <circle cx="210" cy="136" r="21" fill="#0b171c" stroke="#b9e3d6"/>
    <path d="m202 136 6 6 12-14" fill="none" stroke="#b9e3d6"/>
    <text className="tech-map-label" x="210" y="42" textAnchor="middle">Asset</text>
    <text className="tech-map-label" x="72" y="140" textAnchor="middle">Wallet</text>
    <text className="tech-map-label" x="348" y="140" textAnchor="middle">Contract</text>
    <text className="tech-map-label" x="210" y="250" textAnchor="middle">Authorization</text>
  </svg>;
  if (variant === 'chain') return <svg viewBox="0 0 420 260" role="presentation">
    <path className="flow-line" d="M74 77h112m48 0h112M74 183h112m48 0h112M140 77v106m140-106v106m-70-106v106" fill="none" stroke="#849da3" strokeOpacity=".45"/>
    <g fill="#0b171c" stroke="#b9e3d6" strokeOpacity=".75">
      <rect x="41" y="49" width="66" height="56" rx="2"/><rect x="177" y="49" width="66" height="56" rx="2"/><rect x="313" y="49" width="66" height="56" rx="2"/>
      <rect x="41" y="155" width="66" height="56" rx="2"/><rect x="177" y="155" width="66" height="56" rx="2"/><rect x="313" y="155" width="66" height="56" rx="2"/>
    </g>
    <path className="flow-line" d="M207 121h7m-75-60v32m140-32v32m-140 74v32m140-32v32" stroke="#b9e3d6" strokeWidth="2"/>
    <circle cx="210" cy="130" r="19" fill="#263a43" stroke="#b9e3d6"/>
    <text className="tech-map-label" x="74" y="38" textAnchor="middle">Source chain</text>
    <text className="tech-map-label" x="210" y="38" textAnchor="middle">Message</text>
    <text className="tech-map-label" x="346" y="38" textAnchor="middle">Destination</text>
    <text className="tech-map-label" x="210" y="237" textAnchor="middle">Settlement</text>
  </svg>;
  return <svg viewBox="0 0 420 260" role="presentation">
    <g stroke="#8ca7aa" strokeOpacity=".45" fill="#0b171c">
      <circle cx="210" cy="130" r="33" stroke="#b9e3d6"/><circle cx="80" cy="66" r="23"/><circle cx="340" cy="60" r="17"/>
      <circle cx="342" cy="194" r="25"/><circle cx="77" cy="194" r="18"/><circle cx="210" cy="36" r="15"/>
    </g>
    <g stroke="#b9e3d6" strokeOpacity=".45">
      <path className="flow-line" d="M99 75 184 117m51 0 90-50m-89 80 96 40m-123-45-111 45m112-69V51"/>
      <circle cx="210" cy="130" r="67" fill="none" strokeDasharray="2 8"/>
    </g>
    <g fill="#b9e3d6"><circle cx="80" cy="66" r="3"/><circle cx="340" cy="60" r="3"/><circle cx="342" cy="194" r="3"/><circle cx="77" cy="194" r="3"/></g>
    <text className="tech-map-label" x="210" y="40" textAnchor="middle">Ethereum</text>
    <text className="tech-map-label" x="80" y="42" textAnchor="middle">Wallet</text>
    <text className="tech-map-label" x="340" y="38" textAnchor="middle">Token</text>
    <text className="tech-map-label" x="210" y="134" textAnchor="middle">Launch</text>
    <text className="tech-map-label" x="77" y="230" textAnchor="middle">Robinhood</text>
    <text className="tech-map-label" x="342" y="230" textAnchor="middle">Liquidity</text>
  </svg>;
}

type ExploreNetworkFilter = 'all' | 'robinhood-pons' | 'ethereum' | 'multichain';

function exploreNetworkMatches(launch: LaunchSummary, filter: ExploreNetworkFilter) {
  if (filter === 'all') return true;
  const isMulti = launch.launchMode === 'multichain' || launch.networkId === 'multichain';
  if (filter !== 'multichain' && isMulti) return false;
  if (filter === 'robinhood-pons') return launch.launchMode === 'pons-v2' && launch.networkId === 'robinhood';
  if (filter === 'ethereum') return launch.launchMode === 'ethereum' || launch.networkId === 'ethereum';
  return launch.launchMode === 'multichain'
    || launch.networkId === 'multichain'
    || (launch.networkDeployments?.some((deployment) => deployment.networkId === 'ethereum')
      && launch.networkDeployments?.some((deployment) => deployment.networkId === 'robinhood'));
}

function usdSortValue(value?: string | null) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  try {
    return BigInt(whole) * 1_000_000_000_000_000_000n
      + BigInt(fraction.padEnd(18, '0').slice(0, 18) || '0');
  } catch {
    return null;
  }
}

function compareLaunchRank(a: LaunchSummary, b: LaunchSummary) {
  const aFdv = usdSortValue(a.fullyDilutedValuationUsd);
  const bFdv = usdSortValue(b.fullyDilutedValuationUsd);
  if (aFdv === null && bFdv !== null) return 1;
  if (aFdv !== null && bFdv === null) return -1;
  if (aFdv !== null && bFdv !== null && aFdv !== bFdv) return aFdv > bFdv ? -1 : 1;
  const aTime = a.launchTimestamp ? Date.parse(a.launchTimestamp) : Number.NaN;
  const bTime = b.launchTimestamp ? Date.parse(b.launchTimestamp) : Number.NaN;
  const timeOrder = (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  return Number.isFinite(timeOrder) && timeOrder !== 0 ? timeOrder : b.id.localeCompare(a.id);
}

function ExplorePage() {
  const [search, setSearch] = useState('');
  const [networkFilter, setNetworkFilter] = useState<ExploreNetworkFilter>('all');
  const [cursor, setCursor] = useState('');
  const params = useMemo<ListLaunchesParams>(() => ({
    network: networkFilter,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(cursor ? { cursor } : {}),
  }), [search, cursor, networkFilter]);
  const { data, isLoading, isError, refetch } = useListLaunches(params, { query: { queryKey: getListLaunchesQueryKey(params) } });
  const items = (data?.items || [])
    .filter((launch) => exploreNetworkMatches(launch, networkFilter))
    .sort(compareLaunchRank);
  const filterLabel = networkFilter === 'all' ? 'All networks' : networkFilter === 'robinhood-pons'
    ? 'Robinhood Pons' : networkFilter === 'ethereum' ? 'Ethereum' : 'Multichain';
  const emptyMessage = search
    ? `No launch matches “${search}” in ${filterLabel}.`
    : networkFilter === 'all'
      ? 'No verified launches are available in the current index.'
      : `No verified ${filterLabel} launches are available in the current index.`;
  return <div className="explore-refresh"><PageHeader title="Explore launches" description="Search verified token launches and filter by network." />
     <div className="panel explorer-panel"><div className="filter-bar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setCursor(''); }} placeholder="Search by name, symbol, or address" aria-label="Search launches" data-testid="input-launch-search" /></label><label className="select-wrap"><span className="sr-only">Filter by network</span><select value={networkFilter} onChange={(event) => { setNetworkFilter(event.target.value as ExploreNetworkFilter); setCursor(''); }} data-testid="select-launch-network"><option value="all">All</option><option value="robinhood-pons">Robinhood Pons</option><option value="ethereum">Ethereum</option><option value="multichain">Multichain</option></select><ChevronDown size={14} /></label></div>
     <div className="explorer-meta"><span>{isLoading ? 'Loading launches…' : `${items.length} launches`}</span><span><span className="verified-meta-dot" /> {filterLabel}</span></div>
    <QueryState loading={isLoading} error={isError} retry={() => void refetch()} empty={!items.length} message={emptyMessage} />
    {!isLoading && !isError && items.length > 0 && <LaunchRows items={items} />}
    {!isLoading && !isError && data?.nextCursor && <button className="button button-secondary load-more" onClick={() => setCursor(data.nextCursor || '')} data-testid="button-next-launch-page">Next page <ArrowDownRight size={15} /></button>}
     </div>
   </div>;
}

function LaunchDetailPage() {
  return <LaunchDetailDashboard copyToClipboard={copyToClipboard} />;
}
function DetailLine({ label, children }: { label: string; children: ReactNode }) { return <div className="detail-line"><span>{label}</span><div>{children}</div></div>; }

function formatTaxRateBps(value: number) {
  return (value / 100).toFixed(2).replace(/\.?0+$/, "");
}

function parseTaxRateInput(input: string): { bps: number | null; error: string } {
  const value = input.trim();
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    return { bps: null, error: "Enter a valid tax rate between 1% and 10%." };
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { bps: null, error: "Enter a valid tax rate between 1% and 10%." };
  }
  if (numeric < 1) return { bps: null, error: "Additional tax must be at least 1%." };
  if (numeric > 10) return { bps: null, error: "Additional tax cannot exceed 10%." };
  const [, fraction = ""] = value.split(".");
  if (fraction.length > 2) {
    return { bps: null, error: "Enter a rate with no more than two decimal places." };
  }
  const [whole] = value.split(".");
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0");
  return { bps, error: "" };
}

async function detectImageContentType(file: File): Promise<"image/png" | "image/jpeg" | "image/webp" | null> {
  try {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
    if (isPng) return "image/png";
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }
    if (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    ) {
      return "image/webp";
    }
  } catch {
    return null;
  }
  return null;
}

type LaunchDraft = {
  name: string;
  symbol: string;
  description: string;
  additionalTaxBps: number;
  imageName: string;
  imageUrl: string;
  imageObjectPath: string;
  websiteUrl: string;
  xUrl: string;
};

type LaunchFlowState = {
  detailsComplete: boolean;
  creatorAddress: string | null;
  launchOrderId: string | null;
  depositStatus: string;
  launchStatus: string;
  launchLastStage: string | null;
  launchTransactions: Record<string, string>;
  launchResult: PonsMainnetLaunchResult | EthereumMainnetLaunchResult | null;
  launchError: string | null;
  requiredDepositWei: string | null;
  depositAddress: string | null;
  depositBalanceWei: string | null;
  depositChainId: number | null;
  depositNetworkName: string | null;
  depositConfirmedAt: string | null;
  launchTransactionHash: string | null;
};

const launchDraftKey = getLaunchDraftStorageKey("pons-v2", "draft");
const launchDraftIdKey = getLaunchDraftStorageKey("pons-v2", "id");
const legacyLaunchDraftKey = legacyLaunchDraftStorageKeys.draft;
const legacyLaunchDraftIdKey = legacyLaunchDraftStorageKeys.id;
const modeLaunchDraftKey = (mode: LaunchModeId | null) =>
  getLaunchDraftStorageKey(mode, "draft");
const modeLaunchDraftIdKey = (mode: LaunchModeId | null) =>
  getLaunchDraftStorageKey(mode, "id");

function isValidLaunchDraftStorageValue(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
    const draft = parsed as Record<string, unknown>;
    const stringFields = [
      "name",
      "symbol",
      "description",
      "imageName",
      "imageUrl",
      "imageObjectPath",
      "websiteUrl",
      "xUrl",
    ];
    if (stringFields.some((field) => field in draft && typeof draft[field] !== "string")) return false;
    return !(
      "additionalTaxBps" in draft &&
      (!Number.isInteger(draft.additionalTaxBps) ||
        (draft.additionalTaxBps as number) < 100 ||
        (draft.additionalTaxBps as number) > 1000)
    );
  } catch {
    return false;
  }
}

function isValidLaunchDraftId(value: string) {
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
}

function readLaunchDraftId(mode: LaunchModeId | null) {
  const fragmentDraftId = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("draft") || "";
  if (isValidLaunchDraftId(fragmentDraftId)) return fragmentDraftId;
  try {
    const storedDraftId = readLaunchDraftStorageValue(window.localStorage, mode, "id") || "";
    return isValidLaunchDraftId(storedDraftId) ? storedDraftId : "";
  } catch {
    return "";
  }
}

function migrateLaunchDraftStorage() {
  try {
    const storage = window.localStorage;
    migrateStorageKey(storage, launchDraftKey, legacyLaunchDraftKey, isValidLaunchDraftStorageValue);
    migrateStorageKey(storage, launchDraftIdKey, legacyLaunchDraftIdKey, isValidLaunchDraftId);
  } catch {
    // Keep the launch form usable without storage access.
  }
}

migrateLaunchDraftStorage();
const emptyLaunchDraft: LaunchDraft = {
  name: "",
  symbol: "",
  description: "",
  additionalTaxBps: 100,
  imageName: "",
  imageUrl: "",
  imageObjectPath: "",
  websiteUrl: "",
  xUrl: "",
};

function readLaunchDraft(mode: LaunchModeId | null = null): LaunchDraft {
  try {
    const saved = readLaunchDraftStorageValue(window.localStorage, mode, "draft");
    if (!saved) return emptyLaunchDraft;
    const parsed = JSON.parse(saved) as Partial<LaunchDraft>;
    return {
      ...emptyLaunchDraft,
      ...parsed,
      additionalTaxBps:
        Number.isInteger(parsed.additionalTaxBps) &&
        (parsed.additionalTaxBps as number) >= 100 &&
        (parsed.additionalTaxBps as number) <= 1000
          ? (parsed.additionalTaxBps as number)
          : emptyLaunchDraft.additionalTaxBps,
    };
  } catch {
    return emptyLaunchDraft;
  }
}

function hasSavedLocalLaunchDraft(mode: LaunchModeId) {
  try {
    const fragmentDraftId = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("draft") || "";
    return hasSavedLaunchDraft(window.localStorage, mode, fragmentDraftId);
  } catch {
    return false;
  }
}

function normalizeWebsiteDraft(value: string): { value: string; error: string } {
  if (!value.trim()) return { value: "", error: "" };
  let url: URL;
  try {
    const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    url = new URL(candidate);
  } catch {
    return { value, error: "Enter a valid website URL." };
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    return { value, error: "Use an HTTP or HTTPS website URL without login details." };
  }
  url.hostname = url.hostname.toLowerCase();
  return { value: url.toString(), error: "" };
}

function normalizeXDraft(value: string): { value: string; error: string } {
  if (!value.trim()) return { value: "", error: "" };
  let url: URL;
  try {
    const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    url = new URL(candidate);
  } catch {
    return { value, error: "Enter a profile or post URL from x.com or twitter.com." };
  }
  if (
    !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase()) ||
    url.pathname === "/" ||
    url.username ||
    url.password
  ) {
    return { value, error: "Use an X/Twitter profile or post URL." };
  }
  url.protocol = "https:";
  url.hostname = "x.com";
  return { value: url.toString(), error: "" };
}

function getLaunchTaxPolicy(modeId: LaunchModeId) {
  if (modeId === "ethereum") {
    return {
      baseTax: "0.7% to the foundation wallet; separate from additional tax",
      additionalTax: "Ethereum-only: 100% to the creator; no buyback split",
    };
  }
  if (modeId === "multichain") {
    return {
      baseTax: "Ethereum: 0.7% to the foundation wallet; Robinhood Pons rules stay separate",
      additionalTax: "Multichain: 70% to the creator, 10% to the platform, 20% to this token's Bridge Vault",
    };
  }
  return {
    baseTax: "Pons fees only; no Armoreum foundation tax",
    additionalTax: "Robinhood-only: 90% to the creator and 10% to the platform",
  };
}

function LaunchModeEconomics({ modeId }: { modeId: LaunchModeId }) {
  const economics = [
    {
      label: 'Launch fee',
      value: modeId === 'ethereum'
        ? `No separate fee · ${ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH launch deposit`
        : modeId === 'multichain'
          ? `${ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH on Ethereum · ${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH on Robinhood, plus the selected Pons buy`
          : `${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH creator launch balance`,
    },
    {
      label: 'Initial buy',
      value: modeId === 'multichain'
        ? 'Pons buy: 0.02 / 0.05 / 0.1 / 0.2 ETH · Ethereum reserve: 1 / 2.5 / 5 / 10%'
        : 'None',
    },
    {
      label: 'Base tax',
      value: modeId === 'ethereum'
        ? '0.7% to foundation'
        : modeId === 'multichain'
          ? 'Ethereum: 0.7% to foundation · Robinhood: Pons rules'
          : 'No Armoreum base tax',
    },
    {
      label: 'Additional tax',
      value: modeId === 'ethereum'
        ? '1% default · 100% to creator'
        : modeId === 'multichain'
          ? '1% default · 70% creator · 10% platform · 20% Bridge Vault'
          : '1% default · 90% creator · 10% platform',
    },
  ];
  return <dl className="launch-mode-economics">
    {economics.map(({ label, value }) => <div key={label}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>)}
  </dl>;
}

function LaunchModeChooser({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (modeId: LaunchModeId) => void;
}) {
  const [ponsReadiness, setPonsReadiness] = useState<"checking" | "ready" | "unavailable">("checking");
  const [ponsReadinessNote, setPonsReadinessNote] = useState("");
  const [ethereumReadiness, setEthereumReadiness] = useState<"checking" | "ready" | "unavailable">("checking");
  const [ethereumReadinessNote, setEthereumReadinessNote] = useState("");
  const [multichainReadiness, setMultichainReadiness] = useState<"checking" | "ready" | "blocked" | "unavailable">("checking");
  const [multichainReadinessNote, setMultichainReadinessNote] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPonsReadiness("checking");
    setPonsReadinessNote("");
    setEthereumReadiness("checking");
    setEthereumReadinessNote("");
    setMultichainReadiness("checking");
    setMultichainReadinessNote("");
    void fetch("/api/network")
      .then(async (response) => {
        if (!response.ok) throw new Error("Network readiness check failed.");
        return await response.json() as {
          networks?: Array<{
            networkId?: string;
            launchEnabled?: boolean;
            ponsV2Status?: string;
            verificationNote?: string;
          }>;
        };
      })
      .then((status) => {
        if (!active) return;
        const robinhood = status.networks?.find((network) => network.networkId === "robinhood");
        const ethereum = status.networks?.find((network) => network.networkId === "ethereum");
        if (robinhood?.launchEnabled && robinhood.ponsV2Status === "verified") {
          setPonsReadiness("ready");
          setPonsReadinessNote("");
        } else {
          setPonsReadiness("unavailable");
          setPonsReadinessNote(robinhood?.verificationNote || "Robinhood Pons V2 mainnet preflight is not ready.");
        }
        if (ethereum?.launchEnabled) {
          setEthereumReadiness("ready");
          setEthereumReadinessNote("");
        } else {
          setEthereumReadiness("unavailable");
          setEthereumReadinessNote(ethereum?.verificationNote || "Ethereum mainnet preflight is not ready.");
        }
      })
      .catch(() => {
        if (!active) return;
        setPonsReadiness("unavailable");
        setPonsReadinessNote("Could not verify the Robinhood Pons V2 launch route.");
        setEthereumReadiness("unavailable");
        setEthereumReadinessNote("Could not verify the Ethereum mainnet launch route.");
      });
    void fetch("/api/multichain/readiness")
      .then(async (response) => {
        if (!response.ok) throw new Error("Multichain readiness check failed.");
        return await response.json() as {
          ready?: boolean;
          checks?: Array<{ id?: string; ready?: boolean }>;
        };
      })
      .then((status) => {
        if (!active) return;
        setMultichainReadiness(status.ready ? "ready" : "blocked");
        const labels: Record<string, string> = {
          "armoreum-bridge-apps": "Bridge contracts",
          "custom-dvn-policy": "DVN policy",
          "destination-keepers": "destination keepers",
          "bridge-indexer": "transfer indexing",
          "multichain-launch-orchestrator": "launch coordination",
          "ethereum-bridge-operators": "Ethereum operators",
          "robinhood-bridge-operators": "Robinhood operators",
          "launch-pair-provisioner": "bridge pair provisioning",
          "bridge-worker": "keeper and transfer indexer",
        };
        const blockers = (status.checks ?? [])
          .filter((check) => !check.ready && check.id)
          .map((check) => labels[check.id!] ?? check.id!);
        setMultichainReadinessNote(
          blockers.length > 0
            ? `${blockers.join(" · ")} still need mainnet setup.`
            : "",
        );
      })
      .catch(() => {
        if (!active) return;
        setMultichainReadiness("unavailable");
        setMultichainReadinessNote("Could not verify Multichain mainnet infrastructure.");
      });
    return () => { active = false; };
  }, [open]);
  const choices: { id: LaunchModeId; title: string; description: string }[] = [
    { id: 'pons-v2', title: 'Pons V2', description: 'Launch through Pons with creator rewards protected by your launch password.' },
    { id: 'ethereum', title: 'Ethereum', description: 'Launch on Ethereum with creator rewards protected by your launch password.' },
    { id: 'multichain', title: 'Multichain', description: 'Launch across Ethereum and Robinhood with creator rewards protected by your launch password.' },
  ];
  return <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
    <DialogContent
      className="launch-mode-dialog"
      onInteractOutside={(event) => {
        const target = event.target;
        if (
          target instanceof Element
          && target.closest('.mobile-bottom-nav, .sidebar, .mobile-more-panel, .mobile-more-scrim')
        ) {
          event.preventDefault();
        }
      }}
    >
      <DialogHeader className="launch-mode-dialog-header">
        <DialogTitle>Choose a launch mode</DialogTitle>
        <DialogDescription>Select a workflow. Choosing a mode does not submit a transaction.</DialogDescription>
      </DialogHeader>
      <div className="launch-mode-dialog-scroll">
        <div className="launch-mode-grid" role="group" aria-label="Choose a launch mode">
          {choices.map(({ id, title, description }) => {
            const mode = LAUNCH_MODES[id];
            const workflowStatus = id === 'pons-v2'
              ? ponsReadiness === "checking"
                ? "Checking Robinhood mainnet"
                : ponsReadiness === "ready"
                  ? "Verified · ready"
                  : "Robinhood · launch unavailable"
              : id === 'ethereum'
                ? ethereumReadiness === "checking"
                  ? "Checking Ethereum mainnet"
                  : ethereumReadiness === "ready"
                    ? "Verified · ready"
                    : "Ethereum · launch unavailable"
                : multichainReadiness === "checking"
                  ? "Checking mainnet setup"
                  : multichainReadiness === "ready"
                    ? "Verified · ready"
                    : multichainReadiness === "unavailable"
                      ? "Mainnet status unavailable"
                      : "Mainnet setup incomplete";
            return <button
              className="launch-mode-card"
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              disabled={
                (id === "pons-v2" && ponsReadiness !== "ready")
                || (id === "ethereum" && ethereumReadiness !== "ready")
                || (id === "multichain" && multichainReadiness !== "ready")
              }
              data-testid={`launch-mode-${id}`}
            >
              <span className="launch-mode-card-top">
                <span className="launch-mode-network-marks">
                  {mode.networks.map((networkId) => <NetworkMark key={networkId} networkId={networkId} size={28} />)}
                </span>
                <span className="launch-mode-state local">{workflowStatus}</span>
              </span>
              <strong>{title}</strong>
              <span className="launch-mode-description">{description}</span>
              <LaunchModeEconomics modeId={id} />
              {id === "pons-v2" && ponsReadinessNote && <span className="launch-mode-description">{ponsReadinessNote}</span>}
              {id === "ethereum" && ethereumReadinessNote && <span className="launch-mode-description">{ethereumReadinessNote}</span>}
              {id === "multichain" && multichainReadinessNote && <span className="launch-mode-description">{multichainReadinessNote}</span>}
            </button>;
          })}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

function LaunchModeNotReady({
  modeId,
  onChangeMode,
}: {
  modeId: Exclude<LaunchModeId, 'pons-v2'>;
  onChangeMode: () => void;
}) {
  const mode = LAUNCH_MODES[modeId];
  const isMultichain = modeId === 'multichain';
  return <>
    <PageHeader
      title={`${mode.label} launch`}
      description={isMultichain ? 'Multichain launch setup.' : 'Ethereum launch setup.'}
      action={<button className="button button-secondary compact" type="button" onClick={onChangeMode}>Change mode</button>}
    />
    <section className="panel launch-mode-readiness">
      <div className="launch-mode-readiness-heading">
        <div className="launch-mode-network-marks">
          {mode.networks.map((networkId) => <NetworkMark key={networkId} networkId={networkId} size={30} />)}
        </div>
        <span className="launch-mode-state not-configured">Not configured</span>
      </div>
      <h2>{isMultichain ? 'Multichain launch setup' : 'Ethereum launch setup'}</h2>
      <p>{formatBrandText(isMultichain
        ? 'The network endpoints are documented, but armoreum token contracts, bridge peers, and message policy are not deployed.'
        : 'Ethereum RPC, Uniswap V4, and core Armoreum contracts are present on mainnet. The launch route is still disabled: the deployment record does not include a verified Armoreum V4 tax-hook route or an active JailSeed opening-price flow.')}</p>
      {isMultichain && <p className="launch-mode-required-buy"><strong>Required starting balances:</strong> {ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH on Ethereum, and {PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH plus the selected initial buy on Robinhood. The same creator address is funded separately on both networks. The live Pons launch fee is 0.0005 ETH and is covered by the Robinhood launch balance; the selected buy is additional.</p>}
      <LaunchModeEconomics modeId={modeId} />
      <p className="launch-mode-footnote">{isMultichain
        ? 'The launch fee shown is a specified amount, not a live quote. No launch transaction is available.'
        : `The total creator deposit is ${ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH, replacing the old launch fee. Launch costs and gas come from that deposit; after launch, transferable surplus goes to the Creator Vault and issues JailETH. This route is not active yet. No transaction will be submitted.`}</p>
    </section>
    <section className="panel launch-mode-dependencies">
      <h2>Network dependencies</h2>
      {mode.networks.map((networkId) => {
        const network = NETWORKS[networkId];
        return <div className="launch-mode-dependency" key={networkId}>
          <NetworkMark networkId={networkId} size={24} />
          <div>{networkId !== 'robinhood' && <strong>{network.name}</strong>}<span>Chain ID {network.chainId} · {network.nativeCurrency} gas</span></div>
          {network.uniswapV4 && <a href={network.uniswapV4.sourceUrl} target="_blank" rel="noreferrer">Uniswap V4 reference</a>}
          {network.layerZero && <a href={network.layerZero.sourceUrl} target="_blank" rel="noreferrer">LayerZero reference</a>}
        </div>;
      })}
    </section>
  </>;
}

function SavedLaunchDraftDialog({
  modeId,
  error,
  onOpenChange,
  onContinue,
  onStartNew,
}: {
  modeId: LaunchModeId;
  error: string;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onStartNew: () => void;
}) {
  return <Dialog open onOpenChange={onOpenChange}>
    <DialogContent className="launch-draft-choice-dialog" data-testid="dialog-saved-launch-draft">
      <DialogHeader>
        <DialogTitle>Saved launch draft found</DialogTitle>
        <DialogDescription>
          An unfinished {LAUNCH_MODES[modeId].label} draft is saved on this device. Continue it or start a new draft.
        </DialogDescription>
      </DialogHeader>
      <p className="launch-draft-choice-warning">
        Starting fresh clears saved launch drafts from this device. Any funds already deposited and confirmed
        transactions remain on their networks; this does not reverse or recover them.
      </p>
      {error && <p className="creator-inline-error" role="alert">{error}</p>}
      <div className="launch-draft-choice-actions">
        <button
          className="button button-primary"
          type="button"
          onClick={onContinue}
          data-testid="button-continue-saved-launch"
        >
          Continue saved draft
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={onStartNew}
          data-testid="button-start-new-launch-draft"
        >
          Start a new draft
        </button>
      </div>
    </DialogContent>
  </Dialog>;
}

function LaunchWizardPage() {
  const [, setLocation] = useLocation();
  const { walletAddress, connecting, connectWallet, walletError } = useArmoreumWallet();
  const readMode = (): LaunchModeId | null => {
    const candidate = new URLSearchParams(window.location.search).get('mode');
    return candidate === 'pons-v2' || candidate === 'ethereum' || candidate === 'multichain' ? candidate : null;
  };
  const initialMode = readMode();
  const [selectedMode, setSelectedMode] = useState<LaunchModeId | null>(initialMode);
  const [draftChoiceMode, setDraftChoiceMode] = useState<LaunchModeId | null>(() =>
    initialMode && hasSavedLocalLaunchDraft(initialMode) ? initialMode : null,
  );
  const [draftChoiceError, setDraftChoiceError] = useState("");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<LaunchDraft>(() => readLaunchDraft(selectedMode));
  const [taxRateInput, setTaxRateInput] = useState(() => formatTaxRateBps(draft.additionalTaxBps));
  const [flowState, setFlowState] = useState<LaunchFlowState>({
    detailsComplete: false,
    creatorAddress: null,
    launchOrderId: null,
    depositStatus: "not-created",
    launchStatus: "not-submitted",
    launchLastStage: null,
    launchTransactions: {},
    launchResult: null,
    launchError: null,
    requiredDepositWei: null,
    depositAddress: null,
    depositBalanceWei: null,
    depositChainId: null,
    depositNetworkName: null,
    depositConfirmedAt: null,
    launchTransactionHash: null,
  });
  const [draftId, setDraftId] = useState(() => readLaunchDraftId(selectedMode));
  const [hydratedDraftId, setHydratedDraftId] = useState("");
  const [initialBuyEth, setInitialBuyEth] = useState(
    () => window.localStorage.getItem("armoreum.multichain-initial-buy.v1") || "0.05",
  );
  const [multichainBuyLocked, setMultichainBuyLocked] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<"saving" | "saved" | "error">("saving");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "processing" | "uploaded" | "error">(
    draft.imageUrl ? "uploaded" : "idle",
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [imageInputKey, setImageInputKey] = useState(0);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [fundingError, setFundingError] = useState("");
  const [fundingOrderLoading, setFundingOrderLoading] = useState(false);
  const [fundingQrDataUrl, setFundingQrDataUrl] = useState("");
  const [passwordAuthorization, setPasswordAuthorization] = useState<{
    draftId: string;
    authorization: QrcAuthorizationRecord;
    creatorPassword: string;
  } | null>(null);
  const [ponsLaunchResult, setPonsLaunchResult] = useState<PonsMainnetLaunchResult | null>(null);
  const [ethereumLaunchResult, setEthereumLaunchResult] = useState<EthereumMainnetLaunchResult | null>(null);
  const [recoveryCapsuleDownloaded, setRecoveryCapsuleDownloaded] = useState(false);
  const draftGenerationRef = useRef(0);
  const [recoveryCapsuleDialogOpen, setRecoveryCapsuleDialogOpen] = useState(false);
  const recoveryCapsuleDialogRef = useRef<HTMLDialogElement>(null);
  const expectedAuthorizationChain = selectedMode === "ethereum" ? 1 : 4663;
  const passwordAuthorizationPrepared = passwordAuthorization?.draftId === draftId &&
    passwordAuthorization.authorization.chainId === expectedAuthorizationChain;
  useEffect(() => {
    if (
      selectedMode === "pons-v2" &&
      passwordAuthorizationPrepared &&
      flowState.launchStatus === "launched" &&
      flowState.launchResult &&
      "curveAddress" in flowState.launchResult &&
      !ponsLaunchResult
    ) {
      setPonsLaunchResult(flowState.launchResult);
    }
  }, [selectedMode, passwordAuthorizationPrepared, flowState.launchStatus, flowState.launchResult, ponsLaunchResult]);
  useEffect(() => {
    if (
      selectedMode === "ethereum" &&
      passwordAuthorizationPrepared &&
      flowState.launchStatus === "launched" &&
      flowState.launchResult &&
      "poolId" in flowState.launchResult &&
      !ethereumLaunchResult
    ) {
      setEthereumLaunchResult(flowState.launchResult);
    }
  }, [selectedMode, passwordAuthorizationPrepared, flowState.launchStatus, flowState.launchResult, ethereumLaunchResult]);
  useEffect(() => {
    if (selectedMode === "pons-v2" && ponsLaunchResult && !recoveryCapsuleDownloaded) {
      setRecoveryCapsuleDialogOpen(true);
    } else {
      setRecoveryCapsuleDialogOpen(false);
    }
  }, [selectedMode, ponsLaunchResult, recoveryCapsuleDownloaded]);
  useEffect(() => {
    const dialog = recoveryCapsuleDialogRef.current;
    if (!dialog) return;
    if (recoveryCapsuleDialogOpen && !dialog.open) {
      dialog.showModal();
    } else if (!recoveryCapsuleDialogOpen && dialog.open) {
      dialog.close();
    }
  }, [recoveryCapsuleDialogOpen, ponsLaunchResult, recoveryCapsuleDownloaded]);
  const activateMode = (modeId: LaunchModeId, startFresh = false) => {
    if (startFresh) {
      let storageCleared = false;
      try {
        storageCleared = clearLocalLaunchDrafts(window.localStorage);
      } catch {
        storageCleared = false;
      }
      if (!storageCleared) {
        setDraftChoiceError("Saved drafts could not be cleared from this browser. Check browser storage settings and try again.");
        return;
      }
    }
    resetModeForm(modeId, startFresh);
  };
  const resetModeForm = (modeId: LaunchModeId, startFresh = false) => {
    draftGenerationRef.current += 1;
    const nextDraft = startFresh ? emptyLaunchDraft : readLaunchDraft(modeId);
    setMultichainBuyLocked(false);
    setHydratedDraftId("");
    setDraftId(startFresh ? "" : readLaunchDraftId(modeId));
    setDraft(nextDraft);
    setTaxRateInput(formatTaxRateBps(nextDraft.additionalTaxBps));
    setSelectedFile(null);
    setPreviewUrl("");
    setUploadState(nextDraft.imageUrl ? "uploaded" : "idle");
    setUploadProgress(0);
    setUploadError("");
    setImageInputKey((current) => current + 1);
    setDraftChoiceError("");
    setFlowState({
      detailsComplete: false,
      creatorAddress: null,
      launchOrderId: null,
      depositStatus: "not-created",
      launchStatus: "not-submitted",
      launchLastStage: null,
      launchTransactions: {},
      launchResult: null,
      launchError: null,
      requiredDepositWei: null,
      depositAddress: null,
      depositBalanceWei: null,
      depositChainId: null,
      depositNetworkName: null,
      depositConfirmedAt: null,
      launchTransactionHash: null,
    });
    setPasswordAuthorization(null);
    setPonsLaunchResult(null);
    setEthereumLaunchResult(null);
    setRecoveryCapsuleDownloaded(false);
    setRecoveryCapsuleDialogOpen(false);
    setStep(0);
    const remainingFragment = new URLSearchParams(
      startFresh ? "" : window.location.hash.replace(/^#/, ""),
    );
    if (startFresh) remainingFragment.delete("draft");
    const fragmentText = remainingFragment.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?mode=${modeId}${fragmentText ? `#${fragmentText}` : ""}`,
    );
    setSelectedMode(modeId);
    setDraftChoiceMode(null);
  };
  const completeRecoveryDraft = () => {
    if (!selectedMode || !draftId || !clearCompletedLaunchDraft(window.localStorage, selectedMode, draftId)) {
      throw new Error("The completed draft could not be cleared from this browser. Keep your recovery capsule and try again.");
    }
    // Reset directly: starting fresh via activateMode would also discard unrelated funded drafts.
    resetModeForm(selectedMode, true);
  };
  const selectMode = (modeId: LaunchModeId) => {
    setDraftChoiceError("");
    if (hasSavedLocalLaunchDraft(modeId)) {
      setDraftChoiceMode(modeId);
      return;
    }
    activateMode(modeId);
  };
  const dismissDraftChoice = (modeId: LaunchModeId) => {
    setDraftChoiceError("");
    setDraftChoiceMode(null);
    if (selectedMode === modeId) {
      setSelectedMode(null);
      const fragment = window.location.hash;
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${fragment}`);
    }
  };
  const continueSavedDraft = () => {
    if (draftChoiceMode) activateMode(draftChoiceMode);
  };
  const startNewDraft = () => {
    if (draftChoiceMode) activateMode(draftChoiceMode, true);
  };
  useEffect(() => {
    window.localStorage.setItem("armoreum.multichain-initial-buy.v1", initialBuyEth);
  }, [initialBuyEth]);
  useEffect(() => {
    setMultichainBuyLocked(false);
  }, [draftId]);
  const changeMode = () => {
    window.history.replaceState(window.history.state, '', window.location.pathname);
    setSelectedMode(null);
  };
  const stepNames = flowState.detailsComplete ? ["Token details", "Password & recovery"] : ["Token details"];
  const symbolValid = /^[A-Z][A-Z0-9]{0,11}$/.test(draft.symbol);
  const websiteCheck = normalizeWebsiteDraft(draft.websiteUrl);
  const xCheck = normalizeXDraft(draft.xUrl);
  const taxRateCheck = parseTaxRateInput(taxRateInput);
  const websiteValid = !websiteCheck.error;
  const xValid = !xCheck.error;
  const detailsValid = Boolean(
    draft.name.trim() && symbolValid && draft.imageUrl && uploadState === "uploaded" && websiteValid && xValid && !taxRateCheck.error,
  );
  const canStartPasswordFirstDraft =
    flowState.detailsComplete &&
    flowState.launchStatus === "not-submitted" &&
    !flowState.launchOrderId &&
    flowState.depositStatus === "not-created" &&
    !flowState.requiredDepositWei &&
    !flowState.depositAddress &&
    !flowState.launchTransactionHash;
  const taxRate = formatTaxRateBps(draft.additionalTaxBps);
  const launchDetailsLocked =
    flowState.depositStatus === "confirmed" ||
    Object.keys(flowState.launchTransactions || {}).length > 0 ||
    (flowState.launchStatus !== "not-submitted" &&
      flowState.launchStatus !== "needs-funding" &&
      flowState.launchStatus !== "needs-attention");

  useEffect(() => {
    if (!selectedMode || draftChoiceMode === selectedMode) return;
    window.localStorage.setItem(modeLaunchDraftKey(selectedMode), JSON.stringify(draft));
  }, [draft, selectedMode, draftChoiceMode]);

  useEffect(() => {
    if (!selectedMode || draftChoiceMode === selectedMode || !draftId || !isValidLaunchDraftId(draftId)) return;
    let savedToStorage = false;
    try {
      window.localStorage.setItem(modeLaunchDraftIdKey(selectedMode), draftId);
      savedToStorage = true;
    } catch {
      // Keep the recovery fragment if storage is unavailable.
    }
    if (!savedToStorage) return;
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (fragment.get("draft") !== draftId) return;
    fragment.delete("draft");
    const remainingFragment = fragment.toString();
    const nextUrl = `${window.location.pathname}${window.location.search}${remainingFragment ? `#${remainingFragment}` : ""}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [draftId, selectedMode, draftChoiceMode]);

  useEffect(() => {
    if (!selectedMode || draftChoiceMode === selectedMode) return;
    setTaxRateInput(formatTaxRateBps(draft.additionalTaxBps));
  }, [draft.additionalTaxBps, selectedMode, draftChoiceMode]);

  useEffect(() => {
    if (!selectedMode || draftChoiceMode === selectedMode) return;
    let active = true;
    const generation = draftGenerationRef.current;
    const loadOrCreateDraft = async () => {
      try {
        if (!draftId) {
          const created = await fetch("/api/launch-drafts", { method: "POST" });
          if (!created.ok) throw new Error("Draft storage is unavailable.");
          const row = (await created.json()) as { id?: string };
          if (generation !== draftGenerationRef.current) return;
          if (!row.id) throw new Error("Draft storage returned no reference.");
          if (active) {
            window.localStorage.setItem(modeLaunchDraftIdKey(selectedMode), row.id);
            setDraftId(row.id);
          }
          return;
        }
        const response = await fetch(`/api/launch-drafts/${encodeURIComponent(draftId)}`);
        if (generation !== draftGenerationRef.current) return;
        if (response.status === 404) {
          window.localStorage.removeItem(modeLaunchDraftIdKey(selectedMode));
          if (active) setHydratedDraftId("");
          const deletedLetgerTestDraft =
            draft.name === "Letger" &&
            draft.symbol === "LETGER" &&
            draft.description === "Your keys are safe. Your funds?" &&
            draft.imageName === "letger-test-logo.png";
          if (deletedLetgerTestDraft) {
            window.localStorage.removeItem(modeLaunchDraftKey(selectedMode));
            if (active) {
              setDraft(emptyLaunchDraft);
              setUploadState("idle");
              setSelectedFile(null);
              setPreviewUrl("");
              setUploadProgress(0);
              setUploadError("");
              setStep(0);
              setFlowState({
                detailsComplete: false,
                creatorAddress: null,
                launchOrderId: null,
                depositStatus: "not-created",
                launchStatus: "not-submitted",
                launchLastStage: null,
                launchTransactions: {},
                launchResult: null,
                launchError: null,
                requiredDepositWei: null,
                depositAddress: null,
                depositBalanceWei: null,
                depositChainId: null,
                depositNetworkName: null,
                depositConfirmedAt: null,
                launchTransactionHash: null,
              });
              setPasswordAuthorization(null);
            }
          }
          if (active) setDraftId("");
          return;
        }
        if (!response.ok) throw new Error("Saved draft could not be loaded.");
        const remote = (await response.json()) as Partial<LaunchDraft> & Partial<LaunchFlowState>;
        if (generation !== draftGenerationRef.current) return;
        const remoteHasData = Boolean(
          remote.name || remote.symbol || remote.description || remote.imageObjectPath || remote.websiteUrl || remote.xUrl,
        );
        if (active && remoteHasData) {
          setDraft((current) => ({ ...current, ...remote }));
          if (remote.imageUrl && remote.imageObjectPath) setUploadState("uploaded");
        }
        if (active && typeof remote.detailsComplete === "boolean") {
          setFlowState((current) => ({ ...current, ...remote }));
          if (remote.detailsComplete) setStep(1);
        }
        if (active) {
          setHydratedDraftId(draftId);
          setDraftSaveState("saved");
        }
      } catch {
        if (active && generation === draftGenerationRef.current) setDraftSaveState("error");
      }
    };
    void loadOrCreateDraft();
    return () => {
      active = false;
    };
  }, [draftId, selectedMode, draftChoiceMode]);

  useEffect(() => {
    if (!selectedMode || draftChoiceMode === selectedMode || !draftId || hydratedDraftId !== draftId || launchDetailsLocked) return;
    const generation = draftGenerationRef.current;
    const timer = window.setTimeout(async () => {
      if (generation !== draftGenerationRef.current) return;
      setDraftSaveState("saving");
      try {
        const rate = parseTaxRateInput(taxRateInput);
        const response = await fetch(`/api/launch-drafts/${encodeURIComponent(draftId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...draft,
            additionalTaxRate: rate.bps === null ? formatTaxRateBps(draft.additionalTaxBps) : taxRateInput,
          }),
        });
        if (generation !== draftGenerationRef.current) return;
        if (!response.ok) throw new Error("Draft save failed.");
        setDraftSaveState("saved");
      } catch {
        if (generation === draftGenerationRef.current) setDraftSaveState("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, draftId, hydratedDraftId, taxRateInput, selectedMode, launchDetailsLocked, draftChoiceMode]);

  useEffect(() => {
    if (
      (selectedMode !== "pons-v2" && selectedMode !== "ethereum") ||
      !draftId ||
      !flowState.launchOrderId
    ) return;
    const statusPath = selectedMode === "ethereum" ? "ethereum-mainnet/funding-orders" : "funding-orders";
    let active = true;
    const generation = draftGenerationRef.current;
    let inFlight = false;
    const pollOrder = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/launch-drafts/${encodeURIComponent(draftId)}/${statusPath}`);
        if (!response.ok) return;
        const latest = (await response.json()) as Partial<LaunchFlowState>;
        if (active && generation === draftGenerationRef.current) setFlowState((current) => ({ ...current, ...latest }));
      } catch {
        // The saved state remains visible if a status refresh is temporarily unavailable.
      } finally {
        inFlight = false;
      }
    };
    void pollOrder();
    const timer = window.setInterval(() => void pollOrder(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [draftId, flowState.launchOrderId, selectedMode]);

  useEffect(() => {
    setFundingQrDataUrl("");
    const expectedDepositChainId = selectedMode === "ethereum" ? 1 : 4663;
    if (
      !flowState.depositAddress ||
      !/^0x[\da-f]{40}$/i.test(flowState.depositAddress) ||
      flowState.depositChainId !== expectedDepositChainId ||
      !flowState.requiredDepositWei ||
      !/^[1-9]\d*$/.test(flowState.requiredDepositWei)
    ) {
      return;
    }
    const depositWei = flowState.depositChainId === 1
      ? ETHEREUM_FIXED_LAUNCH_DEPOSIT_WEI
      : PONS_REQUIRED_CREATOR_DEPOSIT_WEI;
    const uri = `ethereum:${flowState.depositAddress}@${flowState.depositChainId}?value=${depositWei}`;
    let active = true;
    void QRCode.toDataURL(uri, { errorCorrectionLevel: "Q", margin: 2, width: 240 })
      .then((image) => {
        if (active) setFundingQrDataUrl(image);
      })
      .catch(() => {
        if (active) setFundingQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [flowState.depositAddress, flowState.depositChainId, flowState.requiredDepositWei, selectedMode]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const updateDraft = (changes: Partial<LaunchDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  const updateTaxRate = (value: string) => {
    setTaxRateInput(value);
    const parsed = parseTaxRateInput(value);
    if (parsed.bps !== null) updateDraft({ additionalTaxBps: parsed.bps });
  };

  const updateWebsiteUrl = (value: string, normalize = false) => {
    const result = normalizeWebsiteDraft(value);
    updateDraft({ websiteUrl: normalize && !result.error ? result.value : value });
  };

  const updateXUrl = (value: string, normalize = false) => {
    const result = normalizeXDraft(value);
    updateDraft({ xUrl: normalize && !result.error ? result.value : value });
  };

  const saveDraft = async () => {
    if (!draftId) return false;
    const normalizedDraft = {
      ...draft,
      websiteUrl: websiteCheck.value,
      xUrl: xCheck.value,
    };
    setDraft(normalizedDraft);
    setDraftSaveState("saving");
    try {
      const response = await fetch(`/api/launch-drafts/${encodeURIComponent(draftId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...normalizedDraft, additionalTaxRate: taxRateInput }),
      });
      if (!response.ok) throw new Error("Draft metadata could not be saved.");
      setDraftSaveState("saved");
      return true;
    } catch {
      setDraftSaveState("error");
      return false;
    }
  };

  const startPasswordFirstDraft = async () => {
    if (!draftId || !detailsValid) {
      setFundingError("Complete and save the token details before starting a new password-first draft.");
      return;
    }
    setTransitionBusy(true);
    setFundingError("");
    try {
      const statusResponse = await fetch(`/api/launch-drafts/${encodeURIComponent(draftId)}`, {
        cache: "no-store",
      });
      if (!statusResponse.ok) throw new Error("The saved launch draft could not be checked.");
      const latest = (await statusResponse.json()) as Partial<LaunchFlowState>;
      if (
        latest.detailsComplete !== true ||
        latest.launchStatus !== "not-submitted" ||
        latest.launchOrderId ||
        latest.depositStatus !== "not-created" ||
        latest.requiredDepositWei ||
        latest.depositAddress ||
        latest.launchTransactionHash
      ) {
        throw new Error("This draft already has a funding or launch record and cannot be replaced here.");
      }
      if (!await saveDraft()) throw new Error("Token details could not be saved before creating the new draft.");

      const createdResponse = await fetch("/api/launch-drafts", { method: "POST" });
      const created = (await createdResponse.json()) as { id?: string; error?: string };
      if (!createdResponse.ok || !created.id) {
        throw new Error(created.error || "A new password-first draft could not be created.");
      }

      const normalizedDraft = {
        ...draft,
        websiteUrl: websiteCheck.value,
        xUrl: xCheck.value,
      };
      const saveResponse = await fetch(`/api/launch-drafts/${encodeURIComponent(created.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...normalizedDraft,
          additionalTaxRate: taxRateInput,
        }),
      });
      const savedDraft = (await saveResponse.json()) as Partial<LaunchDraft> & { error?: string };
      if (!saveResponse.ok) {
        throw new Error(savedDraft.error || "Token details could not be copied to the new draft.");
      }

      const completeResponse = await fetch(
        `/api/launch-drafts/${encodeURIComponent(created.id)}/complete-details`,
        { method: "POST" },
      );
      const completedDraft = (await completeResponse.json()) as Partial<LaunchDraft> & {
        detailsComplete?: boolean;
        error?: string;
      };
      if (!completeResponse.ok || completedDraft.detailsComplete !== true) {
        throw new Error(completedDraft.error || "The copied token details could not be verified.");
      }

      window.localStorage.setItem(modeLaunchDraftIdKey(selectedMode), created.id);
      setDraftId(created.id);
      setDraft({
        ...emptyLaunchDraft,
        ...normalizedDraft,
        imageUrl: completedDraft.imageUrl || normalizedDraft.imageUrl,
      });
      setPasswordAuthorization(null);
      setFlowState({
        detailsComplete: true,
        creatorAddress: null,
        launchOrderId: null,
        depositStatus: "not-created",
        launchStatus: "not-submitted",
        launchLastStage: null,
        launchTransactions: {},
        launchResult: null,
        launchError: null,
        requiredDepositWei: null,
        depositAddress: null,
        depositBalanceWei: null,
        depositChainId: null,
        depositNetworkName: null,
        depositConfirmedAt: null,
        launchTransactionHash: null,
      });
      setDraftSaveState("saved");
      setStep(1);
    } catch (error) {
      setFundingError(error instanceof Error ? error.message : "A fresh password-first draft could not be started.");
    } finally {
      setTransitionBusy(false);
    }
  };

  const handleImage = async (file?: File) => {
    if (!file) return;
    setUploadError("");
    setSelectedFile(file);
    const contentType = await detectImageContentType(file);
    if (!contentType) {
      setUploadState("error");
      setUploadError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size < 1 || file.size > 100 * 1024 * 1024) {
      setUploadState("error");
      setUploadError("Image size must be between 1 byte and 100 MB.");
      return;
    }
    setUploadState("uploading");
    setUploadProgress(0);
    try {
      const request = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType,
        }),
      });
      const uploadTarget = (await request.json()) as {
        uploadURL?: string;
        uploadId?: string;
        error?: string;
      };
      if (!request.ok || !uploadTarget.uploadURL || !uploadTarget.uploadId) {
        throw new Error(uploadTarget.error || "Could not start the image upload.");
      }
      let uploadUrl: URL;
      try {
        uploadUrl = new URL(uploadTarget.uploadURL);
      } catch {
        throw new Error("The storage service returned an invalid upload link. Try again.");
      }
      if (uploadUrl.protocol !== "https:") {
        throw new Error("The storage upload link is not secure. Try again.");
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl.toString());
        xhr.timeout = 30 * 60 * 1000;
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error("The image could not be stored."));
        xhr.onerror = () => reject(new Error("The image upload connection failed."));
        xhr.ontimeout = () => reject(new Error("The image upload timed out. Retry the upload."));
        xhr.send(file);
      });

      setUploadState("processing");
      setUploadProgress(100);
      const complete = await fetch("/api/storage/uploads/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: uploadTarget.uploadId }),
      });
      const result = (await complete.json()) as {
        objectPath?: string;
        imageUrl?: string;
        error?: string;
      };
      if (!complete.ok || !result.imageUrl || !result.objectPath) {
        throw new Error(result.error || "The uploaded image could not be verified.");
      }
      updateDraft({
        imageName: file.name,
        imageUrl: result.imageUrl,
        imageObjectPath: result.objectPath,
      });
      setUploadProgress(100);
      setUploadState("uploaded");
      setSelectedFile(null);
    } catch (error) {
      setUploadState("error");
      setUploadError(error instanceof Error ? error.message : "Image upload failed.");
    }
  };

  const clearImage = () => {
    updateDraft({ imageName: "", imageUrl: "", imageObjectPath: "" });
    setSelectedFile(null);
    setUploadState("idle");
    setUploadProgress(0);
    setUploadError("");
    setImageInputKey((key) => key + 1);
  };

  const continueFromDetails = () => {
    if (!detailsValid || transitionBusy) return;
    void (async () => {
      setTransitionBusy(true);
      setFundingError("");
      try {
        if (!(await saveDraft())) return;
        const response = await fetch(`/api/launch-drafts/${encodeURIComponent(draftId)}/complete-details`, {
          method: "POST",
        });
        const result = (await response.json()) as Partial<LaunchFlowState> & { error?: string };
        if (!response.ok || result.detailsComplete !== true) {
          throw new Error(result.error || "Token details could not be verified.");
        }
        setFlowState((current) => ({ ...current, ...result }));
        setStep(1);
      } catch (error) {
        setFundingError(error instanceof Error ? error.message : "Token details could not be verified.");
      } finally {
        setTransitionBusy(false);
      }
    })();
  };

  const requestFundingOrder = async (requestBody: unknown): Promise<PonsFundingOrder> => {
    if (!draftId || !flowState.detailsComplete) {
      throw new Error("Complete and save the token details before preparing launch funding.");
    }
    if (fundingOrderLoading) {
      throw new Error("The fixed launch deposit order is already being prepared.");
    }
    setFundingOrderLoading(true);
    setFundingError("");
    try {
      const response = await fetch(`/api/launch-drafts/${encodeURIComponent(draftId)}/funding-orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error(`The launch server returned an empty response (HTTP ${response.status}). No launch transaction was submitted; retry when the server is responding.`);
      }
      let result: Partial<LaunchFlowState> & {
        error?: string;
        reason?: string;
        depositBalanceWei?: string;
      };
      try {
        result = JSON.parse(responseText) as typeof result;
      } catch {
        throw new Error(`The launch server returned an unreadable response (HTTP ${response.status}). No launch transaction was submitted; retry when the server is responding.`);
      }
      if (!response.ok) throw new Error([result.error, result.reason].filter(Boolean).join(" "));
      setFlowState((current) => ({ ...current, ...result }));
      return result as PonsFundingOrder;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Funding order could not be created.";
      throw new Error(message);
    } finally {
      setFundingOrderLoading(false);
    }
  };

  const requestEthereumFundingOrder = async (): Promise<EthereumFundingOrder> => {
    if (!draftId || !flowState.detailsComplete) {
      throw new Error("Complete and save the token details before checking Ethereum funding.");
    }
    if (fundingOrderLoading) {
      throw new Error("The Ethereum balance is already being checked.");
    }
    setFundingOrderLoading(true);
    setFundingError("");
    try {
      const response = await fetch(
        `/api/launch-drafts/${encodeURIComponent(draftId)}/ethereum-mainnet/funding-orders`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error(`The launch server returned an empty response (HTTP ${response.status}).`);
      }
      let result: Partial<LaunchFlowState> & { error?: string };
      try {
        result = JSON.parse(responseText) as typeof result;
      } catch {
        throw new Error(`The launch server returned an unreadable response (HTTP ${response.status}).`);
      }
      if (!response.ok) throw new Error(result.error || "Ethereum funding status could not be checked.");
      setFlowState((current) => ({ ...current, ...result }));
      return result as EthereumFundingOrder;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ethereum funding status could not be checked.";
      throw new Error(message);
    } finally {
      setFundingOrderLoading(false);
    }
  };

  if (draftChoiceMode) {
    return <SavedLaunchDraftDialog
      modeId={draftChoiceMode}
      error={draftChoiceError}
      onOpenChange={(open) => { if (!open) dismissDraftChoice(draftChoiceMode); }}
      onContinue={continueSavedDraft}
      onStartNew={startNewDraft}
    />;
  }

  if (!selectedMode) {
    return <LaunchModeChooser
      open
      onOpenChange={(open) => { if (!open) setLocation('/'); }}
      onSelect={selectMode}
    />;
  }

  return <>
    {(() => {
      const mode = LAUNCH_MODES[selectedMode];
      return <PageHeader
        title={`${mode.label} launch`}
        description={selectedMode === "ethereum"
          ? "Walletless Ethereum mainnet token launch."
          : selectedMode === "multichain"
            ? "Coordinated Robinhood and Ethereum mainnet launch."
            : "Walletless Robinhood launch flow."}
        action={<button className="button button-secondary compact" type="button" onClick={changeMode}>Change mode</button>}
      />;
    })()}
    <section className="panel launch-cost-panel">
      <div className="launch-mode-readiness-heading"><h2>Launch configuration</h2><div className="launch-mode-network-marks">{LAUNCH_MODES[selectedMode].networks.map((networkId) => <NetworkMark key={networkId} networkId={networkId} size={24} />)}</div></div>
      <LaunchModeEconomics modeId={selectedMode} />
    </section>
    <div className="wizard-layout">
      <section className="panel wizard-panel">
        <div className="wizard-stepper" role="tablist" aria-label="Token launch steps">
          {stepNames.map((item, index) => (
            <button
              className={`wizard-step ${step === index ? "active" : ""} ${index === 0 && flowState.detailsComplete ? "done" : ""}`}
              key={item}
              role="tab"
              aria-selected={step === index}
              aria-controls={`launch-step-panel-${index}`}
              onClick={() => {
                if ((ponsLaunchResult || ethereumLaunchResult) && index === 0) return;
                if (index === 0 || flowState.detailsComplete) setStep(index);
              }}
              disabled={Boolean((ponsLaunchResult || ethereumLaunchResult) && index === 0)}
              data-testid={`wizard-step-${index}`}
            >
              <span>{index === 0 && flowState.detailsComplete ? <Check size={14} /> : `0${index + 1}`}</span>
              {item}
            </button>
          ))}
        </div>

        {step === 0 && <div className="wizard-form" role="tabpanel" id="launch-step-panel-0">
          <h2>Token details</h2>
          <p>Your launch draft and links are saved so you can return later. Image upload does not require an account or wallet.</p>
          <p className={`draft-save-status ${draftSaveState === "error" ? "error" : ""}`} role="status">
            {draftSaveState === "saving" ? "Saving draft…" : draftSaveState === "saved" ? "Draft saved" : "Draft save unavailable — this browser still keeps a local copy."}
          </p>
          <label>Token name
            <input required value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} placeholder="Token name" maxLength={40} autoComplete="off" data-testid="input-token-name" />
          </label>
          <label>Token symbol
            <input required value={draft.symbol} onChange={(event) => updateDraft({ symbol: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) })} placeholder="SYMBOL" maxLength={12} autoComplete="off" aria-invalid={Boolean(draft.symbol && !symbolValid)} aria-describedby="symbol-validation" data-testid="input-token-symbol" />
          </label>
          <p id="symbol-validation" className={`recipient-validation ${symbolValid ? "valid" : draft.symbol ? "invalid" : ""}`} aria-live="polite">
            {symbolValid ? "Symbol format is valid." : draft.symbol ? "Use 1–12 letters or numbers and start with a letter." : "Required. Starts with a letter; up to 12 characters."}
          </p>
          <div className="upload-block">
            <label htmlFor="token-image-upload">Token image <span className="optional">Required · PNG, JPEG, or WebP · any aspect ratio · up to 100 MB</span></label>
            <div className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleImage(event.dataTransfer.files?.[0]); }}>
              <input
                key={imageInputKey}
                id="token-image-upload"
                className="file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void handleImage(event.target.files?.[0])}
                data-testid="input-token-image"
              />
            </div>
            {(previewUrl || draft.imageUrl) && <div className="image-preview-card">
              <img src={previewUrl || draft.imageUrl} alt="Selected token artwork preview" />
              <div><strong>{selectedFile?.name || draft.imageName}</strong></div>
              <button className="button button-secondary compact" type="button" onClick={clearImage} disabled={uploadState === "uploading" || uploadState === "processing"}>Remove</button>
            </div>}
            {uploadState === "uploading" && <progress className="upload-progress" max={100} value={uploadProgress} aria-label="Image upload progress" />}
            {uploadError && <p className="creator-inline-error" role="alert">{uploadError}</p>}
            {uploadState === "error" && selectedFile && <button className="button button-secondary compact" type="button" onClick={() => void handleImage(selectedFile)} data-testid="button-retry-image">Retry image upload</button>}
          </div>
          <label>Description <span className="optional">Optional</span>
            <textarea value={draft.description} onChange={(event) => updateDraft({ description: event.target.value.slice(0, 320) })} placeholder="Describe the token plainly." maxLength={320} rows={4} data-testid="input-token-description" />
          </label>
          <div className="char-count">{draft.description.length} / 320</div>
          <label>Website URL <span className="optional">Optional</span>
            <input type="url" value={draft.websiteUrl} onChange={(event) => updateWebsiteUrl(event.target.value)} onBlur={(event) => updateWebsiteUrl(event.target.value, true)} placeholder="https://example.com" maxLength={2048} aria-invalid={Boolean(draft.websiteUrl && websiteCheck.error)} aria-describedby="website-validation" data-testid="input-token-website" />
          </label>
          <p id="website-validation" className={`recipient-validation ${websiteCheck.error ? "invalid" : draft.websiteUrl ? "valid" : ""}`} aria-live="polite">{websiteCheck.error || (draft.websiteUrl ? "Website URL is valid." : "Optional. Use an HTTP or HTTPS address.")}</p>
          <label>X / Twitter URL <span className="optional">Optional</span>
            <input type="url" value={draft.xUrl} onChange={(event) => updateXUrl(event.target.value)} onBlur={(event) => updateXUrl(event.target.value, true)} placeholder="https://x.com/yourproject" maxLength={2048} aria-invalid={Boolean(draft.xUrl && xCheck.error)} aria-describedby="x-validation" data-testid="input-token-x-url" />
          </label>
          <p id="x-validation" className={`recipient-validation ${xCheck.error ? "invalid" : draft.xUrl ? "valid" : ""}`} aria-live="polite">{xCheck.error || (draft.xUrl ? "X/Twitter profile or post URL is valid." : "Optional. Use an x.com or twitter.com profile or post.")}</p>
          <label>Additional tax rate
            <div className="tax-input-wrap">
              <input
                type="number"
                inputMode="decimal"
                min="1"
                max="10"
                step="0.01"
                required
                value={taxRateInput}
                onChange={(event) => updateTaxRate(event.target.value)}
                aria-invalid={Boolean(taxRateCheck.error)}
                aria-describedby="additional-tax-validation"
                data-testid="input-additional-tax"
              />
              <span>%</span>
            </div>
          </label>
          <p id="additional-tax-validation" className={`recipient-validation ${taxRateCheck.error ? "invalid" : "valid"}`} aria-live="polite">
              {taxRateCheck.error || `${getLaunchTaxPolicy(selectedMode).additionalTax}. Base tax is separate.${selectedMode === "ethereum" ? " Ethereum mainnet settings are verified before launch." : " Routing remains inactive in this draft."}`}
          </p>
          {fundingError && <p className="creator-inline-error" role="alert">{fundingError}</p>}
        </div>}

        {step === 1 && flowState.detailsComplete && selectedMode === "ethereum" && <div className="wizard-form" role="tabpanel" id="launch-step-panel-1">
          <section className="launch-progress-section local-launch-panel" aria-labelledby="ethereum-mainnet-launch-heading">
            <h2 id="ethereum-mainnet-launch-heading">Ethereum mainnet launch</h2>
            <p>This separate Ethereum flow creates a fixed-supply token, password-protected Creator Vault, TaxRouter and renounced Uniswap V4 tax hook. The generated creator wallet signs each transaction and pays gas from the {ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH total balance.</p>
            <div className="review-grid">
              <DetailLine label="Creator wallet">
                {passwordAuthorizationPrepared && passwordAuthorization
                  ? <CopyAddress value={passwordAuthorization.authorization.creatorAddress} label="Copy generated creator address" />
                  : <span>Created during Ethereum password setup</span>}
              </DetailLine>
              <DetailLine label="Launch route"><span>Ethereum · Uniswap V4 · chain ID 1</span></DetailLine>
              <DetailLine label="Token"><span>{draft.name} ({draft.symbol})</span></DetailLine>
              <DetailLine label="Password authorization">
                <span>{recoveryCapsuleDownloaded
                  ? "Recovery capsule downloaded"
                  : ethereumLaunchResult
                    ? "Launch confirmed; recovery capsule required"
                    : passwordAuthorizationPrepared
                      ? "Ethereum password authorization prepared"
                      : "Not prepared"}</span>
              </DetailLine>
            </div>
            {!passwordAuthorizationPrepared && draftId && <EthereumPasswordCreatorAuthorizationSetup
              key={`${draftId}:ethereum`}
              draftId={draftId}
              canStartNewDraft={canStartPasswordFirstDraft}
              startingNewDraft={transitionBusy}
              onStartNewDraft={startPasswordFirstDraft}
              onReady={(authorization, creatorPassword) => {
                setPasswordAuthorization({ draftId, authorization, creatorPassword });
              }}
            />}
            {passwordAuthorizationPrepared && passwordAuthorization && <EthereumMainnetLaunchExecutor
              draftId={draftId}
              authorization={passwordAuthorization.authorization}
              creatorPassword={passwordAuthorization.creatorPassword}
              tokenName={draft.name}
              tokenSymbol={draft.symbol}
              fundingOrder={{
                ...flowState,
                launchResult: flowState.launchResult && "poolId" in flowState.launchResult
                  ? flowState.launchResult
                  : null,
              }}
              fundingQrDataUrl={fundingQrDataUrl}
              onCreateFundingOrder={requestEthereumFundingOrder}
              initialResult={ethereumLaunchResult ?? (
                flowState.launchResult && "poolId" in flowState.launchResult
                  ? flowState.launchResult
                  : null
              )}
              onLaunched={(result) => {
                setEthereumLaunchResult(result);
                setFlowState((current) => ({ ...current, launchStatus: "launched", launchResult: result }));
              }}
              onContinue={() => {
                completeRecoveryDraft();
              }}
            />}
            {recoveryCapsuleDownloaded && ethereumLaunchResult && <section className="launch-progress-section" role="status">
              <h3>Ethereum recovery capsule downloaded</h3>
              <p>The .qrc file contains the launch password, creator private key, and H100–H0 proof chains.</p>
            </section>}
            {fundingError && <p className="creator-inline-error" role="alert">{fundingError}</p>}
          </section>
        </div>}

        {step === 1 && flowState.detailsComplete && selectedMode === "pons-v2" && <div className="wizard-form" role="tabpanel" id="launch-step-panel-1">
          <section className="launch-progress-section local-launch-panel" aria-labelledby="pons-mainnet-launch-heading">
            <h2 id="pons-mainnet-launch-heading">Robinhood mainnet launch</h2>
            <p>This is a walletless launch. The creator wallet is generated from password authorization; a separate wallet connection is not needed.</p>
            <div className="review-grid">
              <DetailLine label="Creator wallet">
                {passwordAuthorizationPrepared && passwordAuthorization
                  ? <CopyAddress value={passwordAuthorization.authorization.creatorAddress} label="Copy generated creator address" />
                  : <span>Created during password setup</span>}
              </DetailLine>
              <DetailLine label="Launch route"><span>Pons V2 · Robinhood · chain ID 4663</span></DetailLine>
              <DetailLine label="Token"><span>{draft.name} ({draft.symbol})</span></DetailLine>
              <DetailLine label="Password authorization">
                <span>{recoveryCapsuleDownloaded
                  ? "Recovery capsule downloaded"
                  : ponsLaunchResult
                    ? "Launch confirmed; recovery capsule required"
                    : passwordAuthorizationPrepared
                      ? "Password authorization prepared; capsule follows launch"
                      : "Not prepared"}</span>
              </DetailLine>
            </div>
            {!passwordAuthorizationPrepared && draftId && <PasswordCreatorAuthorizationSetup
              key={draftId}
              draftId={draftId}
              canStartNewDraft={canStartPasswordFirstDraft}
              startingNewDraft={transitionBusy}
              onStartNewDraft={startPasswordFirstDraft}
              onReady={(authorization, creatorPassword) => {
                setPasswordAuthorization({ draftId, authorization, creatorPassword });
              }}
            />}
            {passwordAuthorizationPrepared && passwordAuthorization && <PonsMainnetLaunchExecutor
              draftId={draftId}
              authorization={passwordAuthorization.authorization}
              tokenName={draft.name}
              tokenSymbol={draft.symbol}
              fundingOrder={{
                ...flowState,
                launchResult: flowState.launchResult && "curveAddress" in flowState.launchResult
                  ? flowState.launchResult
                  : null,
              }}
              fundingQrDataUrl={fundingQrDataUrl}
              onCreateFundingOrder={requestFundingOrder}
              initialResult={ponsLaunchResult}
              onLaunched={setPonsLaunchResult}
            />}
            {passwordAuthorizationPrepared && passwordAuthorization && ponsLaunchResult && !recoveryCapsuleDownloaded && <>
              <dialog
                id="post-launch-recovery-dialog"
                ref={recoveryCapsuleDialogRef}
                className="launch-recovery-dialog"
                aria-label="Post-launch recovery capsule"
                onCancel={(event) => {
                  event.preventDefault();
                }}
              >
                <div className="launch-recovery-dialog-toolbar">
                  <span>Launch completed</span>
                  <div className="launch-recovery-dialog-token">
                    <code>{ponsLaunchResult.tokenAddress}</code>
                    {buildPonsTokenUrl(ponsLaunchResult.tokenAddress) && (
                      <a href={buildPonsTokenUrl(ponsLaunchResult.tokenAddress)!} target="_blank" rel="noopener noreferrer">
                        View on Pons <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
                <PostLaunchRecoveryCapsule
                  authorization={passwordAuthorization.authorization}
                  creatorPassword={passwordAuthorization.creatorPassword}
                  launch={ponsLaunchResult}
                  onContinue={() => {
                    completeRecoveryDraft();
                  }}
                />
              </dialog>
            </>}
            {recoveryCapsuleDownloaded && <section className="launch-progress-section" role="status">
              <h3>Offline recovery capsule downloaded</h3>
              <p>The .qrc file contains the launch password, creator private key, and H100–H0 proof chains.</p>
            </section>}
            {fundingError && <p className="creator-inline-error" role="alert">{fundingError}</p>}
          </section>
        </div>}

        {step === 1 && flowState.detailsComplete && selectedMode === "multichain" && <div className="wizard-form" role="tabpanel" id="launch-step-panel-1">
          <label className="initial-buy-select">
            Pons V2 initial buy
            <select value={initialBuyEth} onChange={(event) => setInitialBuyEth(event.target.value)} aria-label="Requested initial-buy amount" disabled={multichainBuyLocked}>
              {MULTICHAIN_LAUNCH_PRESETS.map((preset) => <option key={preset.initialBuyEth} value={preset.initialBuyEth}>
                {preset.initialBuyEth} ETH · Ethereum reserve {preset.ethereumBridgeReservePercent}%
              </option>)}
            </select>
            <div className="bridge-reserve-note" role="note">
              {(() => {
                const selected = getMultichainLaunchPreset(initialBuyEth);
                return selected
                  ? `Fund the same creator address separately on both networks. Robinhood requires ${PONS_REQUIRED_CREATOR_DEPOSIT_ETH} ETH plus the ${selected.initialBuyEth} ETH buy; Ethereum requires ${ETHEREUM_FIXED_LAUNCH_DEPOSIT_ETH} ETH. The Pons buy goes directly to the Robinhood Bridge Vault. Ethereum reserves ${selected.ethereumBridgeReservePercent}% (${Number(BigInt(selected.ethereumBridgeReserveTokens)).toLocaleString()} tokens) and seeds the remainder into V4. Bridge inventory cannot be claimed by the creator.`
                  : "Select a supported preset to view the matching Ethereum bridge reserve.";
              })()}
            </div>
          </label>
          <MultichainMainnetLaunchFlow
            key={`${draftId}:${initialBuyEth}`}
            draftId={draftId}
            tokenName={draft.name}
            tokenSymbol={draft.symbol}
            initialBuyEth={initialBuyEth}
            canStartNewDraft={canStartPasswordFirstDraft}
            startingNewDraft={transitionBusy}
            onStartNewDraft={startPasswordFirstDraft}
            onInitialBuyLocked={() => setMultichainBuyLocked(true)}
            onCapsuleDownloaded={(ponsResult, ethereumResult) => {
              completeRecoveryDraft();
            }}
          />
        </div>}

        <div className="wizard-actions">
          <button className="button button-secondary" onClick={() => setStep(0)} disabled={step === 0 || Boolean(ponsLaunchResult)} data-testid="button-wizard-back"><ArrowLeft size={15} /> Edit details</button>
          {step === 0
            ? <button className="button button-primary" onClick={continueFromDetails} disabled={!detailsValid || !draftId || transitionBusy} data-testid="button-wizard-next">{transitionBusy ? "Saving and verifying…" : "Continue"} <ArrowRight size={15} /></button>
            : null}
        </div>
      </section>
    </div>
  </>;
}

function MyLaunchesPage() {
  return <><PageHeader title="Your launch drafts" description="Saved token drafts." />
    <div className="unavailable-hero"><div className="unavailable-symbol"><Wallet size={24} /></div><h2>Launch history isn’t available yet.</h2><div className="unavailable-actions"><Link href="/launch-token" className="text-link">Create a launch draft <ArrowRight size={14} /></Link></div></div>
  </>;
}

function RewardsPage() {
  const { walletAddress, walletChainId, walletError, connecting, connectWallet } = useArmoreumWallet();
  const [selectedChain, setSelectedChain] = useState<1 | 4663>(4663);
  const [payoutAddress, setPayoutAddress] = useState("");
  const [unjailAmount, setUnjailAmount] = useState("0.01");
  const connectedChainId = walletChainId ? Number.parseInt(walletChainId, 16) : null;
  const chainLabel = selectedChain === 1 ? "Ethereum" : "Robinhood";
  const vaultConfigured = false;

  return <>
    <PageHeader title="Creator rewards & Unjail" description="Review vault balances and payout authorization." action={<StatusPill tone="warn">Not deployed</StatusPill>} />
    <section className="panel reward-vault-panel">
      <div className="reward-vault-heading">
        <div><h2>Reward vault</h2><p>{chainLabel} · chain ID {selectedChain}</p></div>
        <StatusPill tone="warn">Unavailable</StatusPill>
      </div>
      <p className="reward-vault-status">
        No verified reward-vault address is configured for this network. Registration and payouts are disabled.
      </p>
      <div className="reward-vault-metrics">
        <div><span>Accrued creator rewards</span><strong>Unavailable</strong></div>
        <div><span>Protected payout address</span><strong>Not registered</strong></div>
        <div><span>Unjail eligibility</span><strong>Unavailable</strong></div>
      </div>
      <div className="reward-vault-controls">
        <label>
          <span>Network</span>
          <select value={selectedChain} onChange={(event) => setSelectedChain(Number(event.target.value) as 1 | 4663)}>
            <option value={1}>Ethereum · 1</option>
            <option value={4663}>Robinhood · 4663</option>
          </select>
        </label>
        <label>
          <span>New protected payout address</span>
          <input
            autoComplete="off"
            value={payoutAddress}
            onChange={(event) => setPayoutAddress(event.target.value)}
            placeholder="0x…"
            aria-label="New protected payout address"
            data-testid="input-protected-payout"
          />
        </label>
        <label>
          <span>jailETH to burn · ETH payout</span>
          <input
            inputMode="decimal"
            min="0.01"
            step="0.01"
            type="number"
            value={unjailAmount}
            onChange={(event) => setUnjailAmount(event.target.value)}
            aria-label="Unjail amount"
            data-testid="input-unjail-amount"
          />
        </label>
      </div>
      <div className="reward-vault-summary">
        <span>Payout policy in contract source</span>
        <strong>1 jailETH burned : 1 wei of backed ETH paid</strong>
        <small>Paid from accrued creator-fee backing; the contract checks available liabilities before payment.</small>
      </div>
      <div className="reward-vault-actions">
        <div>
          <span>{walletAddress ? `Wallet ${shorten(walletAddress, 7, 5)}` : "Wallet not connected"}</span>
          {walletAddress && <small>{connectedChainId === selectedChain ? "Selected network" : `Wallet network ${connectedChainId ?? "unavailable"}`}</small>}
          {walletError && <small className="reward-vault-error">{walletError}</small>}
        </div>
        {!walletAddress && <button className="button button-secondary" onClick={() => void connectWallet()} disabled={connecting} data-testid="button-connect-rewards-wallet">{connecting ? "Connecting…" : "Connect wallet"}</button>}
        <button className="button button-secondary" disabled={!vaultConfigured || !walletAddress || connectedChainId !== selectedChain || !/^0x[a-fA-F0-9]{40}$/.test(payoutAddress)} data-testid="button-register-protected-payout">Register payout address</button>
        <button className="button button-primary" disabled={!vaultConfigured || !walletAddress || connectedChainId !== selectedChain} data-testid="button-request-unjail">Request Unjail</button>
      </div>
      <div className="reward-transaction-state" aria-label="Unjail transaction status">
        {["Awaiting authorization", "Unjail submitted", "Burn confirmed", "ETH payout confirmed", "Completed"].map((state, index) => (
          <div key={state}><span>{String(index + 1).padStart(2, "0")}</span><strong>{state}</strong><small>Not started</small></div>
        ))}
      </div>
    </section>
  </>;
}

function ActivityPage() {
  const [launchId, setLaunchId] = useState('');
  const [eventType, setEventType] = useState('');
  const [cursor, setCursor] = useState('');
  const params = useMemo<ListActivityParams>(() => ({ ...(launchId.trim() ? { launchId: launchId.trim() } : {}), ...(eventType ? { eventType } : {}), ...(cursor ? { cursor } : {}) }), [launchId, eventType, cursor]);
  const { data, isLoading, isError, refetch } = useListActivity(params, { query: { queryKey: getListActivityQueryKey(params) } });
  return <><PageHeader title="Launch & reward activity" description="Recent launch and reward events." />
    <div className="panel activity-panel"><div className="filter-bar"><label className="search-box"><Search size={17} /><input value={launchId} onChange={(e) => { setLaunchId(e.target.value); setCursor(''); }} placeholder="Filter by launch ID" aria-label="Filter by launch ID" data-testid="input-activity-launch" /></label><label className="search-box event-type-input"><FileCheck2 size={16} /><input value={eventType} onChange={(e) => { setEventType(e.target.value); setCursor(''); }} placeholder="Filter by indexed event type" aria-label="Filter by event type" data-testid="input-event-type" /></label></div>
       <div className="explorer-meta"><span>{isLoading ? 'Loading activity…' : `${data?.items?.length ?? 0} events`}</span><span>{data?.items?.length ?? 0} results</span></div>
      <QueryState loading={isLoading} error={isError} retry={() => void refetch()} empty={!data?.items?.length} message="No events were returned for these filters." />
      {!isLoading && !isError && data?.items?.length ? <><ActivityTable items={data.items} />{data.nextCursor && <button className="button button-secondary load-more" onClick={() => setCursor(data.nextCursor || '')} data-testid="button-next-activity-page">Next page <ArrowDownRight size={15} /></button>}</> : null}
      </div>
  </>;
}
function ActivityTable({ items }: { items: ActivityEvent[] }) {
  return <div className="table-wrap"><table className="activity-table"><thead><tr><th>Event</th><th>Launch</th><th>Network</th><th>Amount</th><th>Transaction</th><th>Time (UTC)</th><th>Status</th></tr></thead><tbody>{items.map((event) => {
    const transactionUrl = getExplorerTransactionUrl(event.networkId, event.transactionHash);
    return <tr key={event.id} data-testid={`row-activity-${event.id}`}><td><span className="event-marker"><FileCheck2 size={15} /></span><strong>{pretty(event.eventType)}</strong></td><td>{event.launchId ? <Link href={`/launch/${encodeURIComponent(event.launchId)}`} className="text-link">{event.launchLabel || shorten(event.launchId, 9, 4)}</Link> : event.launchLabel || unavailableText}</td><td>{event.networkId ? NETWORKS[event.networkId].name : unavailableText}</td><td className="mono">{event.amount ?? unavailableText} {event.assetSymbol || ''}</td><td><ExternalAddress href={transactionUrl}>{shorten(event.transactionHash, 8, 6)}</ExternalAddress></td><td>{fmtDate(event.timestamp)}</td><td><StatusPill tone={event.status === 'confirmed' ? 'good' : event.status === 'failed' ? 'bad' : 'warn'}>{pretty(event.status)}</StatusPill></td></tr>;
  })}</tbody></table></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><AppShell><Switch>
    <Route path="/" component={OverviewPage} /><Route path="/explore" component={ExplorePage} />
    <Route path="/defi-tools" component={DeFiToolsPage} />
    <Route path="/defi-tools/jailswap" component={JailSwapPage} /><Route path="/defi-tools/bridge" component={BridgePage} />
    <Route path="/jailswap" component={JailSwapPage} /><Route path="/bridge" component={BridgePage} /><Route path="/bridge-explorer" component={BridgeExplorerPage} />
    <Route path="/launch-token" component={LaunchWizardPage} /><Route path="/creator" component={CreatorPage} />
    <Route path="/my-jail" component={MyJailRoute} />
    <Route path="/my-launches" component={CreatorPage} /><Route path="/rewards" component={RewardsPage} /><Route path="/activity" component={ActivityPage} />
    <Route path="/launchpad-armoreum" component={LaunchpadInfoPage} /><Route path="/jailswap-armoreum" component={JailSwapInfoPage} /><Route path="/bridge-armoreum" component={BridgeInfoPage} /><Route path="/status-armoreum" component={StatusInfoPage} /><Route path="/integrations-armoreum" component={IntegrationsInfoPage} /><Route path="/about-armoreum" component={AboutInfoPage} /><Route path="/privacy-armoreum" component={PrivacyInfoPage} /><Route path="/terms-armoreum" component={TermsInfoPage} /><Route path="/contact-armoreum" component={ContactInfoPage} />
    <Route path="/security" component={SecurityPage} /><Route path="/docs" component={DocsPage} /><Route path="/docs/:slug" component={DocsPage} /><Route path="/documentation" component={DocsPage} />
    <Route path="/launch/:launchId" component={LaunchDetailPage} /><Route component={NotFound} />
  </Switch></AppShell></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
