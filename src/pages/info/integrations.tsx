import { Layers3 } from 'lucide-react';
import { InfoPage } from '@/components/info/info-page';
import type { InfoPageDef } from '@/components/info/types';

const def: InfoPageDef = {
  eyebrow: 'Integrations', icon: Layers3,
  title: 'Integrations',
  lead: 'Naming a protocol is not an integration, and a logo is not a partnership. This page separates what the source actually uses from what is only planned or merely present as a dependency.',
  evidence: [{ label: 'Implemented', value: 'OpenZeppelin, Reown wallet connection' }, { label: 'Mainnet bridge', value: 'Armoreum custom DVN and destination keepers' }, { label: 'Partnerships', value: 'None implied' }],
  sections: [
    { id: 'matrix', title: 'Integration matrix', blocks: [
      { table: { label: 'integration-matrix', headers: ['Integration', 'Status', 'Evidence'], rows: [
        ['OpenZeppelin Contracts', 'Implemented in source', 'Contract source uses its P-256, access-control, and UUPS components. Source is not deployed.'],
        ['Injected EIP-1193 wallet', 'Implemented', 'The app requests accounts and chain id from the browser wallet provider.'],
        ['Block explorers', 'Implemented as links', 'Explorer address and transaction links are built from network configuration.'],
        ['Pons V2', 'Partially verified', 'Configured as an external protocol. Source-to-bytecode match and callback compatibility are not verified.'],
        ['WalletConnect or Reown', 'Planned, unverified', 'No transport is implemented.'],
        ['LayerZero (OApp bridge contract)', 'Custom operators live; OApp pair provisioned per launch', 'Armoreum’s custom DVN and destination executors are deployed on Ethereum and Robinhood. A unique lock-and-release pair is configured and inventory-funded after both legs of an Armoreum Multichain launch complete.'],
        ['Uniswap contracts and v4 hooks', 'Referenced, unverified', 'Dependencies and a pool manager reference check exist; no hooks or liquidity creation are implemented.'],
      ] } },
      { callout: { tone: 'warn', title: 'Logos do not mean partnership', text: 'Any ecosystem name shown on the site describes technology the project references. It does not imply endorsement, partnership, or a live integration.' } },
    ] },
    { id: 'wallets', title: 'Wallets', blocks: [
      { p: 'Connection uses only the injected provider in the browser, with two requests: account access and chain id. The address and chain are kept in memory for the session of the page. Disconnecting in the app clears that memory; it does not revoke permission inside your wallet, which you manage there.' },
    ] },
    { id: 'developers', title: 'Developer interfaces', blocks: [
      { p: 'The API exposes launch-draft, image-upload, token-metadata, network, and health routes. Several read routes return unavailable when no verified indexer is configured. There is no authentication middleware on draft endpoints.' },
      { links: [
        { label: 'API reference', href: '/docs/api-overview' },
        { label: 'Developer integrations', href: '/docs/developer-integrations' },
        { label: 'Contract overview', href: '/docs/contract-overview' },
        { label: 'GitHub profile configured for the project', href: 'https://github.com/armoreum', external: true, note: 'A configured public channel: a profile or organization URL, not an independently verified repository or support responder.' },
      ] },
    ] },
    { id: 'requirements', title: 'Requirements and limitations', blocks: [
      { ul: ['A browser wallet that exposes an injected EIP-1193 provider.', 'A correctly selected network: chain id 4663 or 1.', 'No integration should be assumed live unless its row above says implemented.', 'Contract integrations require deployment and review that do not yet exist.'] },
    ] },
  ],
};
export default function IntegrationsInfoPage() { return <InfoPage def={def} testId="page-integrations-info" />; }
