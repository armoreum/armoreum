import { ArrowDownToLine, ArrowUpFromLine, CircleAlert, CircleCheck, Coins, LockKeyhole, RefreshCw, Shield, Wallet } from 'lucide-react';
import './my-jail-page.css';

export type MyJailAction = 'deposit' | 'buy' | 'sell' | 'unjail' | 'redeem' | 'withdraw';
export type MyJailStatus = 'disconnected' | 'unsupported-network' | 'loading' | 'no-vault' | 'ready' | 'error';

export interface MyJailPosition {
  launchId: string;
  name: string;
  symbol: string;
  tokenAddress: string;
  jailTokenAddress: string;
  jailTokenBalance: string | null;
  jailEthAddress: string;
  jailEthBalance: string | null;
}

export interface MyJailPageProps {
  status: MyJailStatus;
  walletAddress: string | null;
  chainName: string | null;
  chainId: number | null;
  walletEthBalance: string | null;
  vaultAddress: string | null;
  vaultEthBalance: string | null;
  positions: MyJailPosition[];
  errorMessage: string | null;
  busyAction: string | null;
  networkSwitching: number | null;
  networkSwitchError: string | null;
  onConnect: () => void;
  onSelectChain: (chainId: number) => void;
  onCreateVault: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  hasMoreLaunches: boolean;
  onOpenAction: (action: MyJailAction, launchId?: string) => void;
}

const actionLabels: Record<MyJailAction, string> = {
  deposit: 'Deposit',
  buy: 'Buy',
  sell: 'Sell',
  unjail: 'Unjail',
  redeem: 'Redeem',
  withdraw: 'Withdraw',
};

