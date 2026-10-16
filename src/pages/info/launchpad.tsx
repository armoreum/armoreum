import { Layers3 } from 'lucide-react';
import { InfoPage } from '@/components/info/info-page';
import type { InfoPageDef } from '@/components/info/types';

const def: InfoPageDef = {
  eyebrow: 'Launchpad', icon: Layers3,
  title: 'Launchpad',
  lead: 'The launchpad guides a creator through token details, network choice, and review. This page explains what the flow does in the current implementation, what it does not do, and where responsibility sits with you.',
  evidence: [
    { label: 'Local development launch', value: 'Deploys a fixed-supply ERC-20 when the local backend is available' },
    { label: 'Mainnet launch', value: 'Not verified' },
    { label: 'Fee quotes', value: 'None are live' },
  ],
  sections: [
    { id: 'what-it-does', title: 'What the launchpad does', blocks: [
      { p: 'The launch flow collects a required token name, symbol, verified image, and additional-tax setting, with an optional description, website, and X link. A verified image is required before you can complete the details step. Drafts are kept in your browser. When the API is reachable, a draft can also be saved on the server and an image can be uploaded to object storage.' },
      { p: 'The flow also includes a local launch path. When a configured local development EVM and the local backend are available, the local-launches endpoints deploy an actual fixed-supply ERC-20 on that local chain. The control is disabled when the local backend is unavailable. This is a development capability, not a verified mainnet launch: no mainnet deployment, trading, liquidity creation, bridge operation, automatic launch, funding service, or live creator authorization is verified or enabled.' },
      { callout: { tone: 'warn', title: 'Not a verified launch', text: 'Source fee values shown in the launch interface describe configuration in code. They are not live quotes, and nothing in the flow establishes that a token was deployed to a public network. A local deployment exists only on the local development chain.' } },
    ] },
    { id: 'discovery', title: 'Token discovery and creation', blocks: [
      { p: 'Explore lists launch records only when the service provides them. When no verified indexer is configured, the page shows an honest empty or error state instead of sample tokens. Token detail pages show the fields a record carries, including explorer links for confirmed deployments.' },
      { links: [{ label: 'Open Explore', href: '/explore' }, { label: 'Read the launch documentation', href: '/docs/token-launch-lifecycle' }] },
    ] },
    { id: 'networks', title: 'Networks and token standards', blocks: [
      { table: { label: 'launch-networks', headers: ['Mode', 'What it means here'], rows: [
        ['Robinhood (id 4663)', 'Configured network. The Pons V2 path saves draft details; the external protocol integration is only partially verified.'],
        ['Ethereum', 'Launch intent is selectable. No armoreum launch contracts or transaction path are verified for it.'],
        ['Multichain', 'A draft mode for coordinated Ethereum and Robinhood intent. No bridge peers or message policy are configured.'],
      ] } },
      { p: 'The launch token contract, FixedSupplyLaunchToken, is an ERC-20 with 18 decimals. Its supply is the constant FIXED_SUPPLY of 1,000,000,000 ether (one billion tokens), minted once at deployment. Source is not a public-network deployment. No compatibility with any other network or standard is claimed.' },
    ] },
    { id: 'configuration', title: 'Token configuration and supply', blocks: [
      { table: { label: 'launch-fields', headers: ['Field', 'Rule'], rows: [
        ['Name', 'Up to 40 characters, no leading or trailing spaces.'],
        ['Symbol', '1 to 12 uppercase letters or digits, starting with a letter.'],
        ['Description', 'Up to 320 characters.'],
        ['Additional tax', 'Between 1% and 10%, separate from the Pons base tax of 1% described in source.'],
        ['Links', 'Optional website (HTTP or HTTPS) and a non-root X profile or post path. Embedded credentials are rejected.'],
        ['Image', 'PNG, JPEG or WebP, square, validated and processed before a public URL is used.'],
      ] } },
      { p: 'There is no editable supply field: every launch token has the same fixed supply of one billion tokens at 18 decimals, minted once.' },
    ] },
    { id: 'creator-workflow', title: 'Creator workflow', blocks: [
      { steps: [
        { title: 'Choose a mode', text: 'Pick Robinhood, Ethereum intent, or the multichain draft mode.' },
        { title: 'Enter details', text: 'Fill in name, symbol, description, image, and links. Drafts save locally as you work.' },
        { title: 'Review', text: 'Check every field and every disclosed fee value. Fee values are source configuration, not a quote.' },
        { title: 'Save or test locally', text: 'Persist the draft through the API if it is available, or deploy to the local development chain if the local backend is enabled.' },
        { title: 'Verify independently', text: 'Any claim that a token exists must be checked on a block explorer, never inferred from the draft.' },
      ] },
    ] },
    { id: 'liquidity-fees', title: 'Liquidity, trading, and fees', blocks: [
      { p: 'The launchpad does not create liquidity, and no Uniswap v4 hook is implemented. Trading, pricing, and graduation shown for a record come from whatever the external protocol and the service report. Additional-tax routing in source splits 70% toward a creator reward vault and 30% toward platform accounting; no Pons callback for that routing is verified, so do not assume it applies to any token.' },
      { p: 'You are responsible for network gas, for any third-party protocol fee, and for checking amounts in your own wallet before approving anything.' },
    ] },
    { id: 'risks', title: 'Risks for creators and buyers', blocks: [
      { ul: [
        'A drafted token may never be deployed. A draft is not a token, and a local development token is not a public-network token.',
        'Draft identifiers are references, not credentials. The draft endpoints have no ownership checks, so never place secrets in draft fields.',
        'Buyers face price volatility, thin liquidity, malicious token behavior, and impersonation. Verify contract addresses on an explorer.',
        'Additional tax lowers what a trader receives and can make a token costly to exit.',
        'Creator reward protection is described in contract source for which no deployment or audit report has been supplied or verified.',
      ] },
    ] },
  ],
  cta: { title: 'Open the launch flow', text: 'Go to the functional launch interface. It stays a separate screen from this explanation.', label: 'Open Launchpad', href: '/launch-token', secondary: { label: 'Read launch docs', href: '/docs/launchpad-overview' } },
};
export default function LaunchpadInfoPage() { return <InfoPage def={def} testId="page-launchpad-info" />; }
