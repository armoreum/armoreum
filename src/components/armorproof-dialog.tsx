import { useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { Check, ChevronDown, Copy, Layers, ShieldAlert, X } from 'lucide-react';
import { useGetArmorProof, getGetArmorProofQueryKey } from '@workspace/api-client-react';
import type { ArmorProofCreator } from '@workspace/api-client-react';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';
import { ArmorProofTokenLogo } from './armorproof-token-logo';
import './armorproof-dialog.css';

const isWei = (w: string | null): w is string => !!w && /^\d+$/.test(w);
function exact(w: string | null) {
  if (!isWei(w)) return null;
  const v = BigInt(w);
  const f = (v % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return `${(v / 10n ** 18n).toString()}${f ? `.${f}` : ''}`;
}
function compact(w: string | null) {
  if (!isWei(w)) return null;
  const v = BigInt(w);
  if (v === 0n) return '0';
  const unit = 10n ** 14n;
  const t = v / unit;
  if (t === 0n) return '<0.0001';
  const whole = (t / 10000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const f = (t % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
  return f ? `${whole}.${f}` : whole;
}
const chain = (id: number) => (id === 1 ? 'Ethereum' : id === 4663 ? 'Robinhood' : `Chain ${id}`);

function Amount({ wei }: { wei: string | null }) {
  const c = compact(wei);
  if (c === null) return <span className="ap-bal">Unavailable</span>;
  const label = `${exact(wei)} JailETH`;
  return <span className="ap-bal" title={label} aria-label={label}><span className="ap-num">{c}</span> <span className="ap-unit">JailETH</span></span>;
}

function Creator({ c, i }: { c: ArmorProofCreator; i: number }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [open, setOpen] = useState(false);
  const copy = async () => {
    try { await copyTextToClipboard(c.creatorPrivateKey); setState('ok'); } catch { setState('fail'); setOpen(true); }
    window.setTimeout(() => setState('idle'), 2500);
  };
  const first = c.vaults[0];
  const more = new Set(c.vaults.map((v) => `${v.tokenName}\u0000${v.tokenSymbol}`)).size - 1;
  const chains = Array.from(new Set(c.vaults.map((v) => chain(v.chainId))));
  const panelId = `ap-panel-${c.creatorAddress}`;
  return <li className={open ? 'ap-card is-open' : 'ap-card'}>
    <span className="ap-idx" aria-hidden="true">{i + 1}</span>
    <div className="ap-token">
      <ArmorProofTokenLogo key={first?.tokenImageUrl ?? ''} src={first?.tokenImageUrl} name={first?.tokenName ?? 'Token'} />
      <p className="ap-id" data-testid={`armorproof-token-${c.creatorAddress}`}>
        <strong>{first ? first.tokenName : 'Unknown token'}</strong>
        <span>{first ? `${first.tokenSymbol}${more > 0 ? ` +${more} more` : ''}` : ''} · {chains.join(', ')}</span>
      </p>
    </div>
    <div className="ap-net">{chains.map((n) => <span key={n}>{n}</span>)}</div>
    <div className="ap-balance">
      <span className="ap-bal-label">Available</span>
      <Amount wei={c.availableJailEthWei} />
      {c.balanceStatus === 'partial' && <span className="ap-status">Total unavailable while at least one vault cannot be read. Not zero.</span>}
      {c.balanceStatus === 'unavailable' && <span className="ap-status">Balance could not be verified. Not zero.</span>}
    </div>
    <code className="ap-preview" aria-hidden="true">{c.creatorPrivateKey}</code>
    <div className="ap-keyarea">
      <div className="ap-keyhead"><span>Creator private key</span><span className="ap-pill">Publicly disclosed</span></div>
      <code className="ap-key" data-testid={`armorproof-key-${c.creatorAddress}`}>{c.creatorPrivateKey}</code>
    </div>
    <span className="ap-count">{c.vaults.length}</span>
    <div className="ap-actions">
      <button type="button" className="ap-copy" onClick={copy} data-testid={`armorproof-copy-${c.creatorAddress}`}>
        {state === 'ok' ? <Check size={14} /> : <Copy size={14} />} Copy full key
      </button>
      <span role="status" className={state === 'fail' ? 'ap-ok ap-bad' : 'ap-ok'}>
        {state === 'ok' ? 'Copied' : state === 'fail' ? 'Copy failed. Select the key shown above.' : ''}
      </span>
    </div>
    <button type="button" className="ap-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}
      data-testid={`armorproof-toggle-${c.creatorAddress}`}>
      <Layers size={16} aria-hidden="true" />
      <span className="ap-toggle-label">Creator Vaults in scope ({c.vaults.length})</span>
      <ChevronDown size={18} className="ap-chev" aria-hidden="true" />
    </button>
    <div className="ap-panel" id={panelId} hidden={!open} data-testid={`armorproof-vaults-${c.creatorAddress}`}>
      <ul className="ap-vlist">{c.vaults.map((v) => <li key={`${v.chainId}-${v.vaultAddress}`}>
        <span className="ap-vname"><strong>{v.tokenSymbol}</strong> {chain(v.chainId)} Creator Vault</span>
        <code className="ap-addr">{v.vaultAddress}</code>
        <Amount wei={v.availableJailEthWei} /></li>)}</ul>
    </div>
  </li>;
}

export function ArmorProofDialog() {
  const [open, setOpen] = useState(false);
  const q = useGetArmorProof({ query: {
    queryKey: getGetArmorProofQueryKey(), enabled: open, refetchInterval: 100000,
    refetchIntervalInBackground: false, staleTime: 0, refetchOnMount: 'always',
  } });
  const data = q.data;
  return <D.Root open={open} onOpenChange={setOpen}>
    <D.Trigger asChild>
      <button type="button" className="landing-button secondary" data-testid="armorproof-trigger">ArmorProof</button>
    </D.Trigger>
    <D.Portal>
      <D.Overlay className="ap-overlay" />
      <div className="ap-stage">
        <D.Content className="ap-modal" data-testid="armorproof-dialog">
          <header className="ap-modal-header">
            <D.Title className="ap-title">ArmorProof</D.Title>
            <D.Close className="ap-close" aria-label="Close ArmorProof" data-testid="armorproof-close"><X size={18} /></D.Close>
          </header>
          <div className="ap-scroll" data-testid="armorproof-scroll">
            <D.Description>Can you drain the listed Creator Vaults using only the published keys below?</D.Description>
            <div className="ap-warn"><p><ShieldAlert size={14} style={{ display: 'inline', marginRight: 6 }} aria-hidden="true" /><strong>Never fund these wallets.</strong></p>
              <p>These creator wallets are publicly controlled. Anything sent to them can be taken by anyone.</p></div>
            {q.isLoading && <div aria-label="Loading"><div className="ap-sk" /><div className="ap-sk" /><div className="ap-sk" /></div>}
            {q.isError && <div className="ap-warn" role="alert"><p>Could not load ArmorProof balances. Balances are unknown, not zero.</p>
              <button type="button" className="ap-copy" onClick={() => q.refetch()} data-testid="armorproof-retry">Retry</button></div>}
            {data && data.items.length === 0 && <p>No completed public creators are listed yet.</p>}
            {data && data.items.length > 0 && <div className="ap-table-wrap" data-testid="armorproof-table">
              <div className="ap-head" aria-hidden="true"><span>#</span><span>Token</span><span>Network</span><span>Creator private key</span><span>Available JailETH</span><span>Vaults</span><span>Actions</span></div>
              <ul className="ap-list">{data.items.map((c, i) => <Creator key={c.creatorAddress} c={c} i={i} />)}</ul></div>}
          </div>
        </D.Content>
      </div>
    </D.Portal>
  </D.Root>;
}
