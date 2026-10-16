import assert from "node:assert/strict";
import test from "node:test";
import { launchIsActive, launchPauseMessage, nextLaunchLeg } from "./multichain-launch-sequence.ts";

test("Ethereum is always first until confirmed, even if Robinhood already exists", () => {
  assert.equal(nextLaunchLeg(false, false), "ethereum");
  assert.equal(nextLaunchLeg(false, true), "ethereum");
});
test("Ethereum completion hands off to Robinhood; both complete never restart", () => {
  assert.equal(nextLaunchLeg(true, false), "robinhood");
  assert.equal(nextLaunchLeg(true, true), null);
});
test("pending backend work must not be submitted again", () => {
  for (const status of ["verifying", "deploying-token", "enrolling", "seeding-pool"]) {
    assert.equal(launchIsActive(status), true, status);
  }
  for (const status of [undefined, "", "not-submitted", "needs-attention", "needs-funding",
    "launched", "ethereum-complete", "pons-complete"]) {
    assert.equal(launchIsActive(status), false, String(status));
  }
});
test("pause message preserves Ethereum success, with a clear Robinhood-only Resume", () => {
  assert.match(launchPauseMessage(true), /Ethereum launch complete\. Click Resume to continue on Robinhood/);
  assert.match(launchPauseMessage(false), /Ethereum launch needs another check/);
  for (const complete of [true, false]) {
    assert.doesNotMatch(launchPauseMessage(complete), /500|failed|invalid response/i);
    assert.match(launchPauseMessage(complete), /will not be repeated/);
  }
});
