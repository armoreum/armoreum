import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bridgeWalletErrorMessage } from './bridge-wallet-errors.ts';

test('Phantom internal error is extracted from ethers wrapper without dumping calldata', () => {
  const error = Object.assign(new Error('could not coalesce error (payload=private-rpc-details)'), {
    code: 'UNKNOWN_ERROR', info: { error: { code: -32603, message: 'Unexpected error' } },
  });
  const message = bridgeWalletErrorMessage(error, 'transfer');
  assert.match(message, /RPC -32603/);
  assert.match(message, /No transaction hash was returned/);
  assert.match(message, /Check wallet activity before retrying/);
  assert.doesNotMatch(message, /payload|private-rpc-details/);
  assert.match(bridgeWalletErrorMessage(error, 'approval'), /token approval/);
  assert.match(bridgeWalletErrorMessage(error, 'preflight'), /checking this transfer/);
});

test('returned hash takes precedence over provider errors and prevents unsafe retry guidance', () => {
  assert.match(bridgeWalletErrorMessage({ code: -32603 }, 'confirmation', '0x123'), /Check the transaction below before sending again/);
  assert.doesNotMatch(bridgeWalletErrorMessage({ code: -32603 }, 'confirmation', '0x123'), /No transaction hash/);
});

test('cancelled, pending and insufficient-gas requests get distinct feedback', () => {
  assert.match(bridgeWalletErrorMessage({ code: 4001 }, 'approval'), /approval was cancelled/);
  assert.match(bridgeWalletErrorMessage({ code: 'ACTION_REJECTED' }, 'transfer'), /cancelled/);
  assert.match(bridgeWalletErrorMessage({ error: { code: -32002 } }, 'transfer'), /already open/);
  assert.match(bridgeWalletErrorMessage({ code: 'INSUFFICIENT_FUNDS' }, 'transfer'), /native ETH/);
});

test('business errors remain readable; cyclic and huge provider errors stay bounded', () => {
  assert.equal(bridgeWalletErrorMessage(new Error('Destination reserve changed.'), 'preflight'), 'Destination reserve changed.');
  const cyclic = { code: -32603 }; cyclic.cause = cyclic;
  assert.match(bridgeWalletErrorMessage(cyclic, 'transfer'), /RPC -32603/);
  assert.ok(bridgeWalletErrorMessage(new Error('x'.repeat(10000)), 'transfer').length < 320);
});
