import type { InfoBlock } from '@/components/info/types';

export type OverviewPage = { lead: string; sections: { id: string; title: string; blocks: InfoBlock[] }[] };
const d = (slug: string, label: string) => ({ label, href: `/docs/${slug}` });
const NOTE = 'Mainnet readiness checks are separate from an independent security audit. Review each network and token address on its explorer before interacting.';

export const overviewPages: Record<string, OverviewPage> = {
  'getting-started-overview': { lead: 'A guide to Armoreum protected authorization, Creator Vaults, JailETH, recovery, live cross-chain tools, and token launches.', sections: [
    { id: 'orientation', title: 'Orientation', blocks: [
      { p: 'Armoreum connects protected asset authorization, Creator Vault rewards, JailETH, offline recovery, ArmorProof, and live LayerZero transfers. Explore lists verified launches and token pages. The Launchpad supports Ethereum, Pons V2 on Robinhood Chain, and coordinated Multichain launches. JailSwap and Jail Bank remain Coming Soon; JailPay is a planned integration.' },
      { table: { label: 'start-components', headers: ['Component', 'What it does'], rows: [
        ['Launchpad', 'Pons V2, Ethereum, and Multichain mainnet launch workflows, with per-network funding and confirmation.'],
        ['Security page', 'Explains independent authorization and lets you step through attack scenarios.'],
        ['Creator Vaults and JailETH', 'Per-token reward accounting and password-authorized Claim / Unjail on the selected network.'],
        ['Offline Recovery', 'Inspect a recovery capsule and access the recovery workflow; submitting transactions still requires network connectivity.'],
        ['ArmorProof', 'Public creator-key challenge directory with Creator Vault scope and refreshed JailETH balances.'],
        ['Explore and token pages', 'Discover verified launches, inspect chain-specific data, and open creator or bridge actions.'],
        ['JailSwap', 'Coming Soon.'],
        ['Bridge and Bridge Explorer', 'Live lock-and-release transfers for registered, activated Ethereum ↔ Robinhood pairs, with source, verification, and destination tracking.'],
        ['Jail Bank and JailPay', 'Jail Bank is Coming Soon; JailPay is a planned integration, not an active payment service.'],
      ] } },
    ] },
    { id: 'path', title: 'Recommended path', blocks: [
      { steps: [
        { title: 'Read the overview', text: 'Understand which mainnet launch paths are configured and how status differs from an audit.' },
        { title: 'Read the security model', text: 'Review creator authorization, owner controls, and the centralized DVN trust boundary.' },
        { title: 'Try the launch flow', text: 'Review the selected chain, funding requirement, fee settings, and confirmation before signing.' },
        { title: 'Check networks and fees', text: 'Confirm chain, address, and amounts before any transaction.' },
      ] },
      { links: [d('armoreum-overview', 'armoreum Overview'), d('security-model-overview', 'Security Model Overview'), d('supported-networks', 'Supported Networks'), d('transactions-and-fees', 'Transactions and Fees')] },
    ] } ] },
  'armoreum-overview': { lead: 'Security infrastructure for protected authorization, Creator Vaults, JailETH, recovery, and cross-chain tools on Ethereum and Robinhood Chain.', sections: [
    { id: 'what', title: 'What it is', blocks: [
      { p: 'armoreum links security infrastructure, token launches, creator rewards, DeFi tools, and cross-chain infrastructure around one idea: a wallet key should not always be the only thing needed to move an asset.' },
      { table: { label: 'overview-parts', headers: ['Part', 'Evidence'], rows: [
        ['Launch flow', 'Pons V2 on Robinhood Chain, Ethereum V4 launches, and coordinated Multichain launches are enabled after live preflight checks.'],
        ['Reward and vault contracts', 'Per-launch Creator Vault and TaxRouter accounting is deployed on supported launch chains; confirm the selected launch and current on-chain state. ' + NOTE],
        ['JailSwap', 'Coming Soon.'],
        ['Bridge', 'Live for registered, activated token pairs. Armoreum operates the LayerZero DVN and destination executors; new Multichain launches automatically provision their pair after both launch legs complete.'],
        ['Offline Recovery and ArmorProof', 'Recovery-capsule tooling and the public Creator Vault challenge directory are available in the application.'],
        ['Jail Bank and JailPay', 'Jail Bank is Coming Soon; JailPay is planned.'],
      ] } },
    ] },
    { id: 'principles', title: 'Principles', blocks: [
      { ul: ['Separate wallet identity from password-derived authorization.', 'Distinguish configured readiness, completed transactions, and independent audits.', 'Keep each token and chain’s vault accounting isolated.', 'Treat public chain data and revealed creator keys as public.'] },
      { links: [{ label: 'About armoreum', href: '/about-armoreum' }, d('security-model-overview', 'Security Model Overview'), { label: 'Integrations', href: '/integrations-armoreum' }] },
    ] } ] },
  'security-model-overview': { lead: 'How protection is meant to work, what it covers, and where it stops.', sections: [
    { id: 'model', title: 'The model', blocks: [
      { p: 'For password-authorized creator-vault operations, the client derives a one-time authorization proof locally from the launch password. The creator EVM wallet also signs the operation; amount, recipient, launch, and authorization epoch are bound to the request. These checks serve different purposes.' },
      { p: 'A completed launch reveals its creator wallet key publicly for import. That key must be treated as compromised; it does not replace the password-derived proof for protected vault operations. Device compromise, password disclosure, contract bugs, and administrative powers remain risks.' },
    ] },
    { id: 'protected', title: 'Protected versus ordinary assets', blocks: [
      { table: { label: 'model-assets', headers: ['', 'Protected asset', 'Ordinary wallet asset'], rows: [
        ['Authority', 'Wallet plus contract-enforced authorization.', 'Whoever holds the key.'],
        ['Verified', 'Per-launch contracts and chain state must be checked on the relevant explorer; an independent audit is not implied.', 'Unchanged by armoreum.'],
      ] } },
      { callout: { tone: 'warn', title: 'Limits', text: 'Creator-vault protections do not protect assets held directly in an ordinary wallet. Password or device compromise, public creator-key misuse, privileged contract actions, and contract defects remain risks.' } },
      { links: [{ label: 'Security page and simulator', href: '/security' }, d('threat-model', 'Threat Model'), d('security-limitations', 'Security Limitations')] },
    ] } ] },
  'jailswap-overview': { lead: 'JailSwap is Coming Soon. This status does not disable the live Bridge or Creator Vault reward flows.', sections: [
    { id: 'jailswap', title: 'What JailSwap is', blocks: [
      { p: 'JailSwap is Coming Soon as a protected-swap product with Jail and Unjail controls. It is not currently available for trading; creator-reward Unjail is a separate Creator Vault action and does not make JailSwap available.' },
      { table: { label: 'jailswap-state', headers: ['Item', 'State'], rows: [
        ['Product status', 'Coming Soon; do not use this page as a live swap or quote.'],
        ['Creator rewards', 'A separate feature: supported Creator Vault credits issue fully backed JailETH in the same transaction when issuance is enabled.'],
        ['Creator Unjail', 'Uses the selected launch’s Creator Vault and its password-authorized flow; it is not a JailSwap transaction.'],
        ['General ERC-20 protection', 'Not provided by creator-reward vaults or launch hooks.'],
      ] } },
    ] },
    { id: 'limits', title: 'Limits', blocks: [
      { ul: ['Ordinary wallet assets remain controllable by the private key.', 'JailSwap trading is not available yet.', 'Creator Unjail and token-launch functionality are separate from JailSwap.'] },
      { links: [{ label: 'JailSwap explained', href: '/jailswap-armoreum' }, { label: 'Open JailSwap', href: '/jailswap' }, d('jaileth-architecture', 'jailETH Architecture')] },
    ] } ] },
  'bridge-overview': { lead: 'Bridge registered Armoreum Multichain tokens between Ethereum and Robinhood Chain, and follow their delivery in Bridge Explorer.', sections: [
    { id: 'source', title: 'Contract source', blocks: [
      { p: 'The bridge uses a LayerZero lock-and-release OApp for each Armoreum Multichain token pair. The source contract locks tokens; the destination verifies the authenticated message, applies the configured 0.2% destination Bridge Vault fee, and releases prefunded matching inventory. It does not mint or burn. Transfer IDs are consumed once to prevent replay.' },
      { p: 'LocalBridgeAdapter models the same lock-and-release idea for local EVM chains only.' },
    ] },
    { id: 'interface', title: 'Interface and status', blocks: [
      { table: { label: 'bridge-ov-state', headers: ['Item', 'State'], rows: [
        ['Infrastructure', 'LayerZero endpoints, Armoreum 1-of-1 DVN contracts, and destination executors are configured on both networks.'],
        ['Pair availability', 'Bridge is live for registered, activated pairs. New Multichain launches automatically provision and validate their token-specific route after both launch legs complete.'],
        ['Transfer form', 'Enter a supported token contract address or open Bridge from its token page. Switch direction, connect a wallet, and optionally choose a recipient; otherwise the recipient is the connected wallet.'],
        ['Maximum per transfer', 'The form and API cap a transfer at 10% of free destination reserve, subject to any lower contract limit. Excess input is rejected with the current maximum. Direct contract-call enforcement is a separate boundary.'],
        ['Completion', 'A transfer is complete only after destination execution is confirmed; source confirmation alone is not completion.'],
      ] } },
      { links: [{ label: 'Bridge explained', href: '/bridge-armoreum' }, { label: 'Open Bridge', href: '/bridge' }, { label: 'Bridge Explorer', href: '/bridge-explorer' }] },
    ] } ] },
  'launchpad-overview': { lead: 'Mainnet launch workflows for Pons V2, Ethereum, and Multichain.', sections: [
    { id: 'flow', title: 'What the flow does', blocks: [
      { p: 'The flow collects token details, prepares launch authorization, checks network-specific funding and live contract configuration, then submits the selected mainnet launch workflow after creator confirmation.' },
      { table: { label: 'launch-ov', headers: ['Item', 'Detail'], rows: [
        ['Supply', 'FIXED_SUPPLY of 1,000,000,000 ether (one billion tokens, 18 decimals), minted once; no editable supply field.'],
        ['Modes', 'Pons V2 on Robinhood Chain (4663), Ethereum (1), and Multichain across both.'],
        ['Preflight', 'Each mode checks its live network and launch contracts before a transaction is submitted.'],
        ['Fees', 'Review the selected mode’s displayed funding and tax settings; gas and any transaction-specific quote may change.'],
      ] } },
      { links: [{ label: 'Launchpad', href: '/launchpad-armoreum' }, { label: 'Open the launch flow', href: '/launch-token' }, d('token-launch-lifecycle', 'Token Launch Lifecycle')] },
    ] } ] },
  'supported-networks': { lead: 'Networks the application references and what each one means.', sections: [
    { id: 'networks', title: 'Networks', blocks: [
      { table: { label: 'networks-table', headers: ['Network', 'Chain id', 'State'], rows: [
        ['Robinhood Chain', '4663', 'Pons V2 and Armoreum launch contracts pass live readiness checks. Explorer: robin.etherscan.io.'],
        ['Ethereum', '1', 'Ethereum launch contracts and Uniswap V4 configuration pass live readiness checks. Explorer: etherscan.io.'],
        ['Multichain', 'Ethereum EID 30101 and Robinhood EID 30416', 'Live Bridge routes serve registered, activated pairs. A new pair is automatically provisioned after both coordinated launch legs complete.'],
        ['Local development EVM', 'Configured locally', 'Used by the local launch path and the local bridge adapter; not a public network.'],
      ] } },
      { p: 'Mainnet preflight uses configured RPC endpoints and confirms the reported chain IDs. A ready launch mode is not an independent audit or proof that a particular token launch or bridge transfer has completed.' },
      { links: [d('chain-configuration', 'Chain Configuration'), d('rpc-and-explorer', 'RPC and Explorer'), { label: 'Status guidance', href: '/status-armoreum' }] },
    ] } ] },
  'transactions-and-fees': { lead: 'What you pay, what is a quote, and what is not.', sections: [
    { id: 'fees', title: 'Fees and transactions', blocks: [
      { ul: ['Network gas applies. A transaction included on-chain that reverts can still consume gas; a request that fails before submission may not.', 'Pons, Ethereum, and Multichain have different base-fee and additional-tax rules; read the selected mode’s fee summary.', 'Ethereum’s 0.7% foundation base tax is distinct from the configurable additional tax; existing launches may keep earlier settings.', 'Multichain retains the configured bridge fee in the destination Bridge Vault; check the quote before signing.', 'JailSwap is Coming Soon. Confirmed transactions are generally irreversible; check both source and destination explorers for bridge transfers.'] },
    ] },
    { id: 'status', title: 'Reading transaction status', blocks: [
      { steps: [
        { title: 'Pending', text: 'Submitted but not yet included. Do not resubmit until you know it failed.' },
        { title: 'Failed', text: 'Included and reverted, or never accepted. Gas may or may not have been spent.' },
        { title: 'Confirmed', text: 'Included on-chain. For a bridge, still wait for the destination receipt.' },
      ] },
      { links: [d('funding-and-required-amount', 'Funding and Required Amount'), d('transaction-pending', 'Transaction Pending')] },
    ] } ] },
  'troubleshooting-overview': { lead: 'A short diagnostic order for common problems.', sections: [
    { id: 'diagnose', title: 'Diagnose', blocks: [
      { steps: [
        { title: 'Wrong network', text: 'Confirm chain id 4663 or 1 in your wallet.' },
        { title: 'Wallet not connecting', text: 'Confirm your wallet is available, connected to the selected chain, and authorized for the requested account.' },
        { title: 'Feature status', text: 'Pons V2, Ethereum, and Multichain launch paths use live preflight checks. JailSwap is Coming Soon; a Multichain bridge route appears only after its token pair is provisioned.' },
        { title: 'Draft errors', text: 'Fix the field named in the error. Application request quotas are not imposed; external providers can still reject requests or become unavailable.' },
      ] },
    ] },
    { id: 'table', title: 'Responses', blocks: [
      { table: { label: 'ts-ov', headers: ['Symptom', 'Likely cause'], rows: [
        ['400', 'Invalid field or identifier.'],
        ['404', 'Draft or upload reference does not exist.'],
        ['External provider quota', 'An upstream service can enforce its own allowance; removing application quotas does not remove provider limits.'],
        ['503', 'Storage, indexer, or another integration is unavailable.'],
      ] } },
      { links: [d('wrong-network', 'Wrong Network'), d('launch-failed', 'Launch Failed'), { label: 'Contact', href: '/contact-armoreum' }] },
    ] } ] },
  'developer-integrations': { lead: 'What a developer can build against, and what to avoid assuming.', sections: [
    { id: 'api', title: 'API', blocks: [
      { p: 'The API offers launch-draft, image-upload, launch metadata, network readiness, Multichain bridge, transfer tracking, and creator-reward support routes. A live readiness response does not imply that a token-specific bridge pair or transfer exists.' },
    ] },
    { id: 'contracts', title: 'Contracts and dependencies', blocks: [
      { table: { label: 'dev-deps', headers: ['Item', 'Distinction'], rows: [
        ['OpenZeppelin', 'Imported and used in contract source.'],
        ['LayerZero OApp', 'Armoreum operates its custom 1-of-1 verifier and chain-specific destination executors. A token-specific OApp pair is provisioned after both launch legs complete.'],
        ['Uniswap V4', 'Used for Ethereum launch liquidity and configured integrations; hook behavior applies only to the pool that uses the hook.'],
        ['JailSwap', 'Coming Soon; do not treat it as an enabled swap service.'],
      ] } },
      { links: [d('api-overview', 'API Overview'), d('contract-overview', 'Contract Overview'), d('environment-variables', 'Environment Variables'), { label: 'Integrations status', href: '/integrations-armoreum' }] },
    ] } ] },
  'faq-overview': { lead: 'Short answers with links to the evidence.', sections: [
    { id: 'faq', title: 'Questions', blocks: [
      { cards: [
        { title: 'Can I swap with JailSwap?', text: 'Not yet. JailSwap is Coming Soon.' },
        { title: 'Can I bridge?', text: 'Yes. Bridge is live for registered, activated Ethereum ↔ Robinhood pairs. Open /bridge or the Bridge action on a Multichain token page; new successful Multichain launches automatically provision their route.' },
        { title: 'Does launching create a real token?', text: 'Pons V2, Ethereum, and Multichain use mainnet launch workflows after live preflight and creator confirmation.' },
        { title: 'Are my wallet assets protected?', text: 'Not automatically. Ordinary wallet assets remain controllable by the key.' },
        { title: 'Is there an independent audit?', text: 'This documentation does not claim an independent audit. Review public contract source and current chain state separately.' },
        { title: 'How does creator Unjail work?', text: 'The selected launch’s Creator Vault burns JailETH and pays ETH to an allowed recipient after the required creator-wallet signature and one-time password-derived proof.' },
      ] },
      { links: [d('frequently-asked-questions', 'Frequently Asked Questions'), { label: 'Privacy Policy', href: '/privacy-armoreum' }] },
    ] } ] },
};
