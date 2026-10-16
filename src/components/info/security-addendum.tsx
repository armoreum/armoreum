import { InfoSections } from './info-page';
import type { InfoSectionDef } from './types';
import './info-page.css';

const sections: InfoSectionDef[] = [
  { id: 'protected-vs-ordinary', title: 'Protected assets versus ordinary wallet assets', kicker: '08', blocks: [
    { table: { label: 'security-protected', headers: ['', 'Protected asset', 'Ordinary wallet-held asset'], rows: [
      ['Authority to move', 'Wallet plus contract-enforced additional authorization.', 'Whoever holds the private key.'],
      ['If the key is exposed', 'May resist movement only where a deployed contract enforces it.', 'Can be moved by the attacker.'],
      ['Verification', 'Creator Vault enforcement applies only to the selected deployed launch; live readiness is not an audit.', 'Not changed by Armoreum.'],
    ] } },
    { callout: { tone: 'warn', title: 'No automatic protection', text: 'Not all assets are protected, and exposure of a private key can still result in loss of anything that key alone controls.' } },
  ] },
  { id: 'jailswap-limits', title: 'JailSwap, Jail, and Unjail', kicker: '09', blocks: [
    { p: 'JailSwap is Coming Soon. Creator-reward Unjail is a separate Creator Vault action: when issuance is enabled, each reward credit issues matching fully backed JailETH in the same transaction. Unjail requires the creator-wallet signature and a one-time proof derived from the launch password, and pays the selected eligible recipient. This does not provide general protection for ordinary ERC-20 assets.' },
    { links: [{ label: 'JailSwap explained', href: '/jailswap-armoreum' }, { label: 'Security model documentation', href: '/docs/security-model-overview' }] },
  ] },
  { id: 'responsibilities', title: 'Limitations and your responsibilities', kicker: '10', blocks: [
    { ul: ['Keep the launch password and downloaded recovery file private; never approve a wallet signature you did not initiate.', 'Treat the post-launch creator key as public and compromised; do not use it as a secret.', 'Verify the selected token’s contract addresses and current state on the correct chain explorer.', 'Multichain verification is owner-controlled 1-of-1; readiness is not an independent audit.'] },
  ] },
  { id: 'disclosure', title: 'Vulnerability disclosure', kicker: '11', blocks: [
    { callout: { tone: 'warn', title: 'No confidential channel is configured', text: 'Do not post secrets or exploit details publicly. The contact page lists the verified channels and the configuration that is missing.' } },
    { links: [{ label: 'Contact and security reports', href: '/contact-armoreum' }] },
  ] },
];

export function SecurityAddendum() {
  return <div className="ip-addendum"><InfoSections sections={sections} /></div>;
}
