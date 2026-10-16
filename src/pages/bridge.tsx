import { useState } from 'react';
import { AlertTriangle, ArrowLeftRight, ChevronDown, Clock3, Route, ShieldCheck } from 'lucide-react';
import { BrandTextTree } from '@/lib/brand-text';
import './defi-flow.css';

type BridgeDirection = 'robinhood-to-ethereum' | 'ethereum-to-robinhood';

export function LegacyBridgePreviewPage() {
  const [direction, setDirection] = useState<BridgeDirection>('robinhood-to-ethereum');
  const source = direction === 'robinhood-to-ethereum' ? 'Robinhood' : 'Ethereum';
  const destination = direction === 'robinhood-to-ethereum' ? 'Ethereum' : 'Robinhood';

  return (
    <BrandTextTree>
      <div className="defi-flow-page" data-testid="page-bridge">
        <header className="defi-flow-header">
          <div className="defi-flow-title-row">
            <span className="defi-flow-title-icon" aria-hidden="true">
              <ArrowLeftRight size={24} strokeWidth={1.55} />
            </span>
            <div className="defi-flow-title-copy">
              <span className="defi-flow-eyebrow">CROSS-CHAIN TRANSFERS</span>
              <h1>Bridge</h1>
              <p className="defi-flow-network-pair">
                <span>Robinhood</span>
                <span className="defi-flow-network-pair-icon" aria-hidden="true">
                  <ArrowLeftRight size={14} strokeWidth={1.8} />
                </span>
                <span>Ethereum</span>
              </p>
            </div>
            <span className="defi-flow-preview-status">
              <span aria-hidden="true" />
              UI preview · not connected
            </span>
          </div>

          <p className="defi-flow-intro">
            Planned transfer flow for supported assets between Robinhood and Ethereum, in either direction. Transfers, transaction tracking, and destination confirmation are not connected in this preview.
          </p>
        </header>

        <div className="defi-flow-layout">
          <section className="defi-flow-card bridge-card" aria-labelledby="bridge-form-title">
            <div className="defi-flow-card-heading">
              <div>
                <span className="defi-flow-card-kicker">TRANSFER PREVIEW</span>
                <h2 id="bridge-form-title">Route your transfer</h2>
              </div>
              <span className="defi-flow-card-status">Unavailable</span>
            </div>

            <div className="bridge-route-picker">
              <div className="bridge-network-field">
                <span>From</span>
                <strong>{source}</strong>
              </div>
              <button
                type="button"
                className="bridge-direction-toggle"
                aria-label="Reverse bridge direction"
                title="Reverse bridge direction"
                data-testid="button-bridge-reverse-direction"
                onClick={() => setDirection((current) => current === 'robinhood-to-ethereum' ? 'ethereum-to-robinhood' : 'robinhood-to-ethereum')}
              >
                <ArrowLeftRight size={17} aria-hidden="true" />
              </button>
              <div className="bridge-network-field">
                <span>To</span>
                <strong>{destination}</strong>
              </div>
            </div>

            <fieldset className="defi-flow-fieldset bridge-fields" disabled aria-describedby="bridge-disabled-note">
              <label className="defi-flow-field">
                <span>Asset</span>
                <button type="button" className="defi-flow-asset-select bridge-asset-select" aria-label="Select bridge asset" data-testid="button-bridge-select-asset">
                  No assets configured <ChevronDown size={15} aria-hidden="true" />
                </button>
              </label>
              <label className="defi-flow-field">
                <span>Amount</span>
                <div className="defi-flow-input-row bridge-amount-row">
                  <input aria-label="Bridge amount" placeholder="0.00" readOnly data-testid="input-bridge-amount" />
                  <span className="defi-flow-static-token">—</span>
                </div>
              </label>
              <div className="defi-flow-summary-row">
                <span>Destination amount</span>
                <span>Unavailable · no bridge quote</span>
              </div>
              <button type="button" className="defi-flow-submit" disabled data-testid="button-bridge-unavailable">
                Transfer unavailable
              </button>
            </fieldset>
            <p className="defi-flow-inline-note" id="bridge-disabled-note">
              No bridge contract, transfer submission, or relay is connected to this screen.
            </p>
          </section>

          <aside className="defi-flow-info-card bridge-tracking-card" aria-labelledby="bridge-tracking-title">
            <div className="defi-flow-info-icon" aria-hidden="true">
              <Route size={19} strokeWidth={1.55} />
            </div>
            <span className="defi-flow-eyebrow">TRANSFER STATUS</span>
            <h2 id="bridge-tracking-title">Tracking & confirmation</h2>
            <div className="bridge-status-list">
              <div>
                <span className="bridge-status-icon" aria-hidden="true"><Clock3 size={15} /></span>
                <span><strong>Source transaction</strong><small>Not submitted</small></span>
              </div>
              <div>
                <span className="bridge-status-icon" aria-hidden="true"><ShieldCheck size={15} /></span>
                <span><strong>Destination confirmation</strong><small>Unavailable until bridge integration</small></span>
              </div>
            </div>
            <div className="defi-flow-caution" role="note">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                Bridge contracts and message policy are not configured for live transfers. This interface does not move assets or confirm a destination transaction.
              </span>
            </div>
          </aside>
        </div>
      </div>
    </BrandTextTree>
  );
}

export { default } from './bridge-live';
