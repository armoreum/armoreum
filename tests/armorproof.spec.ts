import { test, expect, type Page } from '@playwright/test';

const key = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;
const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
function creator(n: number, amount = '1234567890123456') {
  return {
    creatorAddress: addr(n), creatorPrivateKey: key(n),
    availableJailEthWei: amount, balanceStatus: 'verified',
    vaults: [{ chainId: 1, tokenAddress: addr(n + 100), vaultAddress: addr(n + 200),
      tokenName: `Test token ${n}`, tokenSymbol: `T${n}`, tokenImageUrl: null as string | null, availableJailEthWei: amount }],
  };
}
const directory = (count = 16) => ({
  observedAt: '2026-10-16T10:00:00.000Z', refreshIntervalSeconds: 100,
  items: Array.from({ length: count }, (_, i) => creator(i + 1)),
});

for (const width of [390, 1280]) {
  test(`original token logos fill circular avatars at ${width}px, including transparent padding`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = directory(4);
    fixture.items[0].vaults[0].tokenImageUrl = '/__test/wide-logo.svg';
    fixture.items[1].vaults[0].tokenImageUrl = '/__test/padded-logo.svg';
    fixture.items[3].vaults[0].tokenImageUrl = '/__test/missing-logo.png';
    await page.route('**/api/armorproof', route => route.fulfill({ json: fixture }));
    await page.route('**/__test/wide-logo.svg', route => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#216d54"/></svg>',
    }));
    await page.route('**/__test/padded-logo.svg', route => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect x="60" y="40" width="80" height="80" fill="#3568c4"/></svg>',
    }));
    await page.route('**/__test/missing-logo.png', route => route.fulfill({ status: 404 }));
    await page.goto('/');
    await page.getByTestId('armorproof-trigger').click();
    const original = page.getByRole('img', { name: 'Test token 1 logo', exact: true });
    await original.scrollIntoViewIfNeeded();
    await expect(original).toBeVisible();
    await expect(original).toHaveAttribute('src', '/__test/wide-logo.svg');
    await expect(original).toHaveCSS('object-fit', 'cover');
    await expect(original.locator('..')).toHaveCSS('overflow', 'hidden');
    await expect(original.locator('..')).toHaveCSS('border-radius', '50%');
    const padded = page.getByRole('img', { name: 'Test token 2 logo', exact: true });
    await padded.scrollIntoViewIfNeeded();
    await expect(padded).toHaveCSS('transform', /^matrix\(2\.5,/);
    const frame = await padded.evaluate(element => {
      const image = element as HTMLImageElement;
      const matrix = new DOMMatrix(getComputedStyle(image).transform);
      const size = image.clientWidth;
      // The original opaque artwork spans x60..140 / y40..120 of 200px.
      return {
        covered: 80 / 200 * size * matrix.a,
        centered: (80 / 200 * size - size / 2) * matrix.d + matrix.f + size / 2,
        size,
      };
    });
    expect(frame.covered).toBeCloseTo(frame.size, 1);
    expect(frame.centered).toBeCloseTo(frame.size / 2, 1);
    await expect(page.getByRole('img', { name: 'Test token 3 logo unavailable' })).toHaveCount(1);
    const broken = page.locator('.ap-card').nth(3).locator('.ap-avatar');
    await broken.scrollIntoViewIfNeeded();
    await expect(broken).toHaveAttribute('aria-label', 'Test token 4 logo unavailable');
    await expect(broken.locator('img')).toHaveCount(0);
    expect(await page.getByTestId('armorproof-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.getByTestId('armorproof-scroll').evaluate(el => el.scrollTop = 0);
    await page.screenshot({ path: `../../generated-artifacts/armorproof-token-logos-${width}.png` });
  });
}

async function stub(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { (window as unknown as { copied: string }).copied = text; },
    } });
  });
  await page.route('**/api/armorproof', route => route.fulfill({ json: directory() }));
}

