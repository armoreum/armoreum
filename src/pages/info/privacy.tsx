import { LockKeyhole } from 'lucide-react';
import { InfoPage } from '@/components/info/info-page';
import type { InfoPageDef } from '@/components/info/types';

const def: InfoPageDef = {
  eyebrow: 'Privacy Policy', icon: LockKeyhole,
  title: 'Privacy Policy',
  lead: 'This is an informative draft policy pending legal review. It is not legal advice. It describes what the implementation does and does not collect, and flags the legal details that must be configured before publication.',
  evidence: [{ label: 'Status', value: 'Draft, pending legal review' }, { label: 'Cookies / sessions', value: 'None observed' }, { label: 'Marketing analytics', value: 'None found' }],
  sections: [
    { id: 'scope', title: 'Scope', blocks: [
      { p: 'This policy covers the armoreum web application and its API. It does not cover wallets, block explorers, RPC providers, or other sites you reach through links. Their practices are their own.' },
      { callout: { tone: 'warn', title: 'This is not a statement that no data is collected', text: 'Several kinds of data are processed, as described below. Do not read this page as a no-collection claim.' } },
    ] },
    { id: 'provided', title: 'Information you provide', blocks: [
      { ul: [
        'Launch details you type: name, symbol, description, tax setting, website and X links.',
        'Images you upload for a token, which may be stored in object storage and served publicly once validated.',
        'Draft identifiers returned by the API when a draft is saved.',
      ] },
      { p: 'Draft endpoints have no authentication or ownership checks. Anyone with a draft identifier may be able to read or update that draft. Do not enter secrets, private keys, or sensitive personal information.' },
    ] },
    { id: 'wallet', title: 'Wallet addresses and public blockchain data', blocks: [
      { p: 'When you connect, the app asks your injected browser wallet for your account and chain id. The address and chain are held in memory in the page and are not written to browser storage by the code. Choosing to forget the wallet in the app clears that memory only; it does not remove permissions granted in your wallet.' },
      { p: 'Blockchain transactions and addresses are public and permanent by design. Public chain data is not private, cannot be deleted by us, and can be correlated with other information.' },
    ] },
    { id: 'technical', title: 'Technical information, local storage, cookies, analytics', blocks: [
      { table: { label: 'technical-data', headers: ['Item', 'Observed behavior'], rows: [
        ['Local storage', 'Theme preference and launch drafts, including draft identifiers, persist in your browser until changed or cleared.'],
        ['Cookies and sessions', 'No authentication, cookie-session, or session middleware was observed.'],
        ['Analytics', 'No dedicated marketing analytics was found in the code.'],
        ['Server logs', 'The API logs request id, method, URL with query string removed, and response status. Authorization and cookie values are redacted.'],
        ['IP address', 'Processed in memory for rate-limit buckets. The log serializer does not explicitly record it, though infrastructure in front of the API may.'],
        ['Fonts', 'The stylesheet imports fonts from Google Fonts, so your browser requests them from Google, which receives standard request data such as IP address and user agent.'],
        ['Provider cookies', 'App code uses no cookie sessions, but third-party providers such as Google Fonts, RPC providers, wallets, and hosting infrastructure may set or read cookies under their own practices, which can differ from the app.'],
      ] } },
    ] },
    { id: 'third-parties', title: 'RPC providers and third-party services', blocks: [
      { p: 'Your wallet talks to its own RPC provider. The network status check is configured to use Alchemy RPC endpoints, so Alchemy may receive those server-side requests. Uploaded images and draft records are handled by the API, its database, object storage, and hosting infrastructure, each of which may process request metadata. External links, such as explorers, GitHub, and X, are governed by their own policies. No WalletConnect transport is used.' },
    ] },
    { id: 'use-retention', title: 'Use, retention, security, and sharing', blocks: [
      { ul: [
        'Use: to save drafts, validate and serve images, apply rate limits, and keep the service working.',
        'Sharing: uploaded images are intended to be publicly served. We do not describe any sale of data because no such behavior was observed, but sharing arrangements of the operator are not specified here.',
        'Retention: no general retention schedule is published. Abandoned upload intents have cleanup in source. Completed images are not guaranteed to be deleted.',
        'Security: engineering measures exist, such as input validation and rate limiting. No guarantee of absolute security is made.',
      ] },
    ] },
    { id: 'rights', title: 'Your choices and rights', blocks: [
      { p: 'You can clear browser storage to remove local drafts and the theme preference. Clearing it does not delete server drafts, uploaded images, or public blockchain data. No request-deletion endpoint exists. Legal rights that apply to you depend on where you live and on who the operator is; those are not yet determined.' },
    ] },
    { id: 'missing', title: 'Details to configure before publication', blocks: [
      { table: { label: 'privacy-missing', headers: ['Required item', 'State'], rows: [
        ['Legal operator and entity', 'Not configured'],
        ['Responsible privacy contact', 'Not configured'],
        ['Governing jurisdiction and applicable regimes', 'Not configured'],
        ['Retention periods for drafts, images, logs', 'Not configured'],
        ['Process for access and deletion requests', 'Not configured'],
        ['Legal review of this text', 'Pending'],
      ] } },
      { links: [{ label: 'Contact page', href: '/contact-armoreum' }, { label: 'Terms draft', href: '/terms-armoreum' }] },
    ] },
  ],
};
export default function PrivacyInfoPage() { return <InfoPage def={def} testId="page-privacy-info" />; }
