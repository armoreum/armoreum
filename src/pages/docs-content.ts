export type DocSection = { title: string; pages: string[] };

export const docSections: DocSection[] = [
  { title: 'Getting started', pages: ['Introduction', 'What Is armoreum?', 'Core Concepts', 'How armoreum Works', 'Quick Start', 'Glossary', 'Frequently Asked Questions'] },
  { title: 'Overview topics', pages: ['Getting Started Overview', 'armoreum Overview', 'Security Model Overview', 'JailSwap Overview', 'Bridge Overview', 'Launchpad Overview', 'Supported Networks', 'Transactions and Fees', 'Troubleshooting Overview', 'Developer Integrations', 'FAQ Overview'] },
  { title: 'Protocol architecture', pages: ['System Overview', 'Architecture Diagram', 'Token Launch Lifecycle', 'Wallet and Account Model', 'Creator Authorization Architecture', 'Creator Reward Accounting', 'jailETH Architecture', 'Redemption and Unjailing', 'Backend Services', 'Database and Event Processing', 'External Protocol Integrations'] },
  { title: 'Token launch guide', pages: ['How to Launch a Token', 'Token Name and Symbol', 'Token Description and Image', 'Optional Website and X Links', 'Authorization Setup', 'Funding and Required Amount', 'Automatic Launch Processing', 'Launch Confirmation', 'Explore and Token Details', 'Launch Errors and Troubleshooting'] },
  { title: 'Credentials and security', pages: ['Security Model', 'Private Key Disclosure', 'Authorization Credentials', 'Authorization and Verification', 'Credential Registration', 'Challenge and Signature Validation', 'Replay Protection', 'Account Binding', 'Credential Recovery', 'Threat Model', 'Security Limitations', 'Post-Quantum Security'] },
  { title: 'Creator rewards', pages: ['How Creator Rewards Work', 'Reward Sources', 'Reward Calculations', 'Claim Rewards', 'Authorization for Claims', 'Reward Accounting', 'Failed Claims', 'Claim History', 'Security and Recovery'] },
  { title: 'jailETH', pages: ['What Is jailETH?', 'Token Economics', 'Issuance and Backing', 'Claiming jailETH', 'UnjailETH Redemption', 'ETH Destination Address', 'Reserve Accounting', 'Redemption Events', 'Failed Redemptions', 'Risks and Limitations'] },
  { title: 'Smart contracts', pages: ['Contract Overview', 'Mainnet Addresses', 'Contract Verification', 'Proxy Architecture', 'Implementation Contracts', 'Administrative Roles', 'Upgradeability', 'Events and Errors', 'Contract Interactions', 'Deployment History'] },
  { title: 'Contract security and administration', pages: ['Ownership and Role Assignments', 'Owner Wallet', 'Access Control', 'Emergency Pause', 'Treasury Permissions', 'Upgrade Authorization', 'Reserve Protection', 'Deployment and Initialization', 'Security Assumptions'] },
  { title: 'Developer documentation', pages: ['Developer Overview', 'Repository and Project Structure', 'Environment Variables', 'Local Development', 'Installation and Configuration', 'Smart Contract Development', 'Build and Test Commands', 'Deployment Procedures', 'RPC Configuration', 'Event Indexing', 'Database Schema', 'Error Handling', 'Troubleshooting'] },
  { title: 'API reference', pages: ['API Overview', 'Authentication', 'Token Launch Endpoints', 'Upload Endpoints', 'Quote and Fee Endpoints', 'Creator Reward Endpoints', 'Creator Authorization Endpoints', 'jailETH Endpoints', 'Redemption Endpoints', 'Token and Market Data', 'Transaction Status', 'Errors and Rate Limits'] },
  { title: 'Network and integrations', pages: ['Robinhood Mainnet', 'Chain Configuration', 'RPC and Explorer', 'Pons V2 Integration', 'Token Graduation', 'External Dependencies', 'Network Troubleshooting'] },
  { title: 'Troubleshooting and support', pages: ['Transaction Pending', 'Launch Failed', 'Incorrect Funding Amount', 'Authorization Setup Failed', 'Authorization Check Failed', 'Claim Failed', 'Redemption Failed', 'Wrong Network', 'Contract Verification Issues', 'Support FAQ'] },
];

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const descriptions: Record<string, string> = {
  introduction: 'A guide to Armoreum’s Pons V2, Ethereum, and Multichain mainnet launch paths and their security boundaries.',
  'what-is-armoreum': 'A token launch platform with network-specific fees, isolated creator rewards, and token-specific Multichain routes.',
  'quick-start': 'Understand the current repository and launch draft flow before integrating.',
  'mainnet-addresses': 'Configured Armoreum and protocol contract addresses for Ethereum and Robinhood Chain.',
  'api-overview': 'An inventory of live API routes and the status each route currently reports.',
  'creator-authorization-architecture': 'How creator-wallet signatures and password-derived one-time proofs protect Creator Vault operations.',
  'post-quantum-security': 'No quantum-resistant cryptography is implemented.',
  'funding-and-required-amount': 'Review network-specific launch funding requirements and the live preflight before sending funds.',
  'contract-verification': 'Distinguish live RPC readiness, explorer source verification, and an independent security audit.',
};
export const docs = docSections.flatMap((section) => section.pages.map((title) => ({
  title, section: section.title, slug: slugify(title),
  description: descriptions[slugify(title)] || `${title} in armoreum: source-backed behavior, current availability, and the limits of what can be verified.`,
})));

