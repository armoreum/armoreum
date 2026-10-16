import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, RotateCcw, ShieldCheck } from 'lucide-react';
import { BrandTextTree, formatBrandText } from '@/lib/brand-text';
import { SecurityAddendum } from '@/components/info/security-addendum';
import './security.css';

type Scenario = {
  id: string;
  title: string;
  objective: string;
  capabilities: string;
  stages: string[];
  defense: string;
  risks: string;
  outcome: string;
  visualOutcome: string;
  sourceCheck: string;
  chainEvidence: string;
};

const scenarios: Scenario[] = [
  {
    id: 'key',
    title: 'Private key exposure',
    objective: 'Use the publicly disclosed creator key to attempt a protected Creator Vault operation.',
    capabilities: 'The key is intentionally public after launch, so an attacker can sign ordinary EVM transactions as the creator and control assets held directly by that EOA.',
    stages: [
      'The attacker obtains the creator’s private key.',
      'The attacker imports the key into a compatible EVM wallet.',
      'The attacker connects the key to the selected token’s creator flow.',
      'The creator wallet signs the launch-bound operation.',
      'The vault also requires a one-time proof derived from that launch’s password.',
      'Without the password-derived proof, the protected operation is rejected.',
    ],
    defense: 'Protected Creator Vault operations require both the creator-wallet signature and the password-derived one-time proof. The public EOA key alone does not provide the proof.',
    risks: 'Assets held directly by the disclosed EOA remain at risk. Anyone with both the key and password/recovery material can authorize creator operations; device compromise and contract defects remain risks.',
    outcome: 'The public creator key can sign, but a protected operation also needs the launch-specific proof.',
    visualOutcome: 'Missing password proof: rejected',
    sourceCheck: 'Launch-bound one-time proof and creator signature are checked by the vault.',
    chainEvidence: 'Mainnet Creator Vaults are deployed; verify the selected token and current state on its explorer.',
  },
  {
    id: 'public',
    title: 'Public blockchain intelligence',
    objective: 'Use public wallet information to claim creator rewards.',
    capabilities: 'The attacker can inspect addresses, balances, transactions, and public contract interactions.',
    stages: [
      'The attacker identifies the creator’s public address.',
      'The attacker reviews public balances and transaction history.',
      'The attacker observes public authorization commitments and transaction history.',
      'The attacker tries to substitute another launch, amount, or payout address.',
      'The vault binds the request to its launch, creator, recipient, amount, and authorization epoch.',
      'The next valid one-time proof is still required to execute the request.',
    ],
    defense: 'Public commitments do not expose the required password-derived proof. The vault enforces launch and operation binding on chain.',
    risks: 'Addresses, balances, activity, and commitments are public. A disclosed creator key can submit transactions and may be used to grief account operations.',
    outcome: 'Public chain data is not the password-derived proof; the request must still satisfy the selected vault’s authorization rules.',
    visualOutcome: 'Public data alone: insufficient',
    sourceCheck: 'The selected vault checks its operation-specific commitment and one-time proof.',
    chainEvidence: 'Verify the per-token vault address and transaction on the matching explorer.',
  },
  {
    id: 'guessing',
    title: 'Authorization proof and credential recovery',
    objective: 'Recover the launch password or authorization material.',
    capabilities: 'The attacker can inspect public commitments and may target the user’s device, browser session, password, or recovery file.',
    stages: [
      'The attacker obtains the public authorization commitment.',
      'The attacker attempts to guess the password or obtain the downloaded recovery file.',
      'The client derives authorization material locally using Argon2id and the launch’s unique salt.',
      'Each operation consumes a one-time proof from the committed hash chain.',
      'A copied recovery file contains sensitive creator and authorization material and must be treated as full account compromise.',
    ],
    defense: 'The password-derived secret stays in the browser for the operation; on-chain one-time proofs prevent reuse.',
    risks: 'Weak or reused passwords, phishing, same-origin compromise, malware, and loss or theft of the unencrypted recovery file remain risks.',
    outcome: 'The recovery file is highly sensitive; possession of it can grant creator recovery authority.',
    visualOutcome: 'Password-derived proof required',
    sourceCheck: 'Argon2id-derived operation chains are bound to the launch and consumed on chain.',
    chainEvidence: 'Check the selected launch’s authorization epoch and proof state before signing.',
  },
  {
    id: 'device',
    title: 'Compromised device',
    objective: 'Abuse an infected device or capture an authorization proof.',
    capabilities: 'Malware may observe user input, control a session, or attempt to use an unlocked credential on the device.',
    stages: [
      'Malware or an attacker gains access to the user’s device.',
      'The attacker attempts to capture credentials or reuse an authorized session.',
      'The user enters the launch password in the browser to derive an operation proof.',
      'Malware or same-origin code may capture the password, derived proof, or signing session.',
      'A compromised device can bypass protections by stealing both authorization and wallet access.',
    ],
    defense: 'Separate wallet and password checks reduce reliance on one key, but do not protect a device that captures both.',
    risks: 'Malware, phishing, same-origin compromise, session theft, password reuse, and recovery-file theft remain relevant.',
    outcome: 'Device compromise can defeat the independent authorization boundary.',
    visualOutcome: 'Device compromise remains relevant',
    sourceCheck: 'Password derivation and wallet signing occur in the creator flow; review the selected request before approval.',
    chainEvidence: 'On-chain checks cannot prevent a compromised browser from stealing authorization material.',
  },
  {
    id: 'contract',
    title: 'Smart-contract exploit',
    objective: 'Bypass authorization or withdraw creator rewards.',
    capabilities: 'The attacker can inspect public contract interfaces and submit transactions to any deployed entry point.',
    stages: [
      'The attacker examines public contract functions.',
      'The attacker searches for access-control gaps, replay, recipient substitution, and accounting errors.',
      'The attacker attempts to invoke a claim or redemption path.',
      'The vault checks its pending operation, epoch, proof, balance, deadline, and backing constraints.',
      'Request details are bound before execution so the proof cannot substitute its amount or recipient.',
    ],
    defense: 'Creator Vault authorization, balance, backing, and replay checks are enforced on chain; failed burn-and-payout operations revert atomically.',
    risks: 'Contract bugs, upgrade authority, owner-key compromise, and the single-signer DVN trust model remain material. Readiness is not an independent audit.',
    outcome: 'Live contracts and configured links are checked; security still depends on code, roles, and the selected launch state.',
    visualOutcome: 'On-chain checks apply',
    sourceCheck: 'Inspect the active implementation, role assignments, and selected launch configuration.',
    chainEvidence: 'Shared addresses are listed below; per-launch vaults and bridge pairs have token-specific addresses.',
  },
];

