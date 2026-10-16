import assert from "node:assert/strict";
import test from "node:test";
import {
  clearCompletedLaunchDraft,
  clearLocalLaunchDrafts,
  getLaunchDraftStorageKey,
  hasSavedLaunchDraft,
  readLaunchDraftStorageValue,
} from "./launch-draft-storage.ts";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    values,
  };
}

test("each launch mode gets a distinct local draft and id key", () => {
  const modes = ["pons-v2", "ethereum", "multichain"];
  const draftKeys = modes.map((mode) => getLaunchDraftStorageKey(mode, "draft"));
  const idKeys = modes.map((mode) => getLaunchDraftStorageKey(mode, "id"));
  assert.equal(new Set(draftKeys).size, modes.length);
  assert.equal(new Set(idKeys).size, modes.length);
});

test("an older shared draft can still be continued in Multichain", () => {
  const storage = createStorage({
    "armoreum.launch-draft.v2": JSON.stringify({ name: "Old token", symbol: "OLD" }),
    "armoreum.launch-draft-id.v2": "019fce5f-b419-4611-b514-393c89aab2c6",
  });
  assert.equal(hasSavedLaunchDraft(storage, "multichain"), true);
  assert.equal(readLaunchDraftStorageValue(storage, "multichain", "id"), "019fce5f-b419-4611-b514-393c89aab2c6");
});

test("starting fresh removes all current and legacy local launch drafts", () => {
  const storage = createStorage({
    "armoreum.launch-draft.v2": "pons",
    "armoreum.launch-draft-id.v2": "pons-id",
    "armoreum.launch-draft.v2.ethereum": "ethereum",
    "armoreum.launch-draft-id.v2.ethereum": "ethereum-id",
    "armoreum.launch-draft.v2.multichain": "multichain",
    "armoreum.launch-draft-id.v2.multichain": "multichain-id",
    "bulletproof.launch-draft.v2": "legacy",
    "bulletproof.launch-draft-id.v2": "legacy-id",
    "armoreum.multichain-initial-buy.v1": "0.05",
  });
  clearLocalLaunchDrafts(storage);
  assert.equal(storage.values.size, 1);
  assert.equal(storage.getItem("armoreum.multichain-initial-buy.v1"), "0.05");
});

test("malformed or empty local values do not open the saved-draft prompt", () => {
  const storage = createStorage({
    "armoreum.launch-draft.v2.ethereum": "{bad json",
    "armoreum.launch-draft-id.v2.ethereum": "not-a-draft-id",
  });
  assert.equal(hasSavedLaunchDraft(storage, "ethereum"), false);
  assert.equal(hasSavedLaunchDraft(createStorage(), "ethereum", "not-a-draft-id"), false);
});

test("QRC completion clears only the matching launch draft and keeps other modes", () => {
  const completedId = "019fce5f-b419-4611-b514-393c89aab2c6";
  const otherId = "019fce5f-b419-4611-b514-393c89aab2c7";
  const storage = createStorage({
    "armoreum.launch-draft.v2.ethereum": JSON.stringify({ name: "Finished", symbol: "DONE" }),
    "armoreum.launch-draft-id.v2.ethereum": completedId,
    "armoreum.launch-draft.v2": JSON.stringify({ name: "Unfinished", symbol: "WAIT" }),
    "armoreum.launch-draft-id.v2": otherId,
  });
  assert.equal(clearCompletedLaunchDraft(storage, "ethereum", completedId), true);
  assert.equal(storage.getItem("armoreum.launch-draft-id.v2.ethereum"), null);
  assert.equal(storage.getItem("armoreum.launch-draft.v2.ethereum"), null);
  assert.equal(hasSavedLaunchDraft(storage, "ethereum"), false);
  assert.equal(storage.getItem("armoreum.launch-draft-id.v2"), otherId);
  assert.notEqual(storage.getItem("armoreum.launch-draft.v2"), null);
});

test("QRC completion cannot replace a newer active draft in the same mode", () => {
  const completedId = "019fce5f-b419-4611-b514-393c89aab2c6";
  const newerId = "019fce5f-b419-4611-b514-393c89aab2c7";
  const storage = createStorage({
    "armoreum.launch-draft-id.v2.multichain": newerId,
    "armoreum.launch-draft.v2.multichain": "newer-funded-draft",
  });
  assert.equal(clearCompletedLaunchDraft(storage, "multichain", completedId), false);
  assert.equal(storage.getItem("armoreum.launch-draft-id.v2.multichain"), newerId);
  assert.equal(storage.getItem("armoreum.launch-draft.v2.multichain"), "newer-funded-draft");
});

test("QRC completion fails explicitly when browser storage is blocked", () => {
  const blocked = { getItem() { throw new Error("Storage blocked"); }, removeItem() { throw new Error("Storage blocked"); } };
  assert.equal(clearCompletedLaunchDraft(blocked, "ethereum", "019fce5f-b419-4611-b514-393c89aab2c6"), false);
});

for (const mode of ["pons-v2", "ethereum", "multichain"]) {
  test(`${mode} QRC cleanup removes the completed form but preserves another funded mode`, () => {
    const id = "019fce5f-b419-4611-b514-393c89aab2c6";
    const other = mode === "ethereum" ? "multichain" : "ethereum";
    const key = (field) => getLaunchDraftStorageKey(mode, field);
    const otherKey = (field) => getLaunchDraftStorageKey(other, field);
    const storage = createStorage({
      [key("id")]: id, [key("draft")]: "completed",
      [otherKey("id")]: "019fce5f-b419-4611-b514-393c89aab2c7",
      [otherKey("draft")]: "funded",
    });
    assert.equal(clearCompletedLaunchDraft(storage, mode, id), true);
    assert.equal(storage.getItem(key("id")), null);
    assert.equal(storage.getItem(key("draft")), null);
    assert.equal(storage.getItem(otherKey("draft")), "funded");
  });
}
