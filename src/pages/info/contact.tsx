import { CircleHelp } from 'lucide-react';
import { InfoPage } from '@/components/info/info-page';
import type { InfoPageDef } from '@/components/info/types';

const channels = [
  { label: 'armoreum on X', href: 'https://x.com/armoreum', external: true, note: 'Configured public channel; a response is not guaranteed.' },
  { label: 'GitHub profile', href: 'https://github.com/armoreum', external: true, note: 'Configured public channel. A profile or organization URL; no specific repository, issue tracker, or support response is verified.' },
];
const def: InfoPageDef = {
  eyebrow: 'Contact', icon: CircleHelp,
  title: 'Contact',
  lead: 'Only two public channels are configured. There is no contact form, support email, or confidential security-report endpoint, and none is invented here.',
  evidence: [{ label: 'Configured public channels', value: 'X and GitHub profile' }, { label: 'Contact form', value: 'Not configured' }, { label: 'Confidential security intake', value: 'Not configured' }],
  sections: [
    { id: 'general', title: 'General inquiries', blocks: [{ p: 'Use the configured public channels below. Do not send secrets, seed phrases, private keys, or authorization credentials to anyone, ever.' }, { links: channels }] },
    { id: 'support', title: 'Technical support', blocks: [
      { p: 'No dedicated support desk is configured. Before reaching out, collect the network, the transaction hash if one exists, and what the screen displayed. Never include keys or phrases. The documentation covers common cases.' },
      { links: [{ label: 'Troubleshooting documentation', href: '/docs/troubleshooting-overview' }, { label: 'Status guidance', href: '/status-armoreum' }, ...channels] },
    ] },
    { id: 'security', title: 'Security vulnerability reports', blocks: [
      { callout: { tone: 'warn', title: 'No confidential disclosure endpoint exists yet', text: 'No private security email, form, or advisory channel is configured. Do not post exploit details, secrets, or sensitive data in a public post or comment.' } },
      { p: 'Until a confidential channel is configured, a reporter may use a public channel only to ask for a private route, without technical detail. A confidential disclosure endpoint must be configured by the operator before this site invites vulnerability reports.' },
    ] },
    { id: 'developers', title: 'Developer and integration inquiries', blocks: [
      { p: 'Start with the integration status and developer documentation, then use a public channel for questions that contain no sensitive data.' },
      { links: [{ label: 'Integrations', href: '/integrations-armoreum' }, { label: 'Developer integrations docs', href: '/docs/developer-integrations' }] },
    ] },
    { id: 'missing', title: 'Configuration required before publication', blocks: [
      { table: { label: 'missing-contact', headers: ['Item', 'State'], rows: [
        ['General contact address or form endpoint', 'Missing'],
        ['Support contact', 'Missing'],
        ['Confidential security report endpoint', 'Missing'],
        ['Responsible privacy contact', 'Missing'],
        ['Legal operator and notice contact', 'Missing'],
      ] } },
    ] },
  ],
};
export default function ContactInfoPage() { return <InfoPage def={def} testId="page-contact-info" />; }
