/**
 * Public, per-chain addresses for the personal Jail Vault integration.
 * Keep a chain disabled until its VaultFactory is upgraded, trusted factory is
 * registered, and the deployed personal-vault factory is verified on-chain.
 */
export const MY_JAIL_DEPLOYMENTS: Record<
  number,
  { vaultFactory: string; personalVaultFactory: string } | null
> = {
  1: null,
  4663: null,
};
