import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";

// Isolated browser harness: real coordinator, simulated executors and authorization.
// All HTTP is intercepted. This suite cannot submit a blockchain transaction.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
let bundle = "";
const address = `0x${"12".repeat(20)}`;
const root = `0x${"34".repeat(32)}`;
const result = {
  launchId: root, tokenAddress: address, creatorVault: address, taxRouter: address,
  curveAddress: address, poolId: root, authorizationEpochRoot: root, transactions: {},
};

test.beforeAll(async () => {
  const output = await build({
    stdin: {
      contents: `import React from "react"; import { createRoot } from "react-dom/client";
        import { MultichainMainnetLaunchFlow } from "./src/components/MultichainMainnetLaunchFlow";
        createRoot(document.getElementById("root")).render(React.createElement(MultichainMainnetLaunchFlow, {
          draftId:"fixture",tokenName:"Fixture",tokenSymbol:"FIX",initialBuyEth:"0.02",
          canStartNewDraft:false,startingNewDraft:false,onStartNewDraft:async()=>{},
          onInitialBuyLocked:()=>{},onCapsuleDownloaded:()=>{}
        }));`,
      resolveDir: path.resolve("."),
      loader: "tsx",
    },
    bundle: true, write: false, format: "esm", jsx: "automatic",
    define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
    plugins: [{
      name: "isolated-launch-fixtures",
      setup(b: any) {
        b.onLoad({ filter: /creator-password-authorization\.ts$/ }, () => ({
          loader: "js",
          contents: `import { keccak256, toUtf8Bytes } from "ethers";
            export const validateCreatorAuthorizationPassword=()=>{};
            export const deriveCreatorPasswordKdf=async()=>new Uint8Array(32);
            export const requestCreatorAuthorizationSeed=async(id)=>({
              launchId:keccak256(toUtf8Bytes("armoreum-launch:"+id)),
              seed:new Uint8Array(32),creatorAddress:"${address}",
              creatorPrivateKey:"fixture-not-a-real-key",serverKeyId:"fixture"
            });
            export const derivePasswordAuthorizationSigner=async()=>"${address}";
            export const signPasswordAuthorizationDigest=async()=>"fixture";
            export const derivePasswordAuthorizationProofChains=async()=>({
              authorizationEpochRoot:"${root}",chains:{}
            });`,
        }));
        b.onLoad({ filter: /(?:Pons|Ethereum)MainnetLaunchExecutor\.tsx$/ }, (args: any) => {
          const ethereum = args.path.includes("Ethereum");
          const name = ethereum ? "EthereumMainnetLaunchExecutor" : "PonsMainnetLaunchExecutor";
          const chain = ethereum ? "ethereum" : "robinhood";
          return {
            loader: "tsx",
            contents: `import {useEffect,useRef} from "react";
              export function ${name}(p){
                const seen=useRef(0);
                useEffect(()=>{void p.onCreateFundingOrder({}).catch(()=>{});},[]);
                useEffect(()=>{
                  if(!p.launchTrigger||!p.canExecute||p.initialResult||seen.current===p.launchTrigger)return;
                  seen.current=p.launchTrigger;p.onExecutionState("running");
                  void fetch("/__execute/${chain}",{method:"POST"}).then(async(r)=>{
                    if(!r.ok)throw Error("The launch service returned an invalid response (500).");
                    const value=await r.json();p.onLaunched(value);p.onExecutionState("completed");
                  }).catch(e=>p.onExecutionState("failed",e.message));
                },[p.launchTrigger,p.canExecute,p.initialResult]);
                return null;
              }`,
          };
        });
        b.onLoad({ filter: /QuantumRecoveryCapsule\.tsx$/ }, () => ({
          loader: "js", contents: "export function QuantumRecoveryCapsule(){return null;}",
        }));
      },
    }],
  });
  bundle = output.outputFiles[0].text;
});

async function setup(page: any, options: { existingEthereum?: boolean; existingEthereumPending?: boolean; failEthereum?: boolean; failRobinhood?: boolean; deliveredDespite500?: boolean } = {}) {
  const state = {
    ethereum: options.existingEthereum ? "launched" : options.existingEthereumPending ? "deploying-token" : "not-submitted",
    robinhood: "not-submitted",
    calls: [] as string[],
    fail: Boolean(options.failRobinhood),
    failEthereum: Boolean(options.failEthereum),
    releaseEthereum: null as null | (() => void),
  };
  await page.route("**/*", async (route: any) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/__sequence") {
      return route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div><script type="module" src="/__sequence.js"></script></body></html>' });
    }
    if (url.pathname === "/__sequence.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
    if (url.pathname.includes("/funding-orders")) {
      const ethereum = url.pathname.includes("ethereum-mainnet");
      const status = ethereum ? state.ethereum : state.robinhood;
      return route.fulfill({ json: {
        depositStatus: "confirmed", launchStatus: status, launchLastStage: status,
        launchTransactions: {}, launchResult: status === "launched" ? result : null,
        requiredDepositWei: "2500000000000000", depositBalanceWei: "25000000000000000",
        depositAddress: address, depositChainId: ethereum ? 1 : 4663,
        depositNetworkName: ethereum ? "Ethereum" : "robinhood",
      } });
    }
    if (url.pathname === "/__execute/ethereum") {
      state.calls.push("ethereum");
      if (state.failEthereum) {
        state.failEthereum = false;
        state.ethereum = "needs-attention";
        return route.fulfill({ status: 500, contentType: "text/plain", body: "fixture interruption" });
      }
      state.ethereum = "deploying-token";
      await new Promise<void>(resolve => { state.releaseEthereum = resolve; });
      state.ethereum = "launched";
      return route.fulfill({ json: result });
    }
    if (url.pathname === "/__execute/robinhood") {
      state.calls.push("robinhood");
      if (state.fail) {
        state.fail = false;
        state.robinhood = options.deliveredDespite500 ? "launched" : "needs-attention";
        return route.fulfill({ status: 500, contentType: "text/plain", body: "fixture interruption" });
      }
      state.robinhood = "launched";
      return route.fulfill({ json: result });
    }
    // Never allow any real API, RPC, wallet, or other external request.
    return route.abort();
  });
  await page.goto("/__sequence");
  await page.locator('input[type="password"]').nth(0).fill("fixture-password");
  await page.locator('input[type="password"]').nth(1).fill("fixture-password");
  await page.getByRole("button", { name: /prepare.*authorization/i }).click();
  if (!options.existingEthereumPending) {
    await expect(page.getByTestId("button-multichain-confirm-launch")).toBeEnabled();
  }
  return state;
}

