import { test, expect } from '@playwright/test';

for (const width of [320, 390, 768, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`Bridge header stays readable at ${width}px in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/bridge');
      await page.evaluate(theme => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.classList.toggle('dark', theme === 'dark');
      }, theme);
      const header = page.locator('.bridge-page-header');
      await expect(header.getByRole('heading', { name: 'Bridge', exact: true })).toBeVisible();
      const network = header.locator('.bridge-page-networks');
      const badge = header.locator('.bridge-page-scope');
      await expect(network.getByText('Robinhood Chain', { exact: true })).toBeVisible();
      await expect(badge).toBeVisible();
      const geometry = await header.evaluate(element => {
        const rect = (selector: string) => element.querySelector(selector)!.getBoundingClientRect().toJSON();
        return {
          heading: rect('.bridge-page-heading'), network: rect('.bridge-page-networks'),
          badge: rect('.bridge-page-scope'),
          labels: Array.from(element.querySelectorAll('.bridge-page-networks > span')).map(label => label.getBoundingClientRect().height),
          viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        };
      });
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.network.top).toBeGreaterThanOrEqual(geometry.heading.bottom);
      expect(geometry.badge.right).toBeLessThanOrEqual(width);
      expect(geometry.labels.every(height => height <= 22)).toBe(true);
      if (width <= 600) expect(geometry.badge.top).toBeGreaterThanOrEqual(geometry.network.bottom);
      await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible({ visible: width < 1024 });
    });
  }
}
