import test from 'node:test';
import assert from 'node:assert/strict';
import { withAlchemyReads, requireNativeGas } from '../src/lib/alchemy-rpc';

test('application reads use Alchemy while signing, accounts and network authority stay in the wallet', async () => {
  let chainId = '0x1';
  const walletCalls: string[] = [], alchemyCalls: { chain: number; method: string }[] = [];
  const wallet = {
    request: async ({ method }: { method: string; params?: unknown[] }) => {
      walletCalls.push(method);
      if (method === 'eth_chainId') return chainId;
      if (method === 'eth_accounts') return ['0xcreator'];
      if (method === 'eth_sendTransaction') return '0xhash';
      if (method.startsWith('eth_signTypedData')) return '0xsignature';
      throw new Error(`Unexpected wallet RPC ${method}`);
    },
    on() { return this; },
  };
  const wrapped = withAlchemyReads(wallet, chain => ({
    send: async (method: string) => { alchemyCalls.push({ chain, method }); return '0x123'; },
  }));
  for (const method of ['eth_getBalance', 'eth_call', 'eth_estimateGas', 'eth_gasPrice', 'eth_getTransactionReceipt', 'eth_getTransactionByHash']) {
    assert.equal(await wrapped.request({ method }), '0x123');
  }
  assert.ok(alchemyCalls.every(call => call.chain === 1));
  assert.ok(walletCalls.every(method => method === 'eth_chainId'));
  chainId = '0x1237';
  await wrapped.request({ method: 'eth_getBalance' });
  assert.equal(alchemyCalls.at(-1)?.chain, 4663);
  assert.deepEqual(await wrapped.request({ method: 'eth_accounts' }), ['0xcreator']);
  assert.equal(await wrapped.request({ method: 'eth_sendTransaction', params: [] }), '0xhash');
  assert.equal(await wrapped.request({ method: 'eth_signTypedData_v4', params: [] }), '0xsignature');
  assert.equal(wrapped.on(), wallet);
});
test('Alchemy failure is explicit and never retries via the wallet', async () => {
  const calls: string[] = [];
  const wrapped = withAlchemyReads({
    request: async ({ method }) => { calls.push(method); return '0x1'; },
  }, () => ({ send: async () => { throw new Error('Alchemy unavailable'); } }));
  await assert.rejects(wrapped.request({ method: 'eth_call', params: [] }), /Alchemy unavailable/);
  assert.deepEqual(calls, ['eth_chainId']);
});
test('frozen injected providers can be wrapped without mutating the wallet', async () => {
  const wallet = Object.freeze({ request: async (_args?: { method: string; params?: unknown[] }) => '0x1' });
  const wrapped = withAlchemyReads(wallet, () => ({ send: async () => '0xbeef' }));
  assert.equal(await wrapped.request({ method: 'eth_getBalance' }), '0xbeef');
  assert.equal('request' in wrapped, true);
  assert.equal(await wallet.request(), '0x1');
});
test('native-gas preflight includes both the fee cap and transaction value', async () => {
  const gas = { gasLimit: 50n, maxFeePerGas: 2n };
  await assert.rejects(requireNativeGas({ getBalance: async () => 0n }, '0xwallet', gas), /native ETH/);
  await assert.rejects(requireNativeGas({ getBalance: async () => 109n }, '0xwallet', gas, 10n), /native ETH/);
  await requireNativeGas({ getBalance: async () => 110n }, '0xwallet', gas, 10n);
});
