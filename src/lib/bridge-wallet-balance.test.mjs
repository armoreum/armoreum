import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseUnits } from 'ethers';
import { bridgeBalanceAmount, readBridgeTokenBalance } from './bridge-wallet-balance.ts';
const account = '0x1111111111111111111111111111111111111111';
const ethereumToken = '0x2222222222222222222222222222222222222222';
const robinhoodToken = '0x3333333333333333333333333333333333333333';

test('50% and Max preserve every base unit without floating point', () => {
  const raw = 987654321012345678900000001n;
  assert.equal(parseUnits(bridgeBalanceAmount(raw, 50), 18), raw / 2n);
  assert.equal(parseUnits(bridgeBalanceAmount(raw, 100), 18), raw);
  assert.equal(bridgeBalanceAmount(1n, 50), '0.0');
  assert.equal(bridgeBalanceAmount(1n, 100), '0.000000000000000001');
  assert.equal(bridgeBalanceAmount(0n, 100), '0.0');
  assert.throws(() => bridgeBalanceAmount(-1n, 50));
});

test('uses the same-origin Alchemy backend for the selected token/account on both chains', async () => {
  for (const [chainId, token] of [[1, ethereumToken], [4663, robinhoodToken]]) {
    const raw = 987654321012345678900000001n;
    const fetcher = async (url, options) => {
      assert.equal(url, `/api/bridge-token-balances/${chainId}/${token}/${account}`);
      assert.equal(options.cache, 'no-store');
      assert.equal(options.method, undefined); // GET, not wallet JSON-RPC.
      return Response.json({ chainId, token, account, decimals: 18, balance: raw.toString() });
    };
    assert.equal(await readBridgeTokenBalance(chainId, token, account, fetcher), raw);
  }
});

test('rejects a mismatched chain, token, account, decimals or malformed amount', async () => {
  const good = { chainId: 1, token: ethereumToken, account, balance: '42', decimals: 18 };
  for (const bad of [{ chainId: 4663 }, { token: robinhoodToken }, { account: ethereumToken }, { decimals: 6 }, { balance: '-1' }]) {
    await assert.rejects(readBridgeTokenBalance(1, ethereumToken, account, async () =>
      Response.json({ ...good, ...bad })), /mismatched/);
  }
});

test('failures remain errors, while a verified zero balance is accepted', async () => {
  await assert.rejects(readBridgeTokenBalance(1, ethereumToken, account, async () =>
    Response.json({ error: 'Alchemy unavailable' }, { status: 503 })), /Could not read/);
  await assert.rejects(readBridgeTokenBalance(1, ethereumToken, account, async () => {
    throw new Error('Network unavailable');
  }), /Network unavailable/);
  assert.equal(await readBridgeTokenBalance(1, ethereumToken, account, async () =>
    Response.json({ chainId: 1, token: ethereumToken, account, decimals: 18, balance: '0' })), 0n);
  await assert.rejects(readBridgeTokenBalance(999, ethereumToken, account), /supported network/);
});
