import { ArrowLeftRight, CreditCard, ShieldCheck, Vault } from 'lucide-react';
import './my-jail-page.css';
import './jail-bank-coming-soon.css';

export default function JailBankComingSoon() {
  return <main className="content my-jail-page jail-bank-notice">
    <header className="jail-heading">
      <div>
        <div className="jail-kicker"><ShieldCheck size={16} aria-hidden="true" /> PROTECTED FINANCE</div>
        <h1>Jail Bank</h1>
        <p>Your assets. Your authorization.</p>
      </div>
    </header>
    <section className="jail-bank-intro" aria-labelledby="jail-bank-status">
      <span className="jail-bank-status" id="jail-bank-status">Coming soon</span>
      <div className="jail-bank-symbol"><Vault size={36} strokeWidth={1.4} aria-hidden="true" /></div>
      <h2>A protected home for your digital assets.</h2>
      <p>Jail Bank is being built to bring vault balances, token swaps, cross-chain transfers,
        and payments into one place—with isolated vaults and explicit transaction authorization.</p>
      <div className="jail-bank-features">
        <div><ArrowLeftRight size={20} aria-hidden="true" /><h3>JailSwap</h3><p>Token swaps integrated with your protected vault.</p></div>
        <div><ArrowLeftRight size={20} aria-hidden="true" /><h3>JailBridge</h3><p>Cross-chain transfers within your banking experience.</p></div>
        <div><CreditCard size={20} aria-hidden="true" /><h3>JailPay</h3><p>Payments with clear approvals and transaction details.</p></div>
      </div>
      <p className="jail-bank-release-note">These Jail Bank integrations are not available yet.
        Availability and security details will be published before release.</p>
    </section>
  </main>;
}