export const pageForSlug = (slug: string) => docs.find((page) => page.slug === slug);

export const apiRoutes = [
  ['GET', '/api/healthz', 'Service health response.'],
  ['GET', '/api/network', 'Reports observed chain IDs, RPC connection, and live launch / Multichain readiness checks.'],
  ['GET', '/api/overview', 'Returns verified launch counts and recent launch records with a dataStatus field.'],
  ['GET', '/api/multichain/readiness', 'Checks live Ethereum and Robinhood bridge infrastructure, operators, and launch integration. A ready response does not mean a token pair is active.'],
  ['GET', '/api/multichain-bridges', 'Lists verified Armoreum Multichain token pairs; an empty list means no pair is currently available.'],
  ['GET', '/api/launches', 'Returns verified launch records; invalid filters return 400 and a missing record returns 404.'],
  ['GET', '/api/launches/:launchId', 'Returns a verified launch record; invalid IDs return 400 and unknown IDs return 404.'],
  ['GET', '/api/activity', 'Returns 503: verified reorg-aware event indexer is not configured; invalid filters return 400.'],
  ['GET', '/api/token-metadata/:tokenAddress', 'Reads verified database metadata; invalid address 400, missing verified record 404, service failure 503.'],
  ['GET', '/api/storage/objects/*path', 'Reads completed image objects; unavailable or unverified objects return 404.'],
  ['POST', '/api/launch-drafts', 'Creates an empty draft (201); storage failure 503.'],
  ['GET', '/api/launch-drafts/:id', 'Reads a draft; invalid ID 400, absent draft 404, storage failure 503.'],
  ['PUT', '/api/launch-drafts/:id', 'Validates and saves draft metadata; invalid fields 400, absent draft 404, storage failure 503.'],
  ['POST', '/api/launch-drafts/:id/complete-details', 'Marks valid required details complete; missing draft 404, incomplete/unverified details 409.'],
  ['POST', '/api/launch-drafts/:id/funding-orders', 'Preflights the selected launch mode and estimates required funding; a live contract error blocks the request. A quote does not submit a launch.'],
  ['POST', '/api/storage/uploads/request-url', 'Validates image request then returns a direct upload target; invalid request 400, unavailable storage 503.'],
  ['POST', '/api/storage/uploads/complete', 'Validates, processes, and publishes uploaded image; invalid image 400, missing upload 404, unavailable service 503.'],
] as const;
