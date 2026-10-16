export function multichainFundingOrderUrl(
  draftId: string,
  network: "robinhood" | "ethereum",
): string {
  const encodedDraftId = encodeURIComponent(draftId);
  return network === "robinhood"
    ? `/api/launch-drafts/${encodedDraftId}/funding-orders`
    : `/api/launch-drafts/${encodedDraftId}/ethereum-mainnet/funding-orders`;
}
