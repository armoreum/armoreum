export function launchChainId(id: string, chain: "ethereum" | "robinhood"): string {
  const raw = id.startsWith("ethereum:") ? id.slice("ethereum:".length) : id;
  return chain === "ethereum" ? `ethereum:${raw}` : raw;
}

/** Single-chain routes can be aliases; only Multichain tabs need a second, chain-specific response. */
export function selectLaunchDetail<T extends { id: string; chainId?: number | null; launchMode?: string | null }>(
  base: T, selected: T | undefined, selectedId: string, chain: "ethereum" | "robinhood",
): T | undefined {
  if (base.launchMode !== "multichain") return base;
  return selected?.id.toLowerCase() === selectedId.toLowerCase()
    && selected.chainId === (chain === "ethereum" ? 1 : 4663) ? selected : undefined;
}
