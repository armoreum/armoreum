import { createElement } from "react";
import type { Root } from "react-dom/client";

import App from "./App";
import { ErrorBoundary } from "@/components/error-boundary";
import { RecoverySessionProvider } from "@/contexts/recovery-session-context";
import { ensureReownWallet } from "@/contexts/wallet-context";
import type { QrcPayload } from "@/lib/qrc";

import "./index.css";

export async function mountApp(root: Root, recoveredPayload: QrcPayload | null = null) {
  root.render(
    createElement(
      RecoverySessionProvider,
      { initialPayload: recoveredPayload },
      createElement(ErrorBoundary, null, createElement(App)),
    ),
  );
  // A stalled configuration API must never keep the public page's root empty.
  // The wallet provider upgrades in place when configuration becomes available.
  void ensureReownWallet();
}