const contracts = [
  {
    name: 'ArmoreumFactory',
    role: 'Enrollment and launch reward-system creation',
    boundary: 'Coordinates launch enrollment, vault and router creation, and mode-specific launch completion. UUPS and AccessControl roles govern upgrades and administration.',
    auth: 'Creator and password authorization bind the launch setup. Active implementation pointers, approved tax sources, and privileged roles remain trusted configuration.',
  },
  {
    name: 'CreatorRewardVault',
    role: 'ETH reward accounting, automatic JailETH issuance, and Unjail redemption',
    boundary: 'Accepts reward credit only from its bound router. Each enabled creator-reward credit issues matching backed JailETH in the same transaction.',
    auth: 'Unjail requests bind the amount and recipient, require the creator EVM signature and a launch-password-derived one-time proof, then burn and pay atomically.',
  },
  {
    name: 'TaxRouter',
    role: 'Additional-tax distribution',
    boundary: 'Accepts additional tax only from its configured tax source. Splits depend on launch mode: Pons-only 90/10; Pons Multichain 70/10/20; Ethereum-only creator-directed; Ethereum Multichain 80/20 creator/Bridge Vault.',
    auth: 'Tax-source identity, expected amount, and duplicate-distribution checks. Ethereum’s 0.7% base tax is separate; Pons protocol fees use Pons rules.',
  },
  {
    name: 'Armoreum Custom DVN',
    role: 'LayerZero packet verification',
    boundary: 'Verifies only configured Armoreum Multichain paths and source finality before submitting the LayerZero attestation.',
    auth: 'A single owner-controlled 1-of-1 signer is the attestation authority. This is centralized verification, not an independent quorum.',
  },
  {
    name: 'Armoreum LayerZero Executor',
    role: 'Destination transaction execution',
    boundary: 'Submits destination verification and execution transactions for configured Armoreum Multichain routes.',
    auth: 'Destination keepers are chain-specific and require native gas. They do not independently create source proofs or bypass DVN verification.',
  },
];

