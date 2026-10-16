import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readLayerZeroScanStatus } from './layerzero-scan.ts';
const hash = `0x${'a'.repeat(64)}`;
const source = `0x${'1'.repeat(40)}`;
const destination = `0x${'2'.repeat(40)}`;
const message = name => ({
  source: { tx: { txHash: hash } },
  pathway: { sender: { address: source }, receiver: { address: destination } },
  status: { name },
});

test('uses documented tx endpoint and preserves multiple message statuses', async () => {
  const result = await readLayerZeroScanStatus(hash, source, destination, async (url, options) => {
    assert.equal(url, `https://scan.layerzero-api.com/v1/messages/tx/${hash}`);
    assert.equal(options.credentials, 'omit');
    return Response.json({ data: [message('DELIVERED'), message('CONFIRMING')] });
  });
  assert.deepEqual(result, { state: 'indexed', statuses: ['Delivered', 'Confirming'] });
});

test('never attributes a different tx or OApp route to this transfer', async () => {
  const wrongTx = message('DELIVERED');
  wrongTx.source.tx.txHash = `0x${'b'.repeat(64)}`;
  const wrongRoute = message('DELIVERED');
  wrongRoute.pathway.receiver.address = source;
  const result = await readLayerZeroScanStatus(hash, source, destination, async () =>
    Response.json({ data: [wrongTx, wrongRoute] }));
  assert.equal(result.state, 'not-indexed');
});

test('documented message-not-found is distinct from downtime, rate limits and malformed data', async () => {
  assert.equal((await readLayerZeroScanStatus(hash, source, destination, async () =>
    Response.json({ code: 4040 }, { status: 404 }))).state, 'not-indexed');
  for (const response of [Response.json({}, { status: 429 }), Response.json({}), new Response('bad gateway', { status: 502 })]) {
    assert.equal((await readLayerZeroScanStatus(hash, source, destination, async () => response)).state, 'unavailable');
  }
  assert.equal((await readLayerZeroScanStatus(hash, source, destination, async () => { throw new Error('offline'); })).state, 'unavailable');
});