test("one click executes Ethereum first, then automatically Robinhood exactly once", async ({ page }) => {
  const s = await setup(page);
  expect(s.calls).toEqual([]);
  await page.getByTestId("button-multichain-confirm-launch").click();
  await expect.poll(() => s.calls).toEqual(["ethereum"]);
  await expect(page.getByTestId("button-multichain-confirm-launch")).toBeDisabled();
  s.releaseEthereum!();
  await expect.poll(() => s.calls).toEqual(["ethereum", "robinhood"]);
  await expect(page.getByTestId("multichain-launch-status")).toContainText("launches complete");
  await expect(page.getByTestId("button-multichain-confirm-launch")).toBeDisabled();
});

test("friendly Robinhood-only Resume after 500 never re-executes Ethereum", async ({ page }) => {
  const s = await setup(page, { failRobinhood: true });
  await page.getByTestId("button-multichain-confirm-launch").click();
  await expect.poll(() => s.calls).toEqual(["ethereum"]);
  s.releaseEthereum!();
  await expect(page.getByTestId("multichain-launch-status")).toContainText("Click Resume to continue on Robinhood");
  await expect(page.locator("body")).not.toContainText("invalid response (500)");
  s.fail = true;
  await page.getByRole("button", { name: "Resume Robinhood launch" }).click();
  await expect.poll(() => s.calls).toEqual(["ethereum", "robinhood", "robinhood"]);
  await expect(page.getByTestId("multichain-launch-status")).toHaveCount(1);
  await expect(page.getByTestId("multichain-launch-status")).toContainText("Click Resume to continue on Robinhood");
  await expect(page.locator(".multichain-activity")).not.toContainText("Connection or launch step needs a check");
  await page.getByRole("button", { name: "Resume Robinhood launch" }).click();
  await expect.poll(() => s.calls).toEqual(["ethereum", "robinhood", "robinhood", "robinhood"]);
  await expect(page.getByTestId("multichain-launch-status")).toContainText("launches complete");
});

test("backend success after a broken HTTP response replaces the interruption with completion", async ({ page }) => {
  const s = await setup(page, { existingEthereum: true, failRobinhood: true, deliveredDespite500: true });
  expect(s.calls).toEqual([]);
  await page.getByTestId("button-multichain-confirm-launch").click();
  await expect(page.getByTestId("multichain-launch-status")).toContainText("launches complete");
  expect(s.calls).toEqual(["robinhood"]);
});

test("existing Ethereum requires explicit click and never launches it again", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const s = await setup(page, { existingEthereum: true });
  await page.waitForTimeout(500);
  expect(s.calls).toEqual([]);
  await page.getByTestId("button-multichain-confirm-launch").click();
  await expect.poll(() => s.calls).toEqual(["robinhood"]);
});

test("an interrupted Ethereum attempt can Resume before Robinhood starts", async ({ page }) => {
  const s = await setup(page, { failEthereum: true });
  await page.getByTestId("button-multichain-confirm-launch").click();
  await expect(page.getByRole("button", { name: "Resume Ethereum launch" })).toBeEnabled();
  expect(s.calls).toEqual(["ethereum"]);
  await page.getByRole("button", { name: "Resume Ethereum launch" }).click();
  await expect.poll(() => s.calls).toEqual(["ethereum", "ethereum"]);
  s.releaseEthereum!();
  await expect.poll(() => s.calls).toEqual(["ethereum", "ethereum", "robinhood"]);
});

test("stalled confirmation offers a status-only Resume without duplicating pending execution", async ({ page }) => {
  await page.clock.install();
  const s = await setup(page);
  await page.getByTestId("button-multichain-confirm-launch").click();
  await expect.poll(() => s.calls).toEqual(["ethereum"]);
  // First observe the pending status, then simulate three minutes without progress.
  await page.clock.runFor(4_100);
  await page.clock.fastForward(181_000);
  await expect(page.getByRole("button", { name: "Resume Ethereum launch" })).toBeEnabled();
  await page.getByRole("button", { name: "Resume Ethereum launch" }).click();
  expect(s.calls).toEqual(["ethereum"]);
  s.releaseEthereum!();
  await page.clock.runFor(4_100);
  await expect.poll(() => s.calls).toEqual(["ethereum", "robinhood"]);
});

test("a restored pending launch stays observable without silently starting Robinhood", async ({ page }) => {
  const s = await setup(page, { existingEthereumPending: true });
  await expect(page.getByTestId("button-multichain-confirm-launch")).toBeDisabled();
  s.ethereum = "launched";
  await expect(page.getByRole("button", { name: "Resume Robinhood launch" })).toBeEnabled();
  expect(s.calls).toEqual([]);
  await page.getByRole("button", { name: "Resume Robinhood launch" }).click();
  await expect.poll(() => s.calls).toEqual(["robinhood"]);
});
