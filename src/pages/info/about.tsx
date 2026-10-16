import { KeyRound } from 'lucide-react';
import { InfoPage } from '@/components/info/info-page';
import type { InfoPageDef } from '@/components/info/types';

const def: InfoPageDef = {
  eyebrow: 'About armoreum', icon: KeyRound,
  title: 'About armoreum',
  lead: 'Programmable asset protection and security infrastructure for a decentralized world. armoreum is security and DeFi infrastructure for people who need a precise explanation of how an asset is authorized to move, rather than unverified assurance.',
  evidence: [{ label: 'Focus', value: 'Asset authorization' }, { label: 'Audience', value: 'Users, creators, developers' }, { label: 'Stance', value: 'Evidence before assurance' }],
  sections: [
    { id: 'what', title: 'What armoreum is', blocks: [
      { p: 'armoreum combines a token launch flow, creator reward design, DeFi tool previews, and contract source around one question: what, besides a wallet key, should be required to move an asset? This page makes no statement about founders, staff, or corporate registration.' },
    ] },
    { id: 'why', title: 'Why private keys and programmable protection matter', blocks: [
      { p: 'A conventional wallet treats possession of one private key as total authority. If it leaks, everything the key controls can move. Programmable protection lets a contract demand additional authorization for specific assets, so exposure of a single secret need not be enough.' },
      { p: 'That helps only where contracts enforce it. Assets in an ordinary wallet remain as exposed as before.' },
    ] },
    { id: 'ecosystem', title: 'How the parts relate', blocks: [
      { cards: [
        { tag: 'Security', title: 'Security infrastructure', text: 'Independent authorization design and its contract source, with limits stated.' },
        { tag: 'Launch', title: 'Token launches', text: 'A guided flow to define a token and its additional-tax setting.' },
        { tag: 'Rewards', title: 'Creator rewards', text: 'Reward accounting designed to be claimed only with separate proofs.' },
        { tag: 'DeFi', title: 'DeFi tools', text: 'JailSwap and Bridge, both UI-first interfaces with transactions disabled.' },
        { tag: 'Cross-chain', title: 'Cross-chain infrastructure', text: 'Planned movement between Robinhood and Ethereum.' },
      ] },
    ] },
    { id: 'needs', title: 'Who it serves', blocks: [
      { table: { label: 'audiences', headers: ['Audience', 'Need'], rows: [
        ['Users', 'Plain statements of what is protected and what is not.'],
        ['Creators', 'A launch flow and reward model whose authorization steps are explicit.'],
        ['Developers', 'Readable source, documented routes, and honest integration status.'],
      ] } },
    ] },
    { id: 'principles', title: 'Design principles', blocks: [
      { steps: [
        { title: 'Say what is verified', text: 'Source, deployment, and audit are three different facts.' },
        { title: 'Separate authority', text: 'Wallet identity and authorization should not be the same secret.' },
        { title: 'Fail visibly', text: 'Unavailable features say so instead of showing sample data.' },
        { title: 'Respect public data', text: 'Blockchain activity is public; the interface never implies otherwise.' },
      ] },
      { links: [{ label: 'Security model', href: '/security' }, { label: 'Documentation', href: '/docs' }, { label: 'Integrations', href: '/integrations-armoreum' }] },
    ] },
  ],
  cta: { title: 'Read the security model', text: 'See the threat simulator and the limits of what is verified.', label: 'Open Security', href: '/security' },
};
export default function AboutInfoPage() { return <InfoPage def={def} testId="page-about-info" />; }
