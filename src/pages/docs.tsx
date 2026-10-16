import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Check, Clipboard, FileText, Menu, Search, X } from 'lucide-react';
import { BrandTextTree } from '@/lib/brand-text';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';
import { ArmoreumLogoImages } from '@/components/armoreum-logo-images';
import { overviewPages } from './docs-overview-content';
import { apiRoutes, docs, docSections, pageForSlug } from './docs-content';

const ROOT = '/docs';
const routeFor = (slug: string) => `${ROOT}/${slug}`;
const intro = docs[0];

function slugFromPath(path: string) {
  return path === ROOT || path === `${ROOT}/` || path === '/documentation'
    ? intro.slug
    : decodeURIComponent(path.slice(ROOT.length + 1).split(/[?#]/)[0] || intro.slug);
}

function Code({ code, language = 'text', id }: { code: string; language?: string; id: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copy = async () => {
    setCopyFailed(false);
    setCopied(false);
    try {
      await copyTextToClipboard(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 2500);
    }
  };
  return <div className="armoreum-code" data-testid={`code-${id}`}>
    <div className="armoreum-code-head"><span>{language}</span><button type="button" onClick={() => void copy()} aria-label={copied ? 'Copied' : copyFailed ? 'Copy failed' : 'Copy code'} data-testid={`button-copy-code-${id}`}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? 'Copied' : copyFailed ? 'Copy failed' : 'Copy'}</button></div>
    {copyFailed && <p className="copy-failure-note" role="status">Copy failed. Select the code below and copy it manually.</p>}
    <pre><code>{code}</code></pre>
  </div>;
}

function Callout({ label = 'Implementation note', children, tone = 'plain' }: { label?: string; children: ReactNode; tone?: 'plain' | 'status' }) {
  return <aside className={`armoreum-callout ${tone}`} data-testid="docs-callout"><strong>{label}</strong><p>{children}</p></aside>;
}

function DataTable({ headers, rows, label }: { headers: string[]; rows: (string | React.ReactNode)[][]; label: string }) {
  return <BrandTextTree><div className="armoreum-table-wrap"><table className="armoreum-table" data-testid={`table-${label}`}><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div></BrandTextTree>;
}

function FlowDiagram({ items, label }: { items: string[]; label: string }) {
  return <BrandTextTree><div className="armoreum-flow" role="img" aria-label={label} data-testid="docs-diagram">{items.map((item, index) => <div className="armoreum-flow-item" key={item}><span className="armoreum-flow-no">{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong>{index < items.length - 1 && <ArrowRight className="armoreum-flow-arrow" size={16} />}</div>)}</div></BrandTextTree>;
}

function OverviewContent({ slug }: { slug: string }) {
  const page = overviewPages[slug];
  return <BrandTextTree>
    <p>{page.lead}</p>
    {page.sections.map((section) => <div key={section.id}>
      <h2 id={section.id}>{section.title}</h2>
      {section.blocks.map((b, i) => <div key={i}>
        {b.p && <p>{b.p}</p>}
        {b.ul && <ul>{b.ul.map((x) => <li key={x}>{x}</li>)}</ul>}
        {b.steps && <FlowDiagram label={section.title} items={b.steps.map((st) => `${st.title}: ${st.text}`)} />}
        {b.cards && <DataTable label={`${section.id}-cards`} headers={['Topic', 'Answer']} rows={b.cards.map((c) => [c.title, c.text])} />}
        {b.table && <DataTable label={b.table.label} headers={b.table.headers} rows={b.table.rows} />}
        {b.callout && <Callout label={b.callout.title} tone="status">{b.callout.text}</Callout>}
        {b.links && <ul>{b.links.map((l) => <li key={l.href + l.label}><Link href={l.href}>{l.label}</Link></li>)}</ul>}
      </div>)}
    </div>)}
  </BrandTextTree>;
}

function currentContent(slug: string, title: string) {
  if (overviewPages[slug]) return <OverviewContent slug={slug} />;
  if (docs.find((item) => item.slug === slug)?.section === 'API reference') return <ApiContent slug={slug} />;

  if (slug === 'introduction' || slug === 'what-is-armoreum') return <>
    <p>armoreum is security infrastructure for protected asset authorization, creator vaults, recovery, and cross-chain transfers. Its active tools include Creator Vault rewards and JailETH, password-authorized Claim / Unjail, offline recovery, ArmorProof, token discovery, and the LayerZero Bridge and Bridge Explorer. The Launchpad supports Ethereum, Pons V2 on Robinhood Chain, and coordinated Multichain launches.</p>
    <Callout label="Product availability" tone="status">Bridge is live for registered, activated Ethereum ↔ Robinhood token pairs. New Multichain launches automatically provision their bridge pair after both launch legs complete and validate successfully. JailSwap and Jail Bank remain Coming Soon; JailPay is a planned integration. Availability is not a guarantee of uninterrupted service or an independent security audit.</Callout>
    <h2 id="what-exists">What exists today</h2>
    <p>Verified launch records and metadata are available through the API. Image uploads use a server-validated request, upload, and completion flow. Armoreum launch contracts, per-launch reward vaults, tax routers, and the configured protocol integrations are checked by live mainnet preflight. Per-token status still depends on its confirmed launch records and current on-chain configuration.</p>
    <h2 id="design-goal">The security goal</h2>
    <p>Creator Vault operations use the required creator-wallet signature together with a launch-password-derived one-time proof. When issuance is enabled, each creator reward credit issues the matching fully backed JailETH in the same transaction, including credits below 0.01 ETH. This product-level control is not an independent audit or a guarantee against password, device, contract, or owner-key compromise.</p>
    <h2 id="status-language">Status language</h2>
    <DataTable label="status-terms" headers={['Status', 'Meaning here']} rows={[
      ['Ready', 'Live RPC preflight confirms the configured network, deployed code, and required pointers for that operation.'],
      ['Confirmed', 'A transaction or operation has a confirmed on-chain result; bridge completion also requires destination execution.'],
      ['Coming Soon', 'JailSwap is not available for trading.'],
      ['Not audited', 'Readiness and explorer source verification do not replace an independent security audit.'],
    ]} />
  </>;

  if (slug === 'core-concepts' || slug === 'glossary') return <>
    <p>{title} explains the terms used for Armoreum’s live launch paths and their on-chain boundaries.</p>
    <DataTable label="concepts" headers={['Term', 'Meaning']} rows={[
      ['Pons V2', 'Robinhood Chain launch flow; live readiness checks cover its configured contracts and Armoreum fee-routing integration.'],
      ['Ethereum', 'Chain ID 1; launch uses Uniswap V4 and the configured Ethereum Armoreum contracts.'],
      ['Multichain', 'A coordinated Ethereum and Robinhood launch with a separate token-specific Bridge Vault and lock-and-release pair.'],
      ['Robinhood Chain', 'Chain ID 4663; Pons V2 is the launch and market path.'],
      ['Creator Reward Vault', 'Per-launch ETH accounting with fully backed, non-transferable JailETH and password-authorized Unjail.'],
      ['Password authorization', 'A local Argon2id-derived authorization secret and one-time hash-chain proof, in addition to the creator wallet signature.'],
      ['LayerZero DVN', 'Armoreum-operated 1-of-1 packet verifier; it is a centralized trust assumption, not an independent quorum.'],
      ['Additional tax', 'A launch-mode-specific tax, separate from the Ethereum base tax and Pons protocol fees.'],
    ]} />
    <Callout>Live readiness means configured on-chain code and pointers passed a preflight check. It does not mean an independent audit or a completed token-specific operation.</Callout>
  </>;

  if (slug === 'frequently-asked-questions' || slug === 'support-faq') return <>
    <h2 id="is-launch-live">Can I launch a token now?</h2>
    <p>Pons V2, Ethereum, and Multichain launch paths are enabled after their live preflight checks and the creator’s confirmation. Each launched token must still be checked using its own confirmed transaction and metadata.</p>
    <h2 id="are-contracts-deployed">Are Armoreum contracts deployed?</h2>
    <p>Yes. This guide links the configured mainnet contracts and protocol endpoints. Use the relevant chain explorer to inspect source verification, current roles, and each token’s per-launch contracts.</p>
    <h2 id="is-automatic-issuance-live">Is automatic JailETH issuance live?</h2>
    <p>When issuance is enabled, the Creator Vault credits fully backed JailETH in the same transaction as each eligible creator reward. Unjail separately requires its per-launch authorization and current vault balance.</p>
    <h2 id="is-chain-supported">Which networks are listed?</h2>
    <p>Ethereum (chain ID 1) and Robinhood Chain (chain ID 4663) are the supported mainnets. Multichain coordinates both. A bridge pair becomes available for a token only after its two launch legs complete.</p>
    <h2 id="is-there-quantum-resistance">Is armoreum quantum resistant?</h2>
    <p>No quantum-resistant cryptography is implemented. The intended independent-authorization direction is not a post-quantum guarantee.</p>
  </>;

  if (slug === 'security-model' || slug === 'private-key-disclosure' || slug === 'threat-model' || slug === 'security-limitations' || slug === 'security-assumptions') return <>
    <p>The security boundary is narrow: protected Creator Vault operations require the creator EVM wallet signature and the launch’s password-derived one-time authorization proof. The generated creator private key is publicly disclosed after a successful launch, so anyone may use that key for ordinary EVM actions.</p>
    <DataTable label="security-boundaries" headers={['Property', 'Current evidence']} rows={[
      ['Creator authorization', 'The creator-wallet signature and the one-time password-derived proof are separate checks; neither substitutes for the other.'],
      ['Public creator key', 'The post-launch creator key is intentionally public. Treat it as compromised and do not use it as a long-term secret.'],
      ['Multichain verification', 'The custom DVN is a single 1-of-1 owner authority. It is centralized and is not an independent verifier quorum.'],
      ['Bridge completion', 'A source lock is not completion; confirm the destination transaction and release event. No token pair is active yet.'],
      ['Quantum resistance', 'Not implemented. EVM signatures and hash-chain authorization are not post-quantum guarantees.'],
    ]} />
    <h2 id="scope-and-assumptions">Scope and assumptions</h2>
    <p>The live readiness check verifies configured code and contract links, not the safety of the owner signer, an independent audit, all explorer source matches, or successful execution for every token. Review the current addresses and permissions before interacting.</p>
  </>;

  if (slug === 'wallet-and-account-model') return <>
    <p>The creator account for a launch is a generated EVM wallet derived from the launch password. After a confirmed launch its private key is publicly shown so the creator can import it; anyone who sees it can control that EOA. Protected vault operations still require the launch-specific authorization and wallet signature.</p>
    <p>Wallet connection is used to sign a particular operation and must match that launch’s creator address and required network. A wallet connection alone does not change the creator account or grant access to another token’s vault.</p>
    <Callout label="Privacy boundary">Never reuse the revealed creator key as a secret. Keep the launch password private and store the downloaded recovery file securely; its contents grant creator recovery authority.</Callout>
  </>;

  if (slug === 'environment-variables') return <>
    <p>Variable names below were read from server and deployment source. Their runtime values are not published here, and production configuration should be managed outside the client bundle.</p>
    <DataTable label="environment-variables" headers={['Source area', 'Names referenced in source']} rows={[
      ['API network status', 'ALCHEMY_ETHEREUM_RPC_URL and ALCHEMY_ROBINHOOD_RPC_URL.'],
      ['Hardhat mainnet networks', 'Use the matching ALCHEMY_ETHEREUM_RPC_URL or ALCHEMY_ROBINHOOD_RPC_URL secret.'],
      ['Deployment preflight', 'DEPLOY_MAINNET_CONFIRMATION, CANONICAL_PLATFORM_OWNER_VERIFIED, PONS_TAX_ROUTING_SOURCE_VERIFIED, CANCUN_EVM_VERIFIED.'],
      ['Deployment configuration', 'Canonical platform owner, Pons tax-routing source, configured relying-party origin hash, CREATE2 deployer address and code hash, and maximum vanity attempts.'],
    ]} />
    <Callout label="Keep secrets local">The deployment also requires a configured signing account. Do not publish its private key, values of production settings, or secrets in source control or frontend code.</Callout>
  </>;

  if (slug === 'deployment-procedures') return <>
    <p>Mainnet deployments and upgrades use network-specific scripts and explicit preflight checks. Current configured contract addresses are listed in the registry; the live readiness endpoints also check chain IDs, bytecode, active factory pointers, and required integration settings.</p>
    <p>Never infer a successful deployment from source code, a script, or a local manifest alone. Confirm the transaction and resulting contract state on the intended mainnet explorer.</p>
    <Callout label="Mainnet safety">This documentation does not submit transactions. Review the network, address, fee, and exact operation in the application before signing.</Callout>
  </>;

  if (slug === 'proxy-architecture') return <>
    <p>Shared factory and vault-factory proxies point to separately deployed implementations. Each successful launch creates token-specific Creator Vault and TaxRouter instances; Multichain launches also receive isolated Bridge Vault accounting and a token-specific lock-and-release pair.</p>
    <FlowDiagram label="Configured mainnet proxy and per-launch relationships" items={['ArmoreumFactory proxy', 'VaultFactory + implementations', 'Per-token Creator Vault + TaxRouter', 'Multichain Bridge Vault', 'Token-specific LayerZero bridge pair']} />
    <p>See the address registry for shared infrastructure. Per-token contract addresses are published with the verified launch record and must be checked on that token’s chain.</p>
  </>;

  if (slug === 'token-name-and-symbol') return <>
    <p>The draft API allows a name up to 40 characters and a symbol of 1–12 uppercase letters or digits, beginning with a letter. Name values cannot contain leading or trailing spaces when provided. Completing details requires a non-empty name and valid symbol.</p>
    <Code id="symbol-shape" language="text" code={'Accepted symbol shape: [A-Z][A-Z0-9]{0,11}'} />
    <p>This describes API validation, not a Pons deployment, uniqueness guarantee, or completed token launch.</p>
  </>;

  if (slug === 'optional-website-and-x-links') return <>
    <p>Both links are optional. Website URLs are normalized to HTTP or HTTPS and reject embedded login credentials. X links must use x.com or twitter.com, include a non-root path, and reject embedded credentials. Saved values are normalized by the API.</p>
  </>;

  if (slug === 'launch-errors-and-troubleshooting' || slug === 'launch-failed') return <>
    <p>Draft validation errors identify missing or invalid name, symbol, tax, URL, or image fields. API errors are returned as short error messages with the HTTP status; they do not represent an on-chain launch failure.</p>
    <DataTable label="launch-troubleshooting" headers={['Response', 'Meaning / safe action']} rows={[
      ['400', 'Invalid fields, draft ID, or upload metadata. Correct the reported field before retrying.'],
      ['404', 'The draft or upload reference does not exist. Confirm the reference rather than creating duplicate work.'],
      ['409', 'Required details or a server-verified image are incomplete; complete and save them first.'],
      ['429', 'Rate limit reached. Respect Retry-After before another attempt.'],
      ['503', 'Draft/image storage or funding integration is unavailable. Do not send funds; authorization setup is not a funding or launch confirmation.'],
    ]} />
  </>;

  if (slug === 'system-overview' || slug === 'architecture-diagram' || slug === 'backend-services') return <>
    <p>The application connects protected authorization and Creator Vaults with JailETH, recovery, ArmorProof, token discovery, launch services, and live cross-chain transfers. It spans the React/Vite client, Express API, database-backed records, object storage, server-side Alchemy RPCs, and mainnet contracts. Bridge is live for registered, activated pairs; JailSwap and Jail Bank remain Coming Soon.</p>
    <FlowDiagram label="Current application and mainnet integration boundaries" items={['Creator browser · React/Vite', 'Express API · launch + bridge services', 'Database · launch and transfer records', 'Ethereum + Robinhood mainnet RPCs', 'Pons V2 · Ethereum V4 · LayerZero']} />
    <h2 id="boundaries">Execution boundaries</h2>
    <DataTable label="architecture-boundaries" headers={['Area', 'Observed implementation', 'Availability']} rows={[
      ['Draft details', 'API validates and stores form metadata and completion state.', 'Implemented; no auth middleware on draft endpoints.'],
      ['Image upload', 'Signed/direct target, completion, image checks, optimization, public object.', 'Implemented, subject to configured storage.'],
      ['Chain network status', 'Live checks read Ethereum and Robinhood chain IDs, deployed Armoreum and protocol code, and required contract links.', 'API reports current observation.'],
      ['Launch indexing', 'Verified launches and token metadata are served by the API; market/activity endpoints have separate indexer availability.', 'Check each endpoint status.'],
      ['Multichain bridge', 'Live LayerZero lock-and-release routes with Armoreum DVN, destination executors, relay worker, and automatic pair provisioning.', 'Available for registered, activated token pairs; destination execution confirms delivery.'],
      ['Reward authorization contracts', 'Per-launch Creator Vaults and TaxRouters are deployed and linked to launch records.', 'Verify the selected launch and current state.'],
    ]} />
  </>;

  if (slug === 'token-launch-lifecycle' || slug.includes('launch') || slug === 'automatic-launch-processing' || slug === 'launch-confirmation') return <>
    <p>The UI collects launch details, prepares password-protected creator authorization, checks the selected chain’s contracts and funding, then submits the confirmed mainnet workflow. Pons V2, Ethereum, and Multichain use distinct launch operations and fee rules.</p>
    <FlowDiagram label="Mainnet launch lifecycle" items={['Choose Pons V2 / Ethereum / Multichain', 'Enter token details + password', 'Check required funding on each chain', 'Run live contract preflight', 'Creator confirms and signs', 'Submit each launch leg', 'Verify token and per-launch vault records']} />
    <h2 id="draft-fields">Draft field rules</h2>
    <DataTable label="draft-fields" headers={['Field', 'Validation in source']} rows={[
      ['Name', 'Up to 40 characters; a provided name cannot have leading or trailing spaces; completion requires non-empty name.'],
      ['Symbol', '1–12 uppercase letters or digits, beginning with a letter.'],
      ['Description', 'Up to 320 characters.'],
      ['Additional tax', 'Configured separately from Ethereum’s 0.7% foundation base tax. The distribution split depends on the selected launch mode.'],
      ['Website / X', 'Optional normalized HTTP(S) website; X links must be a non-root x.com or twitter.com URL.'],
      ['Image', 'PNG/JPEG/WebP, square image, validated before a public image URL is used.'],
    ]} />
    <Callout label="Check before funding">Funding requirements differ by launch mode and chain. Use the current in-app funding instructions and confirm the receiving address on the selected network before sending funds.</Callout>
    <p>Do not reuse an old draft’s funding address or infer a deposit from a protocol default. Wait for confirmed funding and the application’s current status before retrying.</p>
  </>;

  if (slug.includes('image') || slug === 'upload-endpoints') return <>
    <p>Uploads use three stages: request an upload target, send the file directly to that target, then call the completion endpoint. The API validates object metadata and the decoded image before it publishes a processed object path.</p>
    <FlowDiagram label="Image upload stages" items={['POST request-url', 'Upload bytes to returned target', 'POST complete', 'Image validation + optimization', 'Public image URL']} />
    <DataTable label="image-limits" headers={['Rule', 'Implementation']} rows={[
      ['Accepted types', 'PNG, JPEG, WebP.'],
      ['Raw request size', '1 byte through 100 MB.'],
      ['Decoded image', 'Square; each dimension at most 8192 pixels and total at most 40 million pixels; animation is rejected.'],
      ['Processed logo', 'Output must be no larger than the Pons V2 5 MB logo limit.'],
      ['Upload requests', 'No application request quota or concurrent-job rejection. File type, size, pixel count, and upload-intent validation still apply.'],
    ]} />
  </>;

  if (slug.includes('credential') || slug.includes('authorization') || slug === 'challenge-and-signature-validation' || slug === 'replay-protection' || slug === 'account-binding' || slug === 'credential-recovery') return <>
    <p>New password-mode launches derive the authorization secret locally with Argon2id. A protected vault action requires the creator wallet’s EIP-712 signature and a one-time hash-chain proof bound to the launch, operation, and epoch. The server does not receive the plaintext password for Unjail.</p>
    <FlowDiagram label="Creator reward issuance and Unjail" items={['Creator authorization bound to launch', 'Creator reward reaches isolated vault', 'Matching backed JailETH issued in the same credit', 'Creator signs a specific Unjail request', 'One-time proof burns JailETH and pays the selected recipient']} />
    <Callout label="Security boundary">The creator key is publicly disclosed after a successful launch. It cannot substitute for the password-derived proof, and the proof cannot substitute for the required creator-wallet signature.</Callout>
    <h2 id="what-source-does">What the contract source specifies</h2>
    <ul><li>Factory enrollment binds the launch, creator, authorization signer, and expiry.</li><li>When issuance is enabled, every creator reward credit receives matching JailETH in the same transaction.</li><li>The amount and destination are bound to the Unjail request before the one-time proof is consumed.</li><li>The creator wallet and password-derived proof are independent required authorizations.</li></ul>
    <p>Confirm the selected launch’s chain, Creator Vault address, JailETH balance, proof availability, and current operation status before signing.</p>
  </>;

  if (slug === 'post-quantum-security') return <>
    <p>No quantum-resistant cryptography is implemented. Password-derived one-time hash chains and EVM signatures are not post-quantum security guarantees.</p>
    <p>Creator Vaults are deployed on Ethereum and Robinhood Chain. Check the selected launch’s authorization mode and on-chain configuration; this page does not claim that a specific Unjail request has succeeded.</p>
  </>;

  if (slug.includes('reward') || slug.includes('claim') || slug === 'failed-claims' || slug === 'claim-history') return <>
    <p>Creator reward accounting and Unjail are launch-specific. Check the token detail page for that launch’s verified vault balance and current reward status.</p>
    <h2 id="tax-model">Network and launch-mode fee rules</h2>
    <DataTable label="tax-source" headers={['Launch mode', 'Fee routing summary']} rows={[
      ['Pons V2 only', 'No Armoreum foundation base tax. Pons-only creator proceeds routed through TaxRouter split 90% to the Creator Vault and 10% to platform accounting.'],
      ['Pons Multichain', 'Pons fee routing splits 70% to Creator Vault, 10% to platform, and 20% to that launch’s Bridge Vault.'],
      ['Ethereum only', 'Future launches use a separate 0.7% foundation base tax; additional tax is directed to the creator. Existing HASH settings remain distinct.'],
      ['Ethereum Multichain', 'Future launches use the 0.7% foundation base tax; 80% of additional tax goes to the creator and 20% as ETH to the Bridge Vault for threshold-triggered token buyback.'],
    ]} />
    <Callout>Percentages are mode-specific configuration, not a quote for a particular swap. The token’s deployed router and current settings are authoritative.</Callout>
  </>;

  if (slug.toLowerCase().includes('jaileth') || slug.includes('redemption') || slug.includes('backing') || slug.includes('unjail')) return <>
    <p>CreatorRewardVault contracts are deployed on Ethereum and Robinhood Chain. When issuance is enabled, each creator-reward credit issues the same amount of fully backed JailETH in that transaction. This reward token is separate from user JailSwap receipts and Multichain Bridge Vault inventory.</p>
    <FlowDiagram label="Creator Vault reward and Unjail flow" items={['TaxRouter routes the creator share', 'Creator Vault receives the ETH credit', 'Vault issues matching JailETH', 'Creator signs the selected Unjail request', 'One-time proof burns JailETH and pays ETH']} />
    <DataTable label="vault-source-rules" headers={['Source behavior', 'Contract rule']} rows={[
      ['Backing liabilities', 'Accrued rewards plus jailETH total supply.'],
      ['Solvency', 'Vault checks ETH balance is at least accrued rewards plus total supply.'],
      ['Issuance', 'When enabled, every incoming creator reward credit issues the matching JailETH in the same transaction, including amounts below 0.01 ETH. A pause defers issuance.'],
      ['Redemption', 'requestUnjailETH records the amount and recipient; redeemJailETH consumes a separate proof, burns jailETH, and atomically pays that recipient 1:1.'],
      ['Excess withdrawal', 'Emergency withdrawer can withdraw only excess above accrued rewards plus token supply, with solvency checks.'],
      ['Transfers', 'Transfers between nonzero addresses revert; source calls the token soulbound.'],
    ]} />
    <p>Vault balances and administrative state vary by launch. Verify the selected vault on its chain before relying on backing, Unjail eligibility, redemption availability, or solvency.</p>
  </>;

  if (slug === 'contract-interactions') return <>
    <p>These contract interfaces support the configured launch flows. Verify the selected launch’s deployed addresses, implementation pointers, authorization state, and current chain before interacting.</p>
    <DataTable label="contract-functions" headers={['Contract', 'Source functions']} rows={[
      ['ArmoreumFactory', 'createPasswordRewardSystemFor, completePonsLaunch, completeMultichainLaunch, enrollmentDigest, predictVaultProxyAddress, setNewLaunchesPaused.'],
      ['CreatorRewardVault', 'creditCreatorRewards, thresholdClaimableRewards, requestUnjailETH, redeemJailETH, rotateAuthorization, recoverAuthorization, cancelPendingRewardOperation, backingStatus, setPauseStates, withdrawExcessBacking. Legacy claim selectors revert.'],
      ['TaxRouter', 'collectAdditionalTax, previewTax, withdrawablePlatformBalance, withdrawPlatform, setRoutingPaused.'],
      ['LayerZero Multichain bridge', 'quoteLock, lock source tokens, verify destination packet, release prefunded inventory once.'],
    ]} />
    <Callout>Use the shared-contract registry and the selected token’s detail page. Never guess or reuse a different launch’s per-token address.</Callout>
  </>;

  if (slug === 'events-and-errors') return <>
    <p>Contract events are emitted by the configured mainnet contracts. The API indexes verified launch records; market activity and token-specific bridge status have their own indexing and confirmation states.</p>
    <DataTable label="contract-events" headers={['Source contract', 'Representative events']} rows={[
      ['Factory', 'Reward-system enrollment, launch completion, and launch-pause events.'],
      ['CreatorRewardVault', 'Rewards accrued, same-credit JailETH issuance, Unjail redemption, authorization rotation, and vault-pause events.'],
      ['TaxRouter / bridge', 'AdditionalTaxDistributed, bridge TransferLocked, and destination TransferReleased events.'],
    ]} />
    <p>Custom errors cover invalid authorization, expired proofs, insufficient rewards or backing, duplicate distributions, paused operations, invalid configuration, and unauthorized tax sources.</p>
  </>;

  if (slug === 'mainnet-addresses' || slug.includes('contract') || slug.includes('deployment') || slug.includes('proxy') || slug.includes('administrative') || slug.includes('ownership') || slug.includes('upgrade') || slug.includes('treasury') || slug.includes('access-control') || slug.includes('pause') || slug.includes('reserve')) return <>
    <p>The registry below lists configured shared mainnet contracts and protocol endpoints. Live RPC readiness checks confirm the configured code and links; they do not replace explorer source verification or an independent audit. Creator Vaults, TaxRouters, Bridge Vaults, hooks, and bridge OApps are created or bound per launch.</p>
    <DataTable label="contract-registry" headers={['Network', 'Contract', 'Address', 'Purpose / evidence']} rows={[
      ['Ethereum · 1', 'ArmoreumFactory proxy', <a key="eth-factory" href="https://etherscan.io/address/0x69003a9C316E080855f04112D5E188A3329BA184" target="_blank" rel="noreferrer">0x69003a9C316E080855f04112D5E188A3329BA184</a>, 'Launch and reward-system coordinator; live preflight checks its code and pointers.'],
      ['Ethereum · 1', 'VaultFactory proxy', <a key="eth-vaultfactory" href="https://etherscan.io/address/0x69009e23f4c3c75d8a0ba270f94e20fae6b4b48d" target="_blank" rel="noreferrer">0x69009e23f4c3c75d8a0ba270f94e20fae6b4b48d</a>, 'Creates per-launch vaults.'],
      ['Ethereum · 1', 'Token deployer', <a key="eth-deployer" href="https://etherscan.io/address/0x69005e5ce18701ab7dc98fef511dec6ddd9cf5d5" target="_blank" rel="noreferrer">0x69005e5ce18701ab7dc98fef511dec6ddd9cf5d5</a>, 'Configured fixed-supply token deployer.'],
      ['Ethereum · 1', 'Hook factory', <a key="eth-hook" href="https://etherscan.io/address/0x690084aa31e5cff13657c63b567cc5896F7c4e45" target="_blank" rel="noreferrer">0x690084aa31e5cff13657c63b567cc5896F7c4e45</a>, 'Deploys launch-specific Uniswap V4 hooks.'],
      ['Ethereum · 1', 'TaxRouter implementation', <a key="eth-tax" href="https://etherscan.io/address/0x6900F46Db09E313802AA8b52BB475b99379e5699" target="_blank" rel="noreferrer">0x6900F46Db09E313802AA8b52BB475b99379e5699</a>, 'Configured implementation pointer for new launch reward routing.'],
      ['Ethereum · 1', 'JailSeed', <a key="eth-jail-seed" href="https://etherscan.io/address/0x690042530954a05d996bef713cb4279de2a5191e" target="_blank" rel="noreferrer">0x690042530954a05d996bef713cb4279de2a5191e</a>, 'Armoreum Ethereum launch seed integration.'],
      ['Ethereum · 1', 'Uniswap V4 PoolManager', <a key="eth-pool-manager" href="https://etherscan.io/address/0x000000000004444c5dc75cb358380d2e3de08a90" target="_blank" rel="noreferrer">0x000000000004444c5dc75cb358380d2e3de08a90</a>, 'Uniswap protocol dependency.'],
      ['Ethereum · 1', 'LayerZero Endpoint · EID 30101', <a key="eth-lz" href="https://etherscan.io/address/0x1a44076050125825900e736c501f859c50fE728c" target="_blank" rel="noreferrer">0x1a44076050125825900e736c501f859c50fE728c</a>, 'LayerZero protocol endpoint, not Armoreum-owned.'],
      ['Robinhood · 4663', 'ArmoreumFactory proxy', <a key="rh-factory" href="https://robin.etherscan.io/address/0x6900aA5440E51b0DF7781507A58Fc27227aA6d3b" target="_blank" rel="noreferrer">0x6900aA5440E51b0DF7781507A58Fc27227aA6d3b</a>, 'Pons launch and reward-system coordinator; live preflight checks its code and links.'],
      ['Robinhood · 4663', 'VaultFactory proxy', <a key="rh-vaultfactory" href="https://robin.etherscan.io/address/0x6900dD2Dcf99363a83162E82c48D2c7822f1b409" target="_blank" rel="noreferrer">0x6900dD2Dcf99363a83162E82c48D2c7822f1b409</a>, 'Creates per-launch vaults.'],
      ['Robinhood · 4663', 'Pons V2 factory', <a key="pons-factory" href="https://robin.etherscan.io/address/0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" target="_blank" rel="noreferrer">0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e</a>, 'External launch protocol.'],
      ['Robinhood · 4663', 'Pons V2 launch-and-buy', <a key="pons-launchbuy" href="https://robin.etherscan.io/address/0xe33E9E479dF8802cb0866d5d05258bEc4cF62948" target="_blank" rel="noreferrer">0xe33E9E479dF8802cb0866d5d05258bEc4cF62948</a>, 'Atomic Pons launch and initial buy integration.'],
      ['Robinhood · 4663', 'Pons V2 FeeEscrow', <a key="pons-escrow" href="https://robin.etherscan.io/address/0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" target="_blank" rel="noreferrer">0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e</a>, 'External Pons fee accounting.'],
      ['Robinhood · 4663', 'Pons V2 MemeHook', <a key="pons-hook" href="https://robin.etherscan.io/address/0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" target="_blank" rel="noreferrer">0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044</a>, 'External Pons market hook.'],
      ['Robinhood · 4663', 'Pons V2 Buyback Vault', <a key="pons-buyback" href="https://robin.etherscan.io/address/0x42df2a798f82289E177311362e8f5ccC45c1219c" target="_blank" rel="noreferrer">0x42df2a798f82289E177311362e8f5ccC45c1219c</a>, 'External Pons buyback infrastructure.'],
      ['Robinhood · 4663', 'Pons V2 LaunchLocker', <a key="pons-locker" href="https://robin.etherscan.io/address/0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952" target="_blank" rel="noreferrer">0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952</a>, 'External Pons launch infrastructure.'],
      ['Robinhood · 4663', 'Pons V2 LaunchDeployer', <a key="pons-deployer" href="https://robin.etherscan.io/address/0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42" target="_blank" rel="noreferrer">0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42</a>, 'External Pons token and curve deployer.'],
      ['Robinhood · 4663', 'Pons V2 GraduationExecutor', <a key="pons-grad-exec" href="https://robin.etherscan.io/address/0xC7819B64A1dAECD7eC19856d026cb14EfBd89046" target="_blank" rel="noreferrer">0xC7819B64A1dAECD7eC19856d026cb14EfBd89046</a>, 'External Pons graduation infrastructure.'],
      ['Robinhood · 4663', 'Pons V2 GraduationGuard', <a key="pons-grad-guard" href="https://robin.etherscan.io/address/0xf5695117b99B6f6401e67d4195BD653628176C6C" target="_blank" rel="noreferrer">0xf5695117b99B6f6401e67d4195BD653628176C6C</a>, 'External Pons graduation infrastructure.'],
      ['Robinhood · 4663', 'Uniswap V4 PoolManager', <a key="rh-pool-manager" href="https://robin.etherscan.io/address/0x8366a39cc670b4001a1121b8f6a443a643e40951" target="_blank" rel="noreferrer">0x8366a39cc670b4001a1121b8f6a443a643e40951</a>, 'Uniswap protocol dependency.'],
      ['Robinhood · 4663', 'LayerZero Endpoint · EID 30416', <a key="rh-lz" href="https://robin.etherscan.io/address/0x6F475642a6e85809B1c36Fa62763669b1b48DD5B" target="_blank" rel="noreferrer">0x6F475642a6e85809B1c36Fa62763669b1b48DD5B</a>, 'LayerZero protocol endpoint, not Armoreum-owned.'],
      ['Both mainnets', 'Armoreum Custom DVN', <a key="dvn" href="https://etherscan.io/address/0xD96A211B07e9d38d26AD4C3Dbb8437182FA37946" target="_blank" rel="noreferrer">0xD96A211B07e9d38d26AD4C3Dbb8437182FA37946</a>, 'Deployed at this address on each chain; owner-controlled 1-of-1 verifier, not an independent quorum.'],
      ['Both mainnets', 'Armoreum LayerZero Executor', <a key="executor" href="https://etherscan.io/address/0x7b4273f93aF6ab971bF1A5F2425ed614F2DA0627" target="_blank" rel="noreferrer">0x7b4273f93aF6ab971bF1A5F2425ed614F2DA0627</a>, 'Deployed at this address on each chain; destination execution/gas role.'],
      ['Both mainnets', 'Per-token bridge OApp pair', 'Automatically provisioned after both Multichain launch legs complete', 'Bridge is live for registered, activated pairs. Check the selected pair rather than inferring a route from shared infrastructure.'],
    ]} />
    <h2 id="prefix-rule">Address prefix and deployment script</h2>
    <p>Contract source checks a 0x6900 address prefix for applicable addresses, and the deployment script targets chain ID 4663 and enforces this prefix. A deployment guard is not evidence that a deployment occurred or that the requirement has been satisfied by any deployed address.</p>
    {['administrative-roles', 'ownership-and-role-assignments', 'owner-wallet', 'access-control', 'emergency-pause', 'treasury-permissions', 'upgrade-authorization', 'reserve-protection', 'security-assumptions'].includes(slug) && <>
      <h2 id="role-model">Role model in source</h2>
      <DataTable label="source-role-model" headers={['Contract', 'Source roles / permissions']} rows={[
        ['Factory', 'DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, PAUSER_ROLE. Protected roles are constrained to canonicalOwner; source can pause new launches.'],
        ['CreatorRewardVault', 'DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, PAUSER_ROLE, EMERGENCY_WITHDRAWER_ROLE. Source can pause accrual, issuance, and redemption separately; excess withdrawal is bounded by liabilities.'],
        ['TaxRouter', 'DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, PAUSER_ROLE, TREASURY_ROLE, EMERGENCY_WITHDRAWER_ROLE. Source bounds withdrawals by platformAccrued.'],
      ]} />
      <p>Owner and keeper roles are configured on-chain and checked by live readiness. Multichain verification uses a single owner-controlled attestation authority; compromise of that authority can approve a forged packet. Destination keepers submit transactions and fund their chain’s gas.</p>
    </>}
    <Callout label="Verification state">The registry links configured addresses to their chain explorers. RPC readiness is not source verification or an independent audit. Pons V2 and LayerZero protocol contracts are third-party infrastructure; the Armoreum components remain separately identified.</Callout>
  </>;

  if (slug.includes('api') || slug.includes('endpoint') || slug === 'authentication' || slug.includes('rate') || slug === 'errors-and-rate-limits') return <ApiContent slug={slug} />;

  if (slug.includes('database') || slug.includes('event-processing') || slug === 'event-indexing') return <>
    <p>Drizzle schemas store launch records, token metadata, Multichain pairs and transfers, drafts, and upload intents. Verified launch records are available through the API. Activity feeds and per-token bridge status depend on separate chain indexers and confirmation states.</p>
    <FlowDiagram label="Verified launch and transfer records" items={['Mainnet transaction', 'Chain-specific confirmation', 'Verified launch or bridge event', 'Database record', 'Token details / transfer history']} />
    <DataTable label="database-schema" headers={['Table', 'Purpose / notable fields']} rows={[
      ['armoreum_launch_drafts', 'Draft details, launch mode, tax basis points, completion/authorization flags, optional order/deposit/launch fields, version and timestamps.'],
      ['armoreum_launch_metadata', 'Public token metadata keyed by launch ID; token address unique; verifiedAt gates public reads.'],
      ['armoreum_upload_intents', 'Upload ID, object path, declared type/size, completion timestamp.'],
      ['multichain_bridges', 'Per-launch Ethereum and Robinhood bridge-pair addresses, token mapping, launch IDs, and provisioning status.'],
      ['multichain_bridge_transfers', 'Source lock, LayerZero GUID, destination execution, fee, and recipient status for each transfer.'],
      ['Legacy auth tables', 'Present in database schema; not evidence of auth middleware on draft routes.'],
    ]} />
    <Callout>Do not treat a source transaction as a completed bridge. Confirm destination execution and the corresponding transfer record.</Callout>
  </>;

  if (slug.includes('network') || slug.includes('robinhood') || slug.includes('pons') || slug.includes('graduation') || slug.includes('external-dependencies') || slug === 'rpc-and-explorer') return <>
    <p>Ethereum (chain ID 1) and Robinhood Chain (chain ID 4663) are checked against live RPC. The readiness service checks configured Armoreum factories and implementation links, Pons V2 addresses, Uniswap V4 PoolManagers, LayerZero endpoints, and bridge operators as applicable.</p>
    <DataTable label="network-status-meaning" headers={['Signal', 'Interpretation']} rows={[
      ['Launch ready', 'Live preflight passed for the selected chain and configured launch contracts.'],
      ['Multichain ready', 'Shared infrastructure is configured; a token-specific pair is still required.'],
      ['Pons V2 verified', 'Live readiness confirms the configured Pons integration; it does not claim Pons is Armoreum-owned.'],
      ['Activity unavailable', 'The current activity endpoint may return 503 while its event index is unavailable. This does not invalidate confirmed launch records.'],
      ['Bridge transfer pending', 'Source lock is confirmed, but destination release has not yet been confirmed.'],
    ]} />
    <p>Use the chain-specific explorers in the address registry. Pons V2, LayerZero endpoints, and Uniswap contracts are protocol dependencies, not Armoreum-owned infrastructure.</p>
  </>;

  if (slug.includes('troubleshooting') || slug.includes('failed') || slug.includes('pending') || slug.includes('wrong-network') || slug.includes('incorrect-funding') || slug.includes('faq') || slug.includes('support')) return <>
    <p>First identify the failing chain, launch leg, route, and transaction hash. An API error before submission is different from a transaction that reverted or a bridge message that is waiting for destination execution.</p>
    <DataTable label="troubleshooting" headers={['Symptom', 'Safe next step']} rows={[
      ['Creator authorization fails', 'Confirm the selected launch, imported creator account, wallet signature, password, and available one-time proof. Never share the password or recovery file.'],
      ['Funding does not progress', 'Check the per-chain funding instructions and confirmed balances. Do not resend until the prior transaction is resolved.'],
      ['Launch detail or activity cannot load', 'Launch metadata and market activity use separate services. Retry the affected view and verify the transaction on the chain explorer.'],
      ['Upload is rejected', 'Check PNG/JPEG/WebP type, square dimensions, raw size up to 100 MB, and completed server validation.'],
      ['Draft update returns 409', 'Complete required name, valid symbol, and server-verified image before marking details complete.'],
      ['429 response', 'Respect Retry-After. Do not repeatedly submit the same request during the rate window.'],
    ]} />
    <p>Do not repeatedly resubmit a launch, claim, or bridge transfer while the previous transaction is pending. Check its hash and the matching on-chain state first. JailSwap is Coming Soon.</p>
  </>;

  if (slug === 'quick-start' || slug === 'local-development' || slug === 'installation-and-configuration' || slug === 'developer-overview' || slug === 'smart-contract-development' || slug === 'build-and-test-commands' || slug === 'deployment-procedures' || slug === 'rpc-configuration' || slug === 'repository-and-project-structure' || slug === 'environment-variables') return <>
    <p>The application is a React/Vite frontend using Wouter and Lucide, an Express API, Drizzle schemas, and a separate Hardhat Solidity package. Package management is pnpm.</p>
    <Code id="quickstart-install" language="shell" code={'pnpm install\npnpm --filter @workspace/armoreum run dev'} />
    <p>Within the armoreum package, the available scripts are:</p>
    <Code id="frontend-commands" language="shell" code={'pnpm --filter @workspace/armoreum run build\npnpm --filter @workspace/armoreum run typecheck'} />
    <p>Contract configuration uses Solidity 0.8.28, optimizer enabled, Cancun EVM, and viaIR. Mainnet deployment and upgrade scripts are network-specific and require their explicit preflight configuration.</p>
    <Callout label="Secrets and deploy safety">Do not put private keys or production credentials in frontend code or examples. The deployment script requires sensitive environment configuration; consult its local source rather than copying or sharing secret values. Do not deploy as part of this documentation.</Callout>
  </>;

  return <>
    <p>{title} describes the configured mainnet behavior and the evidence required to verify a particular launch or operation.</p>
    <p>Use the network-specific address registry and the selected token’s launch record. A shared contract’s readiness does not prove that another token’s vault, bridge pair, or transfer has completed.</p>
    <Callout label="Availability">Pons V2, Ethereum, and Multichain launch preflight checks are enabled. Each transaction still requires creator confirmation and chain confirmation; a Multichain transfer also requires destination execution. JailSwap is Coming Soon.</Callout>
    <p>Related reference: <Link href={routeFor('api-overview')}>API route inventory</Link>, <Link href={routeFor('mainnet-addresses')}>contract registry</Link>, and <Link href={routeFor('security-model')}>security model</Link>.</p>
  </>;
}

function ApiContent({ slug }: { slug: string }) {
  const rows = slug === 'upload-endpoints'
    ? apiRoutes.filter((route) => route[1].startsWith('/api/storage'))
    : slug === 'creator-authorization-endpoints'
      ? []
      : slug.includes('creator-reward') || slug.includes('jail') || slug.includes('redemption') || slug.includes('quote')
        ? []
        : apiRoutes;
  const apiCode = `POST /api/launch-drafts
Content-Type: application/json

{}

Response: 201 Created
The response contains the newly created draft fields.`;
  return <>
    <p>These routes are defined by the Express API mounted under /api. Draft endpoints do not provide private user storage; treat identifiers as references, not access control. Funding preflight and verified launch reads are available, while creator authorization actions are bound to a selected launch and are not represented by generic quote endpoints.</p>
    {rows.length
      ? <DataTable label="api-routes" headers={['Method', 'Route', 'Observed behavior']} rows={rows.map(([method, route, behavior]) => [<code key="method">{method}</code>, <code key="route">{route}</code>, behavior])} />
      : slug === 'creator-authorization-endpoints'
        ? <Callout label="Route scope">Authorization actions are bound to the selected launch and use its creator-wallet signature and password-derived proof. They are initiated through the creator flow, not a generic public authorization endpoint.</Callout>
        : <Callout label="Route scope">Creator reward, Unjail, redemption, and funding operations are launch-specific. Follow the selected token’s details and signing flow; this section does not imply a universal claim endpoint.</Callout>}
    <h2 id="request-example">Request example</h2>
    <Code id="api-draft-create" language="http" code={apiCode} />
    <h2 id="draft-update-contract">Draft update fields</h2>
    <p>PUT /api/launch-drafts/:id accepts name, symbol, description, imageName, imageObjectPath, websiteUrl, xUrl, and additionalTaxRate. The API validates field lengths, tax precision/range, symbol format, normalized URLs, and that a selected upload has completed validation. It returns the updated public draft or an error object.</p>
    <p>Launch-list filters are search, lifecycle, and cursor. Activity filters are launchId, eventType, and cursor. Upload request-url accepts name, integer size, and contentType; upload completion accepts uploadId. Token metadata requires a 20-byte hex tokenAddress.</p>
    <p>Draft creation returns 201, generates a per-launch creator address, and encrypts the matching private key at rest; only the public address is returned. Draft IDs must be 36 hexadecimal/hyphen characters. Upload request-url returns a direct upload target and uploadId. Completion returns objectPath and imageUrl after validation.</p>
    <DataTable label="api-rate-limits" headers={['Route family', 'Request policy']} rows={[
      ['Application API', 'No application-enforced request-count quota.'],
      ['Alchemy RPC gateway', 'No application IP/global request quota or in-flight rejection gate. Supported chains, methods, and payload validation remain enforced.'],
      ['Uploads', 'No request-count quota or concurrent-job rejection. File type, byte size, image dimensions, and upload references are validated.'],
      ['Creator reward relay', 'No per-IP request-count quota. Origin, launch identity, signatures, one-time proofs, and on-chain authorization remain required.'],
      ['External providers', 'Alchemy and other dependencies can still enforce their own limits or experience outages.'],
    ]} />
    <p>Removing application request quotas does not remove payload validation, transaction authorization, or the bridge maximum based on destination reserve. Draft routes have no authentication middleware.</p>
    <Callout>Examples here are structural request examples, not live response snapshots. Service availability depends on database and storage configuration.</Callout>
  </>;
}

const contentSearchTerms: Record<string, string> = {
  'api-overview': '/api/healthz /api/network /api/overview /api/launches /api/activity /api/token-metadata /api/storage/objects /api/launch-drafts 503 400 404',
  authentication: 'authentication authorization public unauthenticated no auth middleware draft UUID security',
  'token-launch-endpoints': '/api/launch-drafts POST PUT GET complete-details creator authorization funding-orders 201 400 404 409 429 503',
  'upload-endpoints': '/api/storage/uploads/request-url /api/storage/uploads/complete PNG JPEG WebP 100 MB 5 MB square image',
  'token-and-market-data': '/api/token-metadata verifiedAt launch metadata address 400 404 503',
  'errors-and-rate-limits': '400 404 409 429 503 Retry-After rate limit validation unavailable storage indexer',
  'quote-and-fee-endpoints': 'there is no quote or fee endpoint additional tax 1% 10% basis points 70% creator 30% platform',
  'creator-reward-endpoints': 'creator vault reward credits JailETH Unjail password signature',
  'jaileth-endpoints': 'JailETH creator vault backing and issuance',
  'redemption-endpoints': 'Unjail redemption creator signature one-time proof ETH',
  'creator-authorization-endpoints': 'creator authorization Argon2id password hash chain EIP-712 signature',
  'post-quantum-security': 'quantum resistant post quantum no quantum-resistant cryptography implemented',
  'mainnet-addresses': 'address registry Ethereum Robinhood chain ID 1 4663 explorer',
  'rpc-and-explorer': 'RPC eth_chainId eth_getCode partially-verified source bytecode no explorer link',
  'challenge-and-signature-validation': 'creator wallet EIP-712 signature Argon2id password proof',
  'replay-protection': 'nonce deadline credentialVersion replay',
  'security-model': 'private key EVM signature independent authorization hash chain creator rewards',
  'jaileth-architecture': 'JailETH backing redemption soulbound ETH vault',
  'token-description-and-image': 'image upload PNG JPEG WebP 100 MB 8192 40 million pixels square sharp processing 5 MB',
};

export default function DocsPage() {
  const [location, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const slug = slugFromPath(location.split('?')[0]);
  const page = pageForSlug(slug) || intro;
  const index = docs.findIndex((entry) => entry.slug === page.slug);
  const previous = docs[index - 1];
  const next = docs[index + 1];
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return docs.filter((item) => `${item.title} ${item.section} ${item.description} ${item.slug} ${contentSearchTerms[item.slug] || ''}`.toLowerCase().includes(term)).slice(0, 9);
  }, [query]);
  useEffect(() => setSelectedResult(0), [query]);
  useEffect(() => {
    document.title = 'Security Infrastructure for a Decentralized World.';
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.setAttribute('name', 'description');
      document.head.appendChild(description);
    }
    description.setAttribute('content', 'Security Infrastructure for a Decentralized World.');
  }, [page]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => document.getElementById('docs-search-input')?.focus(), 0);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const navigate = (slugValue: string) => {
    setLocation(routeFor(slugValue));
    setQuery('');
    setSearchOpen(false);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openSearch = () => {
    setSearchOpen(true);
    window.setTimeout(() => document.getElementById('docs-search-input')?.focus(), 0);
  };
  useEffect(() => {
    const openNavigation = () => setMobileNavOpen(true);
    const searchDocumentation = () => {
      setSearchOpen(true);
      window.setTimeout(() => document.getElementById('docs-search-input')?.focus(), 0);
    };
    window.addEventListener('armoreum:docs-open-navigation', openNavigation);
    window.addEventListener('armoreum:docs-open-search', searchDocumentation);
    return () => {
      window.removeEventListener('armoreum:docs-open-navigation', openNavigation);
      window.removeEventListener('armoreum:docs-open-search', searchDocumentation);
    };
  }, []);
  return <BrandTextTree><div className="armoreum-docs" data-testid="docs-experience">
    <header className="armoreum-docs-mobile-head">
      <button
        type="button"
        className="armoreum-mobile-menu"
        aria-label={mobileNavOpen ? 'Close documentation menu' : 'Open documentation menu'}
        aria-expanded={mobileNavOpen}
        aria-controls="docs-mobile-navigation"
        onClick={() => setMobileNavOpen((open) => !open)}
        data-testid="button-docs-mobile-menu"
      >
        {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <Link href={ROOT} className="armoreum-mobile-docs-brand" aria-label="Armoreum documentation home">
        <span className="armoreum-mobile-docs-mark armoreum-logo-mark"><ArmoreumLogoImages /></span>
        <span><strong>armoreum</strong><small>Documentation</small></span>
      </Link>
      <button type="button" className="armoreum-mobile-search" aria-label="Search documentation" onClick={openSearch} data-testid="button-docs-mobile-search">
        <Search size={17} />
      </button>
    </header>
    <aside className="armoreum-docs-sidebar" aria-label="Documentation navigation">
      <a href="https://armoreum.io" className="armoreum-docs-brand" aria-label="armoreum homepage"><span className="armoreum-docs-brand-icon armoreum-logo-mark"><ArmoreumLogoImages /></span><span><strong>armoreum</strong><small>Documentation · Token launchpad</small></span></a>
      <button type="button" className="armoreum-search-trigger" onClick={openSearch} data-testid="button-docs-search"><Search size={15} /><span>Search documentation</span><kbd>⌘ K</kbd></button>
      <nav className="armoreum-docs-nav" aria-label="Documentation topics">
        {docSections.map((section) => <section className="armoreum-nav-group" key={section.title}><h2>{section.title}</h2>{section.pages.map((title) => {
          const item = docs.find((entry) => entry.title === title)!;
          return <Link key={item.slug} href={routeFor(item.slug)} className={`armoreum-doc-link ${page.slug === item.slug ? 'active' : ''}`} aria-current={page.slug === item.slug ? 'page' : undefined} data-testid={`docs-nav-${item.slug}`}>{item.title}</Link>;
        })}</section>)}
      </nav>
      <div className="armoreum-sidebar-foot"><span className="armoreum-status-mark" />Source-grounded · Read-only</div>
    </aside>
    {mobileNavOpen && <>
      <button className="armoreum-mobile-topic-scrim" type="button" aria-label="Close documentation topics" onClick={() => setMobileNavOpen(false)} />
      <section id="docs-mobile-navigation" className="armoreum-mobile-topic-panel" role="dialog" aria-modal="true" aria-label="Documentation topics">
        <div className="armoreum-mobile-topic-panel-head">
          <strong>Documentation topics</strong>
          <button type="button" aria-label="Close documentation topics" onClick={() => setMobileNavOpen(false)}><X size={17} /></button>
        </div>
        <div className="armoreum-mobile-topic-scroll">{docSections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.pages.map((title) => {
        const item = docs.find((entry) => entry.title === title)!;
        return <Link key={item.slug} href={routeFor(item.slug)} className={`armoreum-doc-link ${page.slug === item.slug ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)}>{item.title}</Link>;
        })}</section>)}</div>
      </section>
    </>}
    <article className="armoreum-doc-article" key={page.slug}>
      <header className="armoreum-doc-heading"><h1>{page.title}</h1><p>{page.description}</p></header>
      <div className="armoreum-doc-prose">{currentContent(page.slug, page.title)}</div>
      <nav className="armoreum-doc-pagination" aria-label="Previous and next documentation page">
        {previous ? <Link href={routeFor(previous.slug)} className="armoreum-page-turn prev" data-testid="docs-previous"><span><ArrowLeft size={14} />Previous</span><strong>{previous.title}</strong></Link> : <span />}
        {next && <Link href={routeFor(next.slug)} className="armoreum-page-turn next" data-testid="docs-next"><span>Next<ArrowRight size={14} /></span><strong>{next.title}</strong></Link>}
      </nav>
    </article>
    {searchOpen && <div className="armoreum-search-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }} data-testid="docs-search-overlay">
      <section className="armoreum-search-dialog" role="dialog" aria-modal="true" aria-label="Search documentation">
        <label className="armoreum-search-field"><Search size={18} /><input id="docs-search-input" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setSelectedResult((value) => Math.min(value + 1, results.length - 1)); }
          if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setSelectedResult((value) => Math.max(value - 1, 0)); }
          if (event.key === 'Enter' && results[selectedResult]) { event.preventDefault(); navigate(results[selectedResult].slug); }
        }} placeholder="Search all documentation…" data-testid="input-docs-search" /><button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={16} /></button></label>
        <div className="armoreum-search-results">{query.trim() ? results.length ? results.map((item, resultIndex) => <button type="button" key={item.slug} onClick={() => navigate(item.slug)} onMouseEnter={() => setSelectedResult(resultIndex)} className={`armoreum-search-result ${selectedResult === resultIndex ? 'highlighted' : ''}`} data-testid={`docs-search-result-${item.slug}`}><FileText size={15} /><span><strong>{item.title}</strong><small>{item.section} · {item.description}</small></span><ArrowRight size={14} /></button>) : <p className="armoreum-search-empty">No matching pages. Try a different term.</p> : <p className="armoreum-search-empty">Search topics, endpoints, contracts, and security concepts.</p>}</div>
        <div className="armoreum-search-hint"><span>Use Up and Down to browse results</span><span>ESC to close</span></div>
      </section>
    </div>}
  </div></BrandTextTree>;
}
