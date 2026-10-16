import { FileCheck2 } from 'lucide-react';
import { InfoPage } from '@/components/info/info-page';
import type { InfoPageDef } from '@/components/info/types';

const def: InfoPageDef = {
  eyebrow: 'Terms of Use', icon: FileCheck2,
  title: 'Terms of Use',
  lead: 'This is an informative draft pending legal review. It is not legal advice, and its legal effect requires review once a legal operator, jurisdiction, and notice process are configured.',
  evidence: [{ label: 'Status', value: 'Draft, pending legal review' }, { label: 'Operator', value: 'Not identified' }, { label: 'Jurisdiction', value: 'Not set' }],
  sections: [
    { id: 'acceptance', title: 'Acceptance and eligibility', blocks: [
      { p: 'These draft terms describe the intended conditions of use. You must have reached the age of legal majority where you live, be able to form a binding agreement, and not be barred from using digital-asset services under laws that apply to you.' },
    ] },
    { id: 'responsibilities', title: 'Your responsibilities and wallet security', blocks: [
       { ul: ['You alone control your wallet, keys, recovery information, and credentials. Never share private credentials or approve authorization prompts you did not initiate.', 'You are responsible for checking networks, addresses, and amounts before signing.', 'You are responsible for the security of your devices.', 'You are responsible for the lawfulness of your use, including tax and reporting obligations.'] },
    ] },
    { id: 'transactions', title: 'Blockchain transactions and finality', blocks: [
      { p: 'Transactions are public, and once confirmed are generally irreversible. We cannot cancel, reverse, or recover them. A transaction shown as pending, failed, or confirmed on an explorer is the authority, not this interface.' },
    ] },
    { id: 'launches', title: 'Token launches and digital asset risks', blocks: [
      { p: 'The launch flow creates local drafts, optional saved drafts, and, when a local backend is available, a token on a local development chain. It does not guarantee a public-network deployment, liquidity, trading, listing, or value. Digital assets can lose all value. Creators are responsible for their token, its description, and compliance. Buyers are responsible for their own research.' },
    ] },
    { id: 'jailswap', title: 'JailSwap and the limits of protection', blocks: [
       { callout: { tone: 'warn', title: 'No guarantee of protection', text: 'JailSwap is UI-first and transactions are disabled. No deployed general ERC-20 protection is verified. Contract-enforced protection, where it exists, may not prevent loss from defects, device or credential compromise, lost credentials, or assets that are not under a protecting contract.' } },
    ] },
    { id: 'bridge', title: 'Bridge and cross-chain risks', blocks: [
      { p: 'Bridge transfers are not enabled in the interface, and no live deployment is verified. Cross-chain movement carries risks of message verification failure, delay, contract defects, and loss. A transfer is not complete until a destination receipt is confirmed.' },
    ] },
    { id: 'fees', title: 'Fees, slippage, failed transactions, third parties', blocks: [
      { p: 'You pay network gas. A transaction that is included on-chain but reverts can still consume gas; a request that fails before submission may not. Values shown as fees in the interface are source configuration, not live quotes. Prices can move before a transaction confirms. Third-party wallets, RPC providers, explorers, and protocols are outside our control and have their own terms.' },
    ] },
    { id: 'prohibited', title: 'Prohibited use', blocks: [
      { ul: ['Fraud, impersonation, or misleading token descriptions.', 'Infringing intellectual property or uploading unlawful content.', 'Attacking, overloading, or probing the service or its API beyond responsible testing.', 'Evading rate limits or using the service to launder funds.', 'Using the service where doing so is unlawful for you.'] },
    ] },
    { id: 'ip-availability', title: 'Intellectual property and availability', blocks: [
      { p: 'The armoreum name, interface, and original content belong to their owner, which is not yet identified. You keep rights in content you submit and grant the permission needed to host and display it. The service may be unavailable, changed, or withdrawn at any time. No monitoring or uptime commitment is made.' },
    ] },
    { id: 'disclaimers', title: 'Disclaimers and limitation of liability', blocks: [
      { p: 'The service is provided as is and as available, without warranties of any kind, including fitness, accuracy, or security. To the extent permitted by law, the operator is not liable for indirect or consequential loss, lost assets, or losses from third-party services. The extent of any such limit depends on the governing law, which is not yet set.' },
    ] },
    { id: 'contact-missing', title: 'Contact and items requiring legal review', blocks: [
      { table: { label: 'terms-missing', headers: ['Required item', 'State'], rows: [
        ['Legal operator and entity', 'Not configured'],
        ['Governing law and venue', 'Not configured'],
        ['Notice and dispute process', 'Not configured'],
        ['Sanctions and restricted-region language', 'Requires legal review'],
        ['Final legal review of this draft', 'Pending'],
      ] } },
      { links: [{ label: 'Contact page', href: '/contact-armoreum' }, { label: 'Privacy draft', href: '/privacy-armoreum' }] },
    ] },
  ],
};
export default function TermsInfoPage() { return <InfoPage def={def} testId="page-terms-info" />; }