const mainnetContracts = [
  { network: 'Ethereum · 1', name: 'ArmoreumFactory proxy', address: '0x69003a9C316E080855f04112D5E188A3329BA184', explorer: 'https://etherscan.io/address/0x69003a9C316E080855f04112D5E188A3329BA184', role: 'Armoreum launch and reward-system coordinator', readiness: 'Code and required pointers pass live preflight' },
  { network: 'Ethereum · 1', name: 'VaultFactory proxy', address: '0x69009e23f4c3c75d8a0ba270f94e20fae6b4b48d', explorer: 'https://etherscan.io/address/0x69009e23f4c3c75d8a0ba270f94e20fae6b4b48d', role: 'Armoreum per-launch vault factory', readiness: 'Code and factory link pass live preflight' },
  { network: 'Ethereum · 1', name: 'Token deployer', address: '0x69005e5ce18701ab7dc98fef511dec6ddd9cf5d5', explorer: 'https://etherscan.io/address/0x69005e5ce18701ab7dc98fef511dec6ddd9cf5d5', role: 'Armoreum fixed-supply token deployment', readiness: 'Configured address checked by launch preflight' },
  { network: 'Ethereum · 1', name: 'Hook factory', address: '0x690084aa31e5cff13657c63b567cc5896f7c4e45', explorer: 'https://etherscan.io/address/0x690084aa31e5cff13657c63b567cc5896f7c4e45', role: 'Armoreum launch-specific Uniswap V4 hooks', readiness: 'Configured address checked by launch preflight' },
  { network: 'Ethereum · 1', name: 'TaxRouter implementation', address: '0x6900f46db09e313802aa8b52bb475b99379e5699', explorer: 'https://etherscan.io/address/0x6900f46db09e313802aa8b52bb475b99379e5699', role: 'Armoreum additional-tax implementation for new launches', readiness: 'Factory implementation pointer checked by live preflight' },
  { network: 'Ethereum · 1', name: 'JailSeed', address: '0x690042530954a05d996bef713cb4279de2a5191e', explorer: 'https://etherscan.io/address/0x690042530954a05d996bef713cb4279de2a5191e', role: 'Armoreum Ethereum launch seed integration', readiness: 'Configured address checked by launch preflight' },
  { network: 'Ethereum · 1', name: 'Uniswap V4 PoolManager', address: '0x000000000004444c5dc75cb358380d2e3de08a90', explorer: 'https://etherscan.io/address/0x000000000004444c5dc75cb358380d2e3de08a90', role: 'Uniswap protocol dependency', readiness: 'PoolManager code checked by live preflight' },
  { network: 'Ethereum · 1', name: 'LayerZero Endpoint · EID 30101', address: '0x1a44076050125825900e736c501f859c50fE728c', explorer: 'https://etherscan.io/address/0x1a44076050125825900e736c501f859c50fE728c', role: 'LayerZero protocol dependency', readiness: 'Endpoint ID checked by live preflight' },
  { network: 'Ethereum · 1', name: 'Armoreum Custom DVN', address: '0xD96A211B07e9d38d26AD4C3Dbb8437182FA37946', explorer: 'https://etherscan.io/address/0xD96A211B07e9d38d26AD4C3Dbb8437182FA37946', role: 'Armoreum owner-controlled 1-of-1 verifier', readiness: 'Operator code and route configuration checked' },
  { network: 'Ethereum · 1', name: 'Armoreum LayerZero Executor', address: '0x7b4273f93aF6ab971bF1A5F2425ed614F2DA0627', explorer: 'https://etherscan.io/address/0x7b4273f93aF6ab971bF1A5F2425ed614F2DA0627', role: 'Armoreum destination executor', readiness: 'Operator code and route configuration checked' },
  { network: 'Robinhood · 4663', name: 'ArmoreumFactory proxy', address: '0x6900aA5440E51b0DF7781507A58Fc27227aA6d3b', explorer: 'https://robin.etherscan.io/address/0x6900aA5440E51b0DF7781507A58Fc27227aA6d3b', role: 'Armoreum Pons launch and reward-system coordinator', readiness: 'Code and required pointers pass live preflight' },
  { network: 'Robinhood · 4663', name: 'VaultFactory proxy', address: '0x6900dD2Dcf99363a83162E82c48D2c7822f1b409', explorer: 'https://robin.etherscan.io/address/0x6900dD2Dcf99363a83162E82c48D2c7822f1b409', role: 'Armoreum per-launch vault factory', readiness: 'Code and factory link pass live preflight' },
  { network: 'Robinhood · 4663', name: 'Pons V2 factory', address: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e', explorer: 'https://robin.etherscan.io/address/0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e', role: 'External Pons V2 launch protocol', readiness: 'Pons integration passes live preflight' },
  { network: 'Robinhood · 4663', name: 'Pons V2 MemeHook', address: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044', explorer: 'https://robin.etherscan.io/address/0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044', role: 'External Pons V2 hook', readiness: 'Pons integration passes live preflight' },
  { network: 'Robinhood · 4663', name: 'Pons V2 FeeEscrow', address: '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e', explorer: 'https://robin.etherscan.io/address/0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e', role: 'External Pons V2 fee accounting', readiness: 'Pons integration passes live preflight' },
  { network: 'Robinhood · 4663', name: 'Pons V2 Buyback Vault', address: '0x42df2a798f82289E177311362e8f5ccC45c1219c', explorer: 'https://robin.etherscan.io/address/0x42df2a798f82289E177311362e8f5ccC45c1219c', role: 'External Pons V2 buyback infrastructure', readiness: 'Pons integration passes live preflight' },
  { network: 'Robinhood · 4663', name: 'Pons V2 LaunchLocker', address: '0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952', explorer: 'https://robin.etherscan.io/address/0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952', role: 'External Pons V2 launch infrastructure', readiness: 'Pons integration passes live preflight' },
  { network: 'Robinhood · 4663', name: 'Pons V2 launch-and-buy', address: '0xe33E9E479dF8802cb0866d5d05258bEc4cF62948', explorer: 'https://robin.etherscan.io/address/0xe33E9E479dF8802cb0866d5d05258bEc4cF62948', role: 'Atomic Pons launch and initial-buy integration', readiness: 'Pons integration passes live preflight' },
  { network: 'Robinhood · 4663', name: 'Pons V2 LaunchDeployer', address: '0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42', explorer: 'https://robin.etherscan.io/address/0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42', role: 'External Pons V2 token/curve deployer', readiness: 'Pons integration passes live preflight' },
  { network: 'Robinhood · 4663', name: 'Pons V2 GraduationExecutor', address: '0xC7819B64A1dAECD7eC19856d026cb14EfBd89046', explorer: 'https://robin.etherscan.io/address/0xC7819B64A1dAECD7eC19856d026cb14EfBd89046', role: 'External Pons V2 graduation infrastructure', readiness: 'Pons integration passes live preflight' },
  { network: 'Robinhood · 4663', name: 'Pons V2 GraduationGuard', address: '0xf5695117b99B6f6401e67d4195BD653628176C6C', explorer: 'https://robin.etherscan.io/address/0xf5695117b99B6f6401e67d4195BD653628176C6C', role: 'External Pons V2 graduation infrastructure', readiness: 'Pons integration passes live preflight' },
  { network: 'Robinhood · 4663', name: 'Uniswap V4 PoolManager', address: '0x8366a39cc670b4001a1121b8f6a443a643e40951', explorer: 'https://robin.etherscan.io/address/0x8366a39cc670b4001a1121b8f6a443a643e40951', role: 'Uniswap protocol dependency', readiness: 'PoolManager code checked by live preflight' },
  { network: 'Robinhood · 4663', name: 'LayerZero Endpoint · EID 30416', address: '0x6F475642a6e85809B1c36Fa62763669b1b48DD5B', explorer: 'https://robin.etherscan.io/address/0x6F475642a6e85809B1c36Fa62763669b1b48DD5B', role: 'LayerZero protocol dependency', readiness: 'Endpoint ID checked by live preflight' },
  { network: 'Robinhood · 4663', name: 'Armoreum Custom DVN', address: '0xD96A211B07e9d38d26AD4C3Dbb8437182FA37946', explorer: 'https://robin.etherscan.io/address/0xD96A211B07e9d38d26AD4C3Dbb8437182FA37946', role: 'Armoreum owner-controlled 1-of-1 verifier', readiness: 'Operator code and route configuration checked' },
  { network: 'Robinhood · 4663', name: 'Armoreum LayerZero Executor', address: '0x7b4273f93aF6ab971bF1A5F2425ed614F2DA0627', explorer: 'https://robin.etherscan.io/address/0x7b4273f93aF6ab971bF1A5F2425ed614F2DA0627', role: 'Armoreum destination executor', readiness: 'Operator code and route configuration checked' },
] as const;

const principles = [
  'A publicly disclosed creator key must not be described as a secret.',
  'Protected Creator Vault operations require both the wallet signature and password-derived proof.',
  'Authorization proofs must resist replay; operation details must be fixed before execution.',
  'Reward accounting must resist replayed claims, duplicate distributions, and unauthorized balance changes.',
  'Administrative permissions and upgrade controls must be explicit; Armoreum’s 1-of-1 DVN is a centralized trust boundary.',
  'Device, password, and recovery-file compromise remain relevant threats.',
  'Quantum resistance depends on the cryptographic primitives actually used.',
];

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="sc-section-heading">
    <span className="sc-section-number">{number}</span>
    <div><h2>{formatBrandText(title)}</h2><p>{formatBrandText(description)}</p></div>
  </div>;
}

function SecurityPage() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const scenario = scenarios[scenarioIndex];

  const selectScenario = (index: number) => {
    setScenarioIndex(index);
    setStageIndex(0);
  };
  const replay = () => setStageIndex(0);

  return <BrandTextTree><main className="security-center" aria-labelledby="security-title">
    <header className="sc-hero">
      <div className="sc-hero-copy">
        <h1 id="security-title">Security by Design</h1>
        <p>Creator Vaults are deployed on Ethereum and Robinhood Chain. Protected operations require a creator-wallet signature plus a launch-password-derived one-time proof. Readiness checks and this explanation are not an independent audit.</p>
      </div>
      <div className="sc-hero-ledger" aria-label="Evidence summary">
        <div><span>Launch networks</span><strong>Ethereum + Robinhood</strong></div>
        <div><span>Multichain DVN</span><strong>Owner-controlled 1-of-1</strong></div>
        <div><span>Independent audit</span><strong>Not claimed</strong></div>
      </div>
      <div className="sc-principles" aria-label="Security principles">
        <span><i>01</i> Independent authorization</span>
        <span><i>02</i> One-time proof checked on chain</span>
        <span><i>03</i> Readiness is not an audit</span>
      </div>
    </header>

    <section className="sc-section" aria-labelledby="sc-architecture">
       <SectionHeading number="01" title="Security Beyond a Single Key" description="Protected creator operations require both the wallet key and a password-derived one-time proof." />
      <div className="sc-architecture">
        <div className="sc-architecture-flow" aria-label="Creator wallet to reward recipient authorization flow">
          <div className="sc-flow-node"><small>Identity</small><strong>Creator wallet</strong><span>Account associated with launch</span></div>
          <ArrowRight className="sc-flow-arrow" aria-hidden="true" />
          <div className="sc-flow-node"><small>Accounting</small><strong>Launch rewards</strong><span>ETH liabilities in the Creator Vault</span></div>
          <ArrowRight className="sc-flow-arrow" aria-hidden="true" />
          <div className="sc-flow-node"><small>Request</small><strong>Claim request</strong><span>Amount · nonce · deadline</span></div>
          <ArrowRight className="sc-flow-arrow" aria-hidden="true" />
          <div className="sc-flow-node sc-flow-verify"><small>Authorization</small><strong>Password proof</strong><span>Derived locally · consumed on chain</span></div>
          <ArrowRight className="sc-flow-arrow" aria-hidden="true" />
          <div className="sc-flow-node"><small>Contract</small><strong>Creator Vault</strong><span>Authorization and backing checks</span></div>
          <ArrowRight className="sc-flow-arrow" aria-hidden="true" />
          <div className="sc-flow-node"><small>Result</small><strong>Creator</strong><span>JailETH balance</span></div>
        </div>
        <div className="sc-rejection-path"><span>Missing or invalid proof</span><ArrowDown size={16} aria-hidden="true" /><strong>Protected operation rejected</strong><small>Verify the selected vault’s current state.</small></div>
      </div>
      <div className="sc-three-points">
        <article><span>1</span><div><h3>Wallet identity</h3><p>The creator EVM wallet identifies the account associated with a launch and its reward entitlement.</p></div></article>
        <article><span>2</span><div><h3>Independent authorization</h3><p>The launch password derives a one-time proof locally. The public EVM key alone does not provide that proof.</p></div></article>
        <article><span>3</span><div><h3>Contract enforcement</h3><p>The selected deployed Creator Vault enforces authorization, balance, backing, and replay checks on chain.</p></div></article>
      </div>
    </section>

    <section className="sc-section sc-simulator-section" aria-labelledby="sc-simulator-title">
      <SectionHeading number="02" title="How armoreum Defends Against Attacks" description="Step through realistic threat models. Each outcome separates intended source checks from what has been verified on chain." />
      <div className="sc-simulator" data-testid="security-simulator">
        <aside className="sc-scenario-nav" aria-label="Attack scenarios">
          {scenarios.map((item, index) => <button key={item.id} type="button" className={`sc-scenario-tab ${scenarioIndex === index ? 'active' : ''}`} aria-current={scenarioIndex === index ? 'step' : undefined} onClick={() => selectScenario(index)} data-testid={`scenario-${item.id}`}>
            <span className="sc-tab-number">0{index + 1}</span><span>{item.title}</span><ArrowRight size={14} aria-hidden="true" />
          </button>)}
           <div className="sc-simulator-caption"><ShieldCheck size={16} aria-hidden="true" /><p>Educational threat model. It does not replace an independent audit or a check of the selected launch.</p></div>
        </aside>
        <div className="sc-scenario-content" aria-live="polite">
          <div className="sc-scenario-intro">
            <div><h3>{scenario.title}</h3></div>
            <button className="sc-replay" type="button" onClick={replay} aria-label={`Replay ${scenario.title} scenario`} data-testid="button-replay"><RotateCcw size={14} /> Replay</button>
          </div>
          <div className="sc-threat-meta">
            <div><small>Attacker objective</small><p>{scenario.objective}</p></div>
            <div><small>Attacker capability</small><p>{scenario.capabilities}</p></div>
          </div>
          <div className="sc-stage-layout">
            <ol className="sc-stage-list" aria-label={`${scenario.title} attack stages`}>
              {scenario.stages.map((stage, index) => <li key={stage} className={index === stageIndex ? 'current' : index < stageIndex ? 'passed' : ''} aria-current={index === stageIndex ? 'step' : undefined}>
                <span className="sc-stage-marker">{index < stageIndex ? <Check size={12} aria-hidden="true" /> : String(index + 1).padStart(2, '0')}</span>
                <span>{stage}</span>
              </li>)}
            </ol>
            <div className="sc-stage-visual">
              <div className="sc-visual-top"><span className="sc-signal" aria-hidden="true" /><span className="sc-trace-step">STEP {String(stageIndex + 1).padStart(2, '0')} / {scenario.stages.length}</span></div>
              <div className="sc-visual-flow">
                <div className="sc-visual-actor"><small>ACTOR</small><strong>Untrusted request</strong></div>
                <ArrowRight size={17} aria-hidden="true" />
                <div className={`sc-visual-gate ${stageIndex >= 3 ? 'evaluating' : ''}`}><small>CHECK</small><strong>{stageIndex >= 3 ? 'Authorization' : 'Claim path'}</strong></div>
                <ArrowRight size={17} aria-hidden="true" />
                <div className="sc-visual-outcome"><small>OUTCOME</small><strong>{stageIndex === scenario.stages.length - 1 ? scenario.visualOutcome : 'Awaiting checks'}</strong></div>
              </div>
              <p className="sc-stage-detail">{scenario.stages[stageIndex]}</p>
              <div className="sc-stage-controls">
                <span>Stage {stageIndex + 1} of {scenario.stages.length}</span>
                <div>
                  <button className="button button-secondary" type="button" onClick={() => setStageIndex((value) => Math.max(0, value - 1))} disabled={stageIndex === 0} data-testid="button-previous-stage">Previous</button>
                  <button className="button button-primary" type="button" onClick={() => setStageIndex((value) => Math.min(scenario.stages.length - 1, value + 1))} disabled={stageIndex === scenario.stages.length - 1} data-testid="button-next-stage">Next</button>
                </div>
              </div>
            </div>
          </div>
          <div className="sc-outcome" data-testid="scenario-result">
            <div className="sc-outcome-title"><strong>{scenario.outcome}</strong></div>
            <div className="sc-evidence-grid">
              <div><small>Source-level check</small><p>{scenario.sourceCheck}</p></div>
              <div><small>On-chain evidence</small><p>{scenario.chainEvidence}</p></div>
            </div>
            <div className="sc-risk-line"><span>Remaining risks</span><p>{scenario.risks}</p></div>
            <div className="sc-defense-line"><span>Intended defense</span><p>{scenario.defense}</p></div>
          </div>
        </div>
      </div>
    </section>

    <section className="sc-section sc-two-column">
      <article className="sc-editorial-section">
        <SectionHeading number="03" title="Creator Authorization" description="The launch password derives an operation-specific proof chain locally." />
        <div className="sc-prose">
          <p>For password-mode launches, Argon2id derives authorization material in the browser from the launch password and unique salt. A creator-wallet signature is also required for protected operations. The creator key is publicly revealed after a successful launch and should be treated as compromised.</p>
          <ul>
            <li>Use a unique, strong launch password and keep the unencrypted recovery file private.</li>
            <li>Never share the password, proof material, or recovery file; possession grants creator recovery authority.</li>
            <li>Same-origin compromise or malware can capture the password, proof, or wallet session.</li>
            <li>Each operation consumes a one-time proof; check the current authorization epoch before signing.</li>
          </ul>
        </div>
      </article>
      <article className="sc-editorial-section sc-quantum-section">
        <SectionHeading number="04" title="What quantum resistance actually means" description="Independent authorization is a trust-boundary choice, not a post-quantum primitive." />
        <div className="sc-crypto-list">
          <div><span>01</span><p><strong>EVM private-key security</strong>Conventional EVM transaction authorization typically relies on elliptic-curve signatures.</p></div>
          <div><span>02</span><p><strong>Independent authorization</strong>A second authorization check can separate reward access from the EOA key; it does not change the cryptography used by that key.</p></div>
          <div><span>03</span><p><strong>Password-derived authorization</strong>Argon2id and hash chains do not protect against password theft, device compromise, or recovery-file disclosure.</p></div>
          <div><span>04</span><p><strong>Post-quantum cryptography</strong>The local authorization design is not a post-quantum cryptographic scheme. No quantum-resistance claim is supported.</p></div>
        </div>
      </article>
    </section>

    <section className="sc-section" aria-labelledby="sc-contracts-title">
       <SectionHeading number="05" title="The Contracts Behind Protection" description="Mainnet code and configured contract links pass live readiness checks; review each address on its chain explorer." />
      <div className="sc-contract-flow" aria-label="Mainnet contract interaction">
        <div><small>Enrollment</small><strong>ArmoreumFactory</strong><span>Creates vault + router proxies</span></div>
        <ArrowRight aria-hidden="true" />
          <div><small>Additional tax</small><strong>TaxRouter</strong><span>Split varies by launch mode</span></div>
        <ArrowRight aria-hidden="true" />
        <div><small>Rewards</small><strong>CreatorRewardVault</strong><span>ETH accounting + jailETH</span></div>
        <div className="sc-verifier-connector"><span>Enrollment only</span><ArrowDown aria-hidden="true" /></div>
        <div className="sc-verifier-node"><small>LayerZero verification</small><strong>Armoreum Custom DVN</strong><span>Owner-controlled 1-of-1 attestation</span></div>
      </div>
      <div className="sc-contract-list">
        {contracts.map((contract, index) => <article className="sc-contract-row" key={contract.name}>
          <div className="sc-contract-name"><span>0{index + 1}</span><h3>{contract.name}</h3><small>{contract.role}</small></div>
          <div><small>Trust boundary</small><p>{contract.boundary}</p></div>
          <div><small>Authorization and assumptions</small><p>{contract.auth}</p></div>
        </article>)}
      </div>
      <p className="sc-contract-footnote">JailETH is non-transferable and backed by ETH in its launch’s Creator Vault. Launch contracts use privileged roles and upgrade controls; Multichain verification is centralized under a single owner-controlled signer, not a multisig DVN quorum.</p>
    </section>

    <section className="sc-section" aria-labelledby="sc-explorer-title">
      <SectionHeading number="06" title="Mainnet Contract Registry" description="Shared launch and bridge infrastructure on Ethereum and Robinhood Chain. Per-token vaults and bridge pairs are listed with each launch." />
      <div className="sc-explorer-head">
        <div><span className="sc-chain-index">1 · 4663</span><div><strong>Ethereum + Robinhood Chain</strong><small>configured Armoreum and protocol contracts</small></div></div>
        <a href="https://robin.etherscan.io" target="_blank" rel="noopener noreferrer" data-testid="link-robinhood-chain-explorer">Open chain explorer <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
      <div className="sc-contract-table-wrap">
        <table className="sc-contract-table">
          <thead><tr><th scope="col">Network</th><th scope="col">Contract</th><th scope="col">Address</th><th scope="col">Ownership / role</th><th scope="col">Readiness</th><th scope="col">Audit status</th></tr></thead>
          <tbody>{mainnetContracts.map((contract) => <tr key={`${contract.network}-${contract.name}`}>
            <th scope="row">{contract.network}</th>
            <td>{contract.name}</td>
            <td><a href={contract.explorer} target="_blank" rel="noopener noreferrer">{contract.address} <ArrowUpRight size={12} aria-hidden="true" /></a></td>
            <td>{contract.role}</td>
            <td>{contract.readiness}</td>
            <td>No independent audit claimed</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="sc-explorer-note">RPC readiness confirms configured code and links, not source verification or audit. Pons V2, Uniswap, and LayerZero protocol contracts are third-party dependencies. Per-launch Creator Vaults, TaxRouters, Bridge Vaults, hooks, and bridge OApps are token-specific. No Multichain bridge pair is currently active.</p>
    </section>

    <section className="sc-section sc-principles-section" aria-labelledby="sc-principles-title">
      <SectionHeading number="07" title="Authorization Controls and Evidence" description="Review the selected launch, its current permissions, and its chain-specific status before signing." />
      <ol className="sc-principle-list">
        {principles.map((principle, index) => <li key={principle}><span>0{index + 1}</span><p>{principle}</p><Check size={15} aria-hidden="true" /></li>)}
      </ol>
      <div className="sc-source-note"><div><strong>Evidence boundary</strong></div><p>The registry reflects configured mainnet addresses and live readiness checks. Explorer verification varies by contract. No independent audit is claimed, and readiness does not prove a particular launch, claim, or bridge transfer completed.</p></div>
    </section>
    <SecurityAddendum />
  </main></BrandTextTree>;
}

export default SecurityPage;
