import { Activity } from 'lucide-react';
import { InfoPage } from '@/components/info/info-page';
import type { InfoPageDef } from '@/components/info/types';

const def: InfoPageDef = {
  eyebrow: 'Service Status', icon: Activity,
  title: 'Service Status',
  lead: 'This page does not display uptime, incident history, or a live indicator, because no live monitoring is connected. It lists the real providers and explorers to check yourself, each marked as a manual check.',
  evidence: [{ label: 'Live monitoring', value: 'Not connected' }, { label: 'Uptime figures', value: 'None published' }, { label: 'Checks', value: 'Manual, by you' }],
  sections: [
    { id: 'what-we-know', title: 'What is and is not known', blocks: [
      { table: { label: 'status-known', headers: ['Component', 'Evidence'], rows: [
        ['Web application', 'Served to your browser. If this page loaded, it was reachable for you.'],
        ['API', 'Has a health route, but its result is not shown or monitored here.'],
        ['Launch indexer', 'Not configured; launch and activity reads return unavailable.'],
        ['Bridge and swap', 'Interfaces are disabled and no deployment is verified. Their screens say so.'],
      ] } },
      { callout: { title: 'No green badge', text: 'An absent incident list is not evidence of health. Do not read anything here as an operational guarantee.' } },
    ] },
    { id: 'manual-checks', title: 'Manual checks you can run', blocks: [
      { links: [
        { label: 'Robinhood explorer', href: 'https://robin.etherscan.io', external: true, note: 'Manual check: confirm blocks are being produced and your transaction appears.' },
                { label: 'Etherscan for Ethereum', href: 'https://etherscan.io', external: true, note: 'Manual check: confirm Ethereum activity and gas conditions.' },
        { label: 'Robinhood overview', href: 'https://robinhood.com/chain', external: true, note: 'Provider information page.' },
        { label: 'Ethereum', href: 'https://ethereum.org/', external: true, note: 'Network reference.' },
        { label: 'armoreum on X (configured public channel)', href: 'https://x.com/armoreum', external: true, note: 'A configured public channel. It is not a guaranteed status feed.' },
      ] },
    ] },
    { id: 'if-something-fails', title: 'When something looks wrong', blocks: [
      { steps: [
        { title: 'Check your wallet network', text: 'Confirm chain id 4663 for Robinhood or 1 for Ethereum.' },
        { title: 'Check the explorer', text: 'Look up your transaction hash. Pending, failed, and confirmed are different states.' },
        { title: 'Check your connection and wallet', text: 'Reload, reconnect the wallet, and retry only after you know nothing was submitted.' },
        { title: 'Report it', text: 'Use the contact page for the channels that exist.' },
      ] },
      { links: [{ label: 'Troubleshooting documentation', href: '/docs/troubleshooting-overview' }, { label: 'Contact', href: '/contact-armoreum' }] },
    ] },
  ],
};
export default function StatusInfoPage() { return <InfoPage def={def} testId="page-status-info" />; }
