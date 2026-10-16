import test from "node:test";
import assert from "node:assert/strict";
import { launchChainId, selectLaunchDetail } from "./launch-chain-ids.ts";

test("multichain detail tabs preserve the launch identity on both deep-link forms", () => {
  const raw = `0x${"a".repeat(64)}`;
  for (const id of [raw, `ethereum:${raw}`]) {
    assert.equal(launchChainId(id, "robinhood"), raw);
    assert.equal(launchChainId(id, "ethereum"), `ethereum:${raw}`);
  }
});

test("Ethereum-only aliases render the verified Ethereum response without waiting for Robinhood", () => {
  const raw = `0x${"b".repeat(64)}`;
  const ethereum = { id: `ethereum:${raw}`, chainId: 1, launchMode: "ethereum" };
  assert.equal(selectLaunchDetail(ethereum, undefined, raw, "ethereum"), ethereum);
  assert.equal(selectLaunchDetail(ethereum, undefined, ethereum.id, "ethereum"), ethereum);
});

test("Pons-only detail uses its own response without requiring an Ethereum deployment", () => {
  const pons = { id: `0x${"c".repeat(64)}`, chainId: 4663, launchMode: "pons-v2" };
  assert.equal(selectLaunchDetail(pons, undefined, pons.id, "robinhood"), pons);
});

test("Multichain tabs reject missing, wrong-network and wrong-identity responses", () => {
  const raw = `0x${"a".repeat(64)}`;
  const robinhood = { id: raw, chainId: 4663, launchMode: "multichain" };
  const ethereum = { id: `ethereum:${raw}`, chainId: 1, launchMode: "multichain" };
  assert.equal(selectLaunchDetail(robinhood, ethereum, ethereum.id, "ethereum"), ethereum);
  assert.equal(selectLaunchDetail(ethereum, robinhood, raw, "robinhood"), robinhood);
  assert.equal(selectLaunchDetail(robinhood, undefined, ethereum.id, "ethereum"), undefined);
  assert.equal(selectLaunchDetail(robinhood, robinhood, ethereum.id, "ethereum"), undefined);
  assert.equal(selectLaunchDetail(robinhood, { ...ethereum, chainId: 4663 }, ethereum.id, "ethereum"), undefined);
  assert.equal(selectLaunchDetail(robinhood, { ...ethereum, id: `ethereum:0x${"d".repeat(64)}` }, ethereum.id, "ethereum"), undefined);
});
