import type { Provider } from "ethers";

const BASIS_POINTS = 10_000n;
const MAX_FEE_CAP_BPS = 12_000n;
const GAS_LIMIT_MARGIN_BPS = 12_000n;

export type Eip1559FeeOverrides = {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

export function feeCapsFromBaseFee(
  baseFee: bigint,
  observedGasPrice: bigint | null,
  networkName: string,
): Eip1559FeeOverrides {
  if (baseFee <= 0n) {
    throw new Error(`${networkName} base fee is unavailable.`);
  }
  const maxFeePerGas =
    (baseFee * MAX_FEE_CAP_BPS + BASIS_POINTS - 1n) / BASIS_POINTS;
  if (observedGasPrice !== null && observedGasPrice > maxFeePerGas) {
    throw new Error(
      `Current ${networkName} gas quote exceeds the live base-fee +20% cap. Wait and retry.`,
    );
  }
  return {
    maxFeePerGas,
    maxPriorityFeePerGas: maxFeePerGas - baseFee,
  };
}

export function gasLimitWithMargin(estimate: bigint): bigint {
  if (estimate <= 0n) throw new RangeError("Gas estimate must be positive.");
  return (estimate * GAS_LIMIT_MARGIN_BPS + BASIS_POINTS - 1n) / BASIS_POINTS;
}

export async function transactionGasOverrides(
  provider: Pick<Provider, "getBlock" | "getFeeData">,
  estimatedGas: bigint,
  networkName: string,
) {
  const [block, feeData] = await Promise.all([
    provider.getBlock("latest"),
    provider.getFeeData(),
  ]);
  const baseFee = block?.baseFeePerGas ?? feeData.gasPrice;
  if (baseFee === null || baseFee === undefined) {
    throw new Error(`${networkName} base fee is unavailable.`);
  }
  return {
    gasLimit: gasLimitWithMargin(estimatedGas),
    ...feeCapsFromBaseFee(baseFee, feeData.gasPrice, networkName),
  };
}
