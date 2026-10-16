const TOKEN_ADDRESS_PATTERN = /^0x[\da-f]{40}$/i;
const LAUNCH_ID_PATTERN = /^0x[\da-f]{64}$/i;

export type TokenNetwork = "ethereum" | "robinhood";

export function buildPonsTokenUrl(tokenAddress: string): string | null {
  return TOKEN_ADDRESS_PATTERN.test(tokenAddress)
    ? `https://ponsfamily.com/launchpad/${tokenAddress}`
    : null;
}

export function buildGmgnTokenUrl(tokenAddress: string): string | null {
  return TOKEN_ADDRESS_PATTERN.test(tokenAddress)
    ? `https://gmgn.ai/eth/token/${tokenAddress}`
    : null;
}

export function buildLaunchDetailPath(network: TokenNetwork, launchId: string): string | null {
  const normalizedLaunchId = network === "ethereum" && launchId.startsWith("ethereum:")
    ? launchId.slice("ethereum:".length)
    : launchId;
  if (!LAUNCH_ID_PATTERN.test(normalizedLaunchId)) return null;

  const publicId = network === "ethereum"
    ? `ethereum:${normalizedLaunchId}`
    : normalizedLaunchId;
  return `/launch/${encodeURIComponent(publicId)}`;
}
