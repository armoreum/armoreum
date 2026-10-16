import { ArrowUpRight, KeyRound, LockKeyhole, ShieldCheck, Workflow, ArrowLeftRight } from 'lucide-react';
import { Link } from 'wouter';
import { BrandTextTree } from '@/lib/brand-text';
import './defi-tools.css';
import '@/components/info/info-page.css';

const groups = [
  {
    id: 'jailswap', title: 'JailSwap', headline: 'Protected asset swaps.', icon: ShieldCheck,
    status: 'UI-first, transactions disabled',
    description: 'JailSwap is designed to add an authorization layer to swaps of supported assets. Jail restricts movement of a protected asset and Unjail releases it after required authorization. Both are mechanisms inside JailSwap, not separate products.',
    workflow: ['Hold a supported asset under contract rules', 'Request a swap through JailSwap', 'Satisfy the Jail or Unjail authorization the contract enforces', 'Review the quote, fee, and slippage, then sign'],
    limits: ['Asset selection, quotes, and submission are disabled in the current implementation.', 'No JailSwap contract or backend swap service is verified as live.', 'No deployed general ERC-20 protection is verified; ordinary wallet assets stay exposed to the key.'],
    href: '/jailswap', cta: 'Open JailSwap', learn: '/jailswap-armoreum',
  },
  {
    id: 'bridge', title: 'Bridge', headline: 'Robinhood and Ethereum.', icon: ArrowLeftRight,
    status: 'UI-first, transfers disabled',
    description: 'The bridge screen presents transfers between Robinhood and Ethereum, and the direction can be reversed in the interface, so both routes are shown. No assets are configured and no transfer can be submitted.',
    workflow: ['Choose a direction', 'Select a configured asset and amount', 'Submit the source transaction', 'Wait for a confirmed destination receipt before treating it as complete'],
    limits: ['The interface is not connected to a bridge contract or relay.', 'Contract source describes LayerZero lock-and-release: lock on the source chain, release prefunded destination inventory on a validated message, never mint or burn. No deployment or live gateway connection is verified.', 'A transfer is never complete before the destination receipt is confirmed.'],
    href: '/bridge', cta: 'Open Bridge', learn: '/bridge-armoreum',
  },
];

const principles = [
  { title: 'Additional Authorization', description: 'Sensitive operations can require an extra authorization step where the supported implementation provides it.', icon: KeyRound },
  { title: 'Programmable Asset Controls', description: 'Smart contracts can enforce defined conditions for supported asset movements and operations.', icon: Workflow },
  { title: 'Security at the Account Level', description: 'Protection depends on how the account and its assets are architected. Assets held in an ordinary externally owned account are not automatically protected by a separate Armoreum interface or authorization credential.', icon: LockKeyhole },
];

export default function DefiToolsPage() {
  return (
    <BrandTextTree>
      <>
      <header className="defi-intro">
        <div className="defi-intro-copy">
          <p className="defi-eyebrow">THE ARMOREUM ECOSYSTEM</p>
          <h1>DeFi Tools. Built Around Stronger Security.</h1>
          <div className="defi-lede">
            <p>Two tools, each described with its workflow and its limits: JailSwap for protected swaps and Bridge for movement between Robinhood and Ethereum.</p>
            <p>Both interfaces are UI-first with transactions disabled. No swap deployment, bridge deployment, or live gateway connection is verified.</p>
          </div>
        </div>
        <div className="defi-emblem" aria-hidden="true">
          <span className="defi-emblem-ring defi-emblem-ring-outer" />
          <span className="defi-emblem-ring defi-emblem-ring-inner" />
          <span className="defi-emblem-axis" />
          <span className="defi-emblem-core"><ShieldCheck size={25} strokeWidth={1.35} /></span>
        </div>
      </header>

      <section className="defi-products" aria-labelledby="defi-products-title">
        <div className="defi-section-heading">
          <div><h2 id="defi-products-title">Explore the Tools</h2></div>
          <p>Each group links to its explanation and to the existing functional interface.</p>
        </div>
        <div className="defi-product-grid defi-duo">
          {groups.map(({ id, title, headline, icon: Icon, status, description, workflow, limits, href, cta, learn }, index) => (
            <article className="defi-product" key={id} data-testid={`product-${id}`}>
              <div className="defi-product-topline">
                <span className="defi-product-index" aria-hidden="true">0{index + 1}</span>
                <span className="defi-product-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.55} /></span>
                <span className="defi-status is-development" data-testid={`status-${id}`}>{status}</span>
              </div>
              <h3>{title}</h3>
              <h4>{headline}</h4>
              <p className="defi-product-description">{description}</p>
              <h5 className="defi-duo-label">Workflow</h5>
              <ol className="ip-list defi-duo-list">{workflow.map((w) => <li key={w}>{w}</li>)}</ol>
              <h5 className="defi-duo-label">Limitations</h5>
              <ul className="ip-list defi-duo-list">{limits.map((w) => <li key={w}>{w}</li>)}</ul>
              <div className="defi-product-bottom">
                <Link href={learn} className="ip-link" data-testid={`link-learn-${id}`}>How {title} works</Link>
                <Link href={href} className="defi-product-link" data-testid={`link-${id}`}>{cta}<ArrowUpRight size={15} aria-hidden="true" /></Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="defi-security" aria-labelledby="defi-security-title">
        <div className="defi-security-copy">
          <p className="defi-eyebrow">SECURITY BY DESIGN</p>
          <h2 id="defi-security-title">What If Your Private Key Is Compromised?</h2>
          <p>A compromised private key can put assets at risk when that key alone is sufficient to authorize transactions.</p>
          <p>Supported operations can be designed to require additional authorization and enforceable onchain conditions, but only where deployed contracts enforce them. No such deployment is verified.</p>
        </div>
        <div className="defi-principles">
          {principles.map(({ title, description, icon: Icon }, index) => (
            <article className="defi-principle" key={title}>
              <span className="defi-principle-index" aria-hidden="true">0{index + 1}</span>
              <span className="defi-principle-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.5} /></span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>
      </>
    </BrandTextTree>
  );
}
