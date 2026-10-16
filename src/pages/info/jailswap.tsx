import { ShieldCheck } from 'lucide-react';
import { InfoPage } from '@/components/info/info-page';
import type { InfoPageDef } from '@/components/info/types';

const def: InfoPageDef = {
  eyebrow: 'JailSwap', icon: ShieldCheck,
  title: 'JailSwap',
  lead: 'JailSwap is designed to add an authorization layer to swaps of supported assets. Jail and Unjail are controls inside JailSwap, not separate products. In the current implementation the interface is UI-first and transactions are disabled.',
  evidence: [
    { label: 'Interface', value: 'UI-first, transactions disabled' },
    { label: 'Swap contract / backend', value: 'Not live' },
    { label: 'General ERC-20 protection', value: 'Not verified' },
  ],
  sections: [
    { id: 'what', title: 'What JailSwap does', blocks: [
      { p: 'JailSwap is the planned place to exchange assets where a contract can require more than a wallet signature to move them. The functional screen shows an asset form, quote area, and disabled submit control. Asset selection, quotes, authorization, and submission are all disabled.' },
      { callout: { tone: 'warn', title: 'Nothing is swapped', text: 'There is no verified JailSwap contract and no backend swap service connected. The page you reach from the call to action does not protect assets and does not validate private-key exposure.' } },
    ] },
    { id: 'how', title: 'How protected swaps are meant to work', blocks: [
      { steps: [
        { title: 'Asset is held under contract rules', text: 'Only an asset that a contract places under restriction can be protected. An ordinary balance in your wallet is not.' },
        { title: 'Movement requires authorization', text: 'A restricted asset leaves its protected state only through an authorization step the contract enforces.' },
        { title: 'Swap executes inside the rules', text: 'The swap path would honor those restrictions rather than bypass them.' },
        { title: 'Result is observable', text: 'The outcome is a public blockchain transaction anyone can inspect.' },
      ] },
    ] },
    { id: 'jail-unjail', title: 'Jail and Unjail authorization', blocks: [
      { p: 'Jail restricts movement of a protected asset. Unjail releases it, and only after the required authorization succeeds. Both belong to the JailSwap mechanism.' },
      { p: 'The Creator Vault issues fully backed JailETH in the same transaction for the full amount of every creator-reward credit when issuance is not paused; no 0.01 ETH issuance threshold applies. Unjail fixes the amount and registered non-creator recipient onchain, then burns JailETH 1:1 and pays real ETH directly from the vault after a one-time authorization proof. Draft authorization setup exists in the API, but the helper is not integrated into a live flow; this does not by itself verify the complete Unjail flow in production.' },
      { callout: { title: 'Source is not deployment', text: 'No deployment or audit report for that vault source has been supplied or verified. It demonstrates the authorization design; it does not mean a deployed JailSwap enforces it.' } },
    ] },
    { id: 'protected-vs-ordinary', title: 'Protected assets versus ordinary ERC-20 assets', blocks: [
      { table: { label: 'protected-ordinary', headers: ['', 'Protected asset', 'Ordinary ERC-20 in a wallet'], rows: [
        ['Who can move it', 'Requires contract-enforced authorization in addition to the wallet.', 'Anyone holding the wallet key.'],
        ['If the private key is exposed', 'May resist movement, only where a deployed contract actually enforces it.', 'Can be moved by whoever has the key.'],
        ['Current status', 'No deployed general ERC-20 JailSwap protection is verified.', 'Unchanged by armoreum.'],
      ] } },
    ] },
    { id: 'workflow', title: 'Swap workflow, assets, fees, and slippage', blocks: [
      { p: 'No supported asset list, fee schedule, quote, or slippage control is available, because the interface shows asset selection, quotes, and submission as disabled. This page makes no promise about how fees or slippage will behave in future. Do not rely on any figure the interface does not display.' },
      { table: { label: 'swap-errors', headers: ['Situation', 'What to expect'], rows: [
        ['Interface says unavailable', 'This is the real state. There is nothing to retry.'],
        ['Quote unavailable', 'The quote field reports that no backend connection exists.'],
        ['Slippage controls', 'Not available; none are shown in the interface.'],
      ] } },
    ] },
    { id: 'limits', title: 'Limitations', blocks: [
      { ul: [
        'Protection against an exposed private key applies only where deployed contracts enforce it.',
        'A compromised device that captures an authorization secret can defeat the control.',
         'Credential loss, authenticator incompatibility, device compromise, and same-origin script compromise remain risks.',
        'Smart-contract defects and upgrade permissions remain risks.',
        'No Uniswap v4 hooks, pool liquidity creation, or token jail and unjail for arbitrary ERC-20 assets is implemented.',
      ] },
    ] },
  ],
  cta: { title: 'See the JailSwap interface', text: 'Open the existing functional screen. It is a disabled preview and will say so.', label: 'Open JailSwap', href: '/jailswap', secondary: { label: 'Security model', href: '/security' } },
};
export default function JailSwapInfoPage() { return <InfoPage def={def} testId="page-jailswap-info" />; }
