import { useState } from "react";
import { BrandTextTree } from "@/lib/brand-text";

type FlowMode = "creator" | "user";

const FLOWS = {
  creator: {
    label: "Creator Rewards",
    className: "is-creator",
    steps: [
      {
        title: "Trading Activity",
        description: "Eligible protocol fees are generated.",
      },
      {
        title: "Creator Reward Vault",
        description: "The creator’s share is recorded as an accrued liability.",
      },
      {
        title: "JAILED",
        description: "Protected reward access remains restricted under the contract rules.",
        jailed: true,
      },
      {
        title: "Password Authorization + Unjail",
        description: "The password and required wallet authorization protect the payout. A recovery-file upload is not part of the normal transaction flow.",
      },
      {
        title: "Protected Payout",
        description: "Eligible rewards can be released to the authorized payout destination after the required on-chain checks succeed.",
      },
    ],
  },
  user: {
    label: "User-Owned Tokens",
    className: "is-user-owned",
    steps: [
      {
        title: "Acquire Supported Tokens",
        description: "The user obtains tokens through a supported protected flow.",
      },
      {
        title: "Protected Balance",
        description: "The relevant contract records or controls the eligible assets.",
      },
      {
        title: "JAILED",
        description: "The configured restrictions prevent unauthorized access through the protected mechanism.",
        jailed: true,
      },
      {
        title: "Password + Wallet Authorization",
        description: "The user authorizes with a password and connected wallet, without uploading a recovery file.",
      },
      {
        title: "UNJAILED",
        description: "Access is restored according to the contract’s rules.",
      },
    ],
  },
} satisfies Record<
  FlowMode,
  {
    label: string;
    className: string;
    steps: { title: string; description: string; jailed?: boolean }[];
  }
>;

export function JailUnjailSection() {
  const [activeFlow, setActiveFlow] = useState<FlowMode>("creator");
  const flow = FLOWS[activeFlow];

  return (
    <BrandTextTree><section className="jail-un-jail-section" aria-labelledby="jail-un-jail-title">
      <div className="jail-un-jail-heading">
        <div>
          <h2 id="jail-un-jail-title">Jail / Unjail</h2>
          <p className="jail-un-jail-subtitle">
            Protection Is a State, Not Just a Wallet Setting.
          </p>
          <p className="jail-un-jail-description">
            armoreum is designed to separate asset ownership from authorization to access protected actions.
            Eligible creator rewards can remain unavailable until the required authorization is completed. Where supported by the actual contracts, eligible user-owned tokens can follow their own configured Jail / Unjail rules.
          </p>
        </div>
        <span className="jail-un-jail-status">Illustrative flow · not deployed or verified</span>
      </div>

      <div className="jail-un-jail-tabs" role="tablist" aria-label="Jail and Unjail flows">
        {(Object.entries(FLOWS) as [FlowMode, (typeof FLOWS)[FlowMode]][]).map(
          ([key, option]) => (
            <button
              key={key}
              id={`jail-flow-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={activeFlow === key}
              aria-controls="jail-flow-panel"
              tabIndex={activeFlow === key ? 0 : -1}
              onClick={() => setActiveFlow(key)}
            >
              {option.label}
            </button>
          ),
        )}
      </div>

      <div
        className={`jail-flow-panel ${flow.className}`}
        id="jail-flow-panel"
        role="tabpanel"
        aria-labelledby={`jail-flow-tab-${activeFlow}`}
      >
        <ol className="jail-flow-track">
          {flow.steps.map((step, index) => (
            <li
              className={`jail-flow-node${step.jailed ? " is-jailed" : ""}`}
              key={`${activeFlow}-${step.title}`}
            >
              <span className="jail-flow-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.title}</strong>
              <span>{step.description}</span>
            </li>
          ))}
        </ol>
        <p className="jail-flow-footnote">
          These flows are illustrative until the associated contracts and end-to-end authorization paths have been deployed and verified. Ordinary ERC-20 balances held in external wallets are not automatically protected.
        </p>
      </div>
    </section></BrandTextTree>
  );
}
