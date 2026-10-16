import { Link } from 'wouter';
import { SiEthereum, SiGithub, SiRobinhood, SiX } from 'react-icons/si';

const platformLinks = [
  { href: 'https://ethereum.org/', label: 'Ethereum', Icon: SiEthereum },
  { href: 'https://robinhood.com/chain', label: 'Robinhood', Icon: SiRobinhood },
  { href: 'https://github.com/armoreum', label: 'GitHub', Icon: SiGithub },
  { href: 'https://x.com/armoreum', label: 'X', Icon: SiX },
];

const productLinks = [
  { label: 'Launchpad', href: '/launchpad-armoreum' },
  { label: 'JailSwap', href: '/jailswap-armoreum' },
  { label: 'Bridge', href: '/bridge-armoreum' },
  { label: 'Security', href: '/security' },
  { label: 'DeFi Tools', href: '/defi-tools' },
];

const resources = [
  { label: 'Documentation', href: '/docs' },
  { label: 'GitHub', href: 'https://github.com/armoreum', external: true },
  { label: 'Status', href: '/status-armoreum' },
  { label: 'Integrations', href: '/integrations-armoreum' },
];

const company = [
  { label: 'About', href: '/about-armoreum' },
  { label: 'Privacy', href: '/privacy-armoreum' },
  { label: 'Terms', href: '/terms-armoreum' },
  { label: 'Contact', href: '/contact-armoreum' },
];

function FooterNavigationGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href?: string; external?: boolean }>;
}) {
  return (
    <nav className="landing-footer-nav-group" aria-label={title}>
      <h2>{title}</h2>
      <ul>
        {items.map(({ label, href, external }) => (
          <li key={label}>
            {href && !external
              ? <Link href={href}>{label}</Link>
              : href
                ? <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
                : <span>{label}</span>}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BrandMarkLinks() {
  return (
    <div className="landing-footer-brand-links" aria-label="External network and social links">
      {platformLinks.map(({ href, label, Icon }) => (
        <a href={href} key={label} target="_blank" rel="noopener noreferrer">
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </a>
      ))}
    </div>
  );
}

export function LandingSecurityFooter() {
  const logoSrc = `${import.meta.env.BASE_URL}armoreum-logo-dark.png`;

  return (
    <footer id="landing-footer" className="landing-security-footer">
      <div className="landing-security-footer-inner">
        <div className="landing-footer-main">
          <section className="landing-footer-identity" aria-label="Armoreum">
            <Link className="landing-footer-brand" href="/" aria-label="Armoreum home">
              <img src={logoSrc} alt="" aria-hidden="true" />
              <strong><em>armoreum</em></strong>
            </Link>
            <p className="landing-footer-tagline">
              Programmable asset protection and security infrastructure for a decentralized world.
            </p>
            <BrandMarkLinks />
          </section>

          <div className="landing-footer-navigation">
            <FooterNavigationGroup title="Product" items={productLinks} />
            <FooterNavigationGroup title="Resources" items={resources} />
            <FooterNavigationGroup title="General" items={company} />
          </div>
        </div>

        <div className="landing-footer-bottom">
          <p className="landing-footer-copyright">
            Copyright 2026 <strong><em>armoreum</em></strong>. All rights reserved.
          </p>
          <p className="landing-footer-security">
            <img src={logoSrc} alt="" aria-hidden="true" />
            <span>Security by design. For a safer decentralized world.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
