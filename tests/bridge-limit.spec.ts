import { test, expect } from '@playwright/test';
import { bridgeLiquidityLimit } from '../../api-server/src/lib/bridge-liquidity';

const unit = 10n ** 18n;
const draft = '55d09b23-3b04-4f8a-b656-520dbd131af1';
const pair = {
  launchDraftId: draft, launchId: `0x${'2'.repeat(64)}`, name: 'capitol', symbol: 'CAPITOL',
  ethereumToken: `0x${'1'.repeat(40)}`, robinhoodToken: `0x${'3'.repeat(40)}`,
  ethereumBridge: `0x${'4'.repeat(40)}`, robinhoodBridge: `0x${'5'.repeat(40)}`,
  sharedCapacity: (10_000_000n * unit).toString(),
};
const nextPair = {
  ...pair, launchDraftId: '66d09b23-3b04-4f8a-b656-520dbd131af2',
  ethereumToken: `0x${'a'.repeat(40)}`, robinhoodToken: `0x${'b'.repeat(40)}`,
  name: 'Future launch', symbol: 'NEXT',
};

async function setup(page: import('@playwright/test').Page) {
  const state = { ethereum: 2_500_000n * unit, robinhood: 10_000_000n * unit, unavailable: false };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const selectedPair = path.includes(nextPair.launchDraftId) ? nextPair : pair;
    if (path.includes('/multichain-bridge/liquidity/')) {
      if (state.unavailable) {
        await route.fulfill({ status: 503, json: { error: 'Could not verify the destination reserve.' } });
        return;
      }
      const sourceChainId = Number(path.split('/').at(-1));
      const inventory = sourceChainId === 1 ? state.robinhood : state.ethereum;
      await route.fulfill({ json: {
        launchDraftId: selectedPair.launchDraftId, sourceChainId,
        destinationChainId: sourceChainId === 1 ? 4663 : 1,
        destinationToken: sourceChainId === 1 ? selectedPair.robinhoodToken : selectedPair.ethereumToken,
        destinationInventory: inventory.toString(), pendingInboundAmount: '0',
        maxAmount: bridgeLiquidityLimit(inventory, 0n, BigInt(pair.sharedCapacity), BigInt(pair.sharedCapacity)).toString(),
      } });
      return;
    }
    await route.fulfill({ json: path === '/api/multichain-bridges' ? [pair, nextPair]
      : path.endsWith('/multichain-bridge') ? { status: 'active', transfers: [] }
      : {} });
  });
  return state;
}

for (const width of [390, 1280]) {
  test(`ten-percent limit and explicit fallback work in both directions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto('/bridge');
    await page.getByTestId('input-bridge-token-address').fill(pair.ethereumToken);
    const reserve = page.getByTestId('bridge-destination-reserve');
    const input = page.getByRole('spinbutton', { name: 'Bridge amount' });
    await expect(reserve).toContainText('1000000.0 CAPITOL');
    await expect(reserve).toContainText('Max per transfer to Robinhood');
    await input.fill('1500000');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.bridge-reserve-warning')).toContainText('Maximum: 1000000.0 CAPITOL');
    await expect(input).toHaveValue('1500000');
    await page.getByTestId('button-bridge-use-max').click();
    await expect(input).toHaveValue('1000000.0');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByTestId('button-bridge-use-max')).toHaveCount(0);
    await page.locator('.bridge-route-picker > button').click();
    await expect(reserve).toContainText('Max per transfer to Ethereum');
    await expect(reserve).toContainText('250000.0 CAPITOL');
    await input.fill('250000.000000000000000001');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await page.getByTestId('button-bridge-use-max').click();
    await expect(input).toHaveValue('250000.0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: '../../generated-artifacts/bridge-limit-mobile.png' });
  });
}

test('updated reserves change the limit without replacing input, including newly listed pairs', async ({ page }) => {
  await page.clock.install();
  const state = await setup(page);
  await page.goto('/bridge');
  await page.getByTestId('input-bridge-token-address').fill(nextPair.ethereumToken);
  const reserve = page.getByTestId('bridge-destination-reserve');
  const input = page.getByRole('spinbutton', { name: 'Bridge amount' });
  await expect(reserve).toContainText('1000000.0 NEXT');
  await input.fill('950000');
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  state.robinhood = 9_000_000n * unit;
  await page.clock.fastForward(15_001);
  await expect(reserve).toContainText('900000.0 NEXT');
  await expect(input).toHaveValue('950000');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await page.getByTestId('button-bridge-use-max').click();
  await expect(input).toHaveValue('900000.0');
});

test('zero or unknown destination capacity cannot become a usable fallback', async ({ page }) => {
  await page.clock.install();
  const state = await setup(page);
  state.robinhood = 9n;
  await page.goto('/bridge');
  await page.getByTestId('input-bridge-token-address').fill(pair.ethereumToken);
  const reserve = page.getByTestId('bridge-destination-reserve');
  await expect(reserve).toContainText('0.0 CAPITOL');
  await page.getByRole('spinbutton', { name: 'Bridge amount' }).fill('0.000000000000000001');
  await expect(page.getByTestId('button-bridge-use-max')).toHaveCount(0);
  await expect(page.getByTestId('button-bridge-max')).toBeDisabled();
  state.unavailable = true;
  await page.clock.fastForward(15_001);
  await expect(reserve).toContainText('Unavailable');
  await expect(page.getByTestId('button-bridge-max')).toBeDisabled();
  await expect(page.getByTestId('button-bridge-use-max')).toHaveCount(0);
  await expect(page.locator('.bridge-reserve-warning')).toContainText('Could not check the destination reserve.');
});
