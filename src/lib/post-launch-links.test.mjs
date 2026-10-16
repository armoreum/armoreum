import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGmgnTokenUrl,
  buildLaunchDetailPath,
  buildPonsTokenUrl,
} from "./post-launch-links.ts";

const tokenAddress = `0x${"aB".repeat(20)}`;
const launchId = `0x${"cD".repeat(32)}`;

test("market links use the launched token contract address", () => {
  assert.equal(buildPonsTokenUrl(tokenAddress), `https://ponsfamily.com/launchpad/${tokenAddress}`);
  assert.equal(buildGmgnTokenUrl(tokenAddress), `https://gmgn.ai/eth/token/${tokenAddress}`);
  assert.equal(buildPonsTokenUrl("not-an-address"), null);
  assert.equal(buildGmgnTokenUrl("not-an-address"), null);
});

test("launch detail routes match the public Robinhood and Ethereum launch identifiers", () => {
  assert.equal(buildLaunchDetailPath("robinhood", launchId), `/launch/${launchId}`);
  assert.equal(
    buildLaunchDetailPath("ethereum", launchId),
    `/launch/${encodeURIComponent(`ethereum:${launchId}`)}`,
  );
  assert.equal(buildLaunchDetailPath("ethereum", `ethereum:${launchId}`), `/launch/${encodeURIComponent(`ethereum:${launchId}`)}`);
  assert.equal(buildLaunchDetailPath("robinhood", "invalid"), null);
});
