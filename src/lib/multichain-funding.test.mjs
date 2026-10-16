import assert from "node:assert/strict";
import test from "node:test";
import { multichainFundingOrderUrl } from "./multichain-funding.ts";

test("Multichain funding endpoints match the API routes for both chains", () => {
  const draftId = "draft/id";
  assert.equal(
    multichainFundingOrderUrl(draftId, "robinhood"),
    "/api/launch-drafts/draft%2Fid/funding-orders",
  );
  assert.equal(
    multichainFundingOrderUrl(draftId, "ethereum"),
    "/api/launch-drafts/draft%2Fid/ethereum-mainnet/funding-orders",
  );
});
