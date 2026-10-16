import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explorerAmount, explorerStatus, explorerUtc, layerZeroScanTransactionUrl, explorerStages } from './bridge-explorer-format.ts';

test('LayerZero Scan links use each transfer source transaction hash', () => {
  const hash = '0xa4fa23d3ec94244f14cbe8a1d23b331376a3a34e78b70322eaafc58cacdeea56';
  assert.equal(layerZeroScanTransactionUrl(hash), `https://layerzeroscan.com/tx/${hash}`);
  const anotherHash = `0x${'b'.repeat(64)}`;
  assert.equal(layerZeroScanTransactionUrl(anotherHash), `https://layerzeroscan.com/tx/${anotherHash}`);
  assert.notEqual(layerZeroScanTransactionUrl(hash), layerZeroScanTransactionUrl(anotherHash));
});

test('amount formatting preserves large integer precision and distinguishes small balances from zero', () => {
  assert.equal(explorerAmount('283625734554285990641093'), '283,625.734554');
  assert.equal(explorerAmount('999999999999999999999999999999999999'), '999,999,999,999,999,999.999999');
  assert.equal(explorerAmount('1'), '<0.000001');
  assert.equal(explorerAmount('0'), '0');
  assert.equal(explorerAmount('invalid'), 'Unavailable');
});
test('source confirmation and retries never masquerade as delivered or failed', () => {
  const label = (status, hasRetryError = false) => explorerStatus({ status, hasRetryError }).label;
  assert.equal(label('source-pending-finality'), 'Awaiting confirmations');
  assert.equal(label('source-finalized'), 'Pending delivery');
  assert.equal(label('source-finalized', true), 'Retrying');
  assert.equal(label('delivered', true), 'Delivered');
  assert.equal(label('failed'), 'Failed');
  assert.match(label('unrecognized'), /Unknown state/);
});
test('timestamps use UTC regardless of the input offset', () => {
  assert.equal(explorerUtc('2026-10-15T22:43:11+07:00'), '2026-10-15 15:43 UTC');
  assert.equal(explorerUtc('invalid'), 'Unavailable');
});

test('confirmed source transactions remain visible with finality and destination still pending', () => {
  const stages = explorerStages({ sourceChainId: 1, destinationChainId: 4663, status: 'source-pending-finality', hasRetryError: false });
  assert.deepEqual(stages.map(stage => [stage.label, stage.status]), [
    ['Ethereum transaction', 'Confirmed'], ['Source confirmations', 'Waiting'],
    ['LayerZero verification', 'Waiting'], ['Robinhood delivery', 'Pending'],
  ]);
});
test('DVN verification never implies delivery and reverse-direction labels use the actual chain', () => {
  const base = { sourceChainId: 4663, destinationChainId: 1, status: 'source-finalized', hasRetryError: false };
  assert.deepEqual(explorerStages(base).map(s => s.status), ['Confirmed', 'Confirmed', 'Waiting', 'Pending']);
  const verified = explorerStages({ ...base, verificationConfirmedAt: '2026-10-15T18:00:00Z' });
  assert.deepEqual(verified.map(s => s.status), ['Confirmed', 'Confirmed', 'Verified', 'Pending']);
  assert.equal(verified[0].label, 'Robinhood transaction');
  assert.equal(verified[3].label, 'Ethereum delivery');
  assert.deepEqual(explorerStages({ ...base, status: 'delivered' }).map(s => s.status), ['Confirmed', 'Confirmed', 'Verified', 'Delivered']);
});
