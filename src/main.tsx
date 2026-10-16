import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Armoreum root element is missing.");
const mountNode: HTMLElement = rootElement;

const root = createRoot(rootElement);
const basePath = import.meta.env.BASE_URL.replace(/\/+$/, "");
const recoveryPath = `${basePath}/offline-recovery` || "/offline-recovery";
const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

function showLoadError() {
  const message = document.createElement("p");
  message.textContent = "Armoreum could not open this page. Reload and try again.";
  message.style.cssText = "margin:2rem auto;max-width:42rem;padding:1rem;font:16px system-ui;color:#e9e6df;background:#071116";
  mountNode.replaceChildren(message);
}

function mountError(error: unknown) {
  if (import.meta.env.DEV) console.error("Armoreum page entry failed to load.", error);
  showLoadError();
}

if (currentPath === recoveryPath) {
  void import("./offline-recovery-entry")
    .then(({ mountOfflineRecovery }) => mountOfflineRecovery(root))
    .catch(mountError);
} else {
  void import("./app-entry")
    .then(({ mountApp }) => mountApp(root))
    .catch(mountError);
}