function shown(value: string | number | null | undefined, suffix = '') {
  return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`;
}

function shortAddress(value: string | null | undefined) {
  if (!value) return '—';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function hasPositiveBalance(value: string | null | undefined) {
  return value !== null && value !== undefined && value !== '' && Number(value) > 0;
}

function ActionButton({
  action,
  launchId,
  onOpenAction,
  disabled,
  primary = false,
}: {
  action: MyJailAction;
  launchId?: string;
  onOpenAction: MyJailPageProps['onOpenAction'];
  disabled: boolean;
  primary?: boolean;
}) {
  const Icon = action === 'deposit' || action === 'buy' ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <button
      className={`jail-action ${primary ? 'jail-action-primary' : ''}`}
      type="button"
      disabled={disabled}
      data-testid={`jail-action-${action}${launchId ? `-${launchId}` : ''}`}
      onClick={() => onOpenAction(action, launchId)}
    >
      <Icon size={14} aria-hidden="true" />
      {actionLabels[action]}
    </button>
  );
}

function StatePanel({ status, errorMessage, onConnect, onCreateVault, onRefresh, busy }: {
  status: MyJailStatus;
  errorMessage: string | null;
  onConnect: () => void;
  onCreateVault: () => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  if (status === 'ready') return null;
  if (status === 'loading') {
    return (
      <section className="jail-state-panel jail-loading" aria-live="polite" aria-busy="true">
        <div className="jail-state-icon"><RefreshCw size={19} aria-hidden="true" /></div>
        <div><h2>Reading your vault</h2><p>Checking wallet and protected asset balances.</p></div>
        <div className="jail-skeletons" aria-hidden="true"><i /><i /><i /></div>
      </section>
    );
  }
  if (status === 'disconnected') {
    return (
      <section className="jail-state-panel" aria-labelledby="jail-state-title">
        <div className="jail-state-icon"><Wallet size={19} aria-hidden="true" /></div>
        <div className="jail-state-copy">
          <span className="jail-eyebrow">Wallet required</span>
          <h2 id="jail-state-title">Your assets stay yours.</h2>
          <p>Connect the wallet that owns your Armoreum Jail assets to view its isolated personal vault.</p>
        </div>
        <button className="jail-action jail-action-primary" type="button" onClick={onConnect} data-testid="jail-connect-wallet">
          <Wallet size={15} aria-hidden="true" /> Connect wallet
        </button>
      </section>
    );
  }
  if (status === 'unsupported-network') {
    return (
      <section className="jail-state-panel jail-state-warning" aria-labelledby="jail-state-title">
        <div className="jail-state-icon"><CircleAlert size={19} aria-hidden="true" /></div>
        <div className="jail-state-copy">
          <span className="jail-eyebrow">Network unavailable</span>
          <h2 id="jail-state-title">Switch to a supported network.</h2>
          <p>The connected wallet is on a network that cannot be used to read this vault.</p>
        </div>
        <button className="jail-action" type="button" disabled={busy} onClick={onRefresh} data-testid="jail-refresh-network">
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </section>
    );
  }
  if (status === 'no-vault') {
    return (
      <section className="jail-state-panel" aria-labelledby="jail-state-title">
        <div className="jail-state-icon"><LockKeyhole size={19} aria-hidden="true" /></div>
        <div className="jail-state-copy">
          <span className="jail-eyebrow">Personal vault</span>
          <h2 id="jail-state-title">No vault is attached to this wallet.</h2>
          <p>Create your isolated vault to hold ETH and protected Jail receipts under your wallet ownership.</p>
        </div>
        <button className="jail-action jail-action-primary" type="button" disabled={busy} onClick={onCreateVault} data-testid="jail-create-vault">
          <LockKeyhole size={14} aria-hidden="true" /> Create personal vault
        </button>
      </section>
    );
  }
  return (
    <section className="jail-state-panel jail-state-error" role="alert" aria-labelledby="jail-state-title">
      <div className="jail-state-icon"><CircleAlert size={19} aria-hidden="true" /></div>
      <div className="jail-state-copy">
        <span className="jail-eyebrow">Could not load vault</span>
        <h2 id="jail-state-title">Your asset view is unavailable.</h2>
        <p>{errorMessage || 'The vault data could not be read. Try refreshing the view.'}</p>
      </div>
      <button className="jail-action" type="button" disabled={busy} onClick={onRefresh} data-testid="jail-retry">
        <RefreshCw size={14} aria-hidden="true" /> Try again
      </button>
    </section>
  );
}

export function MyJailPage({
  status, walletAddress, chainName, chainId, walletEthBalance, vaultAddress, vaultEthBalance,
  positions, errorMessage, busyAction, networkSwitching, networkSwitchError,
  onConnect, onSelectChain, onCreateVault, onRefresh, onOpenAction,
  onLoadMore, hasMoreLaunches,
}: MyJailPageProps) {
  const ready = status === 'ready';
  const busy = busyAction !== null;

  return (
    <main className="content my-jail-page">
      <header className="jail-heading">
        <div>
          <div className="jail-kicker"><span className="jail-kicker-mark"><Shield size={14} aria-hidden="true" /></span> PERSONAL ASSET</div>
          <h1>Jail Bank</h1>
          <p>Your assets stay protected in your personal vault, secured and under your control.</p>
        </div>
        <button
          className="jail-icon-button"
          type="button"
          onClick={onRefresh}
          disabled={busy || status === 'disconnected' || status === 'loading'}
          aria-label="Refresh vault balances"
          title="Refresh balances"
          data-testid="jail-refresh"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="jail-context-bar">
        <div className="jail-context-wallet">
          <span className={`jail-status-light ${walletAddress ? 'is-connected' : ''}`} aria-hidden="true" />
          <span>{walletAddress ? shortAddress(walletAddress) : 'Wallet not connected'}</span>
        </div>
        <span className="jail-context-divider" aria-hidden="true" />
        <span className="jail-context-network">{chainName || 'Network not detected'}{chainId !== null ? ` · ${chainId}` : ''}</span>
        {busyAction && <span className="jail-busy-label" role="status">{busyAction}</span>}
      </div>

      <nav className="jail-chain-picker" aria-label="Choose Jail Bank network">
        <span className="jail-chain-picker-label">CHAIN</span>
        <button
          type="button"
          className={`jail-chain-option ${chainId === 1 ? 'is-selected' : ''}`}
          aria-pressed={chainId === 1}
          disabled={networkSwitching !== null}
          onClick={() => onSelectChain(1)}
          data-testid="my-jail-chain-ethereum"
        >
          Ethereum <small>1</small>
          {networkSwitching === 1 && <span className="jail-chain-progress">Switching…</span>}
        </button>
        <button
          type="button"
          className={`jail-chain-option ${chainId === 4663 ? 'is-selected' : ''}`}
          aria-pressed={chainId === 4663}
          disabled={networkSwitching !== null}
          onClick={() => onSelectChain(4663)}
          data-testid="my-jail-chain-robinhood"
        >
          Robinhood <small>4663</small>
          {networkSwitching === 4663 && <span className="jail-chain-progress">Switching…</span>}
        </button>
      </nav>
      {networkSwitchError && <p className="my-jail-action-error jail-network-switch-error" role="alert">{networkSwitchError}</p>}

      <StatePanel status={status} errorMessage={errorMessage} onConnect={onConnect} onCreateVault={onCreateVault} onRefresh={onRefresh} busy={busy} />

      {ready && (
        <>
          <section className="jail-balance-grid" aria-label="ETH balances by location">
            <article className="jail-balance-card wallet-balance">
              <div className="jail-card-top"><span className="jail-balance-icon"><Wallet size={16} aria-hidden="true" /></span><span className="jail-location-tag">WALLET</span></div>
              <p className="jail-balance-label">Native ETH · connected wallet</p>
              <strong className="jail-balance-value">{shown(walletEthBalance)} <small>ETH</small></strong>
              <span className="jail-address">{shortAddress(walletAddress)}</span>
            </article>
            <article className="jail-balance-card vault-balance">
              <div className="jail-card-top"><span className="jail-balance-icon"><LockKeyhole size={16} aria-hidden="true" /></span><span className="jail-location-tag">PERSONAL VAULT</span></div>
              <p className="jail-balance-label">Native ETH · held in vault</p>
              <strong className="jail-balance-value">{shown(vaultEthBalance)} <small>ETH</small></strong>
              <span className="jail-address" title={vaultAddress || undefined}>{shortAddress(vaultAddress)}</span>
              <div className="jail-vault-actions">
                <ActionButton action="deposit" onOpenAction={onOpenAction} disabled={busy} primary />
                <ActionButton action="withdraw" onOpenAction={onOpenAction} disabled={busy} />
              </div>
            </article>
          </section>

          <section className="jail-positions" aria-labelledby="jail-positions-title">
            <div className="jail-section-heading">
              <div><span className="jail-eyebrow">ON-CHAIN RECEIPTS</span><h2 id="jail-positions-title">JailSwap markets &amp; holdings</h2></div>
              <span className="jail-position-count">{positions.length} {positions.length === 1 ? 'position' : 'positions'}</span>
            </div>
            {positions.length === 0 ? (
              <div className="jail-empty">
                <span className="jail-empty-mark"><Coins size={19} aria-hidden="true" /></span>
                <div><h3>No protected positions yet</h3><p>JailToken and JailETH receipts held by this vault will appear here.</p></div>
              </div>
            ) : (
              <div className="jail-position-list">
                {positions.map((position) => (
                  <article className="jail-position" key={position.launchId}>
                    <div className="jail-position-head">
                      <div className="jail-token-mark" aria-hidden="true">{position.symbol.slice(0, 1).toUpperCase() || '•'}</div>
                      <div className="jail-position-name">
                        <h3>{position.name || 'Unnamed launch'} <span>{position.symbol ? `$${position.symbol}` : ''}</span></h3>
                        <span className="jail-launch-id">Launch {shortAddress(position.launchId)}</span>
                      </div>
                      <div className="jail-position-actions">
                        <ActionButton action="buy" launchId={position.launchId} onOpenAction={onOpenAction} disabled={busy} />
                        <ActionButton action="sell" launchId={position.launchId} onOpenAction={onOpenAction} disabled={busy || !hasPositiveBalance(position.jailTokenBalance)} />
                      </div>
                    </div>
                    <div className="jail-receipts">
                      <div className="jail-receipt jail-token-receipt">
                        <div className="jail-receipt-heading"><span className="jail-receipt-symbol">JT</span><span>JailToken</span></div>
                        <strong>{shown(position.jailTokenBalance)}</strong>
                        <span className="jail-receipt-address" title={position.jailTokenAddress}>{shortAddress(position.jailTokenAddress)}</span>
                        <div className="jail-receipt-actions">
                          <ActionButton action="unjail" launchId={position.launchId} onOpenAction={onOpenAction} disabled={busy || !hasPositiveBalance(position.jailTokenBalance)} />
                          <ActionButton action="sell" launchId={position.launchId} onOpenAction={onOpenAction} disabled={busy || !hasPositiveBalance(position.jailTokenBalance)} />
                        </div>
                      </div>
                      <div className="jail-receipt jail-eth-receipt">
                        <div className="jail-receipt-heading"><span className="jail-receipt-symbol">JE</span><span>JailETH</span></div>
                        <strong>{shown(position.jailEthBalance)} <small>ETH</small></strong>
                        <span className="jail-receipt-address" title={position.jailEthAddress}>{shortAddress(position.jailEthAddress)}</span>
                        <div className="jail-receipt-actions">
                          <ActionButton action="redeem" launchId={position.launchId} onOpenAction={onOpenAction} disabled={busy || !hasPositiveBalance(position.jailEthBalance)} />
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {hasMoreLaunches && <button
              className="jail-action jail-load-more"
              type="button"
              onClick={onLoadMore}
              disabled={busy}
              data-testid="button-my-jail-load-more"
            >
              Load more launches
            </button>}
          </section>
          <footer className="jail-footnote"><CircleCheck size={14} aria-hidden="true" /><span>Balances are shown by custody location. Wallet ETH and vault ETH are separate holdings.</span></footer>
        </>
      )}
    </main>
  );
}

export default MyJailPage;
