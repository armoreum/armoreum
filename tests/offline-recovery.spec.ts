import { test, expect } from '@playwright/test';

test('Jail Bank lives in More and the bottom-bar Recovery opens an isolated document', async ({ page }) => {
  await page.goto('/bridge');
  const bottom = page.getByRole('navigation', { name: 'Mobile navigation', exact: true });
  const recovery = bottom.getByRole('link', { name: 'Offline Recovery', exact: true });
  await expect(recovery).toBeVisible();
  await expect(recovery).toHaveAttribute('href', '/offline-recovery');
  await expect(bottom.getByRole('link', { name: 'Jail Bank', exact: true })).toHaveCount(0);
  await page.locator('.mobile-bottom-more').click();
  const more = page.getByRole('navigation', { name: 'More pages', exact: true });
  await expect(more.getByRole('link', { name: 'Offline Recovery', exact: true })).toHaveCount(0);
  await more.getByRole('link', { name: 'Jail Bank', exact: true }).click();
  await expect(page).toHaveURL(/\/my-jail$/);
  await expect(page.getByRole('heading', { name: 'Jail Bank', exact: true })).toBeVisible();
  await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
  for (const name of ['JailSwap', 'JailBridge', 'JailPay']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.locator('main').getByRole('button', { name: /connect wallet/i })).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as Record<string, unknown>).__appDocument = true; });
  await recovery.click();
  await expect(page.getByRole('heading', { name: /Disconnect From the Internet/i })).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() => '__appDocument' in window)).toBe(false);
});

test('desktop sidebar retains both existing destinations', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/bridge');
  const sidebar = page.locator('.sidebar');
  await expect(sidebar.getByRole('link', { name: 'Jail Bank', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Offline Recovery', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation', exact: true })).toBeHidden();
});

test('verified recovery survives offline reload and remains locked while online', async ({ page, context }) => {
  const apiRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
  await page.goto('/offline-recovery');
  await expect(page.getByRole('heading', { name: /Disconnect From the Internet/i })).toBeVisible({ timeout: 60_000 });
  const continueButton = page.getByRole('button', { name: 'Continue to Offline Recovery' });
  await expect(continueButton).toBeDisabled();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: /Disconnect From the Internet/i })).toBeVisible();
  await page.getByRole('checkbox').check();
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  expect(apiRequests).toEqual([]);
});

test('a verified new worker replaces the previous recovery cache', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const cache = await caches.open('armoreum-offline-recovery-v4');
    await cache.put('/old-recovery-marker', new Response('old'));
  });
  await page.goto('/offline-recovery');
  await expect(page.getByRole('heading', { name: /Disconnect From the Internet/i })).toBeVisible({ timeout: 60_000 });
  const names = await page.evaluate(() => caches.keys());
  expect(names).toContain('armoreum-offline-recovery-v5');
  expect(names).not.toContain('armoreum-offline-recovery-v4');
});