for (const width of [320, 390, 1024, 1280]) {
  test(`ArmorProof dimensions, wrapped keys and pinned close at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stub(page);
    await page.goto('/');
    if (width === 390) await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.style.colorScheme = 'dark';
    });
    await page.getByTestId('armorproof-trigger').click();
    const dialog = page.getByRole('dialog', { name: 'ArmorProof' });
    await expect(dialog).toBeVisible();
    const entries = page.getByTestId('armorproof-table').locator('.ap-list > .ap-card');
    await expect(entries).toHaveCount(16);
    if (width >= 1100) await expect(dialog.locator('.ap-head')).toBeVisible();
    else await expect(dialog.locator('.ap-head')).toBeHidden();
    await expect(dialog).not.toContainText('Scope is those vaults only');
    await expect(dialog).not.toContainText('Creator passwords and recovery proofs');
    await expect(page.getByTestId(`armorproof-key-${addr(1)}`)).toHaveText(key(1));
    await expect(page.getByTestId('armorproof-observed')).toHaveCount(0);
    await expect(dialog).not.toContainText('Refreshes every 100 seconds');
    await expect(dialog).not.toContainText('Observed ');
    await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const geometry = await dialog.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const scroll = el.querySelector('[data-testid="armorproof-scroll"]')!;
      const close = el.querySelector('[data-testid="armorproof-close"]')!.getBoundingClientRect();
      return {
        width: rect.width / innerWidth, height: rect.height / innerHeight,
        scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth,
        closeTop: close.top, closeRight: close.right, right: rect.right,
        blur: getComputedStyle(document.querySelector('.ap-overlay')!).backdropFilter,
      };
    });
    const ratio = width <= 700 ? .9 : .8;
    expect(geometry.width).toBeGreaterThan(ratio - .025);
    expect(geometry.width).toBeLessThan(ratio + .025);
    expect(geometry.height).toBeGreaterThan(ratio - .025);
    expect(geometry.height).toBeLessThan(ratio + .025);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.blur).toContain('blur');
    const balanceLayout = await entries.first().locator('.ap-balance').evaluate(cell => {
      const number = cell.querySelector('.ap-num')!.getBoundingClientRect();
      const unit = cell.querySelector('.ap-unit')!.getBoundingClientRect();
      const bounds = cell.getBoundingClientRect();
      return {
        stacked: unit.top >= number.bottom,
        fits: unit.right <= bounds.right && number.right <= bounds.right,
        fontSize: parseFloat(getComputedStyle(cell.querySelector('.ap-num')!).fontSize),
      };
    });
    expect(balanceLayout.stacked).toBe(true);
    expect(balanceLayout.fits).toBe(true);
    expect(balanceLayout.fontSize).toBeGreaterThanOrEqual(width < 1100 ? 18 : 14);
    await page.getByTestId(`armorproof-copy-${addr(1)}`).click();
    await expect(dialog.getByText('Copied', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(key(1));
    await page.getByTestId(`armorproof-toggle-${addr(1)}`).click();
    await expect(page.getByTestId(`armorproof-toggle-${addr(1)}`)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId(`armorproof-key-${addr(1)}`)).toBeVisible();
    await expect(dialog.getByText(addr(201), { exact: true })).toBeVisible();
    expect(await page.getByTestId('armorproof-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.getByTestId('armorproof-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
    const after = await page.getByTestId('armorproof-close').boundingBox();
    expect(Math.abs(after!.y - geometry.closeTop)).toBeLessThan(2);
    expect(await page.getByTestId('armorproof-close').evaluate(el => {
      const r = el.getBoundingClientRect();
      return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-testid="armorproof-close"]');
    })).toBe(true);
    await page.getByTestId('armorproof-scroll').evaluate(el => { el.scrollTop = 0; });
    if (width === 390 || width === 1280) await page.screenshot({
      path: `../../generated-artifacts/armorproof-${width}.png`,
    });
    await page.getByTestId('armorproof-close').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('armorproof-trigger')).toBeFocused();
  });
}

test('balances refresh and newly published creators appear after 100 seconds, polling stops on close', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-16T10:00:00Z') });
  let calls = 0;
  await page.route('**/api/armorproof', route => {
    calls++;
    return route.fulfill({ json: directory(calls) });
  });
  await page.goto('/');
  await page.getByTestId('armorproof-trigger').click();
  await expect(page.getByTestId('armorproof-table').locator('.ap-list > .ap-card')).toHaveCount(1);
  await page.clock.fastForward(100_001);
  await expect(page.getByTestId('armorproof-table').locator('.ap-list > .ap-card')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('armorproof-dialog')).toBeHidden();
  const before = calls;
  await page.clock.fastForward(200_001);
  expect(calls).toBe(before);
});

test('partial reads are unknown, zero stays zero and network breakdown is real response data', async ({ page }) => {
  const multi = {
    ...creator(1), availableJailEthWei: null, balanceStatus: 'partial',
    vaults: [creator(1).vaults[0], { ...creator(2).vaults[0], chainId: 4663, availableJailEthWei: null }],
  };
  await page.route('**/api/armorproof', route => route.fulfill({
    json: { ...directory(0), items: [creator(3, '0'), multi] },
  }));
  await page.goto('/');
  await page.getByTestId('armorproof-trigger').click();
  const rows = page.getByTestId('armorproof-table').locator('.ap-list > .ap-card');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.ap-balance .ap-num')).toHaveText('0');
  await expect(rows.last()).toContainText('Total unavailable');
  await expect(rows.last()).toContainText('Robinhood');
  await expect(rows.last().locator('.ap-balance .ap-bal')).toHaveText('Unavailable');
  await page.getByTestId(`armorproof-toggle-${addr(1)}`).click();
  await expect(rows.last().locator('.ap-vlist > li')).toHaveCount(2);
  await expect(rows.last().locator('.ap-vlist > li').last()).toContainText('Unavailable');
});

test('error can retry, clipboard failure stays selectable and Escape restores focus', async ({ page }) => {
  let failing = true;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async () => { throw new Error('Denied'); },
    } });
    document.execCommand = () => false;
  });
  await page.route('**/api/armorproof', route => route.fulfill(
    failing ? { status: 503, json: { error: 'Temporarily unavailable' } } : { json: directory(1) }));
  await page.goto('/');
  await page.getByTestId('armorproof-trigger').click();
  await expect(page.getByTestId('armorproof-retry')).toBeVisible();
  failing = false;
  await page.getByTestId('armorproof-retry').click();
  await page.getByTestId(`armorproof-copy-${addr(1)}`).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copy failed' })).toBeVisible();
  await expect(page.getByTestId(`armorproof-key-${addr(1)}`)).toHaveCSS('user-select', 'all');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('armorproof-trigger')).toBeFocused();
});

test('empty directory is explicit rather than fake zero-balance rows', async ({ page }) => {
  await page.route('**/api/armorproof', route => route.fulfill({ json: directory(0) }));
  await page.goto('/');
  await page.getByTestId('armorproof-trigger').click();
  await expect(page.getByText('No completed public creators are listed yet.')).toBeVisible();
  await expect(page.getByTestId('armorproof-table')).toHaveCount(0);
});

test('JailETH display truncates to four decimals but preserves exact amounts', async ({ page }) => {
  await page.route('**/api/armorproof', route => route.fulfill({
    json: { ...directory(0), items: [
      creator(1, '1628198282928200'),
      creator(2, '1699999999999999'),
      creator(3, '1'),
      creator(4, '0'),
    ] },
  }));
  await page.goto('/');
  await page.getByTestId('armorproof-trigger').click();
  const rows = page.getByTestId('armorproof-table').locator('.ap-list > .ap-card');
  await expect(rows.locator('.ap-balance .ap-num')).toHaveText(['0.0016', '0.0016', '<0.0001', '0']);
  await expect(rows.first().locator('.ap-balance .ap-bal')).toHaveAttribute('title', '0.0016281982829282 JailETH');
});

test('desktop copy failure expands the full selectable key without duplicating controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async () => { throw new Error('Denied'); },
    } });
    document.execCommand = () => false;
  });
  await page.route('**/api/armorproof', route => route.fulfill({ json: directory(1) }));
  await page.goto('/');
  await page.getByTestId('armorproof-trigger').click();
  const keyElement = page.getByTestId(`armorproof-key-${addr(1)}`);
  await expect(keyElement).toBeHidden();
  await expect(page.getByTestId(`armorproof-copy-${addr(1)}`)).toHaveCount(1);
  await page.getByTestId(`armorproof-copy-${addr(1)}`).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copy failed' })).toBeVisible();
  await expect(keyElement).toBeVisible();
  await expect(keyElement).toHaveText(key(1));
  await expect(keyElement).toHaveCSS('user-select', 'all');
  await expect(page.getByTestId(`armorproof-toggle-${addr(1)}`)).toHaveAttribute('aria-expanded', 'true');
});
