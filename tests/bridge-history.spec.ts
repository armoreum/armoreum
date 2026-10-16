import { test, expect } from '@playwright/test';

const draft = '55d09b23-3b04-4f8a-b656-520dbd131af1';
const token = `0x${'1'.repeat(40)}`;
const pair = {
  launchDraftId: draft, launchId: `0x${'2'.repeat(64)}`, name: 'capitol', symbol: 'CAPITOL',
  ethereumToken: token, robinhoodToken: `0x${'3'.repeat(40)}`,
  ethereumBridge: `0x${'4'.repeat(40)}`, robinhoodBridge: `0x${'5'.repeat(40)}`,
  sharedCapacity: '10000000000000000000000000',
};
const transfers = [0, 1].map((n) => ({
  id: `transfer-${n}`, sourceChainId: 1, destinationChainId: 4663,
  sender: token, recipient: token, grossAmount: '283625734554285990641093',
  destinationFee: '56838824559977152433', recipientAmount: '283057346308686219116760',
  sourceTransactionHash: `0x${String(n + 6).repeat(64)}`,
  destinationTransactionHash: `0x${String(n + 8).repeat(64)}`,
  status: 'delivered', retryCount: 0, lastError: null, createdAt: '2026-10-16T08:20:11Z',
}));

for (const width of [360, 390, 1280]) {
  test(`bridge transfer history is readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = path === '/api/multichain-bridges' ? [pair]
        : path === `/api/launch-drafts/${draft}/multichain-bridge` ? { status: 'active', transfers }
        : path.endsWith('/liquidity') ? { maxAmount: pair.sharedCapacity }
        : { status: 'unavailable', messages: [], error: 'Scan temporarily unavailable' };
      await route.fulfill({ json: body });
    });
    await page.goto('/bridge');
    await page.getByTestId('input-bridge-token-address').fill(token);
    await expect(page.locator('.bridge-history-item')).toHaveCount(2);
    const card = page.locator('.bridge-history-item').first();
    await expect(card.locator('strong')).toContainText('283,625.734554');
    await expect(card.locator('strong')).not.toContainText('285990641093');
    await expect(card.getByRole('link', { name: 'Source', exact: true })).toHaveAttribute('href', /etherscan.io\/tx/);
    await expect(card.getByRole('link', { name: 'Destination', exact: true })).toHaveAttribute('href', /robin.etherscan.io\/tx/);
    await expect(card.getByRole('link', { name: 'LayerZero Scan', exact: true })).toHaveAttribute('href', /layerzeroscan.com\/tx/);
    await expect(card.locator('time')).toContainText('UTC');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (width === 390) await card.screenshot({ path: '../../generated-artifacts/bridge-history-mobile.png' });
    if (width === 1280) await card.screenshot({ path: '../../generated-artifacts/bridge-history-desktop.png' });
  });
}

test('explorer shows a submitted hash before confirmation and updates without reloading', async ({ page }) => {
  let confirmed = false;
  await page.route('**/api/bridge-transfers*', async route => {
    const row = {
      ...transfers[0], name: pair.name, symbol: pair.symbol, launchDraftId: draft,
      sourceToken: pair.ethereumToken, destinationToken: pair.robinhoodToken,
      sourceBridge: pair.ethereumBridge, destinationBridge: pair.robinhoodBridge,
      transferId: confirmed ? `0x${'a'.repeat(64)}` : null, guid: confirmed ? `0x${'b'.repeat(64)}` : null,
      sender: confirmed ? token : null, recipient: confirmed ? token : null,
      grossAmount: confirmed ? transfers[0].grossAmount : null,
      destinationFee: confirmed ? transfers[0].destinationFee : null,
      recipientAmount: confirmed ? transfers[0].recipientAmount : null,
      destinationTransactionHash: null, verificationConfirmedAt: null,
      status: confirmed ? 'source-pending-finality' : 'source-submitted',
      hasRetryError: false, updatedAt: transfers[0].createdAt,
    };
    await route.fulfill({ json: { items: [row], total: 1, nextCursor: null, observedAt: row.createdAt } });
  });
  await page.goto('/bridge-explorer');
  await expect(page.getByText('Source pending', { exact: true })).toBeVisible();
  const sourceStage = page.getByText('Ethereum transaction', { exact: true }).locator('..');
  await expect(sourceStage.getByText('Pending', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /View on LayerZero Scan/ })).toHaveAttribute('href', /666666/);
  confirmed = true;
  await expect(sourceStage.getByText('Confirmed', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Awaiting confirmations', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
