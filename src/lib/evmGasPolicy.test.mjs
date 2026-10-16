import assert from "node:assert/strict";
import test from "node:test";
import { feeCapsFromBaseFee, gasLimitWithMargin } from "./evmGasPolicy.ts";

test("wallet transactions cap max fee at the latest base fee plus 20%", () => {
  assert.deepEqual(feeCapsFromBaseFee(101n, 122n, "Ethereum"), {
    maxFeePerGas: 122n,
    maxPriorityFeePerGas: 21n,
  });
  assert.throws(
    () => feeCapsFromBaseFee(100n, 121n, "Robinhood"),
    /Robinhood gas quote exceeds the live base-fee \+20% cap/i,
  );
});

test("wallet transactions reserve a rounded-up 20% gas-limit margin", () => {
  assert.equal(gasLimitWithMargin(100_001n), 120_002n);
  assert.throws(() => gasLimitWithMargin(0n), /must be positive/i);
});
