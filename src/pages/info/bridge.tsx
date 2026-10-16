import { ArrowLeftRight } from 'lucide-react';
import { InfoPage } from '@/components/info/info-page';
import type { InfoPageDef } from '@/components/info/types';

const def: InfoPageDef = {
  eyebrow: 'Bridge', icon: ArrowLeftRight,
  title: 'Bridge',
  lead: 'The bridge screen is planned for transfers between Robinhood and Ethereum in either direction. The consumer interface is UI-first: it is not connected to a bridge contract or relay, and no transfer can be submitted from it. Separate contract source describes a real lock-and-release mechanism; no deployment or live gateway connection is verified.',
  evidence: [
    { label: 'Routes shown', value: 'Both directions' },
    { label: 'Configured assets', value: 'None' },
    { label: 'Interface transfers', value: 'Disabled' },
    { label: 'Contract source', value: 'LayerZero lock-and-release; pair provisioned per Multichain launch' },
  ],
  sections: [
    { id: 'why', title: 'Why people bridge', blocks: [
      { p: 'An asset on one chain cannot be spent on another. Users bridge to reach liquidity, applications, or lower fees on a different network. Each hop adds a trust assumption, so the mechanism matters more than the interface.' },
    ] },
    { id: 'networks', title: 'Supported networks and assets', blocks: [
      { table: { label: 'bridge-networks', headers: ['Item', 'State'], rows: [
        ['Robinhood to Ethereum', 'Available when the launch-specific OApp pair is active; the Ethereum keeper verifies and executes finalized transfers.'],
        ['Ethereum to Robinhood', 'Available when the launch-specific OApp pair is active; the Robinhood keeper verifies and executes finalized transfers.'],
        ['Assets', 'The asset selector reports that no assets are configured.'],
      ] } },
      { p: 'No other network is claimed. A bridge route is not an endorsement of any asset.' },
    ] },
    { id: 'mechanism', title: 'Mechanism in contract source', blocks: [
      { p: 'ArmoreumLockReleaseBridge is a LayerZero OApp. On the source chain it locks the source token. On the destination chain it releases prefunded inventory only after the custom DVN validates the finalized source packet. It never mints or burns tokens.' },
      { table: { label: 'bridge-source', headers: ['Property', 'Source behavior'], rows: [
        ['Token pair', 'Fixed at construction: one local token and one remote token.'],
        ['Peer', 'One remote peer, configurable once; it cannot be changed afterward.'],
        ['Activation', 'Inbound release requires prefunded inventory; activation is gated on it.'],
        ['Guards', 'A maximum bridge amount, outbound and inbound capacity limits, and a consumed-transfer-id check against replay.'],
        ['Messages', 'Validated for launch id, token pair, sender, recipient, and amount before any release.'],
      ] } },
      { p: 'A separate local development adapter, LocalBridgeAdapter, models the same lock-and-release idea for local EVM chains only and refuses to run elsewhere.' },
      { callout: { tone: 'warn', title: 'Source is not a live bridge', text: 'The contract source describes the transfer mechanism, but no deployment or live gateway connection is verified. Transfers remain disabled in the interface. A verified deployment and connected transaction path are required before this mechanism can serve users.' } },
    ] },
    { id: 'workflow', title: 'The intended transfer workflow', blocks: [
      { steps: [
        { title: 'Source transaction', text: 'You submit a transaction on the source chain. The screen shows this as not submitted.' },
        { title: 'Processing', text: 'The source keeper waits for finalized source-chain evidence, the PLATFORM_OWNER signer attests through Armoreum’s custom DVN, and the destination keeper executes the verified message.' },
        { title: 'Destination receipt', text: 'Only a confirmed receipt on the destination chain completes a transfer.' },
      ] },
      { p: 'A transfer is not complete when the source transaction confirms. Treat it as complete only after you see the destination receipt in your own wallet or on the destination explorer.' },
    ] },
    { id: 'fees-failures', title: 'Fees, failures, delays, and recovery', blocks: [
      { ul: [
        'Expect to pay network gas on the source chain and possibly a messaging fee. No quote is available in the interface.',
        'Delays can come from source finality, relay availability, or destination congestion.',
        'If something stalls, keep the source transaction hash, check both explorers, and do not repeat the transfer until you know the first one failed.',
        'Each transfer is tracked by its unique ID and automatically retried by the destination keeper until delivery succeeds. Locked source tokens are not automatically refunded.',
      ] },
    ] },
    { id: 'risks', title: 'Security assumptions and cross-chain risks', blocks: [
      { ul: [
        'Message validation and peer configuration are the usual points of failure for bridges. Source configures a single peer once, which must be correct.','Releases depend on prefunded destination inventory; if it is insufficient the release cannot occur.',
        'Wrapped or bridged assets carry the risk of the bridge that issued them.',
        'Contract defects, privileged upgrades, and wrong-network mistakes can cause permanent loss.',
        'Confirm network and address on the explorers listed on the status page.',
      ] },
    ] },
  ],
  cta: { title: 'See the Bridge interface', text: 'Open the existing functional screen. It is a disabled preview.', label: 'Open Bridge', href: '/bridge', secondary: { label: 'Check provider status', href: '/status-armoreum' } },
};
export default function BridgeInfoPage() { return <InfoPage def={def} testId="page-bridge-info" />; }
