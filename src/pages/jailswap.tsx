import { AlertTriangle, ArrowDownUp, ChevronDown, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandTextTree } from '@/lib/brand-text';
import './defi-flow.css';

export default function JailSwapPage() {
  return (
    <BrandTextTree>
      <div className="defi-flow-page" data-testid="page-jailswap">
        <header className="defi-flow-header">
          <div className="defi-flow-title-row">
            <span className="defi-flow-title-icon" aria-hidden="true">
              <ShieldCheck size={24} strokeWidth={1.55} />
            </span>
            <div className="defi-flow-title-copy">
              <span className="defi-flow-eyebrow">ASSET OPERATIONS</span>
              <h1>JailSwap</h1>
              <p>Protected Asset Swaps</p>
            </div>
            <span className="defi-flow-preview-status">
              <span aria-hidden="true" />
              UI preview · not connected
            </span>
          </div>

          <p className="defi-flow-intro">
            Design goal: add an authorization layer to swaps for supported assets. Jail and Unjail controls can protect only assets and transaction paths where the applicable smart contracts enforce them. This preview has no verified JailSwap contract or backend connection.
          </p>
        </header>

        <div className="defi-flow-layout">
          <section className="defi-flow-card jailswap-card" aria-labelledby="jailswap-form-title">
            <div className="defi-flow-card-heading">
              <div>
                <span className="defi-flow-card-kicker">JAILSWAP PREVIEW</span>
                <h2 id="jailswap-form-title">Asset swap</h2>
              </div>
              <span className="defi-flow-card-status">Unavailable</span>
            </div>

            <fieldset className="defi-flow-fieldset" disabled aria-describedby="jailswap-disabled-note">
              <label className="defi-flow-field">
                <span>From</span>
                <div className="defi-flow-input-row">
                  <input aria-label="JailSwap amount to send" placeholder="0.00" readOnly data-testid="input-jailswap-send-amount" />
                  <button type="button" className="defi-flow-asset-select" aria-label="Select sending asset" data-testid="button-jailswap-select-source">
                    Select asset <ChevronDown size={15} aria-hidden="true" />
                  </button>
                </div>
              </label>

              <div className="defi-flow-switch-mark" aria-hidden="true">
                <ArrowDownUp size={17} strokeWidth={1.6} />
              </div>

              <label className="defi-flow-field">
                <span>To</span>
                <div className="defi-flow-input-row">
                  <input aria-label="JailSwap estimated amount" placeholder="Quote unavailable" readOnly data-testid="input-jailswap-receive-amount" />
                  <button type="button" className="defi-flow-asset-select" aria-label="Select receiving asset" data-testid="button-jailswap-select-destination">
                    Select asset <ChevronDown size={15} aria-hidden="true" />
                  </button>
                </div>
              </label>

              <div className="defi-flow-summary-row">
                <span>Quote</span>
                <span>Unavailable · no backend connection</span>
              </div>
              <button type="button" className="defi-flow-submit" disabled data-testid="button-jailswap-unavailable">
                Swap unavailable
              </button>
            </fieldset>
            <p className="defi-flow-inline-note" id="jailswap-disabled-note">
              Asset selection, quotes, authorization, and transaction submission are disabled in this UI preview.
            </p>
          </section>

          <aside className="defi-flow-info-card" aria-labelledby="jailswap-security-title">
            <div className="defi-flow-info-icon" aria-hidden="true">
              <LockKeyhole size={19} strokeWidth={1.55} />
            </div>
            <span className="defi-flow-eyebrow">WITHIN JAIlSWAP</span>
            <h2 id="jailswap-security-title">Jail / Unjail authorization</h2>
            <p>
              These controls are part of the JailSwap protection mechanism, not separate features. Protection can apply only to supported assets and transaction paths enforced by the applicable smart contracts.
            </p>
            <p>The normal Swap, Jail, and Unjail flow uses your password and connected wallet. Uploading a recovery file is not required. Transaction authorization remains unavailable in this preview.</p>
            <div className="defi-flow-caution" role="note">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                This preview does not protect assets or validate private-key exposure. Assets outside a verified contract path may remain controllable by the wallet key.
              </span>
            </div>
            <div className="defi-flow-info-foot">
              <KeyRound size={14} aria-hidden="true" />
              <span>Contract and backend verification pending</span>
            </div>
          </aside>
        </div>
      </div>
    </BrandTextTree>
  );
}
