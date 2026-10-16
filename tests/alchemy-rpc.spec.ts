import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let rpcModule = '';
test.beforeAll(() => {
  // The test server is a production preview, not Vite's source-module server.
  execFileSync('pnpm', ['--filter', '@workspace/api-server', 'exec', 'esbuild',
    '../armoreum/src/lib/alchemy-rpc.ts', '--bundle', '--platform=browser', '--format=esm',
    '--outfile=../../generated-artifacts/alchemy-browser-module.mjs'], { stdio: 'pipe' });
  rpcModule = readFileSync(new URL('../../../generated-artifacts/alchemy-browser-module.mjs', import.meta.url), 'utf8');
});

test('browser routes wallet-assisted reads to Alchemy and keeps signing in the wallet', async ({ page }) => {
  const calls: { chain: string; method: string }[] = [];
  await page.route('**/__test/alchemy-rpc.js', route => route.fulfill({ contentType: 'text/javascript', body: rpcModule }));
  await page.route('**/api/evm-rpc/*', async route => {
    const body = route.request().postDataJSON();
    const chain = route.request().url().split('/').at(-1)!;
    calls.push({ chain, method: body.method });
    await route.fulfill({ json: { jsonrpc: '2.0', id: body.id, result: '0x123' } });
  });
  await page.goto('/bridge');
  const result = await page.evaluate(async () => {
    const { withAlchemyReads, alchemyGatewayUrl } = await import('/__test/alchemy-rpc.js');
    let chain = '0x1';
    const walletCalls: string[] = [];
    const wallet = Object.freeze({
      request: async ({ method }: { method: string; params?: unknown[] }) => {
        walletCalls.push(method);
        if (method === 'eth_chainId') return chain;
        if (method === 'eth_sendTransaction') return `0x${'a'.repeat(64)}`;
        throw new Error(`Read escaped to wallet: ${method}`);
      },
    });
    const wrapped = withAlchemyReads(wallet);
    const ethereum = await wrapped.request({ method: 'eth_getBalance', params: [`0x${'1'.repeat(40)}`, 'latest'] });
    chain = '0x1237';
    const robinhood = await wrapped.request({ method: 'eth_getTransactionReceipt', params: [`0x${'b'.repeat(64)}`] });
    const hash = await wrapped.request({ method: 'eth_sendTransaction', params: [] });
    return { ethereum, robinhood, hash, walletCalls, rpcUrl: alchemyGatewayUrl(4663) };
  });
  expect(result.ethereum).toBe('0x123');
  expect(result.robinhood).toBe('0x123');
  expect(result.hash).toMatch(/^0xa{64}$/);
  expect(result.walletCalls).toEqual(['eth_chainId', 'eth_chainId', 'eth_sendTransaction']);
  expect(new URL(result.rpcUrl).pathname).toBe('/api/evm-rpc/4663');
  expect(result.rpcUrl).not.toContain('alchemy.com');
  expect(calls).toEqual([{ chain: '1', method: 'eth_getBalance' }, { chain: '4663', method: 'eth_getTransactionReceipt' }]);
});
