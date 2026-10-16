import { test, expect } from '@playwright/test';

let lifecycleErrors: string[] = [];
test.beforeEach(({ page }) => {
  lifecycleErrors = [];
  page.on('console', message => {
    if (/Maximum update depth|Cannot update a component .*while rendering/i.test(message.text())) {
      lifecycleErrors.push(message.text());
    }
  });
});
test.afterEach(() => { expect(lifecycleErrors).toEqual([]); });

test('the HTML shell shows a real loading state while the application chunk is unavailable', async ({ page }) => {
  let blocked = 0;
  await page.route('**/assets/app-entry-*.js', () => { blocked++; });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status')).toContainText('Loading armoreum');
  await expect(page.getByRole('img', { name: 'armoreum', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'armoreum', exact: true })).toHaveJSProperty('complete', true);
  expect(await page.getByRole('img', { name: 'armoreum', exact: true }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText('Built on Hashes. Designed for Quantum Resistance.', { exact: true })).toBeVisible();
  expect(blocked).toBeGreaterThan(0);
});

test('a delayed wallet API does not hide the landing or reset an open ArmorProof dialog', async ({ page, request }) => {
  const config = await request.get('http://127.0.0.1:8080/api/wallet-connect-config');
  expect(config.ok()).toBe(true);
  const body = await config.text();
  let release: (() => Promise<void>) | undefined;
  await page.route('**/api/wallet-connect-config', route => new Promise<void>(resolve => {
    release = async () => { await route.fulfill({ contentType: 'application/json', body }); resolve(); };
  }));
  await page.route('**/api/armorproof', route => route.fulfill({
    json: { observedAt: '2026-10-16T10:00:00.000Z', refreshIntervalSeconds: 100, items: [] },
  }));
  await page.goto('/');
  await expect(page.getByTestId('armorproof-trigger')).toBeVisible({ timeout: 5000 });
  await page.getByTestId('armorproof-trigger').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(release).toBeDefined();
  await release!();
  await page.waitForTimeout(1500);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('armorproof-trigger')).toBeAttached();
});

test('an unavailable wallet API never leaves the landing blank, including after its timeout', async ({ page }) => {
  let configRequests = 0;
  await page.route('**/api/wallet-connect-config', () => { configRequests++; });
  await page.goto('/');
  await expect(page.getByTestId('armorproof-trigger')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(10_500);
  await expect(page.getByTestId('armorproof-trigger')).toBeVisible();
  expect(configRequests).toBe(1);
  await page.goto('/bridge');
  await expect(page.getByRole('heading', { name: 'Bridge', exact: true })).toBeVisible();
});

test('restored startup retains ArmorProof and opens the real Reown modal', async ({ page, request }) => {
  await page.route('**/api/wallet-connect-config', async route => {
    const response = await request.get('http://127.0.0.1:8080/api/wallet-connect-config');
    expect(response.ok()).toBe(true);
    await route.fulfill({ response });
  });
  await page.goto('/');
  await expect(page.getByTestId('armorproof-trigger')).toBeVisible();
  await expect(page.locator('#armoreum-startup')).toHaveCount(0);
  await expect(page.getByText('Opening your app…', { exact: true })).toHaveCount(0);
  await page.goto('/bridge');
  await page.getByRole('button', { name: 'More pages and settings' }).click();
  await page.locator('#mobile-more-panel').getByRole('button', { name: /Connect Wallet/i }).click();
  await expect(page.locator('w3m-modal')).toBeVisible({ timeout: 15000 });
});
