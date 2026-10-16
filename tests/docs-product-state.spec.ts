import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`documentation reflects live tools and request policy at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/docs');
    await expect(page.locator('body')).toContainText('Creator Vault rewards and JailETH');
    await expect(page.locator('body')).toContainText('offline recovery, ArmorProof');
    await expect(page.locator('body')).toContainText('LayerZero Bridge and Bridge Explorer');
    await page.goto('/docs/bridge-overview');
    await expect(page.locator('body')).toContainText('Bridge is live for registered, activated pairs.');
    await expect(page.locator('body')).not.toContainText('No pair is active at present');
    await page.goto('/docs/api-overview');
    await expect(page.locator('body')).toContainText('No application-enforced request-count quota.');
    await expect(page.locator('body')).not.toContainText('20 requests per IP per hour');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
