import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeSubmissionQueue } from './bridge-submission-queue.ts';

const input = { launchDraftId: '11111111-2222-3333-4444-555555555555', sourceChainId: 1, transactionHash: `0x${'a'.repeat(64)}` };
const store = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('a failed registration survives reload and retries only its existing hash', async () => {
  const storage = store();
  const first = createBridgeSubmissionQueue(storage, async () => { throw new Error('offline'); });
  assert.equal(await first.track(input), false);
  const sent = [];
  const reloaded = createBridgeSubmissionQueue(storage, async data => { sent.push(data); });
  assert.deepEqual(await reloaded.retry(), [true]);
  assert.deepEqual(sent, [input]);
  assert.deepEqual(await reloaded.retry(), []);
});
test('concurrent registrations deduplicate without mixing source networks', async () => {
  const sent = [];
  const queue = createBridgeSubmissionQueue(store(), async data => { sent.push(data); });
  assert.deepEqual(await Promise.all([queue.track(input), queue.track(input)]), [true, true]);
  assert.equal(sent.length, 1);
  await queue.track({ ...input, sourceChainId: 4663 });
  assert.equal(sent.length, 2);
});
test('synchronous failures and blocked storage never strand a hash or rebroadcast a wallet transaction', async () => {
  let calls = 0;
  const blocked = { getItem() { throw new Error(); }, setItem() { throw new Error(); } };
  const queue = createBridgeSubmissionQueue(blocked, () => {
    if (++calls === 1) throw new Error('temporary');
    return Promise.resolve();
  });
  assert.equal(await queue.track(input), false);
  assert.deepEqual(await queue.retry(), [true]);
  assert.equal(calls, 2);
});
test('malformed persisted records are not sent to the backend', async () => {
  const storage = store();
  storage.setItem('armoreum.bridge.pending-submissions', JSON.stringify([
    { ...input, sourceChainId: 31337 }, { ...input, transactionHash: 'invalid' }, null, input,
  ]));
  const sent = [];
  await createBridgeSubmissionQueue(storage, async data => { sent.push(data); }).retry();
  assert.deepEqual(sent, [input]);
});
